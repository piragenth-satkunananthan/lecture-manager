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
- The user chose OpenRouter to use free models. Select a free model only after it passes the synthetic comparison; Gemma 4 31B is a candidate. Keep Gemini only as the comparison baseline and do not use paid, Gemini, or local runtime fallback.
- The earlier plan records one Gemini fixture passing, followed by two request timeouts and two HTTP 503 responses before the remaining fixtures ran. The Gemini API pilot remains incomplete; no OpenRouter comparison has run, and no raw run log was found to recheck the old results.
- No live WhatsApp test group/session or host-controlled Zoom meeting is configured in the project record. No live intake or unattended recording is enabled.
- `README.md` still says there is no source code or test command; that conflicts with the current repository and must be corrected during the operations-documentation milestone.

## Current project state

- The Node 24 TypeScript foundation, configuration validation, Gemini extraction adapter, synthetic fixtures, and their local tests are committed.
- The repository has an in-progress Baileys pilot and WhatsApp post-selection tests. Preserve and finish this work rather than replacing it.
- The local test command is `npm test`; it runs the strict TypeScript build and Node test suite. Current milestone work must pass it before being marked complete.
- Current verification on Node 24.22.2: `npm test` passes all 31 tests, including fixture and evidence validation plus mocked OpenRouter request, privacy, timeout, and error checks.
- The current build/test suite does not prove Gemini API quality, WhatsApp reconnect recovery, or Zoom admission and capture. Those require separate external pilots.

## Approved constraints

- Keep the planner calendar in SQLite and use `Asia/Colombo`; date-only assignments are due at 11:59 PM.
- Accept only new posts from configured groups and trusted lecturers. Pilot Baileys first; try `whatsapp-web.js` only if Baileys fails. Do not enable live-group intake before the current-policy and account-risk gate.
- Send one selected post per OpenRouter request with JSON mode and `provider.require_parameters: true`. Omit source IDs, actual URLs, and passcodes. Keep strict Zod and semantic validation, including field-level exact quotes for every non-null fact; attach source references locally only after validation. Use a 60-second timeout and no automatic retries.
- Compare Gemini and free OpenRouter candidates using the same synthetic fixtures; require 100% expected-field accuracy and valid evidence, with no invalid, ambiguous, incomplete, or unsupported result confirmed. Use no real WhatsApp posts for model evaluation.
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

Complete the OpenRouter migration plan's local schema/adapter work, then run synthetic model evaluation and the separate WhatsApp and Zoom feasibility pilots before planner-core work. Do not use live WhatsApp content for model comparison, and keep live intake disabled until the planner core has durable failure handling.

1. **Extraction contract and fixtures:** create expected values and exact field quotes for every supported field. Cover clear, corrected, conflicting, missing, incomplete, cancellation, rescheduling, ambiguous, invalid-evidence, and impossible date/time cases. Verify strict schema, evidence, semantic, date, and existing Zoom-link-index checks.
2. **Provider comparison:** run the same synthetic fixtures through the Gemini baseline and shortlisted free OpenRouter models. For each OpenRouter run, require JSON mode and `provider.require_parameters: true`; omit WhatsApp IDs, actual URLs, and passcodes. Require 100% expected-field accuracy and valid evidence for every non-null fact, with no invalid or uncertain item confirmed. Save route, model ID, fixture scores, and failures. The earlier Gemini run did not complete; do not claim a comparison unless both required runs finish. If no free candidate passes, select none and keep extraction disabled.
3. **Failure behavior:** use mocked/saved responses to verify timeouts, rate limits, empty output, malformed JSON, schema errors, and invalid evidence become extraction failures. Use one 60-second request and no automatic retries. Durable retry/manual-review storage is a Planner core exit check, not an existing feature; live intake remains disabled until it passes.
4. **WhatsApp test-group run:** after recording the current policy check and account-risk decision, use one separate test group to verify trusted-sender filtering, new posts, reconnect/catch-up, edits, duplicates, and process restart without loss or duplicate planner items. Do not send test-group posts to Gemini or OpenRouter. If Baileys fails, test `whatsapp-web.js` in the same group. Do not use a live subject group.
5. **Zoom test-meeting run:** in a host-controlled meeting, verify permission, login, admission, five-minute early join, the 20-minute opening wait, usable saved screen/audio, host-end stop within 30 seconds, four-hour cap, low-space finalization, and restart behavior. Keep capture disabled if any permission or admission check fails.

