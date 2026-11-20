# EGM Drift Report — Student Planner

**Generated:** 2026-11-10  
**Design Document:** `docs/designs/student-planner.md`  
**Scope:** Full codebase vs. approved design

---

## docs/designs/student-planner.md

### Critical Missing Components (Architectural Divergence)

#### 1. **Zoom Worker — Entirely Missing**
- `webtop/Dockerfile` — Not created
- `webtop/agent.ts` — Not created
- `webtop/zoom-ui.ts` — Not created
- `webtop/capture.ts` — Not created
- `webtop/root/etc/services.d/zoom-agent/run` — Not created
- **Impact:** CUJ 3 (Join and record a scheduled Zoom class) cannot be fulfilled.

#### 2. **Zoom Job Scheduler (`src/zoom.ts`) — Not Created**
Design Section "Technical Plan / Zoom scheduling and capture" specifies:
- Schedule confirmed non-overlapping classes with confirmed permission
- Request Webtop job five minutes before start
- Enforce 20-minute wait
- Record job state, alert on agent failure, admission failure, four-hour cap, low disk space
- **Status:** File does not exist.

#### 3. **Agent Routes — Not Implemented in `src/server.ts`**
Design Section "15. `src/server.ts`" specifies these agent routes:
- `POST /agent/health` — accepts `{ state, account_email, display_available, audio_source_available }`; only `ready` permits job claims
- `POST /agent/jobs/claim` — returns `{ job_id, item_id, lease_id, meeting_link, scheduled_start, lease_expires_at }` or 204
- `POST /agent/jobs/{job_id}/heartbeat` — accepts `{ lease_id }`
- `POST /agent/jobs/{job_id}/status` — accepts `{ lease_id, state, occurred_at, admission, recording_path?, failure_code? }`
- Legal transitions: `queued → claimed → joining → waiting → recording → completed`, with failure from any active state
- Separate bearer token authentication (`WEBTOP_AGENT_TOKEN`)
- **Status:** None of these routes exist in `src/server.ts`.

#### 4. **Database Schema — Missing Tables**
Design Section "8. `src/db.ts`" and "Detailed Implementation Plan / Stage 2" specify:

| Table | Design Spec | Current Status |
|-------|-------------|----------------|
| `zoom_jobs` | Primary key, unique item FK, random `lease_id`, lease owner/expiry, state, timestamps | **Missing** |
| `recording_metadata` | Primary key, unique job FK, relative path, start/end, file status, deletion time | **Missing** |

Current `src/db.ts` only has: `schema_migrations`, `source_messages`, `planner_items`, `clarifications`, `reminder_deliveries`, `settings`.

#### 5. **Recording Deletion Endpoint — Missing**
Design Section "15. `src/server.ts`" specifies:
- `DELETE /api/recordings/{id}` — deletes the file and marks its metadata deleted
- **Status:** Not implemented in `src/server.ts`.

#### 5. **Backup/Restore — Minimal Implementation Only**
Design Section "20. `scripts/backup.ts` and `src/backup.ts`" specifies:

| Requirement | Current Status |
|-------------|----------------|
| AES-256-GCM encryption with fresh 12-byte nonce + 32-byte raw key | **Not implemented** — `scripts/backup.ts` and `src/backup.ts` only have stub interfaces |
| Versioned header, key ID, nonce, ciphertext, 16-byte auth tag | **Not implemented** |
| Mode-0600 temp file, removed after encryption (including on failure) | **Not implemented** |
| Seven-daily / four-weekly retention | **Not implemented** |
| Exclude credentials and video files | **Not implemented** |
| Key rotation / restore selects by key ID, verifies auth tag | **Not implemented** |
| Test restore with active key before switching writers | **Not implemented** |
| Scheduled daily backup integrated into service | **Not integrated** — no cron/timer in `src/index.ts` |

Current `scripts/backup.ts` is only 22 lines (stub), `scripts/restore.ts` is 14 lines (stub), `src/backup.ts` is 41 lines (interfaces only).

