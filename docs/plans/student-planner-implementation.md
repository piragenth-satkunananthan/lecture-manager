# Student Planner Implementation Plan

**Status:** In progress  
**Approved design:** [`docs/designs/student-planner.md`](../designs/student-planner.md)  
**Plan date:** 2026-11-07

## Progress

- Stage 1 (project and test foundation) is complete: `npm run build` passes and `npm test` passes all 6 config tests on Node.js 24.22.2.
- The user changed the approved AI provider from local Ollama to the Gemini API and accepted free-tier data handling. This changes the design's earlier local-only AI decision; the approved design now records the change. The planner uses structured output, requests `store=false`, sends one selected post with URL/passcode redaction, and does not fall back to a local model.
- The Gemini adapter, config changes, synthetic fixture pilot, and focused tests are implemented. `npm test` passes all 14 tests. A single live fixture passed once; the full API pilot then hit two request timeouts and two HTTP 503 responses before the remaining fixtures ran. The API gate remains open. The key was supplied through an environment file for the pilot; it was not printed or committed, and `.env` was not read.
- No live WhatsApp group/session or Zoom test meeting has been configured. Docker is running, but no Webtop container is present. Live WhatsApp and Zoom acceptance remain separate gates and will not be inferred from unit tests.

## Baseline

- The approved design is the product specification. The repository has no application source, package manifest, or tests yet. User-requested design changes are reflected in the approved design and recorded in this plan.
- The working tree was clean on `main`. No repository `AGENTS.md`, `SPEC.md`, `ROADMAP.md`, or `TASKS.md` was found. The README describes a blueprint only.
- The environment has Node.js 24.22.2, npm 12.2.2, and Docker 29.9.3. The existing `.env` is ignored and will not be read or changed as part of this plan.
- Implementation is split into reviewable stages. Each code stage adds focused tests and runs the build and relevant tests before the next stage.

## Implementation stages

### 1. Project and test foundation

Create the Node 24 TypeScript project, strict compiler settings, build/test scripts, runtime configuration validation, `.env.example`, and generated/private-data exclusions. Add config tests for defaults, missing required values, and invalid storage/runtime limits. Do not read or overwrite `.env`.

**Exit checks:** `npm run build` passes; `npm test` passes; config tests prove `Asia/Colombo` defaults, required settings fail clearly, and invalid paths, timezones, and numeric limits are rejected.

### 2. Extraction, intake, and capture pilots (must pass before planner core)

Run the Gemini structured-output adapter against synthetic fixtures and require exact expected values, including unresolved ambiguous cases. Verify that requests omit sender/group IDs, actual URLs, and passcodes, set `store=false`, and fail safely when the API is unavailable or over quota. Pilot Baileys against the separate test group (try whatsapp-web.js only if Baileys fails) and the Ubuntu Webtop Zoom workflow in a host-controlled test meeting. Keep live-group intake and unattended live recording disabled. Record reconnect/catch-up outcomes, permission/admission checks, saved media quality, host-end detection, and low-space stop results.

**Exit checks:** all fixture expectations pass with zero incorrect or ambiguous auto-confirmations; Gemini requests contain only the selected post with the documented redactions and disabled server-side storage; API failure and quota behavior retain work for retry; intake recovers every eligible pilot post without loss or duplicate planner items; the permitted test meeting saves usable screen/audio, detects host end within 30 seconds, and finalizes at the low-space stop. No live automation until its policy/permission gate is recorded.

**External prerequisites:** a Gemini API key and available quota, a test-group identity and linked-device login, a host-controlled Zoom test meeting and link, and a running Ubuntu Webtop environment. Unit tests can use fakes, but they do not replace these live pilot checks.

### 3. Planner core

After Stage 2 passes, add SQLite migrations and source identity, Gemini extraction validation, pending clarification handling, item lifecycle and edit/cancel matching, overdue review, Sri Lanka date rules, and persistent deduplicated reminders. Add synthetic fixtures with exact expected structured values.

**Exit checks:** component tests cover schema/migrations, message idempotency, ambiguous and incorrect extraction, user-correction precedence, unique cancellation matching, overdue reminder suppression, timezone defaults, reminder deduplication, and restart recovery.

### 4. Planner UI, access, and email

Add the password-protected responsive planner, clarification and correction actions, event provenance, recording metadata views, authenticated worker API boundary, and SMTP notices. Preserve the private-LAN/VPN requirement and do not expose Webtop publicly.

**Exit checks:** API/UI tests cover authentication, input validation, pending questions, corrections, provenance after source-text deletion, recording deletion, sender-safe email content, and at-least-once retry behavior. Build and all prior tests pass.

### 5. Zoom scheduler and Webtop worker

Add persistent non-overlapping Zoom jobs, the claim/heartbeat/status lease protocol, confirmed-permission/admission gates, 5-minute early join, 20-minute wait, screen/audio capture, host-end detection, four-hour cap, 10 GiB free-space stop, private storage, and failure email. Do not bypass blocked Zoom controls.

**Exit checks:** unit tests cover every job transition, lease expiry before/after capture begins, permission/admission rejection, one-job concurrency, wait/cap/end behavior, low-space finalization, and restart/file reconciliation. Repeat the host-controlled live Zoom pilot before enabling unattended capture.

### 6. Deployment, backup, and integrated recovery

Add Compose deployment, private Webtop access, resource limits, daily encrypted SQLite online backup with seven daily and four weekly copies, restore steps, and operations documentation. Exclude credentials and video files from backups; document that expired snapshots may retain deleted database content until expiry.

**Exit checks:** build and all tests pass; a private one-group/test-meeting pilot survives restart and intake outage; restore recovers planner items, reminders, and recording metadata; HTTPS/authentication, disk behavior, alerting, and secret-free logs are manually verified. Keep live automation disabled for any gate that fails.

## Design gaps to resolve before affected stages

1. The design requires authenticated HTTPS for the planner and Webtop but does not specify TLS termination or certificate provisioning. Resolve this before Stage 4 deployment/API exposure; do not silently add a proxy or change the service boundary.
2. The design requires backups on storage separate from the live database but does not specify the actual backup destination. Resolve the deployment path before Stage 6; keep it configurable rather than assuming a host path.
3. The design requires permission confirmed for each class but does not specify the user-facing confirmation mechanism. Resolve this before enabling Stage 5 scheduling; until then, the worker must fail closed.

## Scope and rollback

- Implement only the approved design and its explicit acceptance criteria. Keep live WhatsApp intake and unattended live recording disabled until the documented gates pass.
- Keep each stage in a separate local commit after its checks pass. If a stage fails, leave the previous commit intact and revert only that stage's files.
- Never place real group messages, names, meeting links, passcodes, or session credentials in fixtures, tests, logs, or Git.
