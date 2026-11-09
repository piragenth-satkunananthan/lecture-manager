import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { getTrackedWhatsAppGroup, openPlannerDatabase } from "../src/db.js";

function configuredIds(name: string): string[] {
  return [...new Set((process.env[name] ?? "").split(",").map((value) => value.trim()).filter(Boolean))];
}

const envGroupIds = configuredIds("WHATSAPP_GROUP_IDS");
const db = openPlannerDatabase(process.env.DATABASE_PATH?.trim() || "./storage/planner.sqlite");
const tracked = getTrackedWhatsAppGroup(db);
const groupIds = tracked ? [tracked.groupId] : envGroupIds;
if (groupIds.length !== 1) {
  db.close();
  throw new Error("Select one test group in the planner UI or set WHATSAPP_GROUP_IDS");
}
const groupId = groupIds[0]!;

const logger = pino({ level: "silent" });
const { state, saveCreds } = await useMultiFileAuthState("./storage/whatsapp-auth");
let sock: ReturnType<typeof makeWASocket> | undefined;
let reconnectTimer: NodeJS.Timeout | undefined;
let stopping = false;

async function connect(): Promise<void> {
  const current = makeWASocket({
    auth: state,
    logger,
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  sock = current;
  current.ev.on("creds.update", saveCreds);
  current.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("Scan this QR code with the WhatsApp account for the test group:");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      console.log("Listening for test-group messages. No text is read or stored.");
      console.log("Send one message from the lecturer's phone, then copy the sender= value.");
    }
    if (connection !== "close") return;
    const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
    if (statusCode === DisconnectReason.loggedOut) {
      console.error("WhatsApp session logged out. Move storage/whatsapp-auth aside and rerun.");
      process.exitCode = 1;
      return;
    }
    if (stopping) return;
    console.error(`WhatsApp connection closed (${statusCode ?? "unknown"}); reconnecting.`);
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void connect().catch(() => {
        console.error("WhatsApp reconnect failed; exiting.");
        process.exitCode = 1;
      });
    }, 2000);
  });

  current.ev.on("messages.upsert", (event) => {
    for (const message of event.messages) {
      if (message.key.remoteJid !== groupId || message.key.fromMe) continue;
      const sender = message.key.participant;
      const messageId = message.key.id;
      const seconds = Number(message.messageTimestamp);
      const timestamp = Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : "unknown";
      console.log(`sender=${sender ?? "unknown"} message=${messageId ?? "unknown"} time=${timestamp}`);
    }
  });
}

function shutdown(): void {
  stopping = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  void sock?.end(undefined);
  if (db.open) db.close();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

void connect().catch(() => {
  console.error("WhatsApp listener could not connect.");
  process.exitCode = 1;
});
