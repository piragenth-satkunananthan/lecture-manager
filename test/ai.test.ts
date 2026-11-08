import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createOpenRouterAnnouncementExtractor,
  type ExtractedAnnouncement,
  type OpenRouterGenerate,
} from "../src/ai.js";

const config = {
  apiKey: "test-openrouter-api-key",
  model: "google/gemma-4-31b-it:free",
  timeZone: "Asia/Colombo",
};

const modelAssignment = {
  kind: "assignment",
  title: "Data Structures assignment 2",
  details: "submit by",
  course: "Data Structures",
  location: null,
  due_date: "2026-11-10",
  due_time: "17:00",
  class_date: null,
  class_time: null,
  change_type: null,
  change_details: null,
  zoom_link_index: null,
  ambiguous_fields: [],
  field_evidence: {
    kind: [{ quote: "assignment" }],
    title: [{ quote: "Data Structures assignment 2" }],
    details: [{ quote: "submit by" }],
    course: [{ quote: "Data Structures" }],
    due_date: [{ quote: "submit by 10 November 2026" }],
    due_time: [{ quote: "submit by 10 November 2026 at 5:00 PM" }],
  },
};

function fakeGenerate(value: unknown): OpenRouterGenerate {
  return async () => JSON.stringify(value);
}

test("synthetic comparison fixtures specify all fields and pass local evidence checks", async () => {
  const fixtures = JSON.parse(await readFile("test/fixtures/lecturer-posts.json", "utf8")) as Array<{
    id: string;
    sentAt: string;
    text: string;
    expected: ExtractedAnnouncement["items"];
  }>;
  const fields = [
    "kind", "title", "details", "course", "location", "due_date", "due_time", "class_date", "class_time",
    "change_type", "change_details", "zoom_url", "ambiguous_fields", "field_evidence",
  ].sort();

  for (const fixture of fixtures) {
    for (const item of fixture.expected) {
      assert.deepEqual(Object.keys(item).sort(), fields, `${fixture.id} has a partial expected item`);
    }
    const links = [...fixture.text.matchAll(/https?:\/\/[^\s<>"']+/g)].map(([url]) => url);
    const modelItems = fixture.expected.map(({ zoom_url, ...item }) => ({
      ...item,
      zoom_link_index: zoom_url === null ? null : links.indexOf(zoom_url) + 1,
    }));
    const actual = await createOpenRouterAnnouncementExtractor(config, async () => JSON.stringify({ items: modelItems }))({
      text: fixture.text,
      sentAt: new Date(fixture.sentAt),
    });
    assert.deepEqual(actual.items, fixture.expected, `${fixture.id} failed local schema/evidence checks`);
  }

  const impossibleDate = fixtures.find(({ id }) => id === "assignment-impossible-date")?.expected[0];
  assert.equal(impossibleDate?.due_date, null);
  assert.deepEqual(impossibleDate?.ambiguous_fields, ["due_date"]);
});

test("skips empty messages and rejects invalid timestamps without calling OpenRouter", async () => {
  let called = false;
  const generate: OpenRouterGenerate = async () => {
    called = true;
    return "{}";
  };
  const extract = createOpenRouterAnnouncementExtractor(config, generate);
  assert.deepEqual(await extract({ text: "  ", sentAt: new Date() }), { items: [] });
  assert.equal(called, false);
  await assert.rejects(extract({ text: "assignment", sentAt: new Date("invalid") }), /timestamp is invalid/);
  assert.equal(called, false);
});

test("rejects malformed model output and non-calendar dates", async () => {
  const source = { text: "Operating Systems assignment is due on 30 February 2026.", sentAt: new Date("2026-02-01T03:30:00.000Z") };
  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, async () => "not JSON")(source),
    /invalid structured data/,
  );
  const impossibleDate = {
    ...modelAssignment,
    title: "Operating Systems assignment",
    course: "Operating Systems",
    due_date: "2026-02-30",
    due_time: null,
    details: null,
    field_evidence: {
      kind: [{ quote: "assignment" }],
      title: [{ quote: "Operating Systems assignment" }],
      course: [{ quote: "Operating Systems" }],
      due_date: [{ quote: "30 February 2026" }],
    },
  };
  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, fakeGenerate({ items: [impossibleDate] }))(source),
    /invalid calendar date/,
  );
});