**Current evidence:** local Gemini, WhatsApp, and field-evidence validation coverage is available. The OpenRouter adapter passes mocked tests; live synthetic provider comparison, test-group run, and Zoom meeting result are still pending. The current WhatsApp pilot keeps deduplication in memory, so it cannot by itself prove no loss or duplication across process restart.

**Exit checks:** at least one free OpenRouter candidate passes the 100% synthetic comparison with valid evidence and no invalid or ambiguous event confirmed; both provider runs are complete and recorded; every test-group post survives disconnect/restart without loss or duplication and untrusted senders/groups are ignored; the saved Zoom sample has usable screen/audio and passes the host-end and low-space checks. Keep live intake disabled until Planner core provides durable failure retention and manual review, and keep unattended capture disabled until its separate permission and pilot gates pass.

### Milestone 2: Planner core — after Milestone 1 passes

1. Add SQLite migrations and stable source identity; enforce unique source-message IDs and reminder keys.
2. Integrate the validated OpenRouter extractor from the migration pilot. Attach app-owned source references only after every field and quote passes validation; never confirm partial or unsupported output.
3. Implement durable retention of failed posts for retry/manual review, clarification, correction precedence, cancellation matching, duplicate review, raw-text deletion, evidence-quote lifecycle, and `pending`, `confirmed`, `cancelled`, and `overdue_review` states.
4. Add Sri Lanka date handling and persistent reminder scheduling, including overdue suppression and the documented at-least-once retry behavior.

**Exit checks:** tests cover integration of the validated extraction contract, no persistence of invalid extraction, migrations, idempotent delivery, durable extraction failure/manual review, ambiguous and incorrect extraction, unique cancellation matching, user-correction precedence, date-only deadlines, overdue suppression, reminder deduplication, evidence deletion and backup retention, and restart recovery.

### Milestone 3: User access and alerts

Build the authenticated planner API and responsive browser calendar, pending-question and correction flows, source provenance with field evidence, intake health, recording metadata views, and SMTP notices. Serve planner access over authenticated HTTPS on the private LAN; remote use requires the user's VPN. Do not expose Webtop publicly.

**Decision gate:** resolve TLS termination and certificate provisioning before exposing the planner or API. Do not silently add a proxy or change the service boundary.

**Exit checks:** tests cover authentication, input validation, pending questions, corrections, provenance after raw-text deletion, recording deletion, sender-safe notices, and SMTP retry status. Build and prior tests pass.

### Milestone 4: Zoom worker

After the Zoom pilot passes, add the non-overlapping scheduler, permission/admission gate, planner-owned job states and lease protocol, and the separate Ubuntu Webtop worker. Enforce the five-minute early join, 20-minute wait, host-end detection, four-hour cap, 10 GiB stop, private recordings, and failure email. The worker must not access the container engine socket or start a second concurrent capture.

**Decision gate:** define the user-facing per-class permission confirmation before scheduling live jobs. The worker fails closed until that mechanism and the host/account checks are implemented.

**Exit checks:** tests cover job transitions, lease expiry before/after recording starts, permission/admission rejection, one-job concurrency, wait/end/cap/low-space behavior, restart recovery, and saved-file reconciliation. Repeat the host-controlled pilot before enabling unattended capture.

### Milestone 5: Private pilot, deployment, and recovery

Add Compose deployment, private Webtop access, resource limits, operational documentation, and a one-group/test-meeting integrated pilot. Add a daily encrypted SQLite online backup on storage separate from the live database; retain seven daily and four weekly copies; exclude credentials and video files. Document and test restore while stopped, verify planner items/reminders/recording metadata before restart, and state that video files are not recoverable from these backups.

**Decision gate:** select the separate backup destination before implementing backups; do not assume a host path.

**Exit checks:** build and all tests pass; restart and intake outage recovery work; restore recovers planner state and recording metadata; HTTPS/authentication, disk behavior, alerting, secret-free logs, and private Webtop access are manually verified. Keep any live automation disabled when its gate fails.

## Rollback and data handling

- Make one milestone change at a time and keep the last passing commit intact; revert only files from a failed milestone.
- Never put real group messages, names, meeting links, passcodes, or session credentials in fixtures, tests, logs, or Git. Do not read or overwrite `.env` as part of the implementation.
- Do not mark a pilot complete from unit tests alone. Record the external result and its date before enabling that path.
