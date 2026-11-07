import assert from "node:assert/strict";
import test from "node:test";
import type { GoogleGenAI } from "@google/genai";
import {
  createAnnouncementExtractor,
  createGeminiGenerate,
  type ExtractedAnnouncement,
  type GeminiGenerate,
  type GeminiRequest,
} from "../src/ai.js";

const config = {
  geminiApiKey: "test-gemini-api-key",
  geminiModel: "gemini-3.8-flash",
  timeZone: "Asia/Colombo",
};

const assignment: ExtractedAnnouncement = {
  items: [
    {
      kind: "assignment",
      title: "Assignment 2",
      details: "Submit the data structures assignment.",
      due_date: "2026-11-10",
      due_time: "17:00",
      class_date: null,
      class_time: null,
      zoom_url: null,
      ambiguous_fields: [],
    },
  ],
};

const modelAssignment = {
  kind: "assignment",
  title: "Assignment 2",
  details: "Submit the data structures assignment.",
  due_date: "2026-11-10",
  due_time: "17:00",
  class_date: null,
  class_time: null,
  zoom_link_index: null,
  ambiguous_fields: [],
};

function fakeGenerate(value: unknown, onRequest?: (request: GeminiRequest) => void): GeminiGenerate {
  return async (request) => {
    onRequest?.(request);
    return JSON.stringify(value);
  };
}

test("sends only selected message content and local Zoom-link indexes to Gemini", async () => {
  let request: GeminiRequest | undefined;
  const result = await createAnnouncementExtractor(config, fakeGenerate({ items: [modelAssignment] }, (sent) => {
    request = sent;
  }))({
    text: "Data Structures assignment 2: submit by 10 November 2026 at 5 PM. Join https://us02web.zoom.us/j/00000000001?pwd=synthetic",
    sentAt: new Date("2026-11-07T03:30:00.000Z"),
  });

  assert.deepEqual(result, assignment);
  assert.equal(request?.model, "gemini-3.8-flash");
  assert.match(request?.systemInstruction ?? "", /untrusted data/);
  assert.ok(request?.schema);
  const input = JSON.parse(request?.input ?? "{}") as {
    sent_at: string;
    time_zone: string;
    message: string;
    links: Array<{ index: number; is_zoom: boolean }>;
  };
  assert.equal(input.sent_at, "2026-11-07T03:30:00.000Z");
  assert.equal(input.time_zone, "Asia/Colombo");
  assert.match(input.message, /\[LINK_1\]/);
  assert.doesNotMatch(input.message, /zoom\.us|synthetic/);
  assert.deepEqual(input.links, [{ index: 1, is_zoom: true }]);
});

test("skips empty messages and rejects invalid timestamps without calling Gemini", async () => {
  let called = false;
  const generate: GeminiGenerate = async () => {
    called = true;
    return "{}";
  };
  const extract = createAnnouncementExtractor(config, generate);
  assert.deepEqual(await extract({ text: "  ", sentAt: new Date() }), { items: [] });
  assert.equal(called, false);
  await assert.rejects(extract({ text: "assignment", sentAt: new Date("invalid") }), /timestamp is invalid/);
  assert.equal(called, false);
});

test("rejects malformed model output and non-calendar dates", async () => {
  const source = { text: "Assignment due 30 February 2026.", sentAt: new Date() };
  await assert.rejects(
    createAnnouncementExtractor(config, async () => "not JSON")(source),
    /invalid structured data/,
  );
  await assert.rejects(
    createAnnouncementExtractor(config, fakeGenerate({ items: [{ ...modelAssignment, due_date: "2026-02-30" }] }))(source),
    /invalid calendar date/,
  );
});

test("rejects indexes that do not identify an HTTPS Zoom URL from the source", async () => {
  const classItem = {
    kind: "class",
    title: "Lecture",
    details: null,
    due_date: null,
    due_time: null,
    class_date: "2026-11-08",
    class_time: "09:30",
    zoom_link_index: 1,
    ambiguous_fields: [],
  };
  for (const url of [
    "https://example.test/meeting",
    "http://us02web.zoom.us/j/12345678901",
  ]) {
    await assert.rejects(
      createAnnouncementExtractor(config, fakeGenerate({ items: [classItem] }))({
        text: `Join ${url}`,
        sentAt: new Date(),
      }),
      /invalid Zoom link index/,
    );
  }
  await assert.rejects(
    createAnnouncementExtractor(config, fakeGenerate({ items: [{ ...classItem, zoom_url: "https://model.test/" }] }))({
      text: "Lecture",
      sentAt: new Date(),
    }),
    /zoom_url/,
  );
});

test("reattaches the selected source Zoom URL locally and preserves unresolved class time", async () => {
  const zoomUrl = "https://us02web.zoom.us/j/12345678901?pwd=synthetic";
  const result = await createAnnouncementExtractor(config, fakeGenerate({
    items: [{
      kind: "class",
      title: "Lecture",
      details: null,
      due_date: null,
      due_time: null,
      class_date: "2026-11-08",
      class_time: null,
      zoom_link_index: 1,
      ambiguous_fields: ["class_time", "zoom_url"],
    }],
  }))({
    text: `Next lecture is on 8 November. Join ${zoomUrl}`,
    sentAt: new Date("2026-11-07T03:30:00.000Z"),
  });

  assert.equal(result.items[0]?.zoom_url, zoomUrl);
  assert.deepEqual(result.items[0]?.ambiguous_fields, ["class_time"]);

  const withoutLink = await createAnnouncementExtractor(config, fakeGenerate({
    items: [{
      kind: "class",
      title: "Lecture",
      details: null,
      due_date: null,
      due_time: null,
      class_date: "2026-11-08",
      class_time: null,
      zoom_link_index: null,
      ambiguous_fields: ["class_time"],
    }],
  }))({ text: "Next lecture is on 8 November.", sentAt: new Date() });
  assert.deepEqual(withoutLink.items[0]?.ambiguous_fields, ["class_time", "zoom_url"]);
});

test("uses Gemini structured output with server-side interaction storage disabled", async () => {
  let sent: Record<string, unknown> | undefined;
  const client = {
    interactions: {
      create: async (parameters: Record<string, unknown>) => {
        sent = parameters;
        return { output_text: JSON.stringify({ items: [] }) };
      },
    },
  } as unknown as Pick<GoogleGenAI, "interactions">;
  const generate = createGeminiGenerate(client);
  const response = await generate({
    model: config.geminiModel,
    input: "{}",
    systemInstruction: "extract facts",
    schema: { type: "object" } as GeminiRequest["schema"],
  });

  assert.equal(response, JSON.stringify({ items: [] }));
  assert.equal(sent?.model, "gemini-3.8-flash");
  assert.equal(sent?.store, false);
  assert.equal(sent?.system_instruction, "extract facts");
  assert.deepEqual(sent?.response_format, {
    type: "text",
    mime_type: "application/json",
    schema: { type: "object" },
  });
});

test("rejects empty Gemini output", async () => {
  const client = {
    interactions: { create: async () => ({ output_text: "" }) },
  } as unknown as Pick<GoogleGenAI, "interactions">;
  const generate = createGeminiGenerate(client);
  await assert.rejects(
    generate({ model: "gemini-3.8-flash", input: "{}", systemInstruction: "", schema: { type: "object" } as GeminiRequest["schema"] }),
    /no structured response/,
  );
});
