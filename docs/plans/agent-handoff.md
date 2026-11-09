# Agent Handoff

**Updated:** 2026-11-09
**Repository:** `lecture-manager`
**Branch:** `main`

Use this note to continue the approved OpenRouter-only migration. The EGM brainstorm, draft, review, and resolution stages are already complete. Do not restart those stages.

## Verified project state

- The user approved the revised design on 2026-11-08 and then chose to remove the previous provider completely. Migration Milestones 1-3 (design reconciliation, local schema/evidence validation, and OpenRouter adapter) are complete.
- The previous provider's SDK, extractor, configuration, pilot script, package script, and tests have been removed. OpenRouter is the only provider in active code and configuration.
- The OpenRouter adapter and OpenRouter-only synthetic comparison runner are implemented. A live synthetic comparison ran on 2026-11-09; no free model passed under the ZDR-only policy. The user then approved the Gemma non-ZDR exception, but the rerun is incomplete because Google AI Studio returns HTTP 429. No model is selected. See [`model-comparison-2026-11-09-gemma-nonzdr.md`](model-comparison-2026-11-09-gemma-nonzdr.md) and the saved artifact.
- `src/ai.ts` validates the strict extraction shape, field evidence, exact quotes, supported values, dates, times, and Zoom link indexes before returning results. Source IDs remain application-owned.
- `scripts/whatsapp-pilot.ts` tests message intake only. It makes no AI calls. Its duplicate tracking is in memory and is not durable.
- There is no planner database or event persistence path. Keep live intake disabled until durable failure retention, pending review, and provenance are implemented.
- The browser GUI and Zoom worker are design/planning work; they are not implemented.
- The latest implementation check after removing the previous provider passed all 75 tests. That result was re-verified on 2026-11-09 after pinning a time-dependent test clock, adding the Gemma non-ZDR policy test, the evaluation-policy test, the NVIDIA adapter tests, the SQLite/planner/reminder tests, the extraction-pipeline tests, the server tests, and the SMTP delivery tests; it passes 75/75. The comparison runners use 11 synthetic fixtures. The OpenRouter runner needs `OPENROUTER_API_KEY`; the NVIDIA pilot needs `NVIDIA_API_KEY`. A live comparison has now run (see below), but the Gemma rerun is still incomplete because the free endpoint returns HTTP 429. No WhatsApp reconnect test or Zoom test has run.
- The model comparison scorer now compares factual fields and relies on the extractor to validate evidence; it no longer requires the model to reproduce the fixture’s exact evidence quotes. This applies to both providers.
- NVIDIA Build is approved as an active provider and its data terms are accepted. `nvidia/nemotron-3-ultra-550b-a55b` passed the 11/11 gate and is pinned as `NVIDIA_MODEL`. Configuration, the extraction pipeline, and the configured extractor factory are implemented. Extraction stays disabled by default (`EXTRACTION_ENABLED=false`), so no live extraction or intake runs yet. `npm test` passes 75/75. See [`nvidia-build-evaluation-2026-11-09.md`](nvidia-build-evaluation-2026-11-09.md). The passing artifact is [`2026-11-09T05-07-11-690Z.json`](../../artifacts/model-comparison/2026-11-09T05-07-11-690Z.json).
- Held-out check: two sets, 5/6 each. The first exposed a non-announcement false positive; a general rule fixed it. The second set passed both administrative-reminder cases but still set `details` on a deadline-only assignment. The model is conditionally validated, not fully cleared. See [`nvidia-heldout-evaluation-2026-11-09.md`](nvidia-heldout-evaluation-2026-11-09.md) and [`nvidia-heldout2-evaluation-2026-11-09.md`](nvidia-heldout2-evaluation-2026-11-09.md).
- The Fastify server/API is implemented in [`src/server.ts`](../../src/server.ts): six-hour secure session login/logout, authenticated item and clarification routes, corrections/cancellation/archive, recording permission, health, and same-origin checks when `PLANNER_ORIGIN` is set. [`src/index.ts`](../../src/index.ts) starts it and runs the reminder tick. [`src/notifications.ts`](../../src/notifications.ts) sends SMTP reminders with retry/backoff and keeps message text, evidence quotes, and Zoom links out of emails. The browser UI is not implemented.
- Planner core Phase 2A–2C is implemented under user authorization: [`src/db.ts`](../../src/db.ts) holds the SQLite schema and durable extraction-state transitions; [`src/planner.ts`](../../src/planner.ts) handles confirmation, overdue review, cancellation, archive, corrections, duplicate matching, and clarification resolution; [`src/reminders.ts`](../../src/reminders.ts) builds and deduplicates Sri Lanka-time reminders; [`src/time.ts`](../../src/time.ts) holds the timezone helpers. Tests cover schema, lifecycle, corrections, clarifications, and reminders. Extraction and live intake remain disabled.
- `README.md` describes the OpenRouter-only setup, current source, tests, and synthetic comparison command. Update it again after a free model passes Milestone 4.
- A separate resolution-report file was not found. Review dispositions are summarized in `docs/plans/student-planner-implementation.md` and the Goldfish reports.

