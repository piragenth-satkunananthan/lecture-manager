import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createOpenRouterAnnouncementExtractor,
  createOpenRouterGenerate,
  OpenRouterError,
  type ExtractedAnnouncement,
  type ExtractedItem,
  type OpenRouterRouteMetadata,
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
  httpStatus?: number;
  requestedModel: string;
  responseModel: string | null;
  selectedProvider: string | null;
}

interface ModelRun {
  provider: "OpenRouter";
  requestedModel: string;
  status: "passed" | "failed" | "incomplete";
  passed: boolean;
  fields: Record<string, FieldScore>;
  fixtures: FixtureResult[];
}

const fixtures = JSON.parse(await readFile("test/fixtures/lecturer-posts.json", "utf8")) as Fixture[];
const apiKey = process.env.OPENROUTER_API_KEY?.trim();
if (!apiKey) throw new Error("Set OPENROUTER_API_KEY in the process environment; no model calls were made");

const candidateModels = [...new Set(
  (process.env.OPENROUTER_CANDIDATE_MODELS || "google/gemma-4-31b-it:free")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean),
)];
if (candidateModels.length === 0 || candidateModels.some((model) => !model.includes("/") || !model.endsWith(":free") || /\s/.test(model))) {
  throw new Error("OPENROUTER_CANDIDATE_MODELS must contain only free OpenRouter model IDs ending in :free");
}

// Evaluation may test candidate endpoints that require non-ZDR routing. Production extraction keeps the
// adapter's default policy, which approves only the Gemma free exception.
const evaluationNonZdrModels = new Set(["google/gemma-4-31b-it:free", ...candidateModels]);

const timeZone = process.env.TIME_ZONE?.trim() || "Asia/Colombo";
const requestIntervalMs = Number(process.env.OPENROUTER_REQUEST_INTERVAL_MS?.trim() || "0");
if (!Number.isFinite(requestIntervalMs) || requestIntervalMs < 0) {
  throw new Error("OPENROUTER_REQUEST_INTERVAL_MS must be a non-negative number of milliseconds");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorKind(error: unknown): string {
  if (error instanceof OpenRouterError) return error.kind;
  return "invalid_output";
}

function addScores(target: Record<string, FieldScore>, source: Record<string, FieldScore>): void {
  for (const [field, score] of Object.entries(source)) {
    const total = target[field] ??= { matches: 0, total: 0 };
    total.matches += score.matches;
    total.total += score.total;
  }
}

async function runModel(
  model: string,
  extract: (fixture: Fixture) => Promise<{ result: ExtractedAnnouncement; route: OpenRouterRouteMetadata | null }>,
  routeAfterError: () => OpenRouterRouteMetadata | null,
): Promise<ModelRun> {
  const run: ModelRun = {
    provider: "OpenRouter",
    requestedModel: model,
    status: "passed",
    passed: true,
    fields: {},
    fixtures: [],
  };
  for (const [index, fixture] of fixtures.entries()) {
    if (index > 0 && requestIntervalMs > 0) await delay(requestIntervalMs);
    try {
      const { result, route } = await extract(fixture);
      const score = scoreExtraction(fixture.expected, result.items);
      addScores(run.fields, score.fields);
      const fixtureResult: FixtureResult = {
        fixtureId: fixture.id,
        outcome: score.passed ? "pass" : "mismatch",
        ...(score.mismatches.length ? { mismatches: score.mismatches } : {}),
        requestedModel: route?.requestedModel ?? model,
        responseModel: route?.responseModel ?? null,
        selectedProvider: route?.selectedProvider ?? null,
      };
      run.fixtures.push(fixtureResult);
      if (!score.passed) run.passed = false;
      if (!route?.selectedProvider || !route.responseModel) {
        fixtureResult.outcome = "route_missing";
        fixtureResult.errorKind = "missing_route_metadata";
        run.status = "incomplete";
        run.passed = false;
        break;
      }
    } catch (error) {
      const kind = errorKind(error);
      const status = error instanceof OpenRouterError ? error.status : undefined;
      const route = routeAfterError();
      run.fixtures.push({
        fixtureId: fixture.id,
        outcome: kind === "empty_response" ? "invalid_output" : "incomplete",
        errorKind: kind,
        ...(status !== undefined ? { httpStatus: status } : {}),
        requestedModel: route?.requestedModel ?? model,
        responseModel: route?.responseModel ?? null,
        selectedProvider: route?.selectedProvider ?? null,
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
  return run;
}

const runs: ModelRun[] = [];
for (const model of candidateModels) {
  let route: OpenRouterRouteMetadata | null = null;
  const extract = createOpenRouterAnnouncementExtractor(
    { apiKey, model, timeZone },
    createOpenRouterGenerate(apiKey, globalThis.fetch, (metadata) => { route = metadata; }, evaluationNonZdrModels),
  );
  runs.push(await runModel(model, async (fixture) => {
    route = null;
    return {
      result: await extract({ text: fixture.text, sentAt: new Date(fixture.sentAt) }),
      route,
    };
  }, () => route));
}

const generatedAt = new Date().toISOString();
const outputDirectory = join("artifacts", "model-comparison");
await mkdir(outputDirectory, { recursive: true });
const outputFile = join(outputDirectory, `${generatedAt.replace(/[:.]/g, "-")}.json`);
const passingFreeModels = runs.filter(({ status, passed }) => status === "passed" && passed).map(({ requestedModel }) => requestedModel);
await writeFile(outputFile, `${JSON.stringify({ generatedAt, fixtureCount: fixtures.length, passingFreeModels, runs }, null, 2)}\n`, { mode: 0o600 });
for (const run of runs) console.log(`${run.requestedModel}: ${run.status}; ${run.fixtures.length}/${fixtures.length} fixtures recorded`);
console.log(`Synthetic results saved to ${outputFile}`);
