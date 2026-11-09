import type Database from "better-sqlite3";
import { getSourceMessage, insertSourceMessage, type SourceMessage } from "./db.js";
import { processSourceMessage, type ExtractionRunner } from "./extraction.js";
import type { WhatsAppPost } from "./whatsapp.js";

export type IntakeStatus = "recorded" | "duplicate" | "processed" | "pending" | "failed";

export interface IntakeOptions {
  extractionEnabled: boolean;
  extractor?: ExtractionRunner | null;
  now?: string;
}

export interface IntakeResult {
  status: IntakeStatus;
  source: SourceMessage;
  itemIds: number[];
}

function record(db: Database.Database, post: WhatsAppPost): { source: SourceMessage; inserted: boolean } {
  const inserted = insertSourceMessage(db, {
    groupId: post.groupId,
    messageId: post.messageId,
    senderId: post.senderId,
    sentAt: post.sentAt.toISOString(),
    rawText: post.text,
  });
  const source = getSourceMessage(db, { groupId: post.groupId, messageId: post.messageId });
  if (!source) throw new Error("Source message disappeared after insert");
  return { source, inserted };
}

export async function ingestWhatsAppPost(
  db: Database.Database,
  post: WhatsAppPost,
  options: IntakeOptions,
): Promise<IntakeResult> {
  const { source, inserted } = record(db, post);
  if (!inserted) return { status: "duplicate", source, itemIds: [] };
  if (!options.extractionEnabled || !options.extractor) {
    return { status: "recorded", source, itemIds: [] };
  }

  try {
    const result = await processSourceMessage(
      db,
      { groupId: post.groupId, messageId: post.messageId },
      options.extractor,
      options.now === undefined ? { enabled: true } : { enabled: true, now: options.now },
    );
    return {
      status: result.pending ? "pending" : "processed",
      source: result.source,
      itemIds: result.itemIds,
    };
  } catch {
    const failed = getSourceMessage(db, { groupId: post.groupId, messageId: post.messageId });
    if (!failed) throw new Error("Source message disappeared after failed extraction");
    return { status: "failed", source: failed, itemIds: [] };
  }
}

export async function ingestWhatsAppPosts(
  db: Database.Database,
  posts: WhatsAppPost[],
  options: IntakeOptions,
): Promise<IntakeResult[]> {
  const results: IntakeResult[] = [];
  for (const post of posts) {
    results.push(await ingestWhatsAppPost(db, post, options));
  }
  return results;
}
