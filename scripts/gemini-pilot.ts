import { readFile } from "node:fs/promises";
import { createAnnouncementExtractor, type ExtractedAnnouncement } from "../src/ai.js";

interface Fixture {
  id: string;
  sentAt: string;
  text: string;
  expected: Array<Record<string, unknown>>;
}

const fixtures = JSON.parse(await readFile("test/fixtures/lecturer-posts.json", "utf8")) as Fixture[];
const requestedId = process.argv[2];
const selectedFixtures = requestedId ? fixtures.filter((fixture) => fixture.id === requestedId) : fixtures;
if (selectedFixtures.length === 0) throw new Error(`No fixture found for ${requestedId}`);

const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
if (!geminiApiKey) throw new Error("Set GEMINI_API_KEY before running the Gemini pilot");
const config = {
  geminiApiKey,
  geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
  timeZone: process.env.TIME_ZONE?.trim() || "Asia/Colombo",
};
const extract = createAnnouncementExtractor(config);
let failures = 0;

for (const fixture of selectedFixtures) {
  try {
    const actual = await extract({ text: fixture.text, sentAt: new Date(fixture.sentAt) });
    const expected = fixture.expected as ExtractedAnnouncement["items"];
    if (actual.items.length !== expected.length) {
      console.error(`${fixture.id}: expected ${expected.length} item(s), received ${actual.items.length}`);
      failures++;
      continue;
    }
    const mismatches = expected.flatMap((expectedItem, index) => {
      const item = actual.items[index];
      if (!item) return [`item ${index}`];
      return Object.entries(expectedItem)
        .filter(([key, value]) => JSON.stringify(item[key as keyof typeof item]) !== JSON.stringify(value))
        .map(([key]) => `item ${index} ${key}`);
    });
    if (mismatches.length > 0) {
      console.error(`${fixture.id}: mismatch in ${mismatches.join(", ")}`);
      failures++;
    } else {
      console.log(`${fixture.id}: pass`);
    }
  } catch (error) {
    const errorRecord = typeof error === "object" && error !== null
      ? error as { status?: unknown; code?: unknown; cause?: { code?: unknown } }
      : undefined;
    const detail = typeof errorRecord?.status === "number" ? String(errorRecord.status)
      : typeof errorRecord?.code === "string" ? errorRecord.code
        : typeof errorRecord?.cause?.code === "string" ? errorRecord.cause.code
          : error instanceof Error ? error.name : "unknown error";
    console.error(`${fixture.id}: Gemini extraction failed (${detail})`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`Gemini pilot failed: ${failures}/${selectedFixtures.length} fixture(s)`);
  process.exitCode = 1;
} else {
  console.log(`Gemini pilot passed: ${selectedFixtures.length} fixture(s) with ${config.geminiModel}`);
}
