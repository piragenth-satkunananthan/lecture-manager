import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { ExtractedItem } from "../src/ai.js";
import { scoreExtraction } from "../src/model-evaluation.js";

test("scores exact factual fields and leaves evidence validity to the extractor", async () => {
  const fixtures = JSON.parse(await readFile("test/fixtures/lecturer-posts.json", "utf8")) as Array<{
    expected: ExtractedItem[];
  }>;
  const expected = fixtures[0]?.expected;
  assert.ok(expected);
  const reordered = structuredClone(expected);
  const evidence = reordered[0]?.field_evidence;
  if (evidence?.due_date) evidence.due_date.reverse();
  if (reordered[0]) reordered[0].ambiguous_fields.reverse();

  const score = scoreExtraction(expected, reordered);
  assert.equal(score.passed, true);
  assert.deepEqual(score.mismatches, []);
  assert.deepEqual(score.fields.item_count, { matches: 1, total: 1 });
});

test("accepts source-supported free-text spans but rejects unrelated or tiny fragments", async () => {
  const fixtures = JSON.parse(await readFile("test/fixtures/lecturer-posts.json", "utf8")) as Array<{
    expected: ExtractedItem[];
  }>;
  const expected = fixtures[0]?.expected;
  assert.ok(expected);

  const acceptable = structuredClone(expected);
  if (acceptable[0]) {
    acceptable[0].details = "submit";
    acceptable[0].course = "Data Structures assignment 2";
  }
  const accepted = scoreExtraction(expected, acceptable);
  assert.equal(accepted.passed, true);
  assert.deepEqual(accepted.mismatches, []);

  const unrelated = structuredClone(expected);
  if (unrelated[0]) unrelated[0].details = "unrelated";
  const rejected = scoreExtraction(expected, unrelated);
  assert.equal(rejected.passed, false);
  assert.deepEqual(rejected.mismatches, ["items.0.details"]);

  const tiny = structuredClone(expected);
  if (tiny[0]) tiny[0].title = "assignment";
  const tinyScore = scoreExtraction(expected, tiny);
  assert.equal(tinyScore.passed, false);
  assert.deepEqual(tinyScore.mismatches, ["items.0.title"]);
});

test("reports mismatched fields and item counts without copying extracted values", async () => {
  const fixtures = JSON.parse(await readFile("test/fixtures/lecturer-posts.json", "utf8")) as Array<{
    expected: ExtractedItem[];
  }>;
  const expected = fixtures[0]?.expected;
  assert.ok(expected);
  const changed = structuredClone(expected);
  if (changed[0]) changed[0].title = "invented title";

  const score = scoreExtraction(expected, [...changed, ...changed]);
  assert.equal(score.passed, false);
  assert.deepEqual(score.mismatches, ["item_count", "items.0.title"]);
  assert.deepEqual(score.fields.title, { matches: 0, total: 1 });
});
