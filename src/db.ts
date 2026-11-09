import Database from "better-sqlite3";

export type ExtractionState =
  | "received"
  | "extracting"
  | "pending_review"
  | "failed"
  | "confirmed"
  | "expired"
  | "deleted";

export type PlannerItemStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "overdue_review"
  | "archived";

export type ReminderKind =
  | "assignment_day_before"
  | "assignment_due"
  | "class_day_before"
  | "class_hour_before";

export interface SourceMessageKey {
  groupId: string;
  messageId: string;
}

export interface SourceMessage extends SourceMessageKey {
  senderId: string;
  sentAt: string;
  rawText: string;
  rawTextExpiresAt: string | null;
  extractionState: ExtractionState;
  failureCode: string | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FailedSourceSummary extends SourceMessageKey {
  senderId: string;
  sentAt: string;
  failureCode: string | null;
  attemptCount: number;
  rawTextExpiresAt: string | null;
  createdAt: string;
}

export interface NewSourceMessage extends SourceMessageKey {
  senderId: string;
  sentAt: string;
  rawText: string;
  rawTextExpiresAt?: string | null;
}

export interface NewPlannerItem {
  sourceGroupId: string;
  sourceMessageId: string;
  kind: "assignment" | "class";
  status?: PlannerItemStatus;
  title: string | null;
  details: string | null;
  course: string | null;
  location: string | null;
  dueDate: string | null;
  dueTime: string | null;
  classDate: string | null;
  classTime: string | null;
  changeType: "cancelled" | "rescheduled" | null;
  changeDetails: string | null;
  zoomUrl: string | null;
  ambiguousFields: string[];
  fieldEvidence: Record<string, Array<{ quote: string }>>;
  recordingPermission?: "confirmed" | "declined" | null;
  permissionConfirmedBy?: string | null;
  permissionConfirmedAt?: string | null;
}

export interface PlannerItem {
  id: number;
  sourceGroupId: string;
  sourceMessageId: string;
  kind: "assignment" | "class";
  status: PlannerItemStatus;
  title: string | null;
  details: string | null;
  course: string | null;
  location: string | null;
  dueDate: string | null;
  dueTime: string | null;
  classDate: string | null;
  classTime: string | null;
  changeType: "cancelled" | "rescheduled" | null;
  changeDetails: string | null;
  zoomUrl: string | null;
  ambiguousFields: string[];
  fieldEvidence: Record<string, Array<{ quote: string }>>;
  recordingPermission: "confirmed" | "declined" | null;
  permissionConfirmedBy: string | null;
  permissionConfirmedAt: string | null;
  userCorrections: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerItemPatch {
  title?: string | null;
  details?: string | null;
  course?: string | null;
  location?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  classDate?: string | null;
  classTime?: string | null;
  changeType?: "cancelled" | "rescheduled" | null;
  changeDetails?: string | null;
  zoomUrl?: string | null;
  status?: PlannerItemStatus;
  ambiguousFields?: string[];
  fieldEvidence?: Record<string, Array<{ quote: string }>>;
  userCorrections?: Record<string, string | null>;
  recordingPermission?: "confirmed" | "declined" | null;
  permissionConfirmedBy?: string | null;
  permissionConfirmedAt?: string | null;
}

export interface Clarification {
  id: number;
  itemId: number;
  sourceGroupId: string;
  sourceMessageId: string;
  question: string;
  requestedFields: string[];
  state: "open" | "answered" | "resolved" | "cancelled";
  answer: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface NewClarification {
  question: string;
  requestedFields: string[];
}

export interface NewReminderDelivery {
  itemId: number;
  reminderKind: ReminderKind;
  scheduledAt: string;
}

const extractionTransitions: Record<ExtractionState, ExtractionState[]> = {
  received: ["extracting", "deleted"],
  extracting: ["pending_review", "failed", "confirmed", "deleted"],
  failed: ["extracting", "expired", "deleted"],
  pending_review: ["confirmed", "expired", "deleted"],
  confirmed: ["expired", "deleted"],
  expired: ["deleted"],
  deleted: [],
};

const schema = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_messages (
  group_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  raw_text_expires_at TEXT,
  extraction_state TEXT NOT NULL CHECK (extraction_state IN
    ('received', 'extracting', 'pending_review', 'failed', 'confirmed', 'expired', 'deleted')),
  failure_code TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (group_id, message_id)
);

CREATE TABLE IF NOT EXISTS planner_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_group_id TEXT NOT NULL,
  source_message_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('assignment', 'class')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'overdue_review', 'archived')),
  title TEXT,
  details TEXT,
  course TEXT,
  location TEXT,
  due_date TEXT,
  due_time TEXT,
  class_date TEXT,
  class_time TEXT,
  change_type TEXT CHECK (change_type IS NULL OR change_type IN ('cancelled', 'rescheduled')),
  change_details TEXT,
  zoom_url TEXT,
  ambiguous_fields TEXT NOT NULL DEFAULT '[]',
  field_evidence TEXT NOT NULL DEFAULT '{}',
  recording_permission TEXT CHECK (recording_permission IS NULL OR recording_permission IN ('confirmed', 'declined')),
  permission_confirmed_by TEXT,
  permission_confirmed_at TEXT,
  user_corrections TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_group_id, source_message_id)
    REFERENCES source_messages(group_id, message_id)
);

