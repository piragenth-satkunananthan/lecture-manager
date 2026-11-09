import { readFile } from "node:fs/promises";
import { loadConfig } from "../src/config.js";
import { openPlannerDatabase } from "../src/db.js";
import { createConfiguredExtraction } from "../src/extraction-factory.js";
import { ingestWhatsAppPosts } from "../src/intake.js";
import type { WhatsAppPost } from "../src/whatsapp.js";

interface IntakePost {
  groupId: string;
  messageId: string;
  senderId: string;
  sentAt: string;
  text: string;
}

function asPost(value: unknown): WhatsAppPost {
  if (typeof value !== "object" || value === null) throw new Error("Each intake post must be an object");
  const record = value as Record<string, unknown>;
  for (const key of ["groupId", "messageId", "senderId", "text"] as const) {
    if (typeof record[key] !== "string" || !record[key]) throw new Error(`Each intake post needs ${key}`);
  }
  if (typeof record.sentAt !== "string") throw new Error("Each intake post needs sentAt");
  const sentAt = new Date(record.sentAt);
  if (!Number.isFinite(sentAt.valueOf())) throw new Error("Each intake post needs a valid sentAt");
  return {
    groupId: record.groupId as string,
    messageId: record.messageId as string,
    senderId: record.senderId as string,
    sentAt,
    text: record.text as string,
  };
}

const inputPath = process.argv[2];
if (!inputPath) throw new Error("Usage: npm run intake:local -- <path-to-json>");

const raw = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
if (!Array.isArray(raw)) throw new Error("Intake input must be a JSON array");
const posts = raw.map(asPost);

const config = loadConfig();
const db = openPlannerDatabase(config.databasePath);
let extractor = null;
try {
  extractor = createConfiguredExtraction(config);
} catch (error) {
  db.close();
  throw error;
}

const results = await ingestWhatsAppPosts(db, posts, {
  extractionEnabled: config.extractionEnabled,
  extractor,
});
db.close();

const counts: Record<string, number> = {};
for (const result of results) counts[result.status] = (counts[result.status] ?? 0) + 1;
console.log(`Intake complete: ${posts.length} post(s)`);
for (const [status, count] of Object.entries(counts)) console.log(`  ${status}: ${count}`);
if (!config.extractionEnabled) console.log("Extraction is disabled; source messages were recorded without model calls.");
