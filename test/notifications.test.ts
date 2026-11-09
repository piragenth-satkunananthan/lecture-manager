import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlannerItem,
  insertSourceMessage,
  openPlannerDatabase,
  type NewPlannerItem,
} from "../src/db.js";
import { confirmPlannerItem } from "../src/planner.js";
import { ensureReminderSchedule } from "../src/reminders.js";
import {
  createSmtpTransport,
  deliverDueReminders,
  type MailTransport,
  type OutgoingMail,
} from "../src/notifications.js";

const baseItem: Omit<NewPlannerItem, "sourceGroupId" | "sourceMessageId"> = {
  kind: "assignment",
  title: "Data Structures assignment 2",
  details: "submit",
  course: "Data Structures",
  location: null,
  dueDate: "2026-11-10",
  dueTime: null,
  classDate: null,
  classTime: null,
  changeType: null,
  changeDetails: null,
  zoomUrl: null,
  ambiguousFields: [],
  fieldEvidence: { kind: [{ quote: "assignment" }] },
};

function seed(
  db: ReturnType<typeof openPlannerDatabase>,
  messageId: string,
  overrides: Partial<NewPlannerItem> = {},
): number {
  insertSourceMessage(db, {
    groupId: "group-1",
    messageId,
    senderId: "lecturer-1",
    sentAt: "2026-11-07T03:30:00.000Z",
    rawText: "synthetic source text that must not be emailed",
  });
  return createPlannerItem(db, {
    ...baseItem,
    sourceGroupId: "group-1",
    sourceMessageId: messageId,
    ...overrides,
  });
}

test("builds a mail transport without connecting", () => {
  const transport = createSmtpTransport({
    host: "smtp.example.test",
    port: 587,
    user: "",
    password: "",
    from: "planner@example.test",
    to: "student@example.test",
  });
  assert.equal(typeof transport.sendMail, "function");
});

test("delivers due reminders once and keeps message text and links out of the email", async () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "assignment-1");
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    ensureReminderSchedule(db, itemId, "2026-11-07T03:31:00.000Z");

    const sent: OutgoingMail[] = [];
    const transport: MailTransport = {
      sendMail: async (message) => { sent.push(message); },
    };
    const now = "2026-11-09T03:30:00.000Z";
    const first = await deliverDueReminders(db, transport, {
      from: "planner@example.test",
      to: "student@example.test",
      now,
    });
    assert.deepEqual(first, { delivered: 1, failed: 0 });
    assert.equal(sent.length, 1);
    assert.match(sent[0]!.subject, /assignment due tomorrow/);
    assert.match(sent[0]!.text, /Data Structures assignment 2/);
    assert.doesNotMatch(sent[0]!.text, /synthetic source text/);
    assert.doesNotMatch(sent[0]!.text, /zoom\.us/);

    const second = await deliverDueReminders(db, transport, {
      from: "planner@example.test",
      to: "student@example.test",
      now,
    });
    assert.deepEqual(second, { delivered: 0, failed: 0 });
  } finally {
    db.close();
  }
});

test("retries a failed reminder after backoff and marks it delivered", async () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "assignment-1");
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    ensureReminderSchedule(db, itemId, "2026-11-07T03:31:00.000Z");

    const failing: MailTransport = { sendMail: async () => { throw new Error("SMTP down"); } };
    const now = "2026-11-09T03:30:00.000Z";
    const failed = await deliverDueReminders(db, failing, {
      from: "planner@example.test",
      to: "student@example.test",
      now,
    });
    assert.deepEqual(failed, { delivered: 0, failed: 1 });

    const row = db.prepare(
      "SELECT state, attempt_count, last_error FROM reminder_deliveries WHERE item_id = ?",
    ).get(itemId) as { state: string; attempt_count: number; last_error: string };
    assert.equal(row.state, "failed");
    assert.equal(row.attempt_count, 1);
    assert.equal(row.last_error, "delivery failed");

    const sent: OutgoingMail[] = [];
    const success: MailTransport = { sendMail: async (message) => { sent.push(message); } };
    const retried = await deliverDueReminders(db, success, {
      from: "planner@example.test",
      to: "student@example.test",
      now: "2026-11-09T03:31:00.000Z",
      retryFailedAfterMinutes: 0,
    });
    assert.deepEqual(retried, { delivered: 1, failed: 0 });
    assert.equal(sent.length, 1);
    const delivered = db.prepare(
      "SELECT state, attempt_count FROM reminder_deliveries WHERE item_id = ?",
    ).get(itemId) as { state: string; attempt_count: number };
    assert.equal(delivered.state, "delivered");
    assert.equal(delivered.attempt_count, 2);
  } finally {
    db.close();
  }
});
