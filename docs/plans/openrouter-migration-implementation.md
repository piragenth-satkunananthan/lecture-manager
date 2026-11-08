# OpenRouter Migration Implementation Plan

**Status:** Draft for review; no application code is authorized by this plan step.
**Date:** 2026-11-08
**Design input:** [`openrouter_migration_brief.md`](../../openrouter_migration_brief.md)
**Existing plan:** [`student-planner-implementation.md`](student-planner-implementation.md)

## Goal

Move the planner's single-post extraction from Gemini to the best passing free OpenRouter model. Keep local validation, source references, and the planned browser interface. Do not send WhatsApp IDs, group IDs, sender IDs, actual URLs, or passcodes to the model.

## Current state and limits

- The app has a Gemini extractor and pilot scripts, but no OpenRouter code.
- The project has no planner database or event-persistence path yet. The current WhatsApp pilot logs extraction errors and can mark a failed message as already seen.
- The approved planner design and main implementation plan still describe Gemini. The design file is labeled `Proposed`, while the implementation plan treats it as approved. Resolve that status difference before changing the design.
- The current planner plan already includes a browser calendar and management screens in its user-access milestone. This migration does not build the GUI; the planner database and service must exist before that GUI can use extracted events.
- The provider migration proposal is a reviewed draft, not an approved design change. Keep live intake disabled until the design and plan are updated and the migration gates below pass.

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

### Migration Milestone 1: Approve and lock the contract

1. Update the approved design to name OpenRouter and the selected free-model policy. Record that OpenRouter may choose the upstream provider and that its data practices apply.
2. Define the extraction fields, null rules, `ambiguous_fields`, `field_evidence` shape, cancellation/rescheduling fields, semantic checks, and quote retention. Include backup retention and the locally derived Zoom URL rule.
3. Reconcile the design's `Proposed` label with the implementation plan's approval status. Update the existing planner plan so its Gemini feasibility step does not conflict with this migration.
4. Record that live intake remains disabled until the planner has a durable pending/retry/manual-review path.

**Exit checks:** The design and plan agree on provider, data use, event schema, evidence storage, error handling, and the live-intake gate. The user has reviewed the updated design and plan.

### Migration Milestone 2: Implement local schema and validation

1. Extend the current strict Zod output contract. Keep `kind` as the event type, existing title/details/date/time fields, and Zoom-link index behavior. Add course, location, cancellation/rescheduling, and `field_evidence` fields as defined in Milestone 1.
2. Add a local evidence validator. Require exact quotes from both the sanitized model input and original source post. Require evidence for every non-null model fact. Reject evidence for missing or unrelated text.
3. Add semantic checks for field-to-quote support and normalized dates/times. Keep unresolved or incomplete announcements pending; never persist a partial result as a confirmed event.
4. Keep source references app-owned. Exclude `zoom_url` from model evidence and retain the existing local link-index validation.

**Exit checks:** Tests cover missing and extra properties, wrong types, malformed and empty JSON, exact and invalid quotes, unsupported and contradictory values, ambiguous announcements, incomplete dates, cancellation/rescheduling, and Asia/Colombo date handling. Invalid output cannot produce a confirmed event.

### Migration Milestone 3: Add the OpenRouter adapter

1. Add a non-streaming Chat Completions adapter using Node's built-in `fetch` if supported by the current runtime. Reuse the existing injected-generator test seam; do not add an SDK solely for this request.
2. Send one selected post, its timestamp, timezone, and existing URL-placeholder/link-index data. Do not send stable source IDs, real URLs, or passcodes.
3. Request JSON mode and require provider parameter support on every request. Keep Zod and semantic validation local.
4. Use a controlled candidate model ID only in the synthetic pilot. The production configuration must be pinned to the selected free model and must not accept an arbitrary paid model.
5. Preserve the one-attempt 60-second timeout. Surface authentication errors, rate limits, timeouts, empty responses, malformed JSON, and upstream failures as extraction failures. Do not log message text, quotes, keys, or links.
6. Keep the Gemini path available for the comparison. Do not add runtime fallback between providers.

**Exit checks:** Mocked adapter tests verify request shape, model ID, `response_format`, `provider.require_parameters`, timeout, error handling, and that no WhatsApp identifiers, actual URLs, or passcodes leave the app.

### Migration Milestone 4: Compare free models on synthetic fixtures

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

The current planner needs durable storage for pending messages, clarification, source references, and retry/manual review. The approved project plan places SQLite and planner-core work before its browser-interface milestone. Do not let the OpenRouter pilot write confirmed events until the planner core enforces validation and preserves failed work. The GUI remains the planned browser interface for the calendar, questions, corrections, provenance, and status.

## Rollback

- Keep the last passing commit and the Gemini pilot path until the synthetic comparison is complete.
- If the selected free route stops supporting JSON mode, returns invalid data, or fails the gate, stop extraction and keep live intake disabled. Do not switch to paid OpenRouter, Gemini, or a local model automatically.
- Revert only the migration milestone that failed. Keep the report of model scores and failures for review.

## Not included

- Building the browser GUI, planner database, WhatsApp live-group intake, or Zoom worker. Those remain in the existing student-planner milestones.
- Streaming, tool calls, multi-message model requests, cross-message evidence mapping, paid inference, or local-model fallback.
