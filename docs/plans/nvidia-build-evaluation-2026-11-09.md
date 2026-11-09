# NVIDIA Build Evaluation — 2026-11-09

**Status:** `nvidia/nemotron-3-ultra-550b-a55b` passes all 11 tuned synthetic fixtures, is approved as an active provider, and is pinned. Three held-out checks stand at 5/6, 5/6, and 5/5. The non-announcement and deadline-only `details` gaps were fixed; the main gate was re-run at 11/11 after the fixes. The extraction pipeline, configured factory, server/API, SMTP delivery, browser UI, and local intake path are implemented, but `EXTRACTION_ENABLED=false` by default. Remaining: production licensing, HTTPS termination, and the live WhatsApp/Zoom pilots. Extraction and live WhatsApp intake remain disabled.
**Provider:** NVIDIA Build (`https://integrate.api.nvidia.com/v1`)
**Code:** [`src/ai.ts`](../../src/ai.ts), [`scripts/nvidia-comparison-pilot.ts`](../../scripts/nvidia-comparison-pilot.ts), [`src/extraction.ts`](../../src/extraction.ts), [`src/extraction-factory.ts`](../../src/extraction-factory.ts)
**Tests:** `npm test` — 90/90 pass
**Passing artifact:** [`artifacts/model-comparison/2026-11-09T05-07-11-690Z.json`](../../artifacts/model-comparison/2026-11-09T05-07-11-690Z.json)

## Access

- `NVIDIA_API_KEY` was present in `.env` and authenticated successfully. The key itself was never printed.
- The catalog lists 84 models, but chat access is limited:
  - Accessible: `nvidia/nemotron-3.5-lightning-30b-a3b`, `nvidia/nemotron-3.5-super-vl-120b-a12b`, `nvidia/nemotron-3-ultra-550b-a55b`.
  - HTTP 404: `google/gemma-4-31b-it`, `google/gemma-3-4b-it`, `nvidia/nemotron-3-super-120b-a12b`, `nvidia/nemotron-4-340b-instruct`, `nvidia/llama-3.1-nemotron-70b-instruct`, `mistralai/mistral-7b-instruct-v0.3`, `moonshotai/kimi-k2.6`.
  - Timeouts: `openai/gpt-oss-20b`, `z-ai/glm-5.3-flash`, `meta/llama-3.2-90b-vision-instruct`.
- `chat_template_kwargs: { enable_thinking: false }` is required for Lightning; otherwise it spends the response budget on `reasoning_content` and returns empty content or exceeds 60 seconds.

## Final gate result

`nvidia/nemotron-3-ultra-550b-a55b` passed **11/11 fixtures**, with every compared field at 11/11 and no invalid or ambiguous output confirmed.

`passingModels`: `["nvidia/nemotron-3-ultra-550b-a55b"]`

The passing artifact contains the model ID, provider, fixture IDs, outcomes, and field scores only — no message text, evidence quotes, or key material.

## Tuning history

| Run | Change | Result |
| --- | --- | --- |
| `04-36-01-762Z` | Baseline 550B, JSON mode, thinking disabled | 3 pass, 4 mismatch, 4 invalid |
| `04-57-46-542Z` | Temperature 0; clearer `details`, `change_details`, `ambiguous_fields` rules | 4 pass, 2 mismatch, 5 invalid |
| `04-59-18-192Z` | Non-null ambiguity ban; evidence-key rules; course/location rules | 6 pass, 5 invalid |
| `05-01-38-207Z` | Due-date/class-date evidence rules; NVIDIA structural normalization | 8 pass, 1 mismatch, 2 invalid |
| `05-03-06-536Z` | Location/negative-evidence rules | 8 pass, 3 invalid |
| `05-05-13-007Z` | Missing nullable keys and `zoom_link_index` ambiguity mapping | 9 pass, 1 mismatch, 1 invalid |
| `05-07-11-690Z` | Strip `ambiguous_fields` from evidence; correction-only `details` rule | **11 pass** |

Prompt tuning was iterative and fixture-driven; there is overfitting risk. The final rules are general field-shape and evidence rules, but a new fixture set could still expose gaps.

## NVIDIA-only normalization

NVIDIA models produce structural artifacts that the strict schema would reject even when the facts and evidence are correct:

- Missing nullable keys instead of explicit `null`.
- `zoom_link_index` inside `ambiguous_fields` instead of `zoom_url`.
- `zoom_link_index` or `ambiguous_fields` inside `field_evidence`.
- Empty evidence arrays for null fields.

[`src/ai.ts`](../../src/ai.ts) normalizes these only for the NVIDIA adapter, before strict validation. OpenRouter remains strict and still rejects missing keys. The normalization does not invent facts, and all evidence quotes still pass the shared source/quote/value checks.

