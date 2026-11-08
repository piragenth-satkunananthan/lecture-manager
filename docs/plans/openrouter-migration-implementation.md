# OpenRouter Migration Implementation Plan

**Status:** Design approved; Migration Milestones 1-3 complete. Migration Milestone 4 comparison runner is ready; live runs are pending API credentials.
**Date:** 2026-11-08
**Next-agent handoff:** [`agent-handoff.md`](agent-handoff.md)
**Design input:** [`openrouter_migration_brief.md`](../../openrouter_migration_brief.md)
**Existing plan:** [`student-planner-implementation.md`](student-planner-implementation.md)

## Goal

Move the planner's single-post extraction from Gemini to the best passing free OpenRouter model. Keep local validation, source references, and the planned browser interface. Do not send WhatsApp IDs, group IDs, sender IDs, actual URLs, or passcodes to the model.

## Current state and limits

- The app has Gemini and OpenRouter adapters that share the same local schema and evidence validation. No free model has been selected.
- A synthetic comparison runner is available as `npm run pilot:compare`. It uses the 11 synthetic fixtures and saves model IDs, provider routes, fixture outcomes, field scores, and sanitized error kinds under `artifacts/model-comparison/`.
- No Gemini or OpenRouter API key is available in the current process environment. The comparison command was checked with both keys unset and stopped before making model calls.
- The project has no planner database or event-persistence path yet. The WhatsApp pilot tests intake only, makes no model calls, and keeps deduplication in memory.
- The OpenRouter and field-evidence design was approved by the user on 2026-11-08; the design and main implementation plan now show the same status.
- The current local semantic checks recognize English field terms and English/ISO date expressions. Other languages and unsupported date formats fail closed; add synthetic fixtures for the languages used in the lecturer groups before selecting a production model.
- The current planner plan already includes a browser calendar and management screens in its user-access milestone. This migration does not build the GUI; the planner database and service must exist before that GUI can use extracted events.
- The migration brief is a historical proposal; the approved design is current. Design approval does not enable production cutover. Keep live intake disabled until the durable failure path exists.

## Fixed requirements

- Use OpenRouter's free model that passes the synthetic comparison. Gemma 4 31B is a candidate, not a fixed choice.
- Use one post per model request, JSON mode, and `provider.require_parameters: true`. If no free route supports JSON mode, fail. Do not use a paid, Gemini, or local fallback at runtime.
- Keep the existing strict Zod, calendar-date, and Zoom-link-index checks. Add strict field-evidence checks. Keep Asia/Colombo date handling.
- Keep WhatsApp source identifiers in application context. Validate quotes against the model-visible text and the original local post, then attach local provenance. `zoom_url` is derived locally from the validated link index and has no model quote.
- Keep valid but incomplete announcements pending clarification. Do not confirm them or schedule reminders until required fields and evidence pass validation. Malformed, unsupported, contradictory, or unverifiable model output must not become a confirmed event.
- Store evidence quotes with the event. Delete them from the live database with the event; encrypted backups may retain them until the existing seven-daily and four-weekly rotation expires. Do not log quotes separately.
- Keep the current 60-second timeout and disable automatic retries. No unlimited retries or silent provider switches.
- Use synthetic lecturer messages only for model evaluation. Never send real WhatsApp posts to candidates during the migration test.

## Migration milestones

### Migration Milestone 1: Prepare and reconcile the design contract — complete

**Status:** Complete — user approved the revised design on 2026-11-08.

1. Update the design to name OpenRouter and the selected free-model policy. Record that OpenRouter may choose the upstream provider and that its data practices apply. Mark the design approved after the user approves it.
2. Define the extraction fields, null rules, `ambiguous_fields`, `field_evidence` shape, cancellation/rescheduling fields, semantic checks, and quote retention. Include backup retention and the locally derived Zoom URL rule.
3. Reconcile the design and implementation plan status labels. Update the existing planner plan so its Gemini feasibility step becomes a Gemini baseline plus free OpenRouter synthetic comparison.
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

**Status:** Complete — the non-streaming adapter, free-model guard, 60-second timeout, and mocked request/error tests pass. Gemini remains available for comparison.

