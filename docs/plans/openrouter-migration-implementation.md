# OpenRouter Migration Implementation Plan

**Status:** OpenRouter primary provider; Migration Milestones 1-3 complete. The user approved the Gemma non-ZDR exception on 2026-11-09; Gemma is still HTTP 429. NVIDIA Build is approved as an active provider; `nvidia/nemotron-3-ultra-550b-a55b` passed 11/11 and is pinned. Two held-out checks passed 5/6 each; the non-announcement gap is fixed, and one deadline-only `details` gap remains. Configuration, the extraction pipeline, the configured extractor factory, the authenticated Fastify API, and SMTP reminder delivery are implemented, but `EXTRACTION_ENABLED` remains false by default. Licensing confirmation, a narrow `details` rule, the browser UI, and intake integration remain. Planner core Phase 2A–2C is implemented with extraction disabled.
**Date:** 2026-11-08
**Next-agent handoff:** [`agent-handoff.md`](agent-handoff.md)
**Design input:** [`student-planner.md`](../designs/student-planner.md)
**Existing plan:** [`student-planner-implementation.md`](student-planner-implementation.md)

## Goal

Use OpenRouter as the only model provider and select a free model that passes the synthetic fixtures. Keep local validation, source references, and the planned browser interface. Do not send WhatsApp IDs, group IDs, sender IDs, actual URLs, or passcodes to the model.

## Current state and limits

- The app has only the OpenRouter adapter, sharing the strict local schema and evidence validation. A synthetic comparison ran on 2026-11-09; no free model passed and none is selected.
- The OpenRouter-only comparison runner is available as `npm run pilot:compare`. It uses 11 synthetic fixtures and saves model IDs, provider routes, fixture outcomes, field scores, safe error kinds, and HTTP status under `artifacts/model-comparison/`.
- The 2026-11-09 run used a key supplied through the process environment. It recorded two incomplete candidate runs: `google/gemma-4-31b-it:free` returned HTTP 404 because its only endpoint is filtered by the ZDR data policy, and `xingchen-agi/xing4.0-29b-a4b:free` failed local validation on two fixtures before HTTP 429. A one-request probe found only that model routable under ZDR among the 12 free models. See [`model-comparison-2026-11-09.md`](model-comparison-2026-11-09.md).
- On 2026-11-09 the user approved the only non-ZDR exception: `google/gemma-4-31b-it:free` may use its Google AI Studio endpoint with `provider.zdr: false`. Data collection remains denied, and every other model keeps ZDR. The Gemma rerun reached Google AI Studio but stopped after 1/11 with HTTP 429; a delayed single probe and paced retries at 03:17Z and 04:51Z also returned 429. Routing is fixed; provider availability is the remaining blocker. See [`model-comparison-2026-11-09-gemma-nonzdr.md`](model-comparison-2026-11-09-gemma-nonzdr.md).
- NVIDIA Build was evaluated on 2026-11-09 under user authorization. After prompt tuning, `nvidia/nemotron-3-ultra-550b-a55b` passed **11/11**. Two held-out checks passed 5/6 each: the non-announcement gap was fixed, and one deadline-only `details` gap remains. The user approved NVIDIA as an active provider and accepted its data terms; the model is pinned as `NVIDIA_MODEL`. Configuration, the extraction pipeline, and the configured factory are implemented. `EXTRACTION_ENABLED` remains false by default. Production licensing confirmation, a narrow `details` rule, and integration tests remain. See [`nvidia-build-evaluation-2026-11-09.md`](nvidia-build-evaluation-2026-11-09.md).
- Planner core Phase 2A–2C, the authenticated Fastify API, and SMTP reminder delivery are implemented on 2026-11-09 under user authorization. [`src/db.ts`](../../src/db.ts), [`src/planner.ts`](../../src/planner.ts), [`src/reminders.ts`](../../src/reminders.ts), [`src/extraction.ts`](../../src/extraction.ts), [`src/extraction-factory.ts`](../../src/extraction-factory.ts), [`src/server.ts`](../../src/server.ts), and [`src/notifications.ts`](../../src/notifications.ts) hold the SQLite schema, lifecycle, clarifications, reminder scheduling, extraction pipeline, configured extractor factory, session-authenticated API, and SMTP delivery with retry/backoff. Extraction and live intake remain disabled by default.
- OpenRouter is the only active model provider in code, configuration, scripts, and dependencies. Earlier EGM review reports remain historical records.
- The project has no planner database or event-persistence path yet. The WhatsApp pilot tests intake only, makes no model calls, and keeps deduplication in memory.
- The OpenRouter and field-evidence design was approved by the user on 2026-11-08; the design and main implementation plan now show the same status.
- The current local semantic checks recognize English field terms and English/ISO date expressions. Other languages and unsupported date formats fail closed; add synthetic fixtures for the languages used in the lecturer groups before selecting a production model.
- The current planner plan already includes a browser calendar and management screens in its user-access milestone. This migration does not build the GUI; the planner database and service must exist before that GUI can use extracted events.
- The migration brief is a historical proposal; the approved design is current. Design approval does not enable production cutover. Keep live intake disabled until the durable failure path exists.