## Gate/scorer changes

- `field_evidence` is no longer compared for exact equality; the extractor validates it.
- Free-text fields accept source-supported normalized spans; dates, times, enums, nulls, item counts, `ambiguous_fields`, and `zoom_url` remain exact.
- A `details` or `change_details` evidence quote may be a longer sentence containing the value.
- The model gate still requires 11/11 with no invalid or ambiguous item confirmed.

## Held-out check

Six cases were written after the prompt tuning and were not used to change it. Result: **5/6 pass**.

- Positive cases passed: relative weekday, two items in one message, tutorial without a link, cancelled class without replacement, assignment with details.
- The failure was `heldout-reminder-not-an-announcement`: the model created an item from a reminder to bring a student ID to an exam hall. Its `kind` evidence did not support assignment or class, so the local validator rejected it. No wrong event was created, but the source would go to failed/manual review.

Full report: [`nvidia-heldout-evaluation-2026-11-09.md`](nvidia-heldout-evaluation-2026-11-09.md). Artifact: [`2026-11-09T06-02-38-672Z.json`](../../artifacts/model-comparison/2026-11-09T06-02-38-672Z.json).

This is a generalization gap, not a clean validation. Do not tune on these six cases and call them held-out again; create a fresh set after any prompt change.

## Second held-out check

A general non-announcement rule was added, then a second six-case set was written and run without tuning on it. Result: **5/6 pass**.

- Both non-announcement cases passed: a hall-ticket reminder and a semester-fee deadline returned empty items.
- Class with location, date-only assignment, and class with Zoom link passed.
- The failure was `fresh-assignment-relative-tomorrow`: `details` was set instead of null for a deadline-only assignment. The date and time were correct.

Full report: [`nvidia-heldout2-evaluation-2026-11-09.md`](nvidia-heldout2-evaluation-2026-11-09.md). Artifact: [`2026-11-09T06-10-13-231Z.json`](../../artifacts/model-comparison/2026-11-09T06-10-13-231Z.json).

Two held-out sets now stand at 5/6 each, with different failures. The model is conditionally validated.

## Third held-out check

The deadline-only `details` rule and a tighter cancellation rule were added, then a third five-case set was written and run without tuning on it. Result: **5/5 pass**.

- Deadline-only assignment and class cases now set `details` to null.
- A separate action instruction is still kept in `details`.
- The non-announcement case returned empty items.
- The main 11-fixture gate was re-run after the rule change and passed **11/11**.

Full report: [`nvidia-heldout3-evaluation-2026-11-09.md`](nvidia-heldout3-evaluation-2026-11-09.md). Artifact: [`2026-11-09T06-51-52-036Z.json`](../../artifacts/model-comparison/2026-11-09T06-51-52-036Z.json). Main gate: [`2026-11-09T06-51-07-019Z.json`](../../artifacts/model-comparison/2026-11-09T06-51-07-019Z.json).

Three held-out sets: 5/6, 5/6, 5/5. No known model-quality gap remains on the current synthetic cases.

## Activation gates

The model is approved and pinned, but extraction is still off by default:

1. **Provider approval — done.** The user approved NVIDIA Build as an active provider and accepted its data terms. NVIDIA’s data-retention and API terms apply; OpenRouter’s `zdr` and `data_collection` controls do not. Recorded in the design and handoff.
2. **Production licensing — pending.** NVIDIA Build’s free/development tier is subject to NVIDIA’s terms; production use may require a commercial license.
3. **Model pin — done.** `NVIDIA_MODEL=nvidia/nemotron-3-ultra-550b-a55b`.
4. **Extractor wiring — done.** `src/extraction.ts`, `src/extraction-factory.ts`, and `src/config.ts` support the NVIDIA provider. `EXTRACTION_ENABLED` defaults to false.
5. **Held-out fixtures — checked.** Three sets: 5/6, 5/6, 5/5. The non-announcement and deadline-only `details` gaps are fixed, and the main gate was re-run at 11/11.
6. **Local integration — done.** Server/API, SMTP delivery, browser UI, and local JSON intake are implemented. `EXTRACTION_ENABLED` remains false.
7. **HTTPS and live pilots — pending.** Record the HTTPS termination path and pass the WhatsApp/Zoom gates. Keep live intake disabled until then.

## Conclusion

- The 550B passes the tuned 11/11 gate and three held-out checks at 5/6, 5/6, and 5/5.
- It is approved, pinned, and wired behind a disabled flag.
- The known model-quality gaps are fixed; remaining risks are synthetic-only coverage, provider nondeterminism, licensing, and the live pilots.
- Next: licensing confirmation, HTTPS termination, and the WhatsApp/Zoom gates before enabling.
