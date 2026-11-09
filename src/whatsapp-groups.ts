import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface CachedWhatsAppGroup {
  id: string;
  subject: string;
  addressingMode: string | null;
  size: number;
  owner: string | null;
  description: string | null;
}

export interface WhatsAppGroupCache {
  generatedAt: string;
  groups: CachedWhatsAppGroup[];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function readGroupCache(path: string): WhatsAppGroupCache | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (!Array.isArray(record.groups)) return null;
    const groups: CachedWhatsAppGroup[] = [];
    for (const value of record.groups) {
      if (typeof value !== "object" || value === null) continue;
      const group = value as Record<string, unknown>;
      const id = asString(group.id);
      const subject = asString(group.subject);
      if (!id || !subject) continue;
      groups.push({
        id,
        subject,
        addressingMode: asString(group.addressingMode),
        size: typeof group.size === "number" && Number.isFinite(group.size) ? group.size : 0,
        owner: asString(group.owner),
        description: asString(group.description),
      });
    }
    return {
      generatedAt: asString(record.generatedAt) ?? new Date(0).toISOString(),
      groups,
    };
  } catch {
    return null;
  }
}

export function writeGroupCache(
  path: string,
  groups: CachedWhatsAppGroup[],
  generatedAt = new Date().toISOString(),
): WhatsAppGroupCache {
  const cache = { generatedAt, groups };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cache, null, 2), { mode: 0o600 });
  return cache;
}
