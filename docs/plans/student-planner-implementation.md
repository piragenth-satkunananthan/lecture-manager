# Student Planner Implementation Plan

**Status:** In progress  
**Approved design:** [`docs/designs/student-planner.md`](../designs/student-planner.md)  
**Plan date:** 2026-11-07

## Recovered handoff

- The EGM artifacts are stored in the project root; the resolved design is under `docs/designs/` and the implementation plan is under `docs/plans/`.
- No repository `AGENTS.md`, `SPEC.md`, `ROADMAP.md`, or `TASKS.md` was found. The user-provided project instructions apply.
- The design file still labels itself `Proposed`, while this plan calls it approved and the user confirms it is the approved design. Treat its architecture and requirements as fixed; do not rewrite them during implementation.
- The resolution report marks findings 1-8 and 10-14 `PROPOSE FIX`, finding 9 `ESCALATE` with no edit because the author had approved the detailed plan, and finding 15 `DECLINE` as editorial. Those dispositions are recorded in `goldfish_review_report.md`; the resolved design includes the accepted changes.
- The user-approved AI choice is Gemini API on the free tier, with `store=false` and no local-model fallback. The design records that Google may use free-tier content to improve products.
- The earlier plan records one Gemini fixture passing, followed by two request timeouts and two HTTP 503 responses before the remaining fixtures ran. The API pilot remains open; no raw run log was found to recheck those results.
- No live WhatsApp test group/session or host-controlled Zoom meeting is configured in the project record. No live intake or unattended recording is enabled.
- `README.md` still says there is no source code or test command; that conflicts with the current repository and must be corrected during the operations-documentation milestone.

## Current project state

- The Node 24 TypeScript foundation, configuration validation, Gemini extraction adapter, synthetic fixtures, and their local tests are committed.
- The working tree contains an in-progress Baileys pilot and WhatsApp post-selection tests, plus its dependency changes. Preserve and finish this work rather than replacing it.
- The local test command is `npm test`; it runs the strict TypeScript build and Node test suite. Current milestone work must pass it before being marked complete.
- Current verification on Node 24.22.2: `npm test` passes all 19 tests, including complete Gemini fixture shape and impossible-date expectations.
- The current build/test suite does not prove Gemini API quality, WhatsApp reconnect recovery, or Zoom admission and capture. Those require separate external pilots.

## Approved constraints

- Keep the planner calendar in SQLite and use `Asia/Colombo`; date-only assignments are due at 11:59 PM.
- Accept only new posts from configured groups and trusted lecturers. Pilot Baileys first; try `whatsapp-web.js` only if Baileys fails. Do not enable live-group intake before the current-policy and account-risk gate.
- Send one selected post to Gemini with URLs replaced by local indexes, passcodes removed, group/sender IDs omitted, and `store=false`. Do not add a local-model fallback.
- Ask about missing or conflicting details instead of guessing. Preserve source identity, user corrections, cancellation matching, duplicate review, and the `overdue_review` behavior defined in the design.
- Keep Zoom capture disabled unless permission and admission can be verified for that class. Never bypass blocked Zoom controls. Keep Webtop private and separately authenticated.
- Keep recordings private and user-deletable. Stop active capture below 10 GiB free, cap it at four hours, and do not automatically delete older recordings.
- Email delivery is at-least-once. Backups exclude credentials and video files.

## Milestones

### Milestone 0: Project and test foundation — complete

Node 24, strict TypeScript, build/test scripts, configuration validation, safe environment example, and private-data exclusions are in place.

**Exit checks:** `npm test` passes; config tests cover defaults, required values, invalid paths, time zones, and numeric limits.

### Milestone 1: Feasibility pilot — in progress

Complete each pilot gate before building the planner core:

1. **Gemini contract and synthetic fixtures:** compare every returned field with a complete expected fixture; cover clear, corrected, conflicting, missing, and impossible date/time cases. Verify request redaction, URL indexing, `store=false`, malformed output rejection, and safe API failure handling.
2. **Gemini API run:** use only synthetic fixtures. Require every fixture to match exactly, record quota and failure behavior, and retain failed work for retry. The previous run did not complete; rerun only when the API key and free-tier quota are available.
3. **WhatsApp test-group run:** after recording the current policy check and account-risk decision, use one separate test group to verify trusted-sender filtering, new posts, reconnect/catch-up, edits, duplicates, and process restart without loss or duplicate planner items. If Baileys fails, test `whatsapp-web.js` in the same group. Do not use a live subject group.
4. **Zoom test-meeting run:** in a host-controlled meeting, verify permission, login, admission, five-minute early join, the 20-minute opening wait, usable saved screen/audio, host-end stop within 30 seconds, four-hour cap, low-space finalization, and restart behavior. Keep capture disabled if any permission or admission check fails.

**Current evidence:** local Gemini and WhatsApp unit coverage is available. The live Gemini run is incomplete; no test-group run or Zoom meeting result is recorded. The current WhatsApp pilot keeps deduplication in memory, so it cannot by itself prove no loss or duplication across process restart.

**Exit checks:** every synthetic fixture matches exactly with zero incorrect or ambiguous items auto-confirmed; Gemini requests meet the redaction and storage requirements; API failure retains work; every eligible test post survives disconnect/restart without loss or duplication; untrusted posts are ignored; the saved Zoom sample has usable screen/audio and passes the host-end and low-space checks. Keep live intake and unattended capture disabled until their separate policy, permission, and pilot gates pass.

### Milestone 2: Planner core — after Milestone 1 passes

1. Add SQLite migrations and stable source identity; enforce unique source-message IDs and reminder keys.
2. Implement item extraction, clarification, correction precedence, cancellation matching, duplicate review, raw-text deletion, and `pending`, `confirmed`, `cancelled`, and `overdue_review` states.
3. Add Sri Lanka date handling and persistent reminder scheduling, including overdue suppression and the documented at-least-once retry behavior.

**Exit checks:** tests cover migrations, idempotent delivery, ambiguous and incorrect extraction, unique cancellation matching, user-correction precedence, date-only deadlines, overdue suppression, reminder deduplication, and restart recovery.

### Milestone 3: User access and alerts

Build the authenticated planner API and responsive browser calendar, pending-question and correction flows, source provenance, intake health, recording metadata views, and SMTP notices. Serve planner access over authenticated HTTPS on the private LAN; remote use requires the user's VPN. Do not expose Webtop publicly.

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
