# Student Planner Implementation Plan

**Status:** In progress  
**Approved design:** [`docs/designs/student-planner.md`](../designs/student-planner.md)
**Plan date:** 2026-11-07
**Provider migration plan:** [`openrouter-migration-implementation.md`](openrouter-migration-implementation.md)
**Agent handoff:** [`agent-handoff.md`](agent-handoff.md)

## Recovered handoff

- The EGM artifacts are stored in the project root; the resolved design is under `docs/designs/` and the implementation plan is under `docs/plans/`.
- No repository `AGENTS.md`, `SPEC.md`, `ROADMAP.md`, or `TASKS.md` was found. The user-provided project instructions apply.
- The user approved the revised OpenRouter and field-evidence design on 2026-11-08. Keep live intake disabled until the durable failure/manual-review path exists.
- The resolution report marks findings 1-8 and 10-14 `PROPOSE FIX`, finding 9 `ESCALATE` with no edit because the author had approved the detailed plan, and finding 15 `DECLINE` as editorial. Those dispositions are recorded in `goldfish_review_report.md`; the resolved design includes the accepted changes.
- The user chose OpenRouter for its free models and later directed us to remove the previous provider completely. Compare free OpenRouter candidates only; Gemma 4 31B is a candidate, not a fixed choice. Do not use paid or local model fallback.
- A synthetic OpenRouter comparison ran on 2026-11-09. No free candidate passed under the ZDR-only policy. The user then approved the Gemma non-ZDR exception; the Gemma rerun reaches Google AI Studio but returns HTTP 429, so it is incomplete. The user also authorized a bounded fallback chain, but no second free model passed the fixture gate. NVIDIA Build was evaluated as a second provider; after prompt tuning, `nvidia/nemotron-3-ultra-550b-a55b` passed 11/11, the user approved NVIDIA as an active provider, and the model is pinned. Two held-out checks passed 5/6 each: a non-announcement gap was fixed by a general rule, and one deadline-only `details` gap remains. Configuration, the extraction pipeline, and the configured extractor factory are implemented; `EXTRACTION_ENABLED` remains false by default. Licensing confirmation and integration tests remain. Live intake stays disabled. See [`nvidia-build-evaluation-2026-11-09.md`](nvidia-build-evaluation-2026-11-09.md).
- No live WhatsApp test group/session or host-controlled Zoom meeting is configured in the project record. No live intake or unattended recording is enabled.
- `README.md` now describes the current source, test, and synthetic comparison commands. Reconcile it with the selected provider during the cutover documentation step.

## Current project state

- The Node 24 TypeScript foundation, OpenRouter extraction adapter, synthetic fixtures, and local tests are committed. The previous provider SDK, configuration, and pilot have been removed.
- The repository has an in-progress Baileys pilot and WhatsApp post-selection tests. Preserve and finish this work rather than replacing it.
- The local test command is `npm test`; it runs the strict TypeScript build and Node test suite. Current milestone work must pass it before being marked complete.
- Phase 2A–2C added [`src/db.ts`](../../src/db.ts), [`src/planner.ts`](../../src/planner.ts), [`src/reminders.ts`](../../src/reminders.ts), and [`src/time.ts`](../../src/time.ts): SQLite schema, extraction-state transitions, item lifecycle, corrections, clarification resolution, duplicate matching, and Sri Lanka-time reminder scheduling. [`src/extraction.ts`](../../src/extraction.ts), [`src/extraction-factory.ts`](../../src/extraction-factory.ts), [`src/server.ts`](../../src/server.ts), and [`src/notifications.ts`](../../src/notifications.ts) add the extraction pipeline, authenticated Fastify API, and SMTP reminder delivery with retry/backoff. The browser GUI is not implemented.
- Current verification on Node 24.22.2: `npm test` passes all 75 tests, including database schema/state, planner lifecycle, clarifications, reminders, extraction pipeline/configuration, server auth/routes, SMTP delivery/retry, fixture scoring, evidence validation, and mocked OpenRouter and NVIDIA request, privacy, timeout, and error checks. The comparison commands build and run when a key is supplied through the process environment; the Gemma route is still rate-limited, but the NVIDIA 550B passed 11/11 and is pinned.
- The current build/test suite does not prove OpenRouter model quality, WhatsApp reconnect recovery, or Zoom admission and capture. Those require separate external pilots.

