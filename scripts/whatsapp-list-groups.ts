import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { writeGroupCache } from "../src/whatsapp-groups.js";

const logger = pino({ level: "silent" });
const { state, saveCreds } = await useMultiFileAuthState("./storage/whatsapp-auth");

let sock: ReturnType<typeof makeWASocket> | undefined;
let reconnectTimer: NodeJS.Timeout | undefined;
let finished = false;
let stopping = false;

function statusCodeOf(error: unknown): number | undefined {
  return (error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
}

async function listGroups(): Promise<void> {
  if (!sock) return;
  finished = true;
  try {
    const groups = await sock.groupFetchAllParticipating();
    const cache = writeGroupCache(
      "./storage/whatsapp-groups.json",
      Object.values(groups).map((group) => ({
        id: group.id,
        subject: group.subject,
        addressingMode: group.addressingMode ?? null,
        size: group.size ?? group.participants.length,
        owner: group.owner ?? null,
        description: group.desc ?? null,
      })),
    );
    console.log(`\nCached ${cache.groups.length} group(s) for the planner UI.`);
    console.log("Open the planner UI and select the test group under WhatsApp tracking.\n");
    console.log("Read-only group metadata. Do not share this output.");
    console.log("Use the separate test group, not a live subject group.\n");
    for (const group of Object.values(groups)) {
      console.log(`Group: ${group.subject}`);
      console.log(`  WHATSAPP_GROUP_IDS candidate: ${group.id}`);
      console.log(`  addressing mode: ${group.addressingMode ?? "unknown"}`);
      console.log(`  participants: ${group.size ?? group.participants.length}`);
      if (group.owner) console.log(`  owner: ${group.owner}`);
      if (group.desc) {
        const description = group.desc.replace(/\s+/g, " ").trim().slice(0, 200);
        if (description) console.log(`  description: ${description}`);
      }
      for (const participant of group.participants) {
        const role = participant.admin ?? "member";
        const name = participant.name ? ` | name=${participant.name}` : "";
        const notify = participant.notify ? ` | notify=${participant.notify}` : "";
        const username = participant.username ? ` | username=${participant.username}` : "";
        const pn = participant.phoneNumber ? ` | pn=${participant.phoneNumber}` : "";
        const lid = participant.lid ? ` | lid=${participant.lid}` : "";
        console.log(`  ${role} | id=${participant.id}${name}${notify}${username}${pn}${lid}`);
      }
      console.log("");
    }
    console.log("For LECTURER_IDS, use the exact id shown for the test lecturer.");
    console.log("If the group uses LID addressing, use the id/lid value, not the pn value.");
  } catch (error) {
    console.error("Could not list groups.");
    console.error(error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  } finally {
    await sock.end(undefined);
  }
}

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
    if (connection === "open" && !finished) {
      void listGroups();
      return;
    }
    if (connection !== "close") return;

    const statusCode = statusCodeOf(lastDisconnect?.error);
    if (statusCode === DisconnectReason.loggedOut) {
      console.error("WhatsApp session logged out. Move storage/whatsapp-auth aside and rerun for a fresh QR.");
      process.exitCode = 1;
      return;
    }
    if (finished || stopping) return;

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
}

process.once("SIGINT", () => {
  stopping = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  void sock?.end(undefined);
});
process.once("SIGTERM", () => {
  stopping = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  void sock?.end(undefined);
});

void connect().catch(() => {
  console.error("WhatsApp helper could not connect.");
  process.exitCode = 1;
});
