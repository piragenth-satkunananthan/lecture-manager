import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { createAnnouncementExtractor } from "../src/ai.js";
import { selectLecturerPosts } from "../src/whatsapp.js";

function configuredIds(name: string): string[] {
  return [...new Set((process.env[name] ?? "").split(",").map((value) => value.trim()).filter(Boolean))];
}

const whatsappGroupIds = configuredIds("WHATSAPP_GROUP_IDS");
const lecturerIds = configuredIds("LECTURER_IDS");
const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
if (whatsappGroupIds.length !== 1) throw new Error("Set exactly one WHATSAPP_GROUP_IDS test group");
if (lecturerIds.length === 0) throw new Error("Set LECTURER_IDS for the test group");
if (!geminiApiKey) throw new Error("Set GEMINI_API_KEY before running the WhatsApp pilot");

const extract = createAnnouncementExtractor({
  geminiApiKey,
  geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
  timeZone: process.env.TIME_ZONE?.trim() || "Asia/Colombo",
});
const config = { whatsappGroupIds, lecturerIds };
const startedAt = new Date();
const seenMessageIds = new Set<string>();
// shortcut: deduplication and catch-up survive socket reconnects only, move the cursor to SQLite before live intake.
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
    if (connection === "open") console.log("WhatsApp test-group pilot connected.");
    if (connection !== "close") return;

    const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
    if (statusCode === DisconnectReason.loggedOut) {
      console.error("WhatsApp session logged out; pilot stopped.");
      process.exitCode = 1;
      void current.end(new Error("WhatsApp session logged out"));
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
    for (const post of selectLecturerPosts(event, config, startedAt)) {
      if (seenMessageIds.has(post.messageId)) continue;
      seenMessageIds.add(post.messageId);
      void extract({ text: post.text, sentAt: post.sentAt }).then((result) => {
        console.log(`Eligible lecturer post processed: ${result.items.length} planner item(s).`);
      }).catch(() => {
        console.error("Eligible lecturer post extraction failed.");
      });
    }
  });
}

process.once("SIGINT", () => {
  stopping = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  void socket?.end(undefined);
});

void connect().catch(() => {
  console.error("WhatsApp pilot could not connect.");
  process.exitCode = 1;
});