## Fixed requirements

- Use OpenRouter's free model that passes the synthetic comparison. Gemma 4 31B is a candidate, not a fixed choice.
- Use one post per model request and JSON mode. The only allowed fallback is the user-authorized bounded chain of at most two pre-approved free models, tried only on availability failure; every member must pass the same gate and log the serving model. Do not use a paid or local fallback at runtime.
- Keep the existing strict Zod, calendar-date, and Zoom-link-index checks. Add strict field-evidence checks. Keep Asia/Colombo date handling.
- Keep WhatsApp source identifiers in application context. Validate quotes against the model-visible text and the original local post, then attach local provenance. `zoom_url` is derived locally from the validated link index and has no model quote.
- Keep valid but incomplete announcements pending clarification. Do not confirm them or schedule reminders until required fields and evidence pass validation. Malformed, unsupported, contradictory, or unverifiable model output must not become a confirmed event.
- Store evidence quotes with the event. Delete them from the live database with the event; encrypted backups may retain them until the existing seven-daily and four-weekly rotation expires. Do not log quotes separately.
- Keep the current 60-second timeout and disable automatic retries. No unlimited retries or silent provider switches.
- Every extraction request sets `provider.data_collection: "deny"`, `provider.allow_fallbacks: false`, and `provider.require_parameters: true`. `provider.zdr: true` is required for every model except `google/gemma-4-31b-it:free`, which the user approved on 2026-11-09 to use its non-ZDR Google AI Studio endpoint with `provider.zdr: false`. Before enabling extraction, set the Google group to the least-permissive non-ZDR option that permits Google AI Studio, keep All other models ZDR-only, and verify and record both settings; fail closed if either setting or a qualifying route is unavailable.
- Use synthetic lecturer messages only for model evaluation. Never send real WhatsApp posts to candidates during the migration test.

## Migration milestones

### Migration Milestone 1: Prepare and reconcile the design contract — complete

**Status:** Complete — user approved the revised design on 2026-11-08.

1. Update the design to name OpenRouter and the selected free-model policy. Record that OpenRouter may choose the upstream provider and that its data practices apply. Mark the design approved after the user approves it.
2. Define the extraction fields, null rules, `ambiguous_fields`, `field_evidence` shape, cancellation/rescheduling fields, semantic checks, and quote retention. Include backup retention and the locally derived Zoom URL rule.
3. Reconcile the design and implementation plan status labels. Set the feasibility plan to compare free OpenRouter candidates only.
4. Record that live intake remains disabled until the planner has a durable pending/retry/manual-review path.

**Exit checks:** The design and plan agree on provider, data use, event schema, evidence storage, error handling, and the live-intake gate. The user approved the revised design before application implementation began.

### Migration Milestone 2: Implement local schema and validation — complete

**Status:** Complete — strict schema, quote validation, field checks, and synthetic regression tests pass.

1. Extend the current strict Zod output contract. Keep `kind` as the event type, existing title/details/date/time fields, and Zoom-link index behavior. Add course, location, cancellation/rescheduling, and `field_evidence` fields as defined in Milestone 1.
2. Add a local evidence validator. Require exact quotes from both the sanitized model input and original source post. Require evidence for every non-null model fact. Reject evidence for missing or unrelated text.
3. Add semantic checks for field-to-quote support and normalized dates/times. Keep unresolved or incomplete announcements pending; never persist a partial result as a confirmed event.
4. Keep source references app-owned. Exclude `zoom_url` from model evidence and retain the existing local link-index validation.

**Exit checks:** Tests cover missing and extra properties, wrong types, malformed and empty JSON, exact and invalid quotes, unsupported and contradictory values, ambiguous announcements, incomplete dates, cancellation/rescheduling, and Asia/Colombo date handling. Invalid output cannot produce a confirmed event.

### Migration Milestone 3: Add the OpenRouter adapter — complete

**Status:** Complete — the non-streaming adapter, free-model guard, 60-second timeout, and mocked request/error tests pass.