1. Add a non-streaming Chat Completions adapter using Node's built-in `fetch` if supported by the current runtime. Reuse the existing injected-generator test seam; do not add an SDK solely for this request.
2. Send one selected post, its timestamp, timezone, and existing URL-placeholder/link-index data. Do not send stable source IDs, real URLs, or passcodes.
3. Request JSON mode and require provider parameter support on every request. Keep Zod and semantic validation local.
4. Use a controlled candidate model ID only in the synthetic pilot. The production configuration must be pinned to the selected free model and must not accept an arbitrary paid model.
5. Preserve the one-attempt 60-second timeout. Surface authentication errors, rate limits, timeouts, empty responses, malformed JSON, and upstream failures as extraction failures. Do not log message text, quotes, keys, or links.
6. Keep the Gemini path available for the comparison. Do not add runtime fallback between providers.

**Exit checks:** Mocked adapter tests verify request shape, model ID, `response_format`, `provider.require_parameters`, timeout, error handling, and that no WhatsApp identifiers, actual URLs, or passcodes leave the app. `npm test` passes all 31 tests.

### Migration Milestone 4: Compare free models on synthetic fixtures

**Status:** In progress — comparison runner and fixtures are ready; live model runs have not been performed.

1. Expand the current synthetic dataset with expected values and exact evidence quotes for every supported field. Include clear, ambiguous, conflicting, corrected, cancellation, rescheduling, and invalid-evidence cases.
2. Run Gemini and each shortlisted free OpenRouter candidate on the same dataset. Save model IDs, provider route, fixture results, errors, and per-field scores. Store no real WhatsApp content.
3. Score exact normalized field matches. A candidate passes only if every expected field matches, all required evidence is valid, and no invalid, ambiguous, incomplete, or unsupported result becomes confirmed. Require 100% expected-field accuracy. If no candidate passes, select none and keep live intake disabled.
4. If multiple candidates pass, prefer Gemma 4 31B when it passes; otherwise record why one passing candidate is selected over the others.
5. A rate limit or service failure makes that candidate run incomplete. Stop that run and resume manually within current free limits; do not retry in a loop or treat an incomplete run as a pass.

**Exit checks:** The same synthetic fixtures and expected answers are used for both providers. Results are saved. At least one free candidate passes every gate. If Gemini cannot be run, do not claim a live comparison; the migration remains at the pilot gate until the required comparison is completed or the user changes that requirement.

### Migration Milestone 5: Cut over the pilot and update project records

1. Pin the passing free model in the production configuration. Remove Gemini from production only after the comparison is recorded. Do not leave a paid or Gemini fallback.
2. Update the `.env.example`, package dependencies, README, approved design, and existing implementation plan. Remove `@google/genai` only after checking every caller and pilot.
3. Keep the migration at synthetic-pilot scope. Do not connect a live WhatsApp group or enable event persistence until the planner's durable failure, pending-review, and provenance paths pass their existing gates.

**Exit checks:** `npm test` and the TypeScript build pass. No real lecturer text appears in fixtures or logs. The selected model is still free and supports the required request parameters at cutover. All invalid outputs fail local validation. The approved design and implementation plan agree with the deployed provider.

## Dependencies before live use

The current planner needs durable storage for pending messages, clarification, source references, and retry/manual review. The existing implementation plan places SQLite and planner-core work before its browser-interface milestone. Do not let the OpenRouter pilot write confirmed events until the planner core enforces validation and preserves failed work. The GUI remains the planned browser interface for the calendar, questions, corrections, provenance, and status.

## Rollback

- Keep the last passing commit and the Gemini pilot path until the synthetic comparison is complete.
- If the selected free route stops supporting JSON mode, returns invalid data, or fails the gate, stop extraction and keep live intake disabled. Do not switch to paid OpenRouter, Gemini, or a local model automatically.
- Revert only the migration milestone that failed. Keep the report of model scores and failures for review.

## Not included

- Building the browser GUI, planner database, WhatsApp live-group intake, or Zoom worker. Those remain in the existing student-planner milestones.
- Streaming, tool calls, multi-message model requests, cross-message evidence mapping, paid inference, or local-model fallback.