CREATE TABLE IF NOT EXISTS clarifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  source_group_id TEXT NOT NULL,
  source_message_id TEXT NOT NULL,
  question TEXT NOT NULL,
  requested_fields TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL CHECK (state IN ('open', 'answered', 'resolved', 'cancelled')),
  answer TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (item_id) REFERENCES planner_items(id) ON DELETE CASCADE,
  FOREIGN KEY (source_group_id, source_message_id)
    REFERENCES source_messages(group_id, message_id)
);

CREATE TABLE IF NOT EXISTS reminder_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  reminder_kind TEXT NOT NULL CHECK (reminder_kind IN
    ('assignment_day_before', 'assignment_due', 'class_day_before', 'class_hour_before')),
  scheduled_at TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'delivered', 'failed', 'suppressed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (item_id, reminder_kind, scheduled_at),
  FOREIGN KEY (item_id) REFERENCES planner_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS source_messages_state_idx ON source_messages(extraction_state);
CREATE INDEX IF NOT EXISTS planner_items_status_idx ON planner_items(status);
CREATE INDEX IF NOT EXISTS clarifications_state_idx ON clarifications(state);
CREATE INDEX IF NOT EXISTS reminder_deliveries_pending_idx ON reminder_deliveries(state, scheduled_at);
`;

interface SourceMessageRow {
  group_id: string;
  message_id: string;
  sender_id: string;
  sent_at: string;
  raw_text: string;
  raw_text_expires_at: string | null;
  extraction_state: ExtractionState;
  failure_code: string | null;
  attempt_count: number;
  last_attempt_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PlannerItemRow {
  id: number;
  source_group_id: string;
  source_message_id: string;
  kind: "assignment" | "class";
  status: PlannerItemStatus;
  title: string | null;
  details: string | null;
  course: string | null;
  location: string | null;
  due_date: string | null;
  due_time: string | null;
  class_date: string | null;
  class_time: string | null;
  change_type: "cancelled" | "rescheduled" | null;
  change_details: string | null;
  zoom_url: string | null;
  ambiguous_fields: string;
  field_evidence: string;
  recording_permission: "confirmed" | "declined" | null;
  permission_confirmed_by: string | null;
  permission_confirmed_at: string | null;
  user_corrections: string;
  created_at: string;
  updated_at: string;
}

interface ClarificationRow {
  id: number;
  item_id: number;
  source_group_id: string;
  source_message_id: string;
  question: string;
  requested_fields: string;
  state: "open" | "answered" | "resolved" | "cancelled";
  answer: string | null;
  created_at: string;
  resolved_at: string | null;
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function toSourceMessage(row: SourceMessageRow): SourceMessage {  return {
    groupId: row.group_id,
    messageId: row.message_id,
    senderId: row.sender_id,
    sentAt: row.sent_at,
    rawText: row.raw_text,
    rawTextExpiresAt: row.raw_text_expires_at,
    extractionState: row.extraction_state,
    failureCode: row.failure_code,
    attemptCount: row.attempt_count,
    lastAttemptAt: row.last_attempt_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPlannerItem(row: PlannerItemRow): PlannerItem {
  return {
    id: row.id,
    sourceGroupId: row.source_group_id,
    sourceMessageId: row.source_message_id,
    kind: row.kind,
    status: row.status,
    title: row.title,
    details: row.details,
    course: row.course,
    location: row.location,
    dueDate: row.due_date,
    dueTime: row.due_time,
    classDate: row.class_date,
    classTime: row.class_time,
    changeType: row.change_type,
    changeDetails: row.change_details,
    zoomUrl: row.zoom_url,
    ambiguousFields: JSON.parse(row.ambiguous_fields) as string[],
    fieldEvidence: JSON.parse(row.field_evidence) as Record<string, Array<{ quote: string }>>,
    recordingPermission: row.recording_permission,
    permissionConfirmedBy: row.permission_confirmed_by,
    permissionConfirmedAt: row.permission_confirmed_at,
    userCorrections: JSON.parse(row.user_corrections) as Record<string, string | null>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function openPlannerDatabase(path: string): Database.Database {
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  if (path !== ":memory:") db.pragma("journal_mode = WAL");
  migrate(db);
  return db;
}

export function migrate(db: Database.Database): void {
  db.exec(schema);
  db.prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)")
    .run(1, new Date().toISOString());
}

export function insertSourceMessage(
  db: Database.Database,
  input: NewSourceMessage,
  at = new Date().toISOString(),
): boolean {
  const result = db.prepare(`
    INSERT OR IGNORE INTO source_messages
      (group_id, message_id, sender_id, sent_at, raw_text, raw_text_expires_at,
       extraction_state, failure_code, attempt_count, last_attempt_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'received', NULL, 0, NULL, ?, ?)
  `).run(
    input.groupId,
    input.messageId,
    input.senderId,
    input.sentAt,
    input.rawText,
    input.rawTextExpiresAt ?? null,
    at,
    at,
  );
  return result.changes > 0;
}

export function getSourceMessage(
  db: Database.Database,
  key: SourceMessageKey,
): SourceMessage | undefined {
  const row = db.prepare(
    "SELECT * FROM source_messages WHERE group_id = ? AND message_id = ?",
  ).get(key.groupId, key.messageId) as SourceMessageRow | undefined;
  return row ? toSourceMessage(row) : undefined;
}

export function listFailedSources(db: Database.Database): FailedSourceSummary[] {
  const rows = db.prepare(`
    SELECT group_id, message_id, sender_id, sent_at, failure_code, attempt_count,
           raw_text_expires_at, created_at
    FROM source_messages
    WHERE extraction_state = 'failed'
    ORDER BY sent_at DESC, message_id DESC
  `).all() as Array<{
    group_id: string;
    message_id: string;
    sender_id: string;
    sent_at: string;
    failure_code: string | null;
    attempt_count: number;
    raw_text_expires_at: string | null;
    created_at: string;
  }>;
  return rows.map((row) => ({
    groupId: row.group_id,
    messageId: row.message_id,
    senderId: row.sender_id,
    sentAt: row.sent_at,
    failureCode: row.failure_code,
    attemptCount: row.attempt_count,
    rawTextExpiresAt: row.raw_text_expires_at,
    createdAt: row.created_at,
  }));
}

export function deleteFailedSource(db: Database.Database, key: SourceMessageKey): boolean {
  const source = getSourceMessage(db, key);
  if (!source || source.extractionState !== "failed") return false;
  transitionExtractionState(db, key, "deleted");
  return true;
}

export function expireFailedSources(
  db: Database.Database,
  now = new Date().toISOString(),
): number {
  const rows = db.prepare(`
    SELECT group_id, message_id
    FROM source_messages
    WHERE extraction_state = 'failed'
      AND raw_text_expires_at IS NOT NULL
      AND raw_text_expires_at <= ?
  `).all(now) as Array<{ group_id: string; message_id: string }>;
  for (const row of rows) {
    transitionExtractionState(
      db,
      { groupId: row.group_id, messageId: row.message_id },
      "expired",
      { at: now },
    );
  }
  return rows.length;
}

export function transitionExtractionState(
  db: Database.Database,
  key: SourceMessageKey,
  next: ExtractionState,
  options: { failureCode?: string; rawTextExpiresAt?: string | null; at?: string } = {},
): SourceMessage {
  const current = getSourceMessage(db, key);
  if (!current) throw new Error("Source message not found");
  if (!extractionTransitions[current.extractionState].includes(next)) {
    throw new Error(`Invalid extraction transition from ${current.extractionState} to ${next}`);
  }

  const at = options.at ?? new Date().toISOString();
  const attemptCount = next === "extracting" ? current.attemptCount + 1 : current.attemptCount;
  const lastAttemptAt = next === "extracting" ? at : current.lastAttemptAt;
  const failureCode = next === "failed" ? options.failureCode ?? "unknown" : null;
  const rawTextExpiresAt = next === "expired" || next === "deleted"
    ? null
    : next === "failed"
      ? options.rawTextExpiresAt ?? addDays(at, 30)
      : current.rawTextExpiresAt;
  const rawText = next === "expired" || next === "deleted" ? "" : current.rawText;

  db.prepare(`
    UPDATE source_messages SET
      raw_text = ?, raw_text_expires_at = ?, extraction_state = ?, failure_code = ?,
      attempt_count = ?, last_attempt_at = ?, updated_at = ?
    WHERE group_id = ? AND message_id = ?
  `).run(
    rawText,
    rawTextExpiresAt,
    next,
    failureCode,
    attemptCount,
    lastAttemptAt,
    at,
    key.groupId,
    key.messageId,
  );

  const updated = getSourceMessage(db, key);
  if (!updated) throw new Error("Source message disappeared after transition");
  return updated;
}

export function expireRawText(
  db: Database.Database,
  key: SourceMessageKey,
  at = new Date().toISOString(),
): SourceMessage {
  return transitionExtractionState(db, key, "expired", { at });
}

export function createPlannerItem(
  db: Database.Database,
  input: NewPlannerItem,
  at = new Date().toISOString(),
): number {
  const dueTime = input.kind === "assignment" && input.dueDate !== null && input.dueTime === null
    ? "23:59"
    : input.dueTime;
  const result = db.prepare(`
    INSERT INTO planner_items (
      source_group_id, source_message_id, kind, status, title, details, course, location,
      due_date, due_time, class_date, class_time, change_type, change_details, zoom_url,
      ambiguous_fields, field_evidence, recording_permission, permission_confirmed_by,
      permission_confirmed_at, user_corrections, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)
  `).run(
    input.sourceGroupId,
    input.sourceMessageId,
    input.kind,
    input.status ?? "pending",
    input.title,
    input.details,
    input.course,
    input.location,
    input.dueDate,
    dueTime,
    input.classDate,
    input.classTime,
    input.changeType,
    input.changeDetails,
    input.zoomUrl,
    JSON.stringify(input.ambiguousFields),
    JSON.stringify(input.fieldEvidence),
    input.recordingPermission ?? null,
    input.permissionConfirmedBy ?? null,
    input.permissionConfirmedAt ?? null,
    at,
    at,
  );
  return Number(result.lastInsertRowid);
}

export function getPlannerItem(db: Database.Database, id: number): PlannerItem | undefined {
  const row = db.prepare("SELECT * FROM planner_items WHERE id = ?").get(id) as PlannerItemRow | undefined;
  return row ? toPlannerItem(row) : undefined;
}

const plannerItemColumns: Record<keyof PlannerItemPatch, string> = {
  title: "title",
  details: "details",
  course: "course",
  location: "location",
  dueDate: "due_date",
  dueTime: "due_time",
  classDate: "class_date",
  classTime: "class_time",
  changeType: "change_type",
  changeDetails: "change_details",
  zoomUrl: "zoom_url",
  status: "status",
  ambiguousFields: "ambiguous_fields",
  fieldEvidence: "field_evidence",
  userCorrections: "user_corrections",
  recordingPermission: "recording_permission",
  permissionConfirmedBy: "permission_confirmed_by",
  permissionConfirmedAt: "permission_confirmed_at",
};

export function updatePlannerItem(
  db: Database.Database,
  id: number,
  patch: PlannerItemPatch,
  at = new Date().toISOString(),
): PlannerItem {
  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const column = plannerItemColumns[key as keyof PlannerItemPatch];
    if (!column) continue;
    assignments.push(`${column} = ?`);
    values.push(
      key === "ambiguousFields" || key === "fieldEvidence" || key === "userCorrections"
        ? JSON.stringify(value)
        : value,
    );
  }
  if (assignments.length > 0) {
    assignments.push("updated_at = ?");
    values.push(at, id);
    db.prepare(`UPDATE planner_items SET ${assignments.join(", ")} WHERE id = ?`).run(...values);
  }
  const item = getPlannerItem(db, id);
  if (!item) throw new Error("Planner item not found");
  return item;
}

export function getClarification(db: Database.Database, id: number): Clarification | undefined {
  const row = db.prepare("SELECT * FROM clarifications WHERE id = ?").get(id) as ClarificationRow | undefined;
  if (!row) return undefined;
  return {
    id: row.id,
    itemId: row.item_id,
    sourceGroupId: row.source_group_id,
    sourceMessageId: row.source_message_id,
    question: row.question,
    requestedFields: JSON.parse(row.requested_fields) as string[],
    state: row.state,
    answer: row.answer,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export function resolveClarificationRecord(
  db: Database.Database,
  id: number,
  answer: string,
  at = new Date().toISOString(),
): void {
  const result = db.prepare(`
    UPDATE clarifications SET state = 'resolved', answer = ?, resolved_at = ?
    WHERE id = ? AND state = 'open'
  `).run(answer, at, id);
  if (result.changes === 0) throw new Error("Clarification is not open");
}

export function createClarification(
  db: Database.Database,
  itemId: number,
  input: NewClarification,
  at = new Date().toISOString(),
): number {
  const item = getPlannerItem(db, itemId);
  if (!item) throw new Error("Planner item not found");
  const result = db.prepare(`
    INSERT INTO clarifications (
      item_id, source_group_id, source_message_id, question, requested_fields,
      state, answer, created_at, resolved_at
    ) VALUES (?, ?, ?, ?, ?, 'open', NULL, ?, NULL)
  `).run(
    itemId,
    item.sourceGroupId,
    item.sourceMessageId,
    input.question,
    JSON.stringify(input.requestedFields),
    at,
  );
  return Number(result.lastInsertRowid);
}

export function createReminderDelivery(
  db: Database.Database,
  input: NewReminderDelivery,
  at = new Date().toISOString(),
): boolean {
  const result = db.prepare(`
    INSERT OR IGNORE INTO reminder_deliveries (
      item_id, reminder_kind, scheduled_at, state, attempt_count, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, 'pending', 0, NULL, ?, ?)
  `).run(input.itemId, input.reminderKind, input.scheduledAt, at, at);
  return result.changes > 0;
}

export function markReminderDelivered(
  db: Database.Database,
  input: NewReminderDelivery,
  at = new Date().toISOString(),
): void {
  db.prepare(`
    UPDATE reminder_deliveries SET
      state = 'delivered', attempt_count = attempt_count + 1, last_error = NULL, updated_at = ?
    WHERE item_id = ? AND reminder_kind = ? AND scheduled_at = ?
  `).run(at, input.itemId, input.reminderKind, input.scheduledAt);
}

export function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(
  db: Database.Database,
  key: string,
  value: string,
  at = new Date().toISOString(),
): void {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, at);
}

export function clearSetting(db: Database.Database, key: string): void {
  db.prepare("DELETE FROM settings WHERE key = ?").run(key);
}

export interface TrackedWhatsAppGroup {
  groupId: string;
  subject: string;
  addressingMode: string | null;
  allowAllSenders: boolean;
  selectedAt: string;
}

const TRACKED_WHATSAPP_KEY = "whatsapp_tracking";

export function getTrackedWhatsAppGroup(db: Database.Database): TrackedWhatsAppGroup | null {
  const raw = getSetting(db, TRACKED_WHATSAPP_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.groupId !== "string" || typeof parsed.subject !== "string") return null;
    return {
      groupId: parsed.groupId,
      subject: parsed.subject,
      addressingMode: typeof parsed.addressingMode === "string" ? parsed.addressingMode : null,
      allowAllSenders: parsed.allowAllSenders === true,
      selectedAt: typeof parsed.selectedAt === "string" ? parsed.selectedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function setTrackedWhatsAppGroup(
  db: Database.Database,
  group: { groupId: string; subject: string; addressingMode: string | null; allowAllSenders?: boolean },
  at = new Date().toISOString(),
): TrackedWhatsAppGroup {
  const tracked: TrackedWhatsAppGroup = { ...group, allowAllSenders: group.allowAllSenders === true, selectedAt: at };
  setSetting(db, TRACKED_WHATSAPP_KEY, JSON.stringify(tracked), at);
  return tracked;
}

export function clearTrackedWhatsAppGroup(db: Database.Database): void {
  clearSetting(db, TRACKED_WHATSAPP_KEY);
}
