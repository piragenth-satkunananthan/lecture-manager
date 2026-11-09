import type Database from "better-sqlite3";
import {
  createClarification,
  createPlannerItem,
  getSourceMessage,
  transitionExtractionState,
  type SourceMessage,
  type SourceMessageKey,
} from "./db.js";
import { confirmPlannerItem } from "./planner.js";
import { ensureReminderSchedule } from "./reminders.js";
import { NvidiaError, OpenRouterError, type ExtractedItem } from "./ai.js";

export interface ExtractionSource {
  text: string;
  sentAt: Date;
}

export type ExtractionRunner = (source: ExtractionSource) => Promise<{ items: ExtractedItem[] }>;

export interface ProcessSourceOptions {
  enabled: boolean;
  now?: string;
}

export interface ProcessSourceResult {
  source: SourceMessage;
  itemIds: number[];
  pending: boolean;
}

function failureCode(error: unknown): string {
  if (error instanceof NvidiaError || error instanceof OpenRouterError) return error.kind;
  return "invalid_output";
}

function missingRequiredFields(item: ExtractedItem): string[] {
  const required = item.kind === "assignment"
    ? ["title", "due_date"]
    : ["title", "class_date", "class_time"];
  return required.filter((field) => {
    const value = item[field as keyof ExtractedItem];
    return value === null || item.ambiguous_fields.some((ambiguous) => ambiguous === field);
  });
}

export async function processSourceMessage(
  db: Database.Database,
  key: SourceMessageKey,
  extract: ExtractionRunner,
  options: ProcessSourceOptions,
): Promise<ProcessSourceResult> {
  if (!options.enabled) throw new Error("Extraction is disabled");

  const source = getSourceMessage(db, key);
  if (!source) throw new Error("Source message not found");
  if (source.extractionState !== "received" && source.extractionState !== "failed") {
    throw new Error(`Cannot extract a source message in state ${source.extractionState}`);
  }

  const now = options.now ?? new Date().toISOString();
  transitionExtractionState(db, key, "extracting", { at: now });

  try {
    const result = await extract({ text: source.rawText, sentAt: new Date(source.sentAt) });

    const persisted = db.transaction(() => {
      const itemIds: number[] = [];
      let pending = false;

      for (const item of result.items) {
        const itemId = createPlannerItem(db, {
          sourceGroupId: key.groupId,
          sourceMessageId: key.messageId,
          kind: item.kind,
          title: item.title,
          details: item.details,
          course: item.course,
          location: item.location,
          dueDate: item.due_date,
          dueTime: item.due_time,
          classDate: item.class_date,
          classTime: item.class_time,
          changeType: item.change_type,
          changeDetails: item.change_details,
          zoomUrl: item.zoom_url,
          ambiguousFields: item.ambiguous_fields,
          fieldEvidence: item.field_evidence as Record<string, Array<{ quote: string }>>,
        }, now);

        const missing = missingRequiredFields(item);
        if (missing.length > 0) {
          pending = true;
          createClarification(db, itemId, {
            question: `Please confirm ${missing.join(", ")} for ${item.title ?? "this item"}.`,
            requestedFields: missing,
          }, now);
        } else {
          confirmPlannerItem(db, itemId, now);
          ensureReminderSchedule(db, itemId, now);
        }
        itemIds.push(itemId);
      }

      return { itemIds, pending };
    })();

    const updated = transitionExtractionState(db, key, persisted.pending ? "pending_review" : "confirmed", { at: now });
    return { source: updated, itemIds: persisted.itemIds, pending: persisted.pending };
  } catch (error) {
    try {
      transitionExtractionState(db, key, "failed", { failureCode: failureCode(error), at: now });
    } catch {
      // Preserve the original extraction error if the failure transition cannot be recorded.
    }
    throw error;
  }
}
