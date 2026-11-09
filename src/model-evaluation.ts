import type { ExtractedItem } from "./ai.js";

export interface FieldScore {
  matches: number;
  total: number;
}

export interface ExtractionScore {
  passed: boolean;
  mismatches: string[];
  fields: Record<string, FieldScore>;
}

const freeTextFields = new Set(["title", "details", "course", "location", "change_details"]);

function normalizeText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function freeTextMatches(expected: string, actual: string): boolean {
  const left = normalizeText(expected);
  const right = normalizeText(actual);
  if (left === right) return true;
  if (!left || !right) return false;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  return longer.includes(shorter) && shorter.length / longer.length >= 0.5;
}

function fieldMatches(field: string, expected: unknown, actual: unknown): boolean {
  if (freeTextFields.has(field)) {
    if (expected === null && actual === null) return true;
    if (typeof expected !== "string" || typeof actual !== "string") return false;
    return freeTextMatches(expected, actual);
  }
  return canonical(expected) === canonical(actual);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function scoreExtraction(expected: ExtractedItem[], actual: ExtractedItem[]): ExtractionScore {
  const fields: Record<string, FieldScore> = {
    item_count: { matches: Number(expected.length === actual.length), total: 1 },
  };
  const mismatches = expected.length === actual.length ? [] : ["item_count"];

  for (const [index, expectedItem] of expected.entries()) {
    const actualItem = actual[index];
    for (const key of Object.keys(expectedItem) as Array<keyof ExtractedItem>) {
      // Evidence validity is enforced by the extractor; the scorer compares factual fields and locally derived values.
      if (key === "field_evidence") continue;
      const field = String(key);
      const score = fields[field] ??= { matches: 0, total: 0 };
      score.total++;
      if (actualItem && fieldMatches(field, expectedItem[key], actualItem[key])) {
        score.matches++;
      } else {
        mismatches.push(`items.${index}.${field}`);
      }
    }
  }

  return { passed: mismatches.length === 0, mismatches, fields };
}
