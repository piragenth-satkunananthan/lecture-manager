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
      const field = String(key);
      const score = fields[field] ??= { matches: 0, total: 0 };
      score.total++;
      if (actualItem && canonical(expectedItem[key]) === canonical(actualItem[key])) {
        score.matches++;
      } else {
        mismatches.push(`items.${index}.${field}`);
      }
    }
  }

  return { passed: mismatches.length === 0, mismatches, fields };
}
