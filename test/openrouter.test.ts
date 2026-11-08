import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createOpenRouterAnnouncementExtractor,
  createOpenRouterGenerate,
  type ExtractedItem,
  type ExtractionRequest,
} from "../src/ai.js";

const config = {
  apiKey: "test-openrouter-key",
  model: "google/gemma-4-31b-it:free",
  timeZone: "Asia/Colombo",
};

const request: ExtractionRequest = {
  model: config.model,
  input: "{}",
  systemInstruction: "Extract facts only.",
  schema: { type: "object" } as ExtractionRequest["schema"],
};

test("sends one sanitized JSON-mode request and reuses local extraction validation", async () => {
  const fixtures = JSON.parse(await readFile("test/fixtures/lecturer-posts.json", "utf8")) as Array<{
    sentAt: string;
    text: string;
    expected: ExtractedItem[];
  }>;
  const fixture = fixtures[0];
  assert.ok(fixture);
  const expected = fixture.expected[0];
  assert.ok(expected);
  const { zoom_url: _zoomUrl, ...modelItem } = expected;
  let captured: { url: string; init: RequestInit } | undefined;
  let route: { requestedModel: string; responseModel: string | null; selectedProvider: string | null } | undefined;
  let calls = 0;
  const fetchImplementation: typeof fetch = async (input, init) => {
    calls++;
    captured = { url: String(input), init: init ?? {} };
    return Response.json({
      model: config.model,
      openrouter_metadata: { endpoints: { available: [{ provider: "Google AI Studio", selected: true }] } },
      choices: [{ message: { content: JSON.stringify({ items: [{ ...modelItem, zoom_link_index: null }] }) } }],
    });
  };
  const extractor = createOpenRouterAnnouncementExtractor(config, createOpenRouterGenerate(
    config.apiKey,
    fetchImplementation,
    (result) => { route = result; },
  ));
  const sourceText = `${fixture.text} Join https://us02web.zoom.us/j/00000000001?pwd=private-passcode`;
  const result = await extractor({ text: sourceText, sentAt: new Date(fixture.sentAt) });

  assert.equal(calls, 1);
  assert.equal(captured?.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(captured?.init.method, "POST");
  assert.equal(new Headers(captured?.init.headers).get("authorization"), `Bearer ${config.apiKey}`);
  assert.equal(new Headers(captured?.init.headers).get("content-type"), "application/json");
  assert.equal(new Headers(captured?.init.headers).get("x-openrouter-metadata"), "enabled");
  assert.deepEqual(route, {
    requestedModel: config.model,
    responseModel: config.model,
    selectedProvider: "Google AI Studio",
  });
  const body = JSON.parse(String(captured?.init.body)) as {
    model: string;
    messages: Array<{ role: string; content: string }>;
    response_format: { type: string };
    provider: { require_parameters: boolean };
    stream: boolean;
  };
  assert.equal(body.model, config.model);
  assert.deepEqual(body.messages.map(({ role }) => role), ["system", "user"]);
  assert.equal(body.response_format.type, "json_object");
  assert.equal(body.provider.require_parameters, true);
  assert.equal(body.stream, false);
  assert.doesNotMatch(JSON.stringify(body), /message_id|group_id|sender_id|us02web\.zoom\.us|private-passcode/);
  const modelInput = JSON.parse(body.messages[1]?.content ?? "{}") as {
    sent_at: string;
    time_zone: string;
    message: string;
    links: Array<{ index: number; is_zoom: boolean }>;
  };
  assert.equal(modelInput.sent_at, new Date(fixture.sentAt).toISOString());
  assert.equal(modelInput.time_zone, "Asia/Colombo");
  assert.match(modelInput.message, /\[LINK_1\]/);
  assert.deepEqual(modelInput.links, [{ index: 1, is_zoom: true }]);
  assert.deepEqual(result.items, [expected]);

  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, async () => JSON.stringify({
      items: [{ ...modelItem, title: "Invented title", zoom_link_index: null }],
    }))({
      text: fixture.text,
      sentAt: new Date(fixture.sentAt),
    }),
    /unsupported evidence for title/,
  );
});

test("rejects missing credentials and non-free model IDs before making a request", async () => {
  let calls = 0;
  const fetchImplementation: typeof fetch = async () => {
    calls++;
    return Response.json({ choices: [] });
  };
  assert.throws(() => createOpenRouterGenerate(" ", fetchImplementation), /OPENROUTER_API_KEY/);
  const generate = createOpenRouterGenerate(config.apiKey, fetchImplementation);
  await assert.rejects(generate({ ...request, model: "google/gemma-4-31b-it" }), /free model ID/);
  assert.throws(() => createOpenRouterAnnouncementExtractor({ ...config, model: "openai/paid-model" }), /free model ID/);
  assert.equal(calls, 0);
});

test("surfaces authentication, rate-limit, upstream, and timeout failures without retrying", async () => {
  for (const [status, message] of [
    [401, /authentication failed/],
    [429, /rate limit/],
    [503, /service failed/],
  ] as const) {
    let calls = 0;
    const generate = createOpenRouterGenerate(config.apiKey, async () => {
      calls++;
      return Response.json({ error: { message: "private provider response" } }, { status });
    });
    await assert.rejects(generate(request), message);
    assert.equal(calls, 1);
  }

  let timeoutCalls = 0;
  const timeoutGenerate = createOpenRouterGenerate(config.apiKey, async () => {
    timeoutCalls++;
    throw new DOMException("aborted", "AbortError");
  });
  await assert.rejects(timeoutGenerate(request), /timed out/);
  assert.equal(timeoutCalls, 1);
});

test("aborts a stalled OpenRouter request at the 60-second limit", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let requestSignal: AbortSignal | undefined;
  const generate = createOpenRouterGenerate(config.apiKey, (_input, init) => new Promise((_resolve, reject) => {
    requestSignal = init?.signal ?? undefined;
    requestSignal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
  }));
  try {
    const pending = generate(request);
    t.mock.timers.tick(60_000);
    await assert.rejects(pending, /timed out after 60 seconds/);
    assert.equal(requestSignal?.aborted, true);
  } finally {
    t.mock.timers.reset();
  }
});

test("rejects malformed, empty, and unexpected API responses", async () => {
  const responses: Response[] = [
    new Response("not JSON"),
    Response.json({ choices: [{ message: { content: "" } }] }),
    Response.json({ choices: [] }),
  ];
  const errors = [/invalid response body/, /no structured response/, /invalid response shape/];
  for (let index = 0; index < responses.length; index++) {
    const generate = createOpenRouterGenerate(config.apiKey, async () => responses[index]!);
    await assert.rejects(generate(request), errors[index]!);
  }
});