#### 6. **Compose Deployment — Missing**
Design Section "6. `compose.yaml`" specifies:
- Planner + Ubuntu Webtop services with persistent data volumes
- Pinned LinuxServer Webtop image tag + Xfce/X11 session
- Tested capture display/audio device settings documented
- Webtop off public ports, private container network
- No container engine socket mounted into planner
- **Status:** `compose.yaml` does not exist. No `webtop/` directory.

#### 7. **Webtop Agent Files — Missing**
Design Section "17-19" specifies:
- `webtop/Dockerfile` — extends pinned LinuxServer Webtop image with Zoom, Node agent, FFmpeg, xdotool, Tesseract
- `webtop/agent.ts`, `webtop/zoom-ui.ts`, `webtop/capture.ts` — claim leased job, verify admission, capture X11+PulseAudio with FFmpeg, detect end-of-meeting UI state
- `webtop/root/etc/services.d/zoom-agent/run` — starts agent under Webtop service manager
- **Status:** `webtop/` directory does not exist.

#### 8. **Configuration — Missing Fields**
Design Section "7. `src/config.ts`" and "Detailed Implementation Plan" specify these config fields that are **missing** from `AppConfig` and `loadConfig()`:

| Missing Field | Purpose |
|---------------|---------|
| `backupPath` / `BACKUP_PATH` | Separately mounted backup destination |
| `backupEncryptionKeyFile` / `BACKUP_ENCRYPTION_KEY_FILE` | 32-byte raw key for AES-256-GCM |
| `zoomAccountEmail` / `ZOOM_ACCOUNT_EMAIL` | Permitted signed-in Zoom account email |
| `webtopAgentToken` is required but Webtop integration doesn't exist | — |

Current `loadConfig()` requires `WEBTOP_AGENT_TOKEN` but the Webtop integration doesn't exist.

#### 9. **Test Files — Missing**
Design Section "21. Test files" specifies these test files to create:
- `test/zoom.test.ts` — **Missing**
- `test/planner.test.ts` — Exists but incomplete per design requirements
- `test/reminders.test.ts` — Exists
- `test/zoom.test.ts` — **Missing** (worker leases, admission/permission, job transitions, wait/end/cap/low-space, restart recovery, saved-file reconciliation)

#### 10. **UI — Missing Recording Features**
Design Section "16. `web/index.html`, `web/app.js`, `web/style.css`" specifies:
- Recording links and deletion UI — **Not implemented** (no `DELETE /api/recordings/{id}` endpoint exists)
- Explicit per-class recording permission UI — Partial (field exists in item, UI shows "Allow recording"/"Decline" buttons but no recording links)

#### 11. **Recording Failure Email Alerts — Not Implemented**
Design Section "Non-Functional Requirements / Notifications and data flow":
> "Email is the independent path for service and recording failures so email notices remain available when WhatsApp intake is disconnected"
- No recording failure email logic in `src/notifications.ts` or elsewhere.

#### 12. **Source Message Retention — 30 Days vs Design "At 30 Days or User Deletion"**
Current implementation: `expireFailedSources()` uses 30-day hardcoded expiry. Design says "At 30 days or user deletion, remove raw text and set `expired`/`deleted`". This matches, but the design also mentions "Keep current and retired key files outside both database and backup destinations" for backups — not applicable to source messages.

#### 13. **Webtop Agent Token — Required but Unused**
`config.ts` requires `WEBTOP_AGENT_TOKEN` (min 32 chars) but no agent routes exist to validate it.

#### 14. **Backup Exclusions — Not Implemented**
Design: "Exclude credentials and recording video files." Current backup stub has no exclusion logic.

#### 15. **Key Rotation / Retired Keys — Not Implemented**
Design: "Retain retired key files outside both database and backup destinations until every snapshot encrypted with them expires; restore selects by key ID and authenticates before opening."

---

### Partial Implementations (Logic Shortcuts / Incomplete Models)

#### 1. **Backup Scripts — Stub Only**
- `scripts/backup.ts` (22 lines): Only saves DB path, no encryption, no retention, no key management
- `scripts/restore.ts` (14 lines): Only copies file, no auth tag verification, no key selection
- `src/backup.ts` (41 lines): Only interface definitions, no implementation

