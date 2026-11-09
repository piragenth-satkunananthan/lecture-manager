import type Database from "better-sqlite3";
import {
  createReminderDelivery,
  getPlannerItem,
  type PlannerItem,
  type ReminderKind,
} from "./db.js";
import { addCalendarDays, shiftIsoMinutes, sriLankaDateTimeToUtc } from "./time.js";

export interface ReminderScheduleEntry {
  kind: ReminderKind;
  scheduledAt: string;
}

export interface DueReminder {
  id: number;
  itemId: number;
  reminderKind: ReminderKind;
  scheduledAt: string;
}

export function buildReminderSchedule(item: PlannerItem): ReminderScheduleEntry[] {
  if (item.status !== "confirmed") return [];
  const schedule: ReminderScheduleEntry[] = [];

  if (item.kind === "assignment" && item.dueDate) {
    schedule.push({
      kind: "assignment_day_before",
      scheduledAt: sriLankaDateTimeToUtc(addCalendarDays(item.dueDate, -1), "09:00"),
    });
    schedule.push({
      kind: "assignment_due",
      scheduledAt: sriLankaDateTimeToUtc(item.dueDate, "09:00"),
    });
  }

  if (item.kind === "class" && item.classDate && item.classTime) {
    schedule.push({
      kind: "class_day_before",
      scheduledAt: sriLankaDateTimeToUtc(addCalendarDays(item.classDate, -1), "09:00"),
    });
    schedule.push({
      kind: "class_hour_before",
      scheduledAt: shiftIsoMinutes(sriLankaDateTimeToUtc(item.classDate, item.classTime), -60),
    });
  }

  return schedule;
}

export function suppressPendingReminders(
  db: Database.Database,
  itemId: number,
  at = new Date().toISOString(),
): void {
  db.prepare(`
    UPDATE reminder_deliveries SET state = 'suppressed', updated_at = ?
    WHERE item_id = ? AND state = 'pending'
  `).run(at, itemId);
}

export function ensureReminderSchedule(
  db: Database.Database,
  itemId: number,
  at = new Date().toISOString(),
): number {
  const item = getPlannerItem(db, itemId);
  if (!item) throw new Error("Planner item not found");
  if (item.status !== "confirmed") {
    suppressPendingReminders(db, itemId, at);
    return 0;
  }

  let created = 0;
  for (const entry of buildReminderSchedule(item)) {
    if (createReminderDelivery(db, {
      itemId,
      reminderKind: entry.kind,
      scheduledAt: entry.scheduledAt,
    }, at)) {
      created++;
    }
  }
  return created;
}

export function listDueReminders(
  db: Database.Database,
  now = new Date().toISOString(),
  options: { retryFailedAfterMinutes?: number } = {},
): DueReminder[] {
  const retryAfterMinutes = options.retryFailedAfterMinutes ?? 5;
  const retryCutoff = new Date(new Date(now).valueOf() - retryAfterMinutes * 60_000).toISOString();
  const rows = db.prepare(`
    SELECT rd.id, rd.item_id, rd.reminder_kind, rd.scheduled_at
    FROM reminder_deliveries rd
    JOIN planner_items pi ON pi.id = rd.item_id
    WHERE (rd.state = 'pending'
      OR (rd.state = 'failed' AND rd.attempt_count < 3 AND rd.updated_at <= ?))
      AND rd.scheduled_at <= ?
      AND pi.status = 'confirmed'
    ORDER BY rd.scheduled_at, rd.id
  `).all(retryCutoff, now) as Array<{
    id: number;
    item_id: number;
    reminder_kind: ReminderKind;
    scheduled_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    itemId: row.item_id,
    reminderKind: row.reminder_kind,
    scheduledAt: row.scheduled_at,
  }));
}

export function markReminderDeliveredById(
  db: Database.Database,
  id: number,
  at = new Date().toISOString(),
): void {
  db.prepare(`
    UPDATE reminder_deliveries SET
      state = 'delivered', attempt_count = attempt_count + 1, last_error = NULL, updated_at = ?
    WHERE id = ?
  `).run(at, id);
}

export function recordReminderFailure(
  db: Database.Database,
  id: number,
  error: string,
  at = new Date().toISOString(),
): void {
  db.prepare(`
    UPDATE reminder_deliveries SET
      state = 'failed', attempt_count = attempt_count + 1, last_error = ?, updated_at = ?
    WHERE id = ?
  `).run(error, at, id);
}