test("requires the complete strict schema, correct types, and evidence for every non-null fact", async () => {
  const source = {
    text: "Data Structures assignment 2: submit by 10 November 2026 at 5:00 PM.",
    sentAt: new Date("2026-11-07T03:30:00.000Z"),
  };
  const { field_evidence: _evidence, ...missingEvidence } = modelAssignment;
  const { course: _course, ...missingProperty } = modelAssignment;
  await assert.rejects(createOpenRouterAnnouncementExtractor(config, fakeGenerate({ items: [missingEvidence] }))(source), /field_evidence/);
  await assert.rejects(createOpenRouterAnnouncementExtractor(config, fakeGenerate({ items: [missingProperty] }))(source), /course/);
  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, fakeGenerate({ items: [{ ...modelAssignment, title: 12 }] }))(source),
    /title/,
  );
  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, fakeGenerate({ items: [{ ...modelAssignment, unexpected: true }] }))(source),
    /unexpected/,
  );
  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, fakeGenerate({
      items: [{
        ...modelAssignment,
        field_evidence: { ...modelAssignment.field_evidence, message_id: [{ quote: "model-created-id" }] },
      }],
    }))(source),
    /message_id/,
  );
  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, fakeGenerate({
      items: [{ ...modelAssignment, field_evidence: { ...modelAssignment.field_evidence, due_date: undefined } }],
    }))(source),
    /evidence for due_date/,
  );
  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, fakeGenerate({ items: [
      modelAssignment,
      { ...modelAssignment, field_evidence: { ...modelAssignment.field_evidence, title: [{ quote: "invented title" }] } },
    ] }))(source),
    /unverifiable quote for title/,
  );
});

test("validates exact evidence and checks normalized dates, times, and string values against the quote", async () => {
  const source = {
    text: "Data Structures assignment 2: submit by 10 November 2026 at 5:00 PM.",
    sentAt: new Date("2026-11-07T03:30:00.000Z"),
  };
  const badTitleEvidence = {
    ...modelAssignment,
    field_evidence: { ...modelAssignment.field_evidence, title: [{ quote: "Data Structures assignment 9" }] },
  };
  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, fakeGenerate({ items: [badTitleEvidence] }))(source),
    /unverifiable quote for title/,
  );
  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, fakeGenerate({
      items: [{ ...modelAssignment, title: "Data Structures assignment 9" }],
    }))(source),
    /unsupported evidence for title/,
  );
  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, fakeGenerate({
      items: [{ ...modelAssignment, due_date: "2026-11-11" }],
    }))(source),
    /unsupported evidence for due_date/,
  );
  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, fakeGenerate({
      items: [{ ...modelAssignment, due_time: "18:00" }],
    }))(source),
    /unsupported evidence for due_time/,
  );
  const negatedDeadline = {
    ...modelAssignment,
    details: "Do not submit by",
    field_evidence: {
      ...modelAssignment.field_evidence,
      details: [{ quote: "Do not submit by" }],
      due_date: [{ quote: "Do not submit by 10 November 2026" }],
      due_time: [{ quote: "Do not submit by 10 November 2026 at 5:00 PM" }],
    },
  };
  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, fakeGenerate({ items: [negatedDeadline] }))({
      text: "Data Structures assignment 2: Do not submit by 10 November 2026 at 5:00 PM.",
      sentAt: source.sentAt,
    }),
    /unsupported evidence for due_date/,
  );
  const corrected = {
    ...modelAssignment,
    due_date: "2026-11-12",
    field_evidence: {
      ...modelAssignment.field_evidence,
      due_date: [{ quote: "Correction: the deadline is 12 November 2026" }],
    },
  };
  const correctedSource = "Data Structures assignment 2: submit by 10 November 2026 at 5:00 PM. Correction: the deadline is 12 November 2026.";
  const correctedResult = await createOpenRouterAnnouncementExtractor(config, fakeGenerate({ items: [corrected] }))({
    text: correctedSource,
    sentAt: source.sentAt,
  });
  assert.equal(correctedResult.items[0]?.due_date, "2026-11-12");
  const contradictoryQuote = {
    ...corrected,
    field_evidence: {
      ...corrected.field_evidence,
      due_date: [{ quote: "submit by 10 November 2026 at 5:00 PM. Correction: the deadline is 12 November 2026" }],
    },
  };
  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, fakeGenerate({ items: [contradictoryQuote] }))({
      text: correctedSource,
      sentAt: source.sentAt,
    }),
    /unsupported evidence for due_date/,
  );
  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, fakeGenerate({
      items: [{ ...modelAssignment, due_date: "2026-11" }],
    }))(source),
    /due_date/,
  );
});

