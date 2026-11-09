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
- `scripts/whatsapp-pilot.ts` supports durable intake. By default it makes no AI calls; with `WHATSAPP_PILOT_INGEST=true`, selected posts are recorded in SQLite through `src/intake.ts` with durable deduplication. `WHATSAPP_PILOT_EXTRACT=true` additionally processes posts through the configured extractor. `scripts/whatsapp-list-groups.ts` (`npm run whatsapp:groups`) caches group metadata for the UI; `scripts/whatsapp-who.ts` prints sender IDs without text. The tracked group can opt into accepting any member's posts (students as well as lecturers), with provenance retained; the default is lecturer-only. `WHATSAPP_PILOT_EXTRACT=true` is the explicit live-extraction mode and requires `EXTRACTION_ENABLED=true`.
- The planner database, durable extraction states, failed-post retention, pending review, and provenance exist. Live intake remains disabled until the WhatsApp test-group and account-risk gates pass.
- The Zoom worker is design/planning work; it is not implemented.
- The latest implementation check after removing the previous provider passed all 90 tests. That result was re-verified on 2026-11-09 after pinning a time-dependent test clock, adding the Gemma non-ZDR policy test, the evaluation-policy test, the NVIDIA adapter tests, the SQLite/planner/reminder tests, the extraction-pipeline tests, the server tests, the SMTP delivery tests, the static UI test, the intake tests, the failed-post retention tests, the backup/restore tests, and the group-selection API test; it passes 90/90. The comparison runners use 11 synthetic fixtures. The OpenRouter runner needs `OPENROUTER_API_KEY`; the NVIDIA pilot needs `NVIDIA_API_KEY`. A live comparison has now run (see below), but the Gemma rerun is still incomplete because the free endpoint returns HTTP 429. No WhatsApp reconnect test or Zoom test has run.
- The model comparison scorer now compares factual fields and relies on the extractor to validate evidence; it no longer requires the model to reproduce the fixture’s exact evidence quotes. This applies to both providers.
- NVIDIA Build is approved as an active provider and its data terms are accepted. `nvidia/nemotron-3-ultra-550b-a55b` passed the 11/11 gate and is pinned as `NVIDIA_MODEL`. Configuration, the extraction pipeline, and the configured extractor factory are implemented. Extraction stays disabled by default (`EXTRACTION_ENABLED=false`), so no live extraction or intake runs yet. `npm test` passes 90/90. See [`nvidia-build-evaluation-2026-11-09.md`](nvidia-build-evaluation-2026-11-09.md). The passing artifact is [`2026-11-09T05-07-11-690Z.json`](../../artifacts/model-comparison/2026-11-09T05-07-11-690Z.json).
- Held-out check: three sets, 5/6, 5/6, and 5/5. The first exposed a non-announcement false positive; a general rule fixed it. The second exposed a deadline-only `details` gap; the details/cancellation rules fixed it. The third set passed 5/5, and the main gate was re-run at 11/11. See [`nvidia-heldout-evaluation-2026-11-09.md`](nvidia-heldout-evaluation-2026-11-09.md), [`nvidia-heldout2-evaluation-2026-11-09.md`](nvidia-heldout2-evaluation-2026-11-09.md), and [`nvidia-heldout3-evaluation-2026-11-09.md`](nvidia-heldout3-evaluation-2026-11-09.md).
- The Fastify server/API is implemented in [`src/server.ts`](../../src/server.ts): six-hour secure session login/logout, authenticated item and clarification routes, corrections/cancellation/archive, recording permission, health, and same-origin checks when `PLANNER_ORIGIN` is set. [`src/index.ts`](../../src/index.ts) starts it and runs the reminder tick. [`src/notifications.ts`](../../src/notifications.ts) sends SMTP reminders with retry/backoff and keeps message text, evidence quotes, and Zoom links out of emails. The browser UI is implemented in [`web/`](../../web/) with the calendar, upcoming list, questions, corrections, archive toggle, evidence/provenance, and recording permission.
- NVIDIA licensing was reviewed on 2026-11-09. The official Build FAQ says models are free to prototype with (up to 40 RPM for most models, no per-token billing). NIM is free under its license terms without enterprise support; NIM Certified Production Branch requires NVIDIA AI Enterprise. The free Build API is accepted for this single-user pilot, but production licensing/support is not confirmed. See [`docs/deployment/nvidia-licensing.md`](../deployment/nvidia-licensing.md).
- The HTTPS termination path is recorded: Caddy 2 with an internal CA at `planner.home.arpa`, reverse-proxying `127.0.0.1:3000`, with a Tailscale-certificate alternative. The runbook and Caddyfile are in [`docs/deployment/https.md`](../deployment/https.md) and [`deploy/Caddyfile.example`](../../deploy/Caddyfile.example). It was validated locally with Caddy 2.11.8 on `https://localhost:8443`: HTTP/2 200, login 200, `HttpOnly; Secure; SameSite=Strict` cookie, and 403 for missing/wrong Origin. Host installation, DNS, CA trust, and port 443 remain.
- SQLite backup/restore is implemented in [`src/backup.ts`](../../src/backup.ts) with `npm run backup` and `npm run restore -- <file>`: integrity-checked online backup, 0600 permissions, `.pre-restore` safety copy, and WAL sidecar cleanup. Tests cover round-trip restore, safety copy, and invalid backups.
- WhatsApp group selection is implemented: the helper caches group metadata to `storage/whatsapp-groups.json`; authenticated `GET /api/whatsapp/groups`, `GET/PUT/DELETE /api/whatsapp/tracking` persist the chosen test group in the `settings` table, and the planner UI has a group picker. The pilot prefers the UI selection and falls back to `WHATSAPP_GROUP_IDS`.
- Failed-post workflow is implemented: authenticated `GET /api/sources/failed`, `POST /api/sources/:groupId/:messageId/retry`, and `DELETE /api/sources/:groupId/:messageId`; the UI lists retained failures and offers retry/delete. `expireFailedSources` clears raw text after the 30-day deadline on each reminder tick.
- Planner core Phase 2A–2C is implemented under user authorization: [`src/db.ts`](../../src/db.ts) holds the SQLite schema and durable extraction-state transitions; [`src/planner.ts`](../../src/planner.ts) handles confirmation, overdue review, cancellation, archive, corrections, duplicate matching, and clarification resolution; [`src/reminders.ts`](../../src/reminders.ts) builds and deduplicates Sri Lanka-time reminders; [`src/time.ts`](../../src/time.ts) holds the timezone helpers; [`src/intake.ts`](../../src/intake.ts) records source messages, deduplicates them, and calls the extraction pipeline only when enabled. [`scripts/intake-local.ts`](../../scripts/intake-local.ts) ingests a local JSON batch. Tests cover schema, lifecycle, corrections, clarifications, reminders, intake, and failed-post retention. Extraction and live intake remain disabled.
- `README.md` describes the current provider setup, source, tests, and synthetic comparison command. Update it again after a free model passes Milestone 4.
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