1. Add a non-streaming Chat Completions adapter using Node's built-in `fetch` if supported by the current runtime. Reuse the existing injected-generator test seam; do not add an SDK solely for this request.
2. Send one selected post, its timestamp, timezone, and existing URL-placeholder/link-index data. Do not send stable source IDs, real URLs, or passcodes.
3. Request JSON mode and set `provider.require_parameters: true`, `provider.data_collection: "deny"`, and `provider.allow_fallbacks: false` on every request. Use `provider.zdr: true` except for the approved `google/gemma-4-31b-it:free` path, which uses `zdr: false`. Keep Zod and semantic validation local.
4. Use a controlled candidate model ID only in the synthetic pilot. The production configuration must be pinned to the selected free model and must not accept an arbitrary paid model.
5. Preserve the one-attempt 60-second timeout. Surface authentication errors, rate limits, timeouts, empty responses, malformed JSON, and upstream failures as extraction failures. Do not log message text, quotes, keys, or links.
6. Do not add another provider path or runtime fallback.

**Exit checks:** Mocked adapter tests verify request shape, model ID, `response_format`, the approved provider controls (strict ZDR for other models; `zdr: false` only for the Gemma free exception), timeout, error handling, and that no WhatsApp identifiers, actual URLs, or passcodes leave the app. The test suite passes. Before live extraction, verify the Google group's approved non-ZDR setting and the ZDR-only All other models setting; if a qualifying endpoint is unavailable, keep extraction disabled.

### Migration Milestone 4: Compare free models on synthetic fixtures

**Status:** In progress — the user approved the Gemma non-ZDR exception and a bounded fallback chain on 2026-11-09. Gemma remains HTTP 429 and no free OpenRouter candidate passed. NVIDIA Build is approved as an active provider; `nvidia/nemotron-3-ultra-550b-a55b` passed **11/11** and is pinned. Configuration, extraction pipeline, and factory are implemented; `EXTRACTION_ENABLED` remains false pending licensing and integration tests.

1. Expand the current synthetic dataset with expected values and exact evidence quotes for every supported field. Include clear, ambiguous, conflicting, corrected, cancellation, rescheduling, and invalid-evidence cases.
2. Run each shortlisted free OpenRouter candidate on the same synthetic dataset. Save model IDs, selected provider routes, fixture results, safe error kinds, and per-field scores. Store no WhatsApp content.
3. Score exact normalized field matches. A candidate passes only if every expected field matches, all required evidence is valid, and no invalid, ambiguous, incomplete, or unsupported result becomes confirmed. Require 100% expected-field accuracy. If no candidate passes, select none and keep live intake disabled.
4. If multiple candidates pass, prefer Gemma 4 31B when it passes; otherwise record why one passing candidate is selected over the others.
5. A rate limit or service failure makes that candidate run incomplete. Stop that run and resume manually within current free limits; do not retry in a loop or treat an incomplete run as a pass.

**2026-11-09 ZDR-only run (historical):** The artifact is [`artifacts/model-comparison/2026-11-09T02-53-10-115Z.json`](../../artifacts/model-comparison/2026-11-09T02-53-10-115Z.json); the report is [`model-comparison-2026-11-09.md`](model-comparison-2026-11-09.md). Under the original all-model ZDR policy:

- `google/gemma-4-31b-it:free`: 1/11 fixtures recorded; HTTP 404, “No endpoints found matching your data policy (Zero data retention)”. Its only endpoint is Google AI Studio, so the required `zdr: true` filter excludes it. Incomplete.
- `xingchen-agi/xing4.0-29b-a4b:free`: 3/11 fixtures recorded via Phala; fixtures 1–2 failed local validation (`invalid_output`), then HTTP 429. Incomplete. It could not meet 100% accuracy even if resumed.
- A one-request probe of all 12 free models with the same controls found 11 blocked by the ZDR data policy and only the xingchen model routable. `passingFreeModels` is empty.

This run was superseded for Gemma by the user-approved non-ZDR exception below.

**2026-11-09 Gemma non-ZDR rerun:** The artifact is [`artifacts/model-comparison/2026-11-09T03-02-47-378Z.json`](../../artifacts/model-comparison/2026-11-09T03-02-47-378Z.json); the report is [`model-comparison-2026-11-09-gemma-nonzdr.md`](model-comparison-2026-11-09-gemma-nonzdr.md).

- The user approved `zdr: false` only for `google/gemma-4-31b-it:free`; `data_collection: "deny"`, `require_parameters: true`, and `allow_fallbacks: false` remain required for every request.
- The request now routes past the ZDR filter to Google AI Studio, but the paced run stopped after 1/11 with HTTP 429. A single probe after 75 seconds and paced retries at 03:17Z and 04:51Z also returned HTTP 429.
- `free_model_daily_requests` reported 3/50 used at the time of the check, so this is a provider-side or transient limit, not the daily free-model quota.
- Gemma model quality remains untested.