test("keeps a valid but incomplete assignment marked for clarification", async () => {
  const result = await createOpenRouterAnnouncementExtractor(config, fakeGenerate({
    items: [{
      ...modelAssignment,
      title: "Assignment 2",
      details: null,
      course: null,
      due_date: null,
      due_time: null,
      ambiguous_fields: ["due_date"],
      field_evidence: {
        kind: [{ quote: "Assignment" }],
        title: [{ quote: "Assignment 2" }],
      },
    }],
  }))({ text: "Assignment 2 has no confirmed deadline yet.", sentAt: new Date("2026-11-07T03:30:00.000Z") });
  assert.equal(result.items[0]?.due_date, null);
  assert.deepEqual(result.items[0]?.ambiguous_fields, ["due_date"]);
});

test("resolves yearless dates using the configured Asia/Colombo timestamp", async () => {
  const result = await createOpenRouterAnnouncementExtractor(config, fakeGenerate({
    items: [{
      ...modelAssignment,
      title: "Operating Systems assignment",
      details: null,
      course: "Operating Systems",
      due_date: "2027-12-31",
      due_time: null,
      field_evidence: {
        kind: [{ quote: "assignment" }],
        title: [{ quote: "Operating Systems assignment" }],
        course: [{ quote: "Operating Systems" }],
        due_date: [{ quote: "Operating Systems assignment is due on 31 December" }],
      },
    }],
  }))({
    text: "Operating Systems assignment is due on 31 December.",
    sentAt: new Date("2026-12-31T23:00:00.000Z"),
  });
  assert.equal(result.items[0]?.due_date, "2027-12-31");
});

test("rejects quotes that exist only in sanitized model text", async () => {
  const source = {
    text: "Lecture is on 8 November 2026. Join https://us02web.zoom.us/j/123?pwd=secret",
    sentAt: new Date("2026-11-07T03:30:00.000Z"),
  };
  const item = {
    ...modelAssignment,
    kind: "class",
    title: "Lecture",
    details: null,
    course: null,
    due_date: null,
    due_time: null,
    class_date: "2026-11-08",
    class_time: null,
    zoom_link_index: 1,
    ambiguous_fields: ["class_time"],
    field_evidence: {
      kind: [{ quote: "Lecture" }],
      title: [{ quote: "Lecture" }],
      class_date: [{ quote: "Lecture is on 8 November 2026" }],
    },
  };
  const invalidQuote = {
    ...item,
    field_evidence: { ...item.field_evidence, title: [{ quote: "[LINK_1]" }] },
  };
  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, fakeGenerate({ items: [invalidQuote] }))(source),
    /unverifiable quote for title/,
  );
});

test("validates evidence for course, location, actions, cancellation, and rescheduling", async () => {
  const source = "Data Structures assignment 2 is rescheduled to 12 November 2026. Submit the revised report in Room 4.";
  const rescheduled = {
    ...modelAssignment,
    details: "Submit the revised report",
    due_date: "2026-11-12",
    due_time: null,
    location: "Room 4",
    change_type: "rescheduled",
    change_details: "rescheduled to 12 November 2026",
    field_evidence: {
      kind: [{ quote: "assignment" }],
      title: [{ quote: "Data Structures assignment 2" }],
      course: [{ quote: "Data Structures" }],
      details: [{ quote: "Submit the revised report" }],
      location: [{ quote: "Room 4" }],
      due_date: [{ quote: "Data Structures assignment 2 is rescheduled to 12 November 2026" }],
      change_type: [{ quote: "rescheduled" }],
      change_details: [{ quote: "rescheduled to 12 November 2026" }],
    },
  };
  const result = await createOpenRouterAnnouncementExtractor(config, fakeGenerate({ items: [rescheduled] }))({
    text: source,
    sentAt: new Date("2026-11-07T03:30:00.000Z"),
  });
  assert.equal(result.items[0]?.course, "Data Structures");
  assert.equal(result.items[0]?.location, "Room 4");
  assert.equal(result.items[0]?.change_type, "rescheduled");
  assert.equal(result.items[0]?.change_details, "rescheduled to 12 November 2026");

  const cancelledSource = "Computer Networks lecture is cancelled. The replacement time is not announced.";
  const cancelled = {
    ...rescheduled,
    kind: "class",
    title: "Computer Networks lecture",
    details: null,
    course: "Computer Networks",
    location: null,
    due_date: null,
    due_time: null,
    class_date: null,
    class_time: null,
    change_type: "cancelled",
    change_details: "lecture is cancelled",
    zoom_link_index: null,
    ambiguous_fields: ["class_date", "class_time", "zoom_url"],
    field_evidence: {
      kind: [{ quote: "lecture" }],
      title: [{ quote: "Computer Networks lecture" }],
      course: [{ quote: "Computer Networks" }],
      change_type: [{ quote: "cancelled" }],
      change_details: [{ quote: "lecture is cancelled" }],
    },
  };
  const cancelledResult = await createOpenRouterAnnouncementExtractor(config, fakeGenerate({ items: [cancelled] }))({
    text: cancelledSource,
    sentAt: new Date("2026-11-07T03:30:00.000Z"),
  });
  assert.equal(cancelledResult.items[0]?.change_type, "cancelled");
  assert.deepEqual(cancelledResult.items[0]?.ambiguous_fields, ["class_date", "class_time", "zoom_url"]);
  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, fakeGenerate({ items: [{
      ...cancelled,
      field_evidence: {
        ...cancelled.field_evidence,
        change_type: [{ quote: "not cancelled" }],
      },
    }] }))({
      text: "Computer Networks lecture is not cancelled.",
      sentAt: new Date("2026-11-07T03:30:00.000Z"),
    }),
    /unsupported evidence for change_type/,
  );
});