The OpenRouter adapter is recorded at `d62cee4`; the comparison runner is at `4d9e63b`; removal of the previous provider is recorded at `43e8c82`. Recheck `git status` and `git log` before making changes.

## Approved decisions to preserve

- OpenRouter was chosen because the user wants a free option. Choose a model only after it passes the synthetic comparison. `google/gemma-4-31b-it:free` is a candidate, not a final selection.
- NVIDIA Build is an approved active provider. `nvidia/nemotron-3-ultra-550b-a55b` passed the gate and is pinned. Extraction remains disabled by default until the deployment sets `EXTRACTION_ENABLED=true`; live WhatsApp intake stays off until its own gate.
- Use one lecturer post per OpenRouter request and JSON object mode. Require `provider.require_parameters: true`, `provider.data_collection: "deny"`, and `provider.allow_fallbacks: false` on every request. Use `provider.zdr: true` except for the user-approved `google/gemma-4-31b-it:free` non-ZDR exception (`zdr: false`). Do not rely on provider-side JSON Schema enforcement.
- Keep strict local Zod, evidence, semantic, date, and Zoom-link validation. Invalid, incomplete, unsupported, contradictory, or unverifiable output must not become a confirmed event.
- Require exact field-level quotes for every non-null factual field. Verify quotes against the original local post and the sanitized model-visible text. Do not send WhatsApp message, group, or sender IDs, actual URLs, or passcodes to OpenRouter.
- Preserve Asia/Colombo handling, the 60-second timeout, one attempt per model, and the existing fail-safe behavior. Do not add retry loops, paid or local model fallback, or silent provider switching. The authorized bounded fallback chain may try a second pre-approved free model only on availability failure, must log the serving model, and must not treat a validation failure as a fallback trigger.
- Use synthetic fixtures for model comparisons. Do not send real WhatsApp posts to model candidates.
- Existing English/ISO date and English field-term checks fail closed for unsupported languages or formats. Add synthetic fixtures for the languages lecturers use before model selection.

## Next work: Add browser UI and intake wiring; finish activation

Phase 2A–2C, the Fastify server/API, and SMTP reminder delivery are implemented. `nvidia/nemotron-3-ultra-550b-a55b` passed 11/11, NVIDIA is approved, the model is pinned, and the extraction pipeline plus configured factory are implemented behind `EXTRACTION_ENABLED=false`. Next:

1. Confirm production licensing for the NVIDIA Build tier.
2. Add the browser calendar and clarification UI.
3. Add the intake path that calls the extraction pipeline; do not connect a live subject group.
4. Add a narrow `details` rule and validate it on a third held-out set.
5. Set `EXTRACTION_ENABLED=true` only after integration tests pass; keep live WhatsApp intake disabled until its own gate.

For the model gate:

The gate has one passing model: `nvidia/nemotron-3-ultra-550b-a55b` at 11/11. NVIDIA is approved and the model is pinned, but extraction stays off because `EXTRACTION_ENABLED=false`, licensing is unconfirmed, and the server/intake integration is incomplete. Gemma is still rate-limited.

On 2026-11-09 the user approved the only non-ZDR exception: `google/gemma-4-31b-it:free` may use its Google AI Studio endpoint with `provider.zdr: false`. `provider.data_collection: "deny"`, `provider.require_parameters: true`, and `provider.allow_fallbacks: false` remain required, and every other model keeps `provider.zdr: true`. The code and tests now enforce that exception.

The rerun is blocked by provider availability, not routing:

