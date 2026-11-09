import type Database from "better-sqlite3";
import {
  createClarification,
  getClarification,
  getPlannerItem,
  resolveClarificationRecord,
  updatePlannerItem,
  type Clarification,
  type PlannerItem,
  type PlannerItemPatch,
  type PlannerItemStatus,
} from "./db.js";
import { sriLankaDateTimeToUtc } from "./time.js";

export type EditableField =
  | "title"
  | "details"
  | "course"
  | "location"
  | "dueDate"
  | "dueTime"
  | "classDate"
  | "classTime"
  | "changeType"
  | "changeDetails";

const editableFieldColumns: Record<EditableField, keyof PlannerItemPatch> = {
  title: "title",
  details: "details",
  course: "course",
  location: "location",
  dueDate: "dueDate",
  dueTime: "dueTime",
  classDate: "classDate",
  classTime: "classTime",
  changeType: "changeType",
  changeDetails: "changeDetails",
};

const statusTransitions: Record<PlannerItemStatus, PlannerItemStatus[]> = {
  pending: ["confirmed", "cancelled", "overdue_review", "archived"],
  confirmed: ["cancelled", "overdue_review", "archived"],
  overdue_review: ["confirmed", "cancelled", "archived"],
  cancelled: ["archived"],
  archived: [],
};

function requireItem(db: Database.Database, itemId: number): PlannerItem {
  const item = getPlannerItem(db, itemId);
  if (!item) throw new Error("Planner item not found");
  return item;
}

function isPastItemStart(item: PlannerItem, now: string): boolean {
  if (item.kind === "assignment" && item.dueDate) {
    return sriLankaDateTimeToUtc(item.dueDate, item.dueTime ?? "23:59") < new Date(now).toISOString();
  }
  if (item.kind === "class" && item.classDate && item.classTime) {
    return sriLankaDateTimeToUtc(item.classDate, item.classTime) < new Date(now).toISOString();
  }
  return false;
}

export function listPlannerItems(
  db: Database.Database,
  options: { includeArchived?: boolean } = {},
): PlannerItem[] {
  const rows = db.prepare(`
    SELECT * FROM planner_items
    ${options.includeArchived ? "" : "WHERE status <> 'archived'"}
    ORDER BY COALESCE(due_date, class_date), COALESCE(due_time, class_time), id
  `).all() as Array<Record<string, unknown>>;
  return rows.map((row) => getPlannerItem(db, Number(row.id))!).filter(Boolean);
}

export function setPlannerItemStatus(
  db: Database.Database,
  itemId: number,
  next: PlannerItemStatus,
  at = new Date().toISOString(),
): PlannerItem {
  const item = requireItem(db, itemId);
  if (!statusTransitions[item.status].includes(next)) {
    throw new Error(`Invalid planner item transition from ${item.status} to ${next}`);
  }
  return updatePlannerItem(db, itemId, { status: next }, at);
}

export function confirmPlannerItem(
  db: Database.Database,
  itemId: number,
  now = new Date().toISOString(),
): PlannerItem {
  const item = requireItem(db, itemId);
  if (item.kind === "class") {
    if (!item.classDate || !item.classTime) {
      throw new Error("Class is missing a confirmed date or start time");
    }
  } else if (!item.title || !item.dueDate) {
    throw new Error("Assignment is missing a confirmed title or due date");
  }

  if (item.status === "overdue_review" && item.kind === "assignment") {
    return updatePlannerItem(db, itemId, { status: "confirmed" }, now);
  }
  if (isPastItemStart(item, now)) {
    return updatePlannerItem(db, itemId, { status: "overdue_review" }, now);
  }
  return updatePlannerItem(db, itemId, { status: "confirmed" }, now);
}

export function cancelPlannerItem(
  db: Database.Database,
  itemId: number,
  at = new Date().toISOString(),
): PlannerItem {
  return setPlannerItemStatus(db, itemId, "cancelled", at);
}

export function archivePlannerItem(
  db: Database.Database,
  itemId: number,
  at = new Date().toISOString(),
): PlannerItem {
  return setPlannerItemStatus(db, itemId, "archived", at);
}

export function applyUserCorrection(
  db: Database.Database,
  itemId: number,
  field: EditableField,
  value: string | null,
  at = new Date().toISOString(),
): PlannerItem {
  const item = requireItem(db, itemId);
  const column = editableFieldColumns[field];
  if (!column) throw new Error(`Unsupported correction field: ${field}`);
  const userCorrections = { ...item.userCorrections, [field]: value };
  return updatePlannerItem(db, itemId, { [column]: value, userCorrections }, at);
}

export function clearUserCorrection(
  db: Database.Database,
  itemId: number,
  field: EditableField,
  at = new Date().toISOString(),
): PlannerItem {
  const item = requireItem(db, itemId);
  const userCorrections = { ...item.userCorrections };
  delete userCorrections[field];
  return updatePlannerItem(db, itemId, { userCorrections }, at);
}

export function applyMessageUpdate(
  db: Database.Database,
  itemId: number,
  patch: PlannerItemPatch,
  at = new Date().toISOString(),
): PlannerItem {
  const item = requireItem(db, itemId);
  const allowed: PlannerItemPatch = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (key === "status" || key === "ambiguousFields") continue;
    if (key === "fieldEvidence") {
      allowed.fieldEvidence = value as Record<string, Array<{ quote: string }>>;
      continue;
    }
    if (item.userCorrections[key] !== undefined) continue;
    (allowed as Record<string, unknown>)[key] = value;
  }
  return updatePlannerItem(db, itemId, allowed, at);
}

export function findOpenItemForCorrection(
  db: Database.Database,
  groupId: string,
  subject: string,
  date: string,
): { itemId: number | null; matches: number } {
  const rows = db.prepare(`
    SELECT id FROM planner_items
    WHERE source_group_id = ?
      AND status IN ('pending', 'confirmed')
      AND (due_date = ? OR class_date = ?)
      AND (title LIKE ? OR course LIKE ?)
  `).all(groupId, date, date, `%${subject}%`, `%${subject}%`) as Array<{ id: number }>;
  return {
    itemId: rows.length === 1 ? rows[0]?.id ?? null : null,
    matches: rows.length,
  };
}

export function openClarification(
  db: Database.Database,
  itemId: number,
  question: string,
  requestedFields: string[],
  at = new Date().toISOString(),
): number {
  requireItem(db, itemId);
  return createClarification(db, itemId, { question, requestedFields }, at);
}

export function resolveClarification(
  db: Database.Database,
  clarificationId: number,
  answer: string,
  updates: Partial<Record<EditableField, string | null>> = {},
  at = new Date().toISOString(),
): { clarification: Clarification; item: PlannerItem } {
  const clarification = getClarification(db, clarificationId);
  if (!clarification) throw new Error("Clarification not found");
  if (clarification.state !== "open") throw new Error("Clarification is not open");

  let item = requireItem(db, clarification.itemId);
  for (const [field, value] of Object.entries(updates) as Array<[EditableField, string | null]>) {
    item = applyUserCorrection(db, item.id, field, value, at);
  }
  resolveClarificationRecord(db, clarificationId, answer, at);

  const complete = item.kind === "class"
    ? Boolean(item.classDate && item.classTime)
    : Boolean(item.title && item.dueDate);
  if (complete && (item.status === "pending" || item.status === "overdue_review")) {
    item = confirmPlannerItem(db, item.id, at);
  }

  const updatedClarification = getClarification(db, clarificationId);
  if (!updatedClarification) throw new Error("Clarification disappeared after resolution");
  return { clarification: updatedClarification, item };
}