## Approved constraints

- Keep the planner calendar in SQLite and use `Asia/Colombo`; date-only assignments are due at 11:59 PM.
- Accept only new posts from configured groups and trusted lecturers. Pilot Baileys first; try `whatsapp-web.js` only if Baileys fails. Do not enable live-group intake before the current-policy and account-risk gate.
- Send one selected post per OpenRouter request with JSON mode, `provider.require_parameters: true`, `provider.data_collection: "deny"`, and `provider.allow_fallbacks: false`. Use `provider.zdr: true` except for the user-approved `google/gemma-4-31b-it:free` non-ZDR exception (`zdr: false`). Omit source IDs, actual URLs, and passcodes. Keep strict Zod and semantic validation, including field-level exact quotes for every non-null fact; attach source references locally only after validation. Use a 60-second timeout and no automatic retries.
- Compare free OpenRouter candidates using the same synthetic fixtures; require 100% expected-field accuracy and valid evidence, with no invalid, ambiguous, incomplete, or unsupported result confirmed. Use no real WhatsApp posts for model evaluation.
- Store validated evidence quotes with their events, delete them with the event from the live database, and document that encrypted backups may retain them through the seven-daily and four-weekly rotation.
- Keep live WhatsApp intake disabled until durable failure retention, pending review, and source provenance are implemented and pass their gates.
- Ask about missing or conflicting details instead of guessing. Preserve source identity, user corrections, cancellation matching, duplicate review, and the `overdue_review` behavior defined in the design.
- Keep Zoom capture disabled unless permission and admission can be verified for that class. Never bypass blocked Zoom controls. Keep Webtop private and separately authenticated.
- Keep recordings private and user-deletable. Stop active capture below 10 GiB free, cap it at four hours, and do not automatically delete older recordings.
- Email delivery is at-least-once. Backups exclude credentials and video files.

## Milestones

### Milestone 0: Project and test foundation — complete

Node 24, strict TypeScript, build/test scripts, configuration validation, safe environment example, and private-data exclusions are in place.

**Exit checks:** `npm test` passes; config tests cover defaults, required values, invalid paths, time zones, and numeric limits.

### Milestone 1: Feasibility pilot — in progress

**Status:** The model gate has a passing candidate: `nvidia/nemotron-3-ultra-550b-a55b` at 11/11. Two held-out checks passed 5/6 each; the non-announcement gap is fixed, and one deadline-only `details` gap remains. The OpenRouter free path has no passing candidate. The WhatsApp test-group and Zoom test-meeting pilots remain pending.
Complete the OpenRouter migration plan's local schema/adapter work, then run synthetic model evaluation and the separate WhatsApp and Zoom feasibility pilots before planner-core work. Do not use live WhatsApp content for model comparison, and keep live intake disabled until the planner core has durable failure handling.

