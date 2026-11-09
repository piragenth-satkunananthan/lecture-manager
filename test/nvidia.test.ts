import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createNvidiaAnnouncementExtractor,
  createNvidiaGenerate,
  NvidiaError,
  type ExtractedItem,
  type ExtractionRequest,
} from "../src/ai.js";

const config = {
  apiKey: "test-nvidia-key",
  model: "nvidia/nemotron-3.5-lightning-30b-a3b",
  timeZone: "Asia/Colombo",
};

const request: ExtractionRequest = {
  model: config.model,
  input: "{}",
  systemInstruction: "Extract facts only.",
};

test("sends one JSON-mode request to NVIDIA Build without OpenRouter provider controls", async () => {
  let captured: { url: string; init: RequestInit } | undefined;
  let route: { requestedModel: string; responseModel: string | null } | undefined;
  const generate = createNvidiaGenerate(
    config.apiKey,
    async (input, init) => {
      captured = { url: String(input), init: init ?? {} };
      return Response.json({
        model: config.model,
        choices: [{ message: { content: "{\"items\":[]}" } }],
      });
    },
    (metadata) => { route = metadata; },
  );

  const content = await generate(request);
  assert.equal(content, "{\"items\":[]}");
  assert.equal(captured?.url, "https://integrate.api.nvidia.com/v1/chat/completions");
  assert.equal(captured?.init.method, "POST");
  assert.equal(new Headers(captured?.init.headers).get("authorization"), `Bearer ${config.apiKey}`);
  assert.deepEqual(route, { requestedModel: config.model, responseModel: config.model });

  const body = JSON.parse(String(captured?.init.body)) as {
    model: string;
    messages: Array<{ role: string }>;
    response_format: { type: string };
    stream: boolean;
    provider?: unknown;
    max_tokens: number;
    temperature: number;
    chat_template_kwargs: { enable_thinking: boolean };
  };
  assert.equal(body.model, config.model);
  assert.deepEqual(body.messages.map(({ role }) => role), ["system", "user"]);
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.equal(body.stream, false);
  assert.equal(body.max_tokens, 4096);
  assert.equal(body.temperature, 0);
  assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false });
  assert.equal(body.provider, undefined);
});

test("rejects missing NVIDIA credentials and empty models before making a request", () => {
  assert.throws(() => createNvidiaGenerate(" "), /NVIDIA_API_KEY/);
  assert.throws(
    () => createNvidiaAnnouncementExtractor({ ...config, model: " " }),
    /NVIDIA_MODEL/,
  );
});

test("surfaces NVIDIA authentication, rate-limit, upstream, and timeout failures without retrying", async () => {
  for (const [status, message] of [
    [401, /authentication failed/],
    [429, /rate limit/],
    [503, /service failed/],
  ] as const) {
    let calls = 0;
    const generate = createNvidiaGenerate(config.apiKey, async () => {
      calls++;
      return Response.json({ title: "error" }, { status });
    });
    await assert.rejects(generate(request), (error: Error) => {
      assert.ok(error instanceof NvidiaError);
      assert.equal(error.status, status);
      assert.match(error.message, message);
      return true;
    });
    assert.equal(calls, 1);
  }

  let timeoutCalls = 0;
  const timeoutGenerate = createNvidiaGenerate(config.apiKey, async () => {
    timeoutCalls++;
    throw new DOMException("aborted", "AbortError");
  });
  await assert.rejects(timeoutGenerate(request), /timed out/);
  assert.equal(timeoutCalls, 1);
});

test("rejects malformed, empty, and unexpected NVIDIA responses", async () => {
  const responses: Response[] = [
    new Response("not JSON"),
    Response.json({ choices: [{ message: { content: "" } }] }),
    Response.json({ choices: [] }),
  ];
  const errors = [/invalid response body/, /no structured response/, /invalid response shape/];
  for (let index = 0; index < responses.length; index++) {
    const generate = createNvidiaGenerate(config.apiKey, async () => responses[index]!);
    await assert.rejects(generate(request), errors[index]!);
  }
});

test("normalizes NVIDIA structural artifacts without relaxing evidence", async () => {
  const fixtures = JSON.parse(await readFile("test/fixtures/lecturer-posts.json", "utf8")) as Array<{
    id: string;
    sentAt: string;
    text: string;
    expected: ExtractedItem[];
  }>;
  const fixture = fixtures.find(({ id }) => id === "class-without-time");
  assert.ok(fixture);
  const expected = fixture.expected[0];
  assert.ok(expected);

  const extractor = createNvidiaAnnouncementExtractor(config, async () => JSON.stringify({
    items: [{
      kind: "class",
      title: "Online lecture",
      class_date: "2026-11-08",
      ambiguous_fields: ["class_time", "zoom_link_index"],
      field_evidence: {
        kind: [{ quote: "lecture" }],
        title: [{ quote: "online lecture" }],
        class_date: [{ quote: "Next online lecture is on 8 November 2026" }],
        ambiguous_fields: [],
      },
    }],
  }));
  const result = await extractor({ text: fixture.text, sentAt: new Date(fixture.sentAt) });
  assert.deepEqual(result.items, [expected]);
});

test("reuses the local extraction validation for an NVIDIA model", async () => {
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
  const extractor = createNvidiaAnnouncementExtractor(config, async () => JSON.stringify({
    items: [{ ...modelItem, zoom_link_index: null }],
  }));
  const sourceText = `${fixture.text} Join https://us02web.zoom.us/j/00000000001?pwd=private-passcode`;
  const result = await extractor({ text: sourceText, sentAt: new Date(fixture.sentAt) });
  assert.deepEqual(result.items, [expected]);

  await assert.rejects(
    createNvidiaAnnouncementExtractor(config, async () => JSON.stringify({
      items: [{ ...modelItem, title: "Invented title", zoom_link_index: null }],
    }))({ text: fixture.text, sentAt: new Date(fixture.sentAt) }),
    /unsupported evidence for title/,
  );
});
