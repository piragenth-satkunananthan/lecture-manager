import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createAnnouncementExtractor,
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
  requestedModel: string;
  responseModel: string | null;
  selectedProvider: string | null;
}

interface ProviderRun {
  provider: "Gemini" | "OpenRouter";
  requestedModel: string;
  status: "passed" | "failed" | "incomplete";
  passed: boolean;
  fields: Record<string, FieldScore>;
  fixtures: FixtureResult[];
}

const fixtures = JSON.parse(await readFile("test/fixtures/lecturer-posts.json", "utf8")) as Fixture[];
const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim();
if (!geminiApiKey || !openRouterApiKey) {
  throw new Error("Set GEMINI_API_KEY and OPENROUTER_API_KEY in the process environment; no model calls were made");
}

const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
const candidateModels = [...new Set(
  (process.env.OPENROUTER_CANDIDATE_MODELS || "google/gemma-4-31b-it:free")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean),
)];
if (candidateModels.length === 0 || candidateModels.some((model) => !model.includes("/") || !model.endsWith(":free") || /\s/.test(model))) {
  throw new Error("OPENROUTER_CANDIDATE_MODELS must contain only free OpenRouter model IDs ending in :free");
}

const timeZone = process.env.TIME_ZONE?.trim() || "Asia/Colombo";
const runs: ProviderRun[] = [];

function errorKind(error: unknown): string {
  if (error instanceof OpenRouterError) return error.kind;
  const record = typeof error === "object" && error !== null
    ? error as { status?: unknown; code?: unknown; cause?: { code?: unknown }; name?: unknown }
    : undefined;
  if (record?.status === 401 || record?.status === 403) return "authentication";
  if (record?.status === 429) return "rate_limit";
  if (record?.status === 408 || record?.status === 504 || record?.name === "TimeoutError") return "timeout";
  if (typeof record?.status === "number" && record.status >= 500) return "upstream";
  const code = record?.code ?? record?.cause?.code;
  if (typeof code === "string" && ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN"].includes(code)) return "network";
  return "invalid_output";
}

function addScores(target: Record<string, FieldScore>, source: Record<string, FieldScore>): void {
  for (const [field, score] of Object.entries(source)) {
    const total = target[field] ??= { matches: 0, total: 0 };
    total.matches += score.matches;
    total.total += score.total;
  }
}

async function runProvider(
  provider: ProviderRun["provider"],
  model: string,
  extract: (fixture: Fixture) => Promise<{ result: ExtractedAnnouncement; route: OpenRouterRouteMetadata | null }>,
  routeAfterError: () => OpenRouterRouteMetadata | null = () => null,
): Promise<ProviderRun> {
  const run: ProviderRun = { provider, requestedModel: model, status: "passed", passed: true, fields: {}, fixtures: [] };
  for (const fixture of fixtures) {
    try {
      const { result, route } = await extract(fixture);
      const score = scoreExtraction(fixture.expected, result.items);
      addScores(run.fields, score.fields);
      const fixtureResult: FixtureResult = {
        fixtureId: fixture.id,
        outcome: score.passed ? "pass" : "mismatch",
        ...(score.mismatches.length ? { mismatches: score.mismatches } : {}),
        requestedModel: route?.requestedModel ?? model,
        responseModel: route?.responseModel ?? (provider === "Gemini" ? model : null),
        selectedProvider: route?.selectedProvider ?? (provider === "Gemini" ? "Google" : null),
      };
      run.fixtures.push(fixtureResult);
      if (!score.passed) run.passed = false;
      if (provider === "OpenRouter" && !route?.selectedProvider) {
        fixtureResult.outcome = "route_missing";
        fixtureResult.errorKind = "missing_route_metadata";
        run.status = "incomplete";
        run.passed = false;
        break;
      }
    } catch (error) {
      const kind = errorKind(error);
      const route = routeAfterError();
      run.fixtures.push({
        fixtureId: fixture.id,
        outcome: kind === "invalid_output" || kind === "empty_response" ? "invalid_output" : "incomplete",
        errorKind: kind,
        requestedModel: route?.requestedModel ?? model,
        responseModel: route?.responseModel ?? null,
        selectedProvider: route?.selectedProvider ?? null,
      });
      run.passed = false;
      if (kind !== "invalid_output" && kind !== "empty_response") {
        run.status = "incomplete";
        break;
      }
      run.status = "failed";
    }
  }
  if (run.status !== "incomplete" && !run.passed) run.status = "failed";
  return run;
}

const extractWithGemini = createAnnouncementExtractor({ geminiApiKey, geminiModel, timeZone });
runs.push(await runProvider("Gemini", geminiModel, async (fixture) => ({
  result: await extractWithGemini({
    text: fixture.text,
    sentAt: new Date(fixture.sentAt),
  }),
  route: null,
})));

for (const model of candidateModels) {
  let route: OpenRouterRouteMetadata | null = null;
  const extract = createOpenRouterAnnouncementExtractor(
    { apiKey: openRouterApiKey, model, timeZone },
    createOpenRouterGenerate(openRouterApiKey, globalThis.fetch, (metadata) => { route = metadata; }),
  );
  runs.push(await runProvider("OpenRouter", model, async (fixture) => {
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
const geminiRun = runs.find(({ provider }) => provider === "Gemini");
const baselineComplete = geminiRun?.status !== "incomplete" && geminiRun?.fixtures.length === fixtures.length;
const eligibleFreeModels = baselineComplete
  ? runs.filter(({ provider, status, passed }) => provider === "OpenRouter" && status === "passed" && passed).map(({ requestedModel }) => requestedModel)
  : [];
await writeFile(outputFile, `${JSON.stringify({ generatedAt, fixtureCount: fixtures.length, baselineComplete, eligibleFreeModels, runs }, null, 2)}\n`, { mode: 0o600 });
for (const run of runs) console.log(`${run.provider} ${run.requestedModel}: ${run.status}; ${run.fixtures.length}/${fixtures.length} fixtures recorded`);
console.log(`Synthetic results saved to ${outputFile}`);