1. **Extraction contract and fixtures:** create expected values and exact field quotes for every supported field. Cover clear, corrected, conflicting, missing, incomplete, cancellation, rescheduling, ambiguous, invalid-evidence, and impossible date/time cases. Verify strict schema, evidence, semantic, date, and existing Zoom-link-index checks.
2. **Provider comparison:** run the same synthetic fixtures through each shortlisted free OpenRouter model. Require JSON mode, `provider.require_parameters: true`, `provider.data_collection: "deny"`, and `provider.allow_fallbacks: false`; use `provider.zdr: true` except for the user-approved `google/gemma-4-31b-it:free` path, which uses `zdr: false`. Omit WhatsApp IDs, actual URLs, and passcodes. Require 100% expected-field accuracy and valid evidence for every non-null fact, with no invalid or uncertain item confirmed. Save route, model ID, fixture scores, and failures. Before enabling extraction, verify the Google group's approved non-ZDR setting and the ZDR-only All other models setting. If any required candidate run is incomplete, no candidate passes, account privacy cannot be verified, or no qualifying endpoint exists, select none and keep extraction disabled.
3. **Failure behavior:** use mocked/saved responses to verify timeouts, rate limits, empty output, malformed JSON, schema errors, and invalid evidence become extraction failures. Use one 60-second request and no automatic retries. Durable retry/manual-review storage is a Planner core exit check, not an existing feature; live intake remains disabled until it passes.
4. **WhatsApp test-group run:** after recording the current policy check and account-risk decision, use one separate test group to verify trusted-sender filtering, new posts, reconnect/catch-up, edits, duplicates, and process restart without loss or duplicate planner items. Do not send test-group posts to any model. If Baileys fails, test `whatsapp-web.js` in the same group. Do not use a live subject group.
5. **Zoom test-meeting run:** in a host-controlled meeting, verify permission, login, admission, five-minute early join, the 20-minute opening wait, usable saved screen/audio, host-end stop within 30 seconds, four-hour cap, low-space finalization, and restart behavior. Keep capture disabled if any permission or admission check fails.

**Current evidence:** local OpenRouter, WhatsApp, and field-evidence coverage is available. Under the ZDR-only policy, Gemma 4 31B free returned HTTP 404 and the only ZDR-routable free model failed validation on two fixtures before HTTP 429. After the user-approved Gemma non-ZDR exception, the request reaches Google AI Studio but the rerun stopped after 1/11 with HTTP 429, even after a 75-second wait; paced retries at 03:17Z and 04:51Z also stopped at 1/11 with HTTP 429. The authorized fallback chain was evaluated: dots recorded 9/11 with 7 invalid outputs, recursive recorded 3/11 with 2 invalid outputs and a timeout, and xingchen failed earlier; no second model passed. NVIDIA Build was evaluated too; after prompt tuning, its Nemotron 3 Ultra 550B passed **11/11**, NVIDIA is approved as an active provider, and the model is pinned. Two held-out checks passed 5/6 each; the non-announcement rule fixed the first gap, and one deadline-only `details` mismatch remains. The gate now accepts source-supported free-text spans while keeping structured fields exact. `EXTRACTION_ENABLED` remains false by default; licensing confirmation and integration tests remain. Phase 2A–2C planner-core work, the authenticated Fastify API, and SMTP reminder delivery are implemented under user authorization; extraction remains disabled. The browser GUI remains. The test-group run and Zoom meeting result are still pending. The current WhatsApp pilot keeps deduplication in memory, so it cannot by itself prove no loss or duplication across process restart.

**Exit checks:** the model gate has a passing candidate (NVIDIA 550B at 11/11) with valid evidence and no invalid or ambiguous event confirmed; the OpenRouter free path has no passing candidate. Every shortlisted model run is complete and recorded; required account privacy settings and qualifying routing are verified; the Baileys WhatsApp test-group pilot passes, or the alternate `whatsapp-web.js` pilot also passes if Baileys fails, using at least 10 eligible and 10 untrusted messages across at least two disconnect/restart cycles, 100% eligible recovery exactly once, and zero untrusted acceptance; the saved Zoom sample has usable screen/audio and passes the host-end and low-space checks. Keep live intake disabled until Planner core provides durable failure retention and manual review, and keep unattended capture disabled until its separate permission and pilot gates pass.

### Milestone 2: Planner core — Phase 2A–2C implemented (early start authorized)

**Status:** Phase 2A–2C is implemented: SQLite schema, source-message states, planner lifecycle, corrections, clarifications, and reminder scheduling. The user authorized starting before Milestone 1 passes; extraction and live WhatsApp intake remain disabled.

