import assert from "node:assert/strict";
import test from "node:test";
import { NvidiaError, type ExtractedItem } from "../src/ai.js";
import {
  getPlannerItem,
  getSourceMessage,
  insertSourceMessage,
  openPlannerDatabase,
} from "../src/db.js";
import { processSourceMessage } from "../src/extraction.js";

const key = { groupId: "group-1", messageId: "message-1" };
const now = "2026-11-07T03:30:00.000Z";

const assignment: ExtractedItem = {
  kind: "assignment",
  title: "Data Structures assignment 2",
  details: "submit",
  course: "Data Structures",
  location: null,
  due_date: "2026-11-10",
  due_time: null,
  class_date: null,
  class_time: null,
  change_type: null,
  change_details: null,
  zoom_url: null,
  ambiguous_fields: [],
  field_evidence: { kind: [{ quote: "assignment" }] },
};

function seed(db: ReturnType<typeof openPlannerDatabase>): void {
  insertSourceMessage(db, {
    ...key,
    senderId: "lecturer-1",
    sentAt: now,
    rawText: "synthetic source text",
  });
}

test("extraction is disabled by default and leaves the source untouched", async () => {
  const db = openPlannerDatabase(":memory:");
  try {
    seed(db);
    await assert.rejects(
      processSourceMessage(db, key, async () => ({ items: [assignment] }), { enabled: false, now }),
      /Extraction is disabled/,
    );
    assert.equal(getSourceMessage(db, key)?.extractionState, "received");
  } finally {
    db.close();
  }
});

test("persists a clear assignment, confirms it, and schedules reminders", async () => {
  const db = openPlannerDatabase(":memory:");
  try {
    seed(db);
    const result = await processSourceMessage(db, key, async () => ({ items: [assignment] }), { enabled: true, now });
    assert.equal(result.pending, false);
    assert.equal(result.source.extractionState, "confirmed");
    assert.equal(result.itemIds.length, 1);
    assert.equal(getPlannerItem(db, result.itemIds[0]!)?.status, "confirmed");
    const reminders = db.prepare("SELECT COUNT(*) AS count FROM reminder_deliveries WHERE item_id = ?")
      .get(result.itemIds[0]!) as { count: number };
    assert.equal(reminders.count, 2);
  } finally {
    db.close();
  }
});

test("keeps a class missing a start time pending with an open clarification", async () => {
  const db = openPlannerDatabase(":memory:");
  try {
    seed(db);
    const lecture: ExtractedItem = {
      ...assignment,
      kind: "class",
      title: "Online lecture",
      details: null,
      course: null,
      due_date: null,
      class_date: "2026-11-10",
      class_time: null,
      ambiguous_fields: ["class_time"],
    };
    const result = await processSourceMessage(db, key, async () => ({ items: [lecture] }), { enabled: true, now });
    assert.equal(result.pending, true);
    assert.equal(result.source.extractionState, "pending_review");
    assert.equal(getPlannerItem(db, result.itemIds[0]!)?.status, "pending");
    const clarification = db.prepare("SELECT state, requested_fields FROM clarifications WHERE item_id = ?")
      .get(result.itemIds[0]!) as { state: string; requested_fields: string };
    assert.equal(clarification.state, "open");
    assert.deepEqual(JSON.parse(clarification.requested_fields), ["class_time"]);
  } finally {
    db.close();
  }
});

test("records a failed extraction and retains the source", async () => {
  const db = openPlannerDatabase(":memory:");
  try {
    seed(db);
    await assert.rejects(
      processSourceMessage(db, key, async () => {
        throw new NvidiaError("rate_limit", "test rate limit");
      }, { enabled: true, now }),
      /test rate limit/,
    );
    const source = getSourceMessage(db, key);
    assert.equal(source?.extractionState, "failed");
    assert.equal(source?.failureCode, "rate_limit");
    assert.equal(source?.rawText, "synthetic source text");
    const items = db.prepare("SELECT COUNT(*) AS count FROM planner_items").get() as { count: number };
    assert.equal(items.count, 0);
  } finally {
    db.close();
  }
});

test("confirms a source with no announcements without creating items", async () => {
  const db = openPlannerDatabase(":memory:");
  try {
    seed(db);
    const result = await processSourceMessage(db, key, async () => ({ items: [] }), { enabled: true, now });
    assert.equal(result.pending, false);
    assert.equal(result.source.extractionState, "confirmed");
    assert.equal(result.itemIds.length, 0);
    const items = db.prepare("SELECT COUNT(*) AS count FROM planner_items").get() as { count: number };
    assert.equal(items.count, 0);
  } finally {
    db.close();
  }
});
