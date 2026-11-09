import { normalizeMessageContent, type BaileysEventMap, type WAMessage } from "@whiskeysockets/baileys";
import type { AppConfig } from "./config.js";

export type WhatsAppIntakeConfig = Pick<AppConfig, "whatsappGroupIds" | "lecturerIds"> & {
  allowAllSenders?: boolean;
};

export interface WhatsAppPost {
  groupId: string;
  messageId: string;
  senderId: string;
  sentAt: Date;
  text: string;
}

function messageText(message: WAMessage): string | null {
  const content = normalizeMessageContent(message.message);
  const text = content?.conversation ?? content?.extendedTextMessage?.text ??
    content?.imageMessage?.caption ?? content?.videoMessage?.caption ?? content?.documentMessage?.caption;
  return typeof text === "string" && text.trim() ? text : null;
}

function toLecturerPost(message: WAMessage, config: WhatsAppIntakeConfig): WhatsAppPost | null {
  const groupId = message.key.remoteJid;
  const senderId = message.key.participant;
  const messageId = message.key.id;
  const seconds = Number(message.messageTimestamp);
  const text = messageText(message);
  if (
    message.key.fromMe ||
    !groupId?.endsWith("@g.us") ||
    !config.whatsappGroupIds.includes(groupId) ||
    !senderId ||
    (!config.allowAllSenders && !config.lecturerIds.includes(senderId)) ||
    !messageId ||
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    !text
  ) return null;

  const sentAt = new Date(seconds * 1000);
  if (!Number.isFinite(sentAt.valueOf())) return null;
  return { groupId, messageId, senderId, sentAt, text };
}

export function selectLecturerPosts(
  event: BaileysEventMap["messages.upsert"],
  config: WhatsAppIntakeConfig,
  catchUpAfter?: Date,
): WhatsAppPost[] {
  if (event.requestId !== undefined || (catchUpAfter && !Number.isFinite(catchUpAfter.valueOf()))) return [];
  return event.messages.flatMap((message) => {
    const post = toLecturerPost(message, config);
    if (!post) return [];
    if (event.type === "append" && (!catchUpAfter || post.sentAt < catchUpAfter)) return [];
    return [post];
  });
}
