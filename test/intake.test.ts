import assert from "node:assert/strict";
import test from "node:test";
import { NvidiaError, type ExtractedItem } from "../src/ai.js";
import {
  expireFailedSources,
  getPlannerItem,
  getSourceMessage,
  insertSourceMessage,
  openPlannerDatabase,
  transitionExtractionState,
} from "../src/db.js";
import { ingestWhatsAppPost, ingestWhatsAppPosts } from "../src/intake.js";
import type { WhatsAppPost } from "../src/whatsapp.js";

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

function post(messageId = "message-1", text = "synthetic source text"): WhatsAppPost {
  return {
    groupId: "group-1",
    messageId,
    senderId: "lecturer-1",
    sentAt: new Date("2026-11-07T09:00:00+05:30"),
    text,
  };
}

test("records a message without extraction when extraction is disabled", async () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const result = await ingestWhatsAppPost(db, post(), { extractionEnabled: false, extractor: null });
    assert.equal(result.status, "recorded");
    assert.equal(result.itemIds.length, 0);
    const source = getSourceMessage(db, { groupId: "group-1", messageId: "message-1" });
    assert.equal(source?.extractionState, "received");
    assert.equal(source?.rawText, "synthetic source text");
  } finally {
    db.close();
  }
});

test("deduplicates a repeated message id", async () => {
  const db = openPlannerDatabase(":memory:");
  try {
    assert.equal((await ingestWhatsAppPost(db, post(), { extractionEnabled: false })).status, "recorded");
    const duplicate = await ingestWhatsAppPost(db, post("message-1", "changed text"), {
      extractionEnabled: false,
    });
    assert.equal(duplicate.status, "duplicate");
    assert.equal(duplicate.source.rawText, "synthetic source text");
    const count = db.prepare("SELECT COUNT(*) AS count FROM source_messages").get() as { count: number };
    assert.equal(count.count, 1);
  } finally {
    db.close();
  }
});

test("processes a recorded message through the extraction pipeline", async () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const result = await ingestWhatsAppPost(db, post(), {
      extractionEnabled: true,
      extractor: async () => ({ items: [assignment] }),
      now: "2026-11-07T09:05:00.000Z",
    });
    assert.equal(result.status, "processed");
    assert.equal(result.itemIds.length, 1);
    assert.equal(getPlannerItem(db, result.itemIds[0]!)?.title, "Data Structures assignment 2");
    assert.equal(result.source.extractionState, "confirmed");
  } finally {
    db.close();
  }
});

test("marks a source failed when the extractor fails", async () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const result = await ingestWhatsAppPost(db, post(), {
      extractionEnabled: true,
      extractor: async () => {
        throw new NvidiaError("rate_limit", "test");
      },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.source.extractionState, "failed");
    assert.equal(result.source.failureCode, "rate_limit");
    assert.equal(result.source.rawText, "synthetic source text");
  } finally {
    db.close();
  }
});

test("expires retained failed source text after the retention deadline", () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const key = { groupId: "group-1", messageId: "expired-1" };
    insertSourceMessage(db, {
      groupId: key.groupId,
      messageId: key.messageId,
      senderId: "lecturer-1",
      sentAt: "2026-11-01T03:30:00.000Z",
      rawText: "retained text",
    });
    transitionExtractionState(db, key, "extracting");
    transitionExtractionState(db, key, "failed", {
      failureCode: "timeout",
      rawTextExpiresAt: "2026-11-08T00:00:00.000Z",
    });

    assert.equal(expireFailedSources(db, "2026-11-09T00:00:00.000Z"), 1);
    const source = getSourceMessage(db, key);
    assert.equal(source?.extractionState, "expired");
    assert.equal(source?.rawText, "");
    assert.equal(source?.rawTextExpiresAt, null);
  } finally {
    db.close();
  }
});

test("summarizes a batch of intake posts", async () => {
  const db = openPlannerDatabase(":memory:");
  try {
    const results = await ingestWhatsAppPosts(
      db,
      [post("message-1"), post("message-2"), post("message-1")],
      { extractionEnabled: false },
    );
    assert.deepEqual(results.map((result) => result.status), ["recorded", "recorded", "duplicate"]);
  } finally {
    db.close();
  }
});
