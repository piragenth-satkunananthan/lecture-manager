import assert from "node:assert/strict";
import test from "node:test";
import type { BaileysEventMap, WAMessage } from "@whiskeysockets/baileys";
import { selectLecturerPosts } from "../src/whatsapp.js";

const config = {
  whatsappGroupIds: ["test-group@g.us"],
  lecturerIds: ["lecturer@s.whatsapp.net"],
};

interface MessageOptions {
  text?: string;
  groupId?: string;
  senderId?: string;
  messageId?: string;
  timestamp?: number;
  fromMe?: boolean;
  message?: unknown;
}

function message(options: MessageOptions = {}): WAMessage {
  const content = options.message ?? { conversation: options.text ?? "Assignment due tomorrow." };
  return {
    key: {
      remoteJid: options.groupId ?? "test-group@g.us",
      participant: options.senderId ?? "lecturer@s.whatsapp.net",
      id: options.messageId ?? "synthetic-message-id",
      fromMe: options.fromMe ?? false,
    },
    message: content,
    messageTimestamp: options.timestamp ?? 1_794_027_600,
  } as unknown as WAMessage;
}

function upsert(
  messages: WAMessage[],
  type: "notify" | "append" = "notify",
  requestId?: string,
): BaileysEventMap["messages.upsert"] {
  return { messages, type, ...(requestId === undefined ? {} : { requestId }) };
}

test("selects only new messages from configured subject groups and lecturers", () => {
  const selected = selectLecturerPosts(upsert([
    message(),
    message({ groupId: "other-group@g.us" }),
    message({ senderId: "student@s.whatsapp.net" }),
    message({ fromMe: true }),
  ]), config);

  assert.equal(selected.length, 1);
  assert.deepEqual(selected[0], {
    groupId: "test-group@g.us",
    messageId: "synthetic-message-id",
    senderId: "lecturer@s.whatsapp.net",
    sentAt: new Date(1_794_027_600 * 1000),
    text: "Assignment due tomorrow.",
  });
});

test("extracts text from ephemeral, extended-text, and media captions", () => {
  const selected = selectLecturerPosts(upsert([
    message({ message: { ephemeralMessage: { message: { extendedTextMessage: { text: "Corrected assignment date." } } } } }),
    message({ message: { imageMessage: { caption: "Assignment instructions in the image caption." } } }),
  ]), config);

  assert.deepEqual(selected.map((post) => post.text), [
    "Corrected assignment date.",
    "Assignment instructions in the image caption.",
  ]);
});

test("uses append events only for messages newer than the reconnect cursor", () => {
  const cursor = new Date(1_794_027_600 * 1000);
  const messages = [
    message({ timestamp: 1_794_027_599, messageId: "older" }),
    message({ timestamp: 1_794_027_600, messageId: "same-time" }),
    message({ timestamp: 1_794_027_601, messageId: "newer" }),
  ];

  assert.deepEqual(selectLecturerPosts(upsert(messages, "append"), config), []);
  assert.deepEqual(
    selectLecturerPosts(upsert(messages, "append"), config, cursor).map((post) => post.messageId),
    ["same-time", "newer"],
  );
});

test("rejects retry-requested, empty, incomplete, and invalid-timestamp messages", () => {
  const invalidCursor = new Date("invalid");
  const incomplete = message();
  incomplete.key.id = null;
  const selected = selectLecturerPosts(upsert([
    message({ text: "   " }),
    incomplete,
    message({ timestamp: 0 }),
    message({ timestamp: Number.NaN }),
  ], "notify", "retry-request"), config);

  assert.deepEqual(selected, []);
  assert.deepEqual(
    selectLecturerPosts(upsert([message()], "append"), config, invalidCursor),
    [],
  );
});
