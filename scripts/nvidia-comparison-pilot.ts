import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createNvidiaAnnouncementExtractor,
  createNvidiaGenerate,
  NvidiaError,
  type ExtractedAnnouncement,
  type ExtractedItem,
  type NvidiaRouteMetadata,
} from "../src/ai.js";
import { scoreExtraction, type FieldScore } from "../src/model-evaluation.js";

interface Fixture {
  id: string;
  sentAt: string;
  text: string;
  expected: ExtractedItem[];
}

interface FixtureResult {
  fixtureId: string;
  outcome: "pass" | "mismatch" | "invalid_output" | "incomplete" | "route_missing";
  mismatches?: string[];
  errorKind?: string;
  errorDetail?: string;
  httpStatus?: number;
  requestedModel: string;
  responseModel: string | null;
}

interface ModelRun {
  provider: "NVIDIA Build";
  requestedModel: string;
  status: "passed" | "failed" | "incomplete";
  passed: boolean;
  fields: Record<string, FieldScore>;
  fixtures: FixtureResult[];
}

const fixtureSource = process.env.NVIDIA_FIXTURES?.trim() || "test/fixtures/lecturer-posts.json";
const fixtures = JSON.parse(await readFile(fixtureSource, "utf8")) as Fixture[];
const apiKey = process.env.NVIDIA_API_KEY?.trim();
if (!apiKey) throw new Error("Set NVIDIA_API_KEY in the process environment; no model calls were made");

const model = process.env.NVIDIA_MODEL?.trim() || "nvidia/nemotron-3.5-lightning-30b-a3b";
const timeZone = process.env.TIME_ZONE?.trim() || "Asia/Colombo";
const requestIntervalMs = Number(process.env.NVIDIA_REQUEST_INTERVAL_MS?.trim() || "0");
if (!Number.isFinite(requestIntervalMs) || requestIntervalMs < 0) {
  throw new Error("NVIDIA_REQUEST_INTERVAL_MS must be a non-negative number of milliseconds");
}
const maxTokens = Number(process.env.NVIDIA_MAX_TOKENS?.trim() || "4096");
if (!Number.isSafeInteger(maxTokens) || maxTokens < 1) {
  throw new Error("NVIDIA_MAX_TOKENS must be a positive integer");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorKind(error: unknown): string {
  if (error instanceof NvidiaError) return error.kind;
  return "invalid_output";
}

function addScores(target: Record<string, FieldScore>, source: Record<string, FieldScore>): void {
  for (const [field, score] of Object.entries(source)) {
    const total = target[field] ??= { matches: 0, total: 0 };
    total.matches += score.matches;
    total.total += score.total;
  }
}

const run: ModelRun = {
  provider: "NVIDIA Build",
  requestedModel: model,
  status: "passed",
  passed: true,
  fields: {},
  fixtures: [],
};

let route: NvidiaRouteMetadata | null = null;
const currentRoute = (): NvidiaRouteMetadata | null => route;
const extract = createNvidiaAnnouncementExtractor(
  { apiKey, model, timeZone },
  createNvidiaGenerate(apiKey, globalThis.fetch, (metadata) => { route = metadata; }, maxTokens),
);

for (const [index, fixture] of fixtures.entries()) {
  if (index > 0 && requestIntervalMs > 0) await delay(requestIntervalMs);
  route = null;
  try {
    const result: ExtractedAnnouncement = await extract({ text: fixture.text, sentAt: new Date(fixture.sentAt) });
    const score = scoreExtraction(fixture.expected, result.items);
    addScores(run.fields, score.fields);
    const fixtureResult: FixtureResult = {
      fixtureId: fixture.id,
      outcome: score.passed ? "pass" : "mismatch",
      ...(score.mismatches.length ? { mismatches: score.mismatches } : {}),
      requestedModel: currentRoute()?.requestedModel ?? model,
      responseModel: currentRoute()?.responseModel ?? null,
    };
    run.fixtures.push(fixtureResult);
    if (!score.passed) run.passed = false;
    if (!currentRoute()?.responseModel) {
      fixtureResult.outcome = "route_missing";
      fixtureResult.errorKind = "missing_route_metadata";
      run.status = "incomplete";
      run.passed = false;
      break;
    }
  } catch (error) {
    const kind = errorKind(error);
    const status = error instanceof NvidiaError ? error.status : undefined;
    const detail = error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 240) : undefined;
    run.fixtures.push({
      fixtureId: fixture.id,
      outcome: kind === "empty_response" ? "invalid_output" : "incomplete",
      errorKind: kind,
      ...(kind === "invalid_output" && detail ? { errorDetail: detail } : {}),
      ...(status !== undefined ? { httpStatus: status } : {}),
      requestedModel: currentRoute()?.requestedModel ?? model,
      responseModel: currentRoute()?.responseModel ?? null,
    });
    run.passed = false;
    if (kind !== "empty_response" && kind !== "invalid_output") {
      run.status = "incomplete";
      break;
    }
    run.status = "failed";
  }
}
if (run.status !== "incomplete" && !run.passed) run.status = "failed";

const generatedAt = new Date().toISOString();
const outputDirectory = join("artifacts", "model-comparison");
await mkdir(outputDirectory, { recursive: true });
const outputFile = join(outputDirectory, `${generatedAt.replace(/[:.]/g, "-")}.json`);
const passingModels = run.status === "passed" && run.passed ? [model] : [];
await writeFile(outputFile, `${JSON.stringify({ generatedAt, provider: "NVIDIA Build", fixtureSource, fixtureCount: fixtures.length, passingModels, runs: [run] }, null, 2)}\n`, { mode: 0o600 });
console.log(`${model}: ${run.status}; ${run.fixtures.length}/${fixtures.length} fixtures recorded`);
console.log(`NVIDIA Build results saved to ${outputFile}`);
