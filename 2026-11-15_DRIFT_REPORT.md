# EGM Drift Report — 2026-11-15

Target: `/home/piragenth/Documents/lecture-manager`
Verified against current code: `npm test` = **107/107 passing**; `git status` shows the working tree listed below.
Note: the earlier findings from this report date (DRF-001, NF-001…NF-007) were fixed in this session and now pass tests; the sections below are a fresh re-scan of every doc against the current code.

---

## docs/designs/student-planner.md

- Target file 5 (`.env.example`) is incomplete vs. the design: it does not document `OPENROUTER_MODEL`, `NVIDIA_API_KEY`, `NVIDIA_MODEL`, `EXTRACTION_PROVIDER`, `EXTRACTION_ENABLED`, `PLANNER_PASSWORD`, `SESSION_KEY_FILE`, `PLANNER_ORIGIN`, `SMTP_TO`, `BACKUP_PATH`, or `BACKUP_ENCRYPTION_KEY_FILE` (only `ZOOM_ACCOUNT_EMAIL`, group/lecturer IDs, SMTP host/port/from, Webtop token, recording path/limits are present). The design requires these as unset placeholders.
- Backup naming mismatch: the design and `src/config.ts` use `BACKUP_PATH` / `BACKUP_ENCRYPTION_KEY_FILE`, but `scripts/backup.ts` reads `BACKUP_DIR` (default `./backups`) and passes `BACKUP_ENCRYPTION_KEY_FILE` directly from env; the new `AppConfig.backupPath`/`backupEncryptionKeyFile` fields are parsed but not consumed by any runtime scheduler.
- Missing feature: the design (stage 5 / target file 20 and Milestone 5) calls for a **daily** encrypted SQLite online backup. Code only provides a manual `npm run backup`; `src/index.ts` has a reminder/Zoom tick but no daily backup timer, so the automated daily snapshot is not implemented.
- Otherwise matches: OpenRouter is now wired in `src/extraction-factory.ts` (design's approved-provider requirement satisfied); AES-256-GCM backup encryption is implemented in `src/backup.ts`; `test/zoom.test.ts`, `test/fixtures/lecturer-posts.json`, and `webtop/root/etc/services.d/zoom-agent/run` now exist as specified.

## README.md

- Line 3 says the repo "is not yet a complete planner application" — stale; the planner server, DB, UI, intake, and Zoom subsystem are implemented.
- Line 12 says "Live WhatsApp intake and the Zoom worker are not implemented" — partially stale: the Zoom worker **is** implemented (`src/zoom.ts`, `webtop/agent.ts`, `webtop/capture.ts`, `webtop/zoom-ui.ts`, and `/agent/*` routes). Only live WhatsApp intake remains disabled (correct).
- Line 47 route list omits the agent routes `/agent/health`, `/agent/jobs/claim`, `/agent/jobs/:jobId/heartbeat`, `/agent/jobs/:jobId/status` and `DELETE /api/recordings/:id`, all present in `src/server.ts`.
- Line 51 says "The server does not start WhatsApp intake, extraction, or Zoom jobs" — false for Zoom jobs: `src/index.ts` calls `scheduleZoomJobs(db, zoomSchedulerConfig)` on every 60 s tick.
- Backup/restore section (lines 182–198) does not document the now-implemented AES-256-GCM encryption (`BACKUP_ENCRYPTION_KEY_FILE`, `.enc` output) nor the `BACKUP_DIR` vs `BACKUP_PATH` naming; it only describes plaintext `.sqlite` backups.

## docs/plans/agent-handoff.md

- Line 12: "OpenRouter is the only provider in active code and configuration" — stale; NVIDIA Build is an approved active provider, and OpenRouter extraction is now wired in `src/extraction-factory.ts` (both selectable via `EXTRACTION_PROVIDER`).
- Line 17: "The Zoom worker is design/planning work; it is not implemented" — stale; the worker, scheduler, and `/agent/*` protocol are implemented.
- Lines 18 and 20: "passes 90/90" — stale; the suite is now **107/107**.

## docs/plans/student-planner-implementation.md

- Line 26: "`npm test` passes all 90 tests" — stale; now 107/107 (includes the new `test/zoom.test.ts`).

## docs/plans/openrouter-migration-implementation.md

- Line 21: "OpenRouter is the only active model provider in code, configuration, scripts, and dependencies" — stale; NVIDIA Build is also an active provider and OpenRouter extraction is wired.
- Line 22: "The project has no planner database or event-persistence path yet" — stale; the SQLite planner store exists in `src/db.ts` with the full schema and state transitions.
- Line 25: "This migration does not build the GUI; the planner database and service must exist before that GUI can use extracted events" — stale; the browser GUI in `web/` and the Fastify server in `src/server.ts` already exist.

## docs/deployment/https.md

- No code drift. Status notes (Caddy not installed on host, DNS/CA/443 pending, app not running on host) remain accurate operational pending items; the local-validation results are unchanged.

## docs/deployment/nvidia-licensing.md

- No drift. Matches code/config (`EXTRACTION_PROVIDER=nvidia`, pinned model); licensing decision text is consistent.

## docs/plans/*-2026-11-09*.md (evaluation reports)

- No drift reported: these are dated, self-labeled historical snapshots (e.g., "Historical (superseded in part)", "2026-11-09") of model-evaluation runs, not current-state specs; they are not expected to match the current code.
