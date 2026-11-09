import type Database from "better-sqlite3";
import nodemailer from "nodemailer";
import { getPlannerItem, type PlannerItem, type ReminderKind } from "./db.js";
import {
  listDueReminders,
  markReminderDeliveredById,
  recordReminderFailure,
} from "./reminders.js";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  to: string;
}

export interface OutgoingMail {
  from: string;
  to: string;
  subject: string;
  text: string;
}

export interface MailTransport {
  sendMail(message: OutgoingMail): Promise<unknown>;
}

export interface DeliveryResult {
  delivered: number;
  failed: number;
}

const reminderLabels: Record<ReminderKind, string> = {
  assignment_day_before: "assignment due tomorrow",
  assignment_due: "assignment due today",
  class_day_before: "class tomorrow",
  class_hour_before: "class starts in one hour",
};

export function createSmtpTransport(config: SmtpConfig): MailTransport {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    ...(config.user && config.password
      ? { auth: { user: config.user, pass: config.password } }
      : {}),
  });
  return {
    sendMail: (message) => transport.sendMail(message),
  };
}

export function buildReminderMessage(
  item: PlannerItem,
  reminderKind: ReminderKind,
  from: string,
  to: string,
): OutgoingMail {
  const lines = [
    "Planner reminder",
    "",
    reminderLabels[reminderKind],
    "",
  ];
  if (item.title) lines.push(`Item: ${item.title}`);
  if (item.course) lines.push(`Course: ${item.course}`);
  if (item.dueDate) {
    lines.push(`Due: ${item.dueDate}${item.dueTime ? ` ${item.dueTime}` : ""}`);
  }
  if (item.classDate) {
    lines.push(`Class: ${item.classDate}${item.classTime ? ` ${item.classTime}` : ""}`);
  }
  lines.push("", "Open the planner for details.");

  return {
    from,
    to,
    subject: `Planner reminder: ${reminderLabels[reminderKind]}`,
    text: lines.join("\n"),
  };
}

export async function deliverDueReminders(
  db: Database.Database,
  transport: MailTransport,
  options: { from: string; to: string; now?: string; retryFailedAfterMinutes?: number },
): Promise<DeliveryResult> {
  const now = options.now ?? new Date().toISOString();
  const due = listDueReminders(db, now, {
    retryFailedAfterMinutes: options.retryFailedAfterMinutes ?? 5,
  });

  let delivered = 0;
  let failed = 0;
  for (const reminder of due) {
    const item = getPlannerItem(db, reminder.itemId);
    if (!item) {
      recordReminderFailure(db, reminder.id, "planner item missing", now);
      failed++;
      continue;
    }
    try {
      await transport.sendMail(buildReminderMessage(item, reminder.reminderKind, options.from, options.to));
      markReminderDeliveredById(db, reminder.id, now);
      delivered++;
    } catch {
      recordReminderFailure(db, reminder.id, "delivery failed", now);
      failed++;
    }
  }
  return { delivered, failed };
}
