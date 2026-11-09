import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlannerItem,
  insertSourceMessage,
  openPlannerDatabase,
  type NewPlannerItem,
} from "../src/db.js";
import {
  buildReminderSchedule,
  ensureReminderSchedule,
  listDueReminders,
  markReminderDeliveredById,
  recordReminderFailure,
} from "../src/reminders.js";
import { cancelPlannerItem, confirmPlannerItem } from "../src/planner.js";

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
    rawText: "synthetic source text",
  });
  return createPlannerItem(db, {
    ...baseItem,
    sourceGroupId: "group-1",
    sourceMessageId: messageId,
    ...overrides,
  });
}

test("builds assignment reminders at 09:00 Sri Lanka time", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "assignment-1");
    const item = confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    assert.deepEqual(buildReminderSchedule(item), [
      { kind: "assignment_day_before", scheduledAt: "2026-11-09T03:30:00.000Z" },
      { kind: "assignment_due", scheduledAt: "2026-11-10T03:30:00.000Z" },
    ]);
  } finally {
    db.close();
  }
});

test("builds class reminders at 09:00 the day before and one hour before", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "class-1", {
      kind: "class",
      classDate: "2026-11-10",
      classTime: "14:00",
      dueDate: null,
      dueTime: null,
      title: "Data Structures lecture",
    });
    const item = confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    assert.deepEqual(buildReminderSchedule(item), [
      { kind: "class_day_before", scheduledAt: "2026-11-09T03:30:00.000Z" },
      { kind: "class_hour_before", scheduledAt: "2026-11-10T07:30:00.000Z" },
    ]);
  } finally {
    db.close();
  }
});

test("creates idempotent reminders and lists only due pending items", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "assignment-1");
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");

    assert.equal(ensureReminderSchedule(db, itemId, "2026-11-07T03:31:00.000Z"), 2);
    assert.equal(ensureReminderSchedule(db, itemId, "2026-11-07T03:32:00.000Z"), 0);

    const due = listDueReminders(db, "2026-11-09T03:30:00.000Z");
    assert.equal(due.length, 1);
    assert.equal(due[0]?.reminderKind, "assignment_day_before");

    markReminderDeliveredById(db, due[0]!.id, "2026-11-09T03:30:05.000Z");
    assert.equal(listDueReminders(db, "2026-11-09T03:30:10.000Z").length, 0);
  } finally {
    db.close();
  }
});

test("suppresses pending reminders when an item is cancelled", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "assignment-1");
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    ensureReminderSchedule(db, itemId, "2026-11-07T03:31:00.000Z");
    cancelPlannerItem(db, itemId, "2026-11-07T03:32:00.000Z");

    assert.equal(ensureReminderSchedule(db, itemId, "2026-11-07T03:33:00.000Z"), 0);
    assert.equal(listDueReminders(db, "2026-11-10T10:00:00.000Z").length, 0);
    const suppressed = db.prepare(
      "SELECT COUNT(*) AS count FROM reminder_deliveries WHERE item_id = ? AND state = 'suppressed'",
    ).get(itemId) as { count: number };
    assert.equal(suppressed.count, 2);
  } finally {
    db.close();
  }
});

test("records reminder delivery failures with attempts", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "assignment-1");
    confirmPlannerItem(db, itemId, "2026-11-07T03:30:00.000Z");
    ensureReminderSchedule(db, itemId, "2026-11-07T03:31:00.000Z");
    const due = listDueReminders(db, "2026-11-10T03:30:00.000Z")[0];
    assert.ok(due);
    recordReminderFailure(db, due.id, "SMTP unavailable", "2026-11-10T03:30:05.000Z");
    const row = db.prepare(
      "SELECT state, attempt_count, last_error FROM reminder_deliveries WHERE id = ?",
    ).get(due.id) as { state: string; attempt_count: number; last_error: string };
    assert.equal(row.state, "failed");
    assert.equal(row.attempt_count, 1);
    assert.equal(row.last_error, "SMTP unavailable");
  } finally {
    db.close();
  }
});