Keep extraction disabled. Retry when the free endpoint stops returning 429, using `OPENROUTER_REQUEST_INTERVAL_MS`; save a new artifact and update the report. Do not add a paid or local fallback, and do not weaken `data_collection`, `require_parameters`, or `allow_fallbacks`.

**2026-11-09 fallback chain evaluation:** The user authorized a bounded chain of at most two free models, with fallback only on availability failures. The artifact is [`artifacts/model-comparison/2026-11-09T03-31-39-374Z.json`](../../artifacts/model-comparison/2026-11-09T03-31-39-374Z.json); the report is [`model-comparison-2026-11-09-fallback-candidates.md`](model-comparison-2026-11-09-fallback-candidates.md).

- `dots-studio/dots-3-note-preview:free`: 9/11 recorded; 1 pass, 7 `invalid_output`, then HTTP 400. Incomplete.
- `recursive/flint-v1.0:free`: 3/11 recorded; 2 `invalid_output`, then timeout. Incomplete.
- `xingchen-agi/xing4.0-29b-a4b:free` failed earlier.
- The remaining free models are blocked by the account’s “Free model training” data policy or do not support the required request parameters.

No second model passed, so the chain is authorized but not enabled. Keep extraction disabled. Do not treat a validation failure as a fallback trigger, and do not add a paid or local fallback.

**2026-11-09 NVIDIA 550B pass:** The artifact is [`artifacts/model-comparison/2026-11-09T05-07-11-690Z.json`](../../artifacts/model-comparison/2026-11-09T05-07-11-690Z.json); the report is [`nvidia-build-evaluation-2026-11-09.md`](nvidia-build-evaluation-2026-11-09.md).

- `nvidia/nemotron-3-ultra-550b-a55b` passed **11/11** after prompt tuning, with every compared field at 11/11.
- NVIDIA-only normalization handles omitted nullable keys, `zoom_link_index`/`ambiguous_fields` inside `field_evidence`, and `zoom_link_index` in `ambiguous_fields`. Factual values and evidence quotes still pass the shared validator. OpenRouter remains strict.
- The user approved NVIDIA as an active provider and its data terms; the model is pinned, and the extraction pipeline/factory, authenticated Fastify API, and SMTP delivery are implemented. `EXTRACTION_ENABLED` remains false. Remaining: production licensing confirmation, a narrow `details` rule plus a third held-out set, the browser UI, intake wiring, and final checks before enabling.
- The model is not a free OpenRouter candidate; it is a second provider.

**Exit checks:** Every candidate uses the same synthetic fixtures and expected answers with the approved provider controls. Results are saved. The OpenRouter path has no passing free candidate; the NVIDIA second-provider candidate passes 11/11, is approved, and is pinned. Two held-out checks are 5/6 each, and extraction remains disabled by default pending licensing confirmation, the `details` fix, and integration. If no candidate passes, any required run is incomplete, or account privacy cannot be verified, keep extraction disabled and select no model.

### Migration Milestone 5: Cut over the pilot and update project records

1. Pin the passing free model in the production configuration. Do not add paid or local fallback.
2. Reconcile the `.env.example`, package dependencies, README, approved design, and existing implementation plan with the selected model and OpenRouter-only setup.
3. Keep the migration at synthetic-pilot scope. Do not connect a live WhatsApp group or enable event persistence until the planner's durable failure, pending-review, and provenance paths pass their existing gates.

**Exit checks:** `npm test` and the TypeScript build pass. No real lecturer text appears in fixtures or logs. The selected model is still free and supports the required request parameters at cutover. All invalid outputs fail local validation. The approved design and implementation plan agree with the deployed provider.

## Dependencies before live use

The current planner needs durable storage for pending messages, clarification, source references, and retry/manual review. The existing implementation plan places SQLite and planner-core work before its browser-interface milestone. Do not let the OpenRouter pilot write confirmed events until the planner core enforces validation and preserves failed work. The GUI remains the planned browser interface for the calendar, questions, corrections, provenance, and status.

## Rollback

- Keep the last passing commit. If the selected free route stops supporting JSON mode, returns invalid data, or fails the gate, stop extraction and keep live intake disabled. Do not switch to a paid OpenRouter model or local model automatically.
- Revert only the migration milestone that failed. Keep the report of model scores and failures for review.

## Not included

- Building the browser GUI, planner database, WhatsApp live-group intake, or Zoom worker. Those remain in the existing student-planner milestones.
- Streaming, tool calls, multi-message model requests, cross-message evidence mapping, paid inference, or local-model fallback.