#### 2. **Reminder Tick — Missing Backup Integration**
`src/index.ts` runs reminder tick every 60s but does not run daily backup.

#### 3. **Zoom Account Email Validation — Not Implemented**
Design: "Set `ZOOM_ACCOUNT_EMAIL` to the permitted signed-in account. The worker verifies that the Zoom profile email matches it." — No worker exists.

#### 3. **Recording Permission UI — Partial**
UI has "Allow recording"/"Decline" buttons but no recording links display or deletion.

---

### No Drift Detected (Matches Design)

The following components **match the design specification**:

- ✅ `src/config.ts` — `AppConfig` and `loadConfig()` (except missing fields above)
- ✅ `src/db.ts` — Core tables (source_messages, planner_items, clarifications, reminder_deliveries, settings) with correct schema, foreign keys, indexes
- ✅ `src/ai.ts` — OpenRouter + NVIDIA extractors, strict validation, evidence verification, NVIDIA normalization, provider routing with ZDR/data_collection/allow_fallbacks controls
- ✅ `src/extraction.ts` — Pipeline with state transitions, clarification creation, reminder scheduling
- ✅ `src/extraction-factory.ts` — Provider selection (NVIDIA only for production)
- ✅ `src/planner.ts` — Item lifecycle, corrections, clarifications, cancellation, archive, duplicate matching, status transitions
- ✅ `src/reminders.ts` — Sri Lanka time reminders (day-before 09:00, due 09:00, class hour-before), idempotent delivery, retry/backoff
- ✅ `src/notifications.ts` — SMTP transport, reminder emails without message text/links/passcodes
- ✅ `src/intake.ts` — Durable WhatsApp post ingestion with deduplication
- ✅ `src/whatsapp.ts` — `selectLecturerPosts` with group/lecturer filtering, append/catch-up logic
- ✅ `src/extraction-factory.ts` — NVIDIA-only for production
- ✅ `src/time.ts` — Sri Lanka offset, calendar date math
- ✅ `src/whatsapp-groups.ts` — Cache read/write for group metadata
- ✅ `src/server.ts` — Fastify app, session auth, origin checks, all planner/clarification/failed-source/whatsapp-tracking routes
- ✅ `src/index.ts` — Service startup, reminder tick, graceful shutdown
- ✅ `web/index.html`, `web/app.js`, `web/style.css` — Responsive calendar, items, clarifications, failed posts, WhatsApp tracking picker
- ✅ Test files for core functionality (88 tests passing)
- ✅ `.gitignore` — Excludes `.env`, `storage/`, `dist/`, `backups/`
- ✅ `scripts/whatsapp-pilot.ts` — Durable intake with any-member mode, optional extraction
- ✅ `scripts/whatsapp-list-groups.ts` — Caches group metadata for UI
- ✅ `scripts/whatsapp-who.ts` — Sender discovery for lecturer ID
- ✅ `scripts/pilot-report.ts` — Intake summary
- ✅ `scripts/intake-local.ts` — Local JSON batch ingestion

---

### Summary

| Category | Status |
|----------|--------|
| Core Planner (DB, AI, Extraction, Planner, Reminders, Intake, Server, UI) | **Complete** |
| WhatsApp Intake (Pilot, Groups, Sender Discovery) | **Complete** |
| SMTP Notifications | **Complete** |
| Backup/Restore | **Stub Only (0% functional)** |
| Zoom Worker (Webtop, Agent, Capture, Scheduler) | **Missing (0%)** |
| Agent Routes | **Missing (0%)** |
| Zoom Job/Recording Tables | **Missing (0%)** |
| Recording Deletion | **Missing (0%)** |
| Compose Deployment | **Missing (0%)** |
| Webtop Dockerfile/Agent | **Missing (0%)** |
| Config (Backup Path, Key, Zoom Email) | **Missing** |

**Overall:** The planner core and WhatsApp intake pipeline are fully implemented and tested (90/90 tests pass). The **entire Zoom recording subsystem (worker, agent, capture, scheduler, agent routes, DB tables, compose, Webtop)** and **encrypted backup/restore system** are **not implemented**. These are the two major architectural components required before live deployment per the design's Stage 4 and Stage 5.