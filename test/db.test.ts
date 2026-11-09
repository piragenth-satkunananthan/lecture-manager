import assert from "node:assert/strict";
import test from "node:test";
import {
  createClarification,
  createPlannerItem,
  createReminderDelivery,
  expireRawText,
  getPlannerItem,
  getSourceMessage,
  insertSourceMessage,
  markReminderDelivered,
  openPlannerDatabase,
  transitionExtractionState,
  type NewPlannerItem,
} from "../src/db.js";

const key = { groupId: "group-1", messageId: "message-1" };
const source = {
  ...key,
  senderId: "lecturer-1",
  sentAt: "2026-11-07T03:30:00.000Z",
  rawText: "Data Structures assignment 2: submit by 10 November 2026 at 5:00 PM.",
};

const itemInput: NewPlannerItem = {
  sourceGroupId: key.groupId,
  sourceMessageId: key.messageId,
  kind: "assignment",
  title: "Data Structures assignment 2",
  details: "submit",
  course: "Data Structures",
  location: null,
  dueDate: "2026-11-10",
  dueTime: "17:00",
  classDate: null,
  classTime: null,
  changeType: null,
  changeDetails: null,
  zoomUrl: null,
  ambiguousFields: [],
  fieldEvidence: {
    kind: [{ quote: "assignment" }],
  },
};

test("creates the schema, deduplicates source messages, and keeps provenance", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    assert.equal(insertSourceMessage(db, source, "2026-11-07T03:31:00.000Z"), true);
    assert.equal(insertSourceMessage(db, source, "2026-11-07T03:32:00.000Z"), false);

    const stored = getSourceMessage(db, key);
    assert.ok(stored);
    assert.equal(stored.senderId, source.senderId);
    assert.equal(stored.rawText, source.rawText);
    assert.equal(stored.extractionState, "received");
    assert.equal(stored.attemptCount, 0);
  } finally {
    db.close();
  }
});

test("tracks extraction attempts and failure metadata through legal transitions", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    insertSourceMessage(db, source);

    const extracting = transitionExtractionState(db, key, "extracting", { at: "2026-11-07T03:33:00.000Z" });
    assert.equal(extracting.extractionState, "extracting");
    assert.equal(extracting.attemptCount, 1);
    assert.equal(extracting.lastAttemptAt, "2026-11-07T03:33:00.000Z");

    const failed = transitionExtractionState(db, key, "failed", {
      at: "2026-11-07T03:34:00.000Z",
      failureCode: "rate_limit",
      rawTextExpiresAt: "2026-12-07T03:34:00.000Z",
    });
    assert.equal(failed.extractionState, "failed");
    assert.equal(failed.failureCode, "rate_limit");
    assert.equal(failed.rawText, source.rawText);
    assert.equal(failed.rawTextExpiresAt, "2026-12-07T03:34:00.000Z");

    const retried = transitionExtractionState(db, key, "extracting", { at: "2026-11-07T03:35:00.000Z" });
    assert.equal(retried.attemptCount, 2);

    const failedAgain = transitionExtractionState(db, key, "failed", { at: "2026-11-07T03:35:30.000Z" });
    assert.equal(failedAgain.rawTextExpiresAt, "2026-12-07T03:35:30.000Z");

    const retriedAgain = transitionExtractionState(db, key, "extracting", { at: "2026-11-07T03:35:45.000Z" });
    assert.equal(retriedAgain.attemptCount, 3);

    const confirmed = transitionExtractionState(db, key, "confirmed", { at: "2026-11-07T03:36:00.000Z" });
    assert.equal(confirmed.extractionState, "confirmed");
    assert.equal(confirmed.failureCode, null);
  } finally {
    db.close();
  }
});

test("rejects illegal extraction transitions and clears raw text on expiry", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    insertSourceMessage(db, source);
    assert.throws(
      () => transitionExtractionState(db, key, "confirmed"),
      /Invalid extraction transition from received to confirmed/,
    );

    transitionExtractionState(db, key, "extracting");
    transitionExtractionState(db, key, "pending_review");
    const expired = expireRawText(db, key, "2026-12-07T03:30:00.000Z");
    assert.equal(expired.extractionState, "expired");
    assert.equal(expired.rawText, "");
    assert.equal(expired.rawTextExpiresAt, null);
    assert.equal(expired.senderId, source.senderId);
  } finally {
    db.close();
  }
});

test("stores planner items with parsed evidence and enforces the source foreign key", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    insertSourceMessage(db, source);
    const itemId = createPlannerItem(db, itemInput, "2026-11-07T03:37:00.000Z");
    const item = getPlannerItem(db, itemId);
    assert.ok(item);
    assert.equal(item.kind, "assignment");
    assert.equal(item.status, "pending");
    assert.deepEqual(item.ambiguousFields, []);
    assert.deepEqual(item.fieldEvidence, itemInput.fieldEvidence);
    assert.equal(item.recordingPermission, null);

    assert.throws(
      () => createPlannerItem(db, { ...itemInput, sourceMessageId: "missing" }),
      /FOREIGN KEY constraint failed/,
    );
  } finally {
    db.close();
  }
});

test("creates clarifications and cascades them when the planner item is deleted", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    insertSourceMessage(db, source);
    const itemId = createPlannerItem(db, itemInput);
    const clarificationId = createClarification(db, itemId, {
      question: "What time is it due?",
      requestedFields: ["due_time"],
    });
    assert.ok(clarificationId > 0);
    db.prepare("DELETE FROM planner_items WHERE id = ?").run(itemId);
    const remaining = db.prepare("SELECT COUNT(*) AS count FROM clarifications").get() as { count: number };
    assert.equal(remaining.count, 0);
  } finally {
    db.close();
  }
});

test("deduplicates reminder deliveries and records delivery", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    insertSourceMessage(db, source);
    const itemId = createPlannerItem(db, itemInput);
    const reminder = {
      itemId,
      reminderKind: "assignment_day_before" as const,
      scheduledAt: "2026-11-09T03:30:00.000Z",
    };
    assert.equal(createReminderDelivery(db, reminder, "2026-11-07T03:38:00.000Z"), true);
    assert.equal(createReminderDelivery(db, reminder, "2026-11-07T03:39:00.000Z"), false);

    markReminderDelivered(db, reminder, "2026-11-09T03:30:05.000Z");
    const row = db.prepare(
      "SELECT state, attempt_count FROM reminder_deliveries WHERE item_id = ? AND reminder_kind = ? AND scheduled_at = ?",
    ).get(itemId, reminder.reminderKind, reminder.scheduledAt) as { state: string; attempt_count: number };
    assert.equal(row.state, "delivered");
    assert.equal(row.attempt_count, 1);
  } finally {
    db.close();
  }
});