## Next work: Apply HTTPS and run the live pilots

Phase 2A–2C, the extraction pipeline, the Fastify server/API, SMTP reminder delivery, the browser UI, and the local intake path are implemented. `nvidia/nemotron-3-ultra-550b-a55b` passed 11/11 and three held-out checks at 5/6, 5/6, and 5/5. NVIDIA is approved, the model is pinned, licensing was reviewed, and the HTTPS path is recorded. Extraction remains behind `EXTRACTION_ENABLED=false`. Next:

1. Install Caddy with the recorded config, register `planner.home.arpa`, trust the CA on clients, and verify HTTPS on port 443. The local reverse-proxy path has already been validated.
2. Run the Baileys test-group pilot and record recovery/untrusted-sender behavior.
3. Run the host-controlled Zoom test meeting.
4. Record the production license choice (self-hosted NIM, NVIDIA AI Enterprise, or another provider) before any non-pilot deployment.
5. Set `EXTRACTION_ENABLED=true` only after the HTTPS and pilot gates pass; keep live WhatsApp intake disabled until its own gate.

For the model gate:

The gate has one passing model: `nvidia/nemotron-3-ultra-550b-a55b` at 11/11. NVIDIA is approved and the model is pinned. Licensing was reviewed: the free Build API is accepted for this single-user pilot, but production licensing/support is not confirmed. The HTTPS path is recorded. Extraction stays off because `EXTRACTION_ENABLED=false` and the live pilot gates are incomplete. The local JSON intake path is implemented; it does not connect WhatsApp. Gemma is still rate-limited.

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

> Continue the existing student-planner work from `docs/plans/agent-handoff.md`. Read the handoff, approved design, migration plan, overall implementation plan, and the 2026-11-09 comparison reports. Do not repeat EGM. Phase 2A–2C, the extraction pipeline, the Fastify server/API, SMTP reminder delivery, the browser UI, and the local intake path are implemented. NVIDIA Build is approved, `nvidia/nemotron-3-ultra-550b-a55b` is pinned, licensing was reviewed, and the HTTPS path is recorded. `EXTRACTION_ENABLED=false` keeps extraction off. The tuned gate is 11/11; held-out checks are 5/6, 5/6, and 5/5, with the known gaps fixed. Next: apply the HTTPS path, run the WhatsApp/Zoom pilots, and record the production license choice. Then enable extraction after those gates. Keep live WhatsApp intake disabled until its own gate. Gemma remains rate-limited; do not add a paid fallback or weaken `data_collection`, `require_parameters`, or `allow_fallbacks`.