1. Add SQLite migrations and stable source identity; enforce unique source-message IDs and reminder keys.
2. Integrate the validated OpenRouter extractor from the migration pilot. Attach app-owned source references only after every field and quote passes validation; never confirm partial or unsupported output.
3. Implement durable retention of failed posts for up to 30 days with user-triggered retry and deletion, clarification, correction precedence, cancellation matching, duplicate review, raw-text deletion, evidence-quote lifecycle, and `pending`, `confirmed`, `cancelled`, `overdue_review`, and `archived` states. Archive hides overdue items from default views and suppresses reminders and recording while retaining item/provenance until user deletion.
4. Add Sri Lanka date handling and persistent reminder scheduling, including overdue suppression and the documented at-least-once retry behavior.

**Exit checks:** tests cover integration of the validated extraction contract, no persistence of invalid extraction, migrations, idempotent delivery, durable extraction failure/manual review, ambiguous and incorrect extraction, unique cancellation matching, user-correction precedence, date-only deadlines, overdue suppression, reminder deduplication, evidence deletion and backup retention, and restart recovery.

### Milestone 3: User access and alerts

**Status:** In progress — the authenticated Fastify API and SMTP reminder delivery are implemented. `src/server.ts` covers session login/logout, items, corrections, clarifications, recording permission, health, and origin checks. `src/notifications.ts` sends due reminders with retry/backoff and keeps message text and links out of email. The browser calendar UI is not implemented.

Build the authenticated planner API and responsive browser calendar, pending-question and correction flows, source provenance with field evidence, intake health, recording metadata views, and SMTP notices. Serve planner access over authenticated HTTPS on the private LAN; remote use requires the user's VPN. Do not expose Webtop publicly.

**Decision gate:** deployment remains blocked until the operator records the HTTPS termination point, certificate provisioning/renewal procedure, and private LAN hostname. Do not assume a domain or machine-specific value.

**Exit checks:** tests cover authentication, input validation, pending questions, corrections, provenance after raw-text deletion, recording deletion, sender-safe notices, and SMTP retry status. Build and prior tests pass.

### Milestone 4: Zoom worker

After the Zoom pilot passes, add the non-overlapping scheduler, permission/admission gate, planner-owned job states and lease protocol, and the separate Ubuntu Webtop worker. Enforce the five-minute early join, 20-minute wait, host-end detection, four-hour cap, 10 GiB stop, private recordings, and failure email. The worker must not access the container engine socket or start a second concurrent capture.

**Decision gate:** require per-class `recording_permission` with confirmer and time before scheduling live jobs. The worker fails closed unless both permission and Zoom admission are confirmed.

**Exit checks:** tests cover job transitions, lease expiry before/after recording starts, permission/admission rejection, one-job concurrency, wait/end/cap/low-space behavior, restart recovery, and saved-file reconciliation. Repeat the host-controlled pilot before enabling unattended capture.

### Milestone 5: Private pilot, deployment, and recovery

Add Compose deployment, private Webtop access, resource limits, operational documentation, and a one-group/test-meeting integrated pilot. Add a daily encrypted SQLite online backup on storage separate from the live database; retain seven daily and four weekly copies; exclude credentials and video files. Document and test restore while stopped, verify planner items/reminders/recording metadata before restart, and state that video files are not recoverable from these backups.

**Decision gate:** deployment remains blocked until a separately mounted `BACKUP_PATH`, external `BACKUP_ENCRYPTION_KEY_FILE`, key rotation procedure, and restore using the active key are verified. Do not assume machine-specific paths.

**Exit checks:** build and all tests pass; restart and intake outage recovery work; restore recovers planner state and recording metadata; HTTPS/authentication, disk behavior, alerting, secret-free logs, and private Webtop access are manually verified. Keep any live automation disabled when its gate fails.

## Rollback and data handling

- Make one milestone change at a time and keep the last passing commit intact; revert only files from a failed milestone.
- Never put real group messages, names, meeting links, passcodes, or session credentials in fixtures, tests, logs, or Git. Do not read or overwrite `.env` as part of the implementation.
- Do not mark a pilot complete from unit tests alone. Record the external result and its date before enabling that path.