1. With `zdr: true`, Gemma returned HTTP 404 from the ZDR data policy. With `zdr: false`, the request reaches Google AI Studio.
2. A paced 11-fixture run stopped after 1/11 with HTTP 429. A single probe after a 75-second wait also returned HTTP 429; a second paced retry at 03:17Z and a third at 04:51Z, after roughly 1.5 hours, also returned 429.
3. `free_model_daily_requests` reported 3/50 used at the time of the check, so the 429 is a provider-side or transient limit, not the daily free-model quota.
4. The authorized fallback chain was evaluated on 2026-11-09. No second free model passed: `dots-studio/dots-3-note-preview:free` recorded 9/11 with 7 invalid outputs, and `recursive/flint-v1.0:free` recorded 3/11 with 2 invalid outputs and a timeout. `xingchen` failed earlier. The remaining free models are blocked by the account’s “Free model training” data policy or do not support the required request parameters. See [`model-comparison-2026-11-09-fallback-candidates.md`](model-comparison-2026-11-09-fallback-candidates.md).
5. NVIDIA Build was evaluated as a second provider on 2026-11-09. The key authenticated and the adapter/pilot are implemented. After prompt tuning, the 550B model passed 11/11 and is now the pinned provider. See [`nvidia-build-evaluation-2026-11-09.md`](nvidia-build-evaluation-2026-11-09.md).

The OpenRouter fallback chain is authorized but has no second passing member, so it is not enabled. NVIDIA is approved and pinned, but extraction remains disabled by default pending licensing confirmation and integration. Keep live WhatsApp intake disabled. Do not add a paid or local fallback, and do not weaken `data_collection`, `require_parameters`, or `allow_fallbacks`. For the OpenRouter path, retry `npm run pilot:compare` later with `OPENROUTER_REQUEST_INTERVAL_MS` when the endpoint stops returning 429; save a new artifact and update the report. Before enabling OpenRouter extraction, set and record the Google group's approved non-ZDR privacy setting and keep All other models ZDR-only.

Do not change live WhatsApp intake or run the WhatsApp pilot against a live subject group.

## EGM and planning files

- Approved design: [`../designs/student-planner.md`](../designs/student-planner.md)
- Provider migration plan: [`openrouter-migration-implementation.md`](openrouter-migration-implementation.md)
- Overall implementation plan: [`student-planner-implementation.md`](student-planner-implementation.md)
- ZDR-only comparison run: [`model-comparison-2026-11-09.md`](model-comparison-2026-11-09.md)
- Gemma non-ZDR rerun: [`model-comparison-2026-11-09-gemma-nonzdr.md`](model-comparison-2026-11-09-gemma-nonzdr.md)
- Fallback candidate evaluation: [`model-comparison-2026-11-09-fallback-candidates.md`](model-comparison-2026-11-09-fallback-candidates.md)
- NVIDIA Build evaluation: [`nvidia-build-evaluation-2026-11-09.md`](nvidia-build-evaluation-2026-11-09.md)
- Historical migration brief: [`../../openrouter_migration_brief.md`](../../openrouter_migration_brief.md). The current approved design supersedes it.
- Original concept brief: [`../../concepts_brief.md`](../../concepts_brief.md)
- Resolved draft: [`../../design_draft.md`](../../design_draft.md)
- Root Goldfish review: [`../../goldfish_review_report.md`](../../goldfish_review_report.md)
- Consolidated EGM review: [`../../consolidated_review_report.md`](../../consolidated_review_report.md)
- OpenRouter migration review reports: [`../../egm-review-openrouter-migration/reports/`](../../egm-review-openrouter-migration/reports/)

There is no repository `AGENTS.md` in the current file listing. Follow the user's project instructions for repository work and check the working tree before editing.

## Suggested restart prompt

> Continue the existing student-planner work from `docs/plans/agent-handoff.md`. Read the handoff, approved design, migration plan, overall implementation plan, and the 2026-11-09 comparison reports. Do not repeat EGM. Phase 2A–2C, the extraction pipeline, the Fastify server/API, and SMTP reminder delivery are implemented. NVIDIA Build is approved, `nvidia/nemotron-3-ultra-550b-a55b` is pinned, but `EXTRACTION_ENABLED=false` keeps extraction off. The tuned gate is 11/11; two held-out sets are 5/6 each, with a remaining deadline-only `details` gap. Next: confirm NVIDIA production licensing, add the browser UI, wire the intake path, optionally add the narrow `details` rule plus a third held-out set, then enable extraction after integration tests. Keep live WhatsApp intake disabled until its own gate. Gemma remains rate-limited; do not add a paid fallback or weaken `data_collection`, `require_parameters`, or `allow_fallbacks`.
