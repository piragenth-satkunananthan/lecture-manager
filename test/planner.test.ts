import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlannerItem,
  getPlannerItem,
  insertSourceMessage,
  openPlannerDatabase,
  type NewPlannerItem,
} from "../src/db.js";
import {
  applyMessageUpdate,
  applyUserCorrection,
  archivePlannerItem,
  cancelPlannerItem,
  clearUserCorrection,
  confirmPlannerItem,
  findOpenItemForCorrection,
  listPlannerItems,
  openClarification,
  resolveClarification,
} from "../src/planner.js";

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
  messageId = "message-1",
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

test("date-only assignments default to 23:59 Sri Lanka time", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db);
    assert.equal(getPlannerItem(db, itemId)?.dueTime, "23:59");
  } finally {
    db.close();
  }
});

test("confirms future items and moves past assignments to overdue review", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const futureId = seed(db, "future");
    const future = confirmPlannerItem(db, futureId, "2026-11-07T03:30:00.000Z");
    assert.equal(future.status, "confirmed");

    const pastId = seed(db, "past", { dueDate: "2026-11-01" });
    const past = confirmPlannerItem(db, pastId, "2026-11-07T03:30:00.000Z");
    assert.equal(past.status, "overdue_review");
  } finally {
    db.close();
  }
});

test("refuses to confirm a class without a start time", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "class-1", {
      kind: "class",
      classDate: "2026-11-10",
      classTime: null,
      dueDate: null,
      dueTime: null,
      title: "Data Structures lecture",
    });
    assert.throws(() => confirmPlannerItem(db, itemId), /missing a confirmed date or start time/);
  } finally {
    db.close();
  }
});

test("user corrections take precedence over later message edits until cleared", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db);
    const corrected = applyUserCorrection(db, itemId, "title", "User title");
    assert.equal(corrected.title, "User title");
    assert.equal(corrected.userCorrections.title, "User title");

    const edited = applyMessageUpdate(db, itemId, { title: "Message title" });
    assert.equal(edited.title, "User title");

    clearUserCorrection(db, itemId, "title");
    const applied = applyMessageUpdate(db, itemId, { title: "Message title" });
    assert.equal(applied.title, "Message title");
    assert.equal(applied.userCorrections.title, undefined);
  } finally {
    db.close();
  }
});

test("cancels and archives items and hides archived items from the default view", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db);
    assert.equal(cancelPlannerItem(db, itemId).status, "cancelled");
    assert.equal(archivePlannerItem(db, itemId).status, "archived");
    assert.equal(listPlannerItems(db).length, 0);
    assert.equal(listPlannerItems(db, { includeArchived: true }).length, 1);
    assert.throws(() => cancelPlannerItem(db, itemId), /Invalid planner item transition/);
  } finally {
    db.close();
  }
});

test("matches exactly one open item for a correction and reports ambiguity", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const first = seed(db, "match-1");
    const one = findOpenItemForCorrection(db, "group-1", "Data Structures", "2026-11-10");
    assert.deepEqual(one, { itemId: first, matches: 1 });

    seed(db, "match-2");
    const many = findOpenItemForCorrection(db, "group-1", "Data Structures", "2026-11-10");
    assert.deepEqual(many, { itemId: null, matches: 2 });
  } finally {
    db.close();
  }
});

test("resolves a clarification, applies the answer, and confirms a complete item", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const itemId = seed(db, "clarify-1", {
      kind: "class",
      classDate: "2026-11-10",
      classTime: null,
      dueDate: null,
      dueTime: null,
      title: "Data Structures lecture",
    });
    const clarificationId = openClarification(db, itemId, "What time does the class start?", ["classTime"]);
    const resolved = resolveClarification(
      db,
      clarificationId,
      "2 PM",
      { classTime: "14:00" },
      "2026-11-07T04:00:00.000Z",
    );

    assert.equal(resolved.clarification.state, "resolved");
    assert.equal(resolved.clarification.answer, "2 PM");
    assert.equal(resolved.item.classTime, "14:00");
    assert.equal(resolved.item.status, "confirmed");
    assert.equal(resolved.item.userCorrections.classTime, "14:00");
    assert.throws(
      () => resolveClarification(db, clarificationId, "again", {}),
      /not open/,
    );
  } finally {
    db.close();
  }
});