test("rejects indexes that do not identify an HTTPS Zoom URL from the source", async () => {
  const classItem = {
    kind: "class",
    title: "Lecture",
    details: null,
    course: null,
    location: null,
    due_date: null,
    due_time: null,
    class_date: null,
    class_time: null,
    change_type: null,
    change_details: null,
    zoom_link_index: 1,
    ambiguous_fields: ["class_date", "class_time", "zoom_url"],
    field_evidence: {
      kind: [{ quote: "Lecture" }],
      title: [{ quote: "Lecture" }],
    },
  };
  for (const url of [
    "https://example.test/meeting",
    "http://us02web.zoom.us/j/12345678901",
  ]) {
    await assert.rejects(
      createOpenRouterAnnouncementExtractor(config, fakeGenerate({ items: [classItem] }))({
        text: `Lecture. Join ${url}`,
        sentAt: new Date(),
      }),
      /invalid Zoom link index/,
    );
  }
  await assert.rejects(
    createOpenRouterAnnouncementExtractor(config, fakeGenerate({ items: [{ ...classItem, zoom_url: "https://model.test/" }] }))({
      text: "Lecture",
      sentAt: new Date(),
    }),
    /zoom_url/,
  );
});

test("reattaches the selected source Zoom URL locally and preserves unresolved class time", async () => {
  const zoomUrl = "https://us02web.zoom.us/j/12345678901?pwd=synthetic";
  const result = await createOpenRouterAnnouncementExtractor(config, fakeGenerate({
    items: [{
      kind: "class",
      title: "Next lecture",
      details: null,
      course: null,
      location: null,
      due_date: null,
      due_time: null,
      class_date: "2026-11-08",
      class_time: null,
      change_type: null,
      change_details: null,
      zoom_link_index: 1,
      ambiguous_fields: ["class_time", "zoom_url"],
      field_evidence: {
        kind: [{ quote: "lecture" }],
        title: [{ quote: "Next lecture" }],
        class_date: [{ quote: "Next lecture is on 8 November" }],
      },
    }],
  }))({
    text: `Next lecture is on 8 November. Join ${zoomUrl}`,
    sentAt: new Date("2026-11-07T03:30:00.000Z"),
  });

  assert.equal(result.items[0]?.zoom_url, zoomUrl);
  assert.deepEqual(result.items[0]?.ambiguous_fields, ["class_time"]);

  const withoutLink = await createOpenRouterAnnouncementExtractor(config, fakeGenerate({
    items: [{
      kind: "class",
      title: "Next lecture",
      details: null,
      course: null,
      location: null,
      due_date: null,
      due_time: null,
      class_date: "2026-11-08",
      class_time: null,
      change_type: null,
      change_details: null,
      zoom_link_index: null,
      ambiguous_fields: ["class_time"],
      field_evidence: {
        kind: [{ quote: "lecture" }],
        title: [{ quote: "Next lecture" }],
        class_date: [{ quote: "Next lecture is on 8 November" }],
      },
    }],
  }))({ text: "Next lecture is on 8 November.", sentAt: new Date() });
  assert.deepEqual(withoutLink.items[0]?.ambiguous_fields, ["class_time", "zoom_url"]);
});

test("propagates an upstream rate limit after one extraction attempt", async () => {
  let calls = 0;
  const extract = createOpenRouterAnnouncementExtractor(config, async () => {
    calls++;
    throw Object.assign(new Error("upstream rate limit"), { status: 429 });
  });
  await assert.rejects(extract({
    text: "Data Structures assignment 2: submit by 10 November 2026 at 5:00 PM.",
    sentAt: new Date("2026-11-07T03:30:00.000Z"),
  }), /upstream rate limit/);
  assert.equal(calls, 1);
});
