# Stage 9: Implementation Readiness Test

**Target:** DetailedRange, lines 148–285 of `docs/designs/student-planner.md`
**Reviewers:** implementation readiness, codebase details, and style
**Status:** All three reviewers completed.

## Findings

### Blockers

#### `implementation_readiness-1-1` / `codebase_details-1-2` — Live WhatsApp intake lacks an authorization and enforcement gate

**Affected scope:** Implementation overview; feasibility pilot; `src/whatsapp.ts`; release gate.
**Finding:** Baileys and whatsapp-web.js are unofficial clients. A test-group connection proves technical operation, not permission for live-group automation or ongoing account acceptance. The supplied Terms snapshot is dated 2021.
**Proposed action:** Add a separate authorization/current-policy and account-risk go/no-go before live intake. Define what happens if the account is restricted: stop automated intake, alert, and use the manual-forwarding fallback.

#### `implementation_readiness-1-2` / `codebase_details-1-1` — Zoom capture lacks a confirmed allowed automation path

**Affected scope:** Zoom worker; Webtop job creation; live capture gate.
**Finding:** The plan relies on automated desktop control and FFmpeg capture. The supplied Zoom sources identify automated Native/Web App use as unofficial and describe bot controls. A successful host-controlled test does not prove that the account and host settings allow every live session.
**Proposed action:** Require the test to confirm the chosen path is permitted by the account and host settings. Do not bypass blocked controls. If the path is blocked or not allowed, keep unattended joining/recording disabled and use only a separately approved fallback.

### Major

#### `implementation_readiness-1-3` — Database and worker contracts are not specified

**Affected scope:** `src/db.ts`; `src/planner.ts`; `src/zoom.ts`; Webtop agent files.
**Finding:** Table names are listed without fields, keys, relationships, or lifecycle states. The document does not define how source edits interact with user corrections. The planner/Webtop interface lacks endpoint and payload definitions, job-state transitions, and retry/lease behavior.
**Proposed action:** Specify the event/message schema, edit precedence, job protocol, state transitions, and retry ownership before implementation.

#### `implementation_readiness-1-4`, `style-1-1`, and `style-1-2` — Pilot pass/fail criteria are not measurable

**Affected scope:** Feasibility Pilot; fixture data; WhatsApp/AI/Zoom verification.
**Finding:** “Extracts correctly,” “within resource limits,” “reliably enough,” and “clear screen/audio” do not define pass/fail results. The fixture file names categories but not expected extraction outputs.
**Proposed action:** Define expected fields and values for each fixture, resource ceilings, reconnect and catch-up success conditions, and observable recording quality/end-detection criteria before enabling live use.

#### `implementation_readiness-1-5` / `codebase_details-1-3` — Webtop image and interactive access remain underspecified

**Affected scope:** `compose.yaml`; `webtop/Dockerfile`; agent startup; deployment guide.
**Finding:** “Ubuntu Webtop” does not select an image tag or desktop session, although the plan depends on X11, `xdotool`, and PulseAudio. “Keep private” does not say how GUI authentication, HTTPS, or device access works. The planner-to-agent token does not authenticate interactive Webtop access.
**Proposed action:** Specify the Webtop image/session and audio/display setup, then define a private HTTPS access route and its authentication before deployment.

#### `implementation_readiness-1-6` — SMTP retry can duplicate reminders

**Affected scope:** `src/reminders.ts`; reminder verification.
**Finding:** If SMTP accepts a message but the process stops before marking the outbox record delivered, restart may send the email again.
**Proposed action:** Define the intended delivery guarantee and recovery behavior, and include the send/commit failure window in verification.

#### `implementation_readiness-1-7` — Backup and restore are named but not designed

**Affected scope:** `compose.yaml`; README; recovery verification.
**Finding:** The plan requires backup/restore checks but does not identify what is backed up, how to take a consistent SQLite copy while the service is running, where backups are stored, or how restore works.
**Proposed action:** Define and verify the backup/restore procedure for planner state and recording metadata before rollout.

### Nit

#### `style-1-3` — “Small” and “plain” are undefined

**Affected scope:** Detailed Implementation Plan introduction.
**Finding:** “Small” and “plain” are subjective descriptors; “single-user” and “responsive” communicate the scope more clearly.
**Proposed action:** Remove the vague descriptors.

## Codebase Findings

The repository contains no application source or reusable components. The README accurately describes it as a blueprint. The proposed targets are new files or a README update; no migration of existing application code is required.

## Read Confirmation

All three reviewers confirmed reading their assigned persona, the implementation-readiness standard where assigned, DetailedRange, and all nine approved source files. The Zoom bot-controls HTML was a loading shell; reviewers also read its rendered-text companion. No files were edited. Runtime checks and tests were not run because this was a read-only design review and there is no implementation to run.
