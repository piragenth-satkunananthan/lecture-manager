import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { loadConfig } from "../src/config.js";
import { getTrackedWhatsAppGroup, openPlannerDatabase } from "../src/db.js";
import { createConfiguredExtraction } from "../src/extraction-factory.js";
import type { ExtractionRunner } from "../src/extraction.js";
import { ingestWhatsAppPost } from "../src/intake.js";
import { selectLecturerPosts } from "../src/whatsapp.js";

function configuredIds(name: string): string[] {
  return [...new Set((process.env[name] ?? "").split(",").map((value) => value.trim()).filter(Boolean))];
}

const envGroupIds = configuredIds("WHATSAPP_GROUP_IDS");
const lecturerIds = configuredIds("LECTURER_IDS");
const db = openPlannerDatabase(process.env.DATABASE_PATH?.trim() || "./storage/planner.sqlite");
const tracked = getTrackedWhatsAppGroup(db);
const whatsappGroupIds = tracked ? [tracked.groupId] : envGroupIds;
if (whatsappGroupIds.length !== 1) {
  db.close();
  throw new Error("Select one test group in the planner UI or set WHATSAPP_GROUP_IDS");
}
const allowAllSenders = tracked?.allowAllSenders ?? process.env.WHATSAPP_ALLOW_ALL_SENDERS === "true";
if (!allowAllSenders && lecturerIds.length === 0) {
  db.close();
  throw new Error("Set LECTURER_IDS or enable any-member posts in the planner UI");
}
const config = { whatsappGroupIds, lecturerIds, allowAllSenders };
const startedAt = new Date();
const seenMessageIds = new Set<string>();
const pilotIngest = process.env.WHATSAPP_PILOT_INGEST === "true";
const useExtraction = process.env.WHATSAPP_PILOT_EXTRACT === "true";
let extractor: ExtractionRunner | null = null;
if (useExtraction) {
  const appConfig = loadConfig();
  extractor = createConfiguredExtraction(appConfig);
  if (!extractor) {
    db.close();
    throw new Error("Set EXTRACTION_ENABLED=true and EXTRACTION_PROVIDER=nvidia to use WHATSAPP_PILOT_EXTRACT");
  }
}
const counts = { recorded: 0, duplicate: 0, processed: 0, pending: 0, failed: 0 };
const logger = pino({ level: "silent" });
let socket: ReturnType<typeof makeWASocket> | undefined;
let reconnectTimer: NodeJS.Timeout | undefined;
let stopping = false;

async function connect(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState("./storage/whatsapp-auth");
  const current = makeWASocket({
    auth: state,
    logger,
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  socket = current;
  current.ev.on("creds.update", saveCreds);
  current.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === "open") {
      console.log("WhatsApp test-group pilot connected.");
      console.log(pilotIngest
        ? (useExtraction
            ? "Durable pilot ingest enabled with model extraction; posts will be sent to the configured provider."
            : "Durable pilot ingest enabled; model extraction is disabled.")
        : "Pilot logging only; set WHATSAPP_PILOT_INGEST=true to record posts in SQLite.");
      if (allowAllSenders) console.log("Sender allowlist disabled: accepting posts from any member of the tracked group.");
    }
    if (connection !== "close") return;

    const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
    if (statusCode === DisconnectReason.loggedOut) {
      console.error("WhatsApp session logged out; pilot stopped.");
      process.exitCode = 1;
      shutdown();
      return;
    }
    if (stopping || reconnectTimer) return;
    console.error("WhatsApp disconnected; reconnecting.");
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void connect().catch(() => {
        console.error("WhatsApp reconnect failed; retrying.");
      });
    }, 2000);
  });
  current.ev.on("messages.upsert", (event) => {
    void handleUpsert(event);
  });
}

async function handleUpsert(event: Parameters<typeof selectLecturerPosts>[0]): Promise<void> {
  for (const post of selectLecturerPosts(event, config, startedAt)) {
    if (seenMessageIds.has(post.messageId)) continue;
    seenMessageIds.add(post.messageId);
    if (!pilotIngest) {
      console.log("Eligible test-group message received; set WHATSAPP_PILOT_INGEST=true to record it.");
      continue;
    }
    try {
      const result = await ingestWhatsAppPost(db, post, {
        extractionEnabled: useExtraction,
        extractor,
      });
      if (result.status === "recorded") counts.recorded++;
      else if (result.status === "duplicate") counts.duplicate++;
      else if (result.status === "processed") counts.processed++;
      else if (result.status === "pending") counts.pending++;
      else counts.failed++;
      console.log(`Pilot intake: ${result.status}.`);
    } catch {
      counts.failed++;
      console.error("Pilot intake failed; message was not recorded.");
    }
  }
}

function shutdown(): void {
  stopping = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  void socket?.end(undefined);
  if (db?.open) db.close();
  if (pilotIngest) {
    console.log(`Pilot totals: recorded=${counts.recorded} duplicate=${counts.duplicate} processed=${counts.processed} pending=${counts.pending} failed=${counts.failed}`);
  }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

void connect().catch(() => {
  console.error("WhatsApp pilot could not connect.");
  process.exitCode = 1;
});
