# EGM Drift Report — 2026-11-20

Target: `/home/piragenth/Documents/lecture-manager`
Scope: the five contracts produced by the 2026-11-18 `egm-bootstrap` run: root `README.md`, `src/README.md`, `scripts/README.md`, `web/README.md`, and `webtop/README.md`.
Verified against the current working tree on 2026-11-20. `npm test` = **107/107 passing** (`npm run build && node --test dist/test/*.test.js`).
Note: all findings below were corrected in the contracts on 2026-11-20 to match the current code; this report records the pre-fix state. No functional source was changed.

---

## README.md

- **Expired Zoom leases are never returned to `queued`.** The Global Invariants section says "expired leases return to `queued`" (`README.md:96`). `expireZoomJobLeases` sets a lapsed job directly to `state = 'expired'` and clears its lease (`src/db.ts:928-941`), while `getNextClaimableJob` only selects `state = 'queued'` (`src/zoom.ts:82`). The `expired -> queued` edge exists in the transition table (`src/zoom.ts:133`), but it is unreachable: the agent status route rejects `queued` with `400 invalid_state` (`src/server.ts:489-491`), and no internal caller invokes `updateJobStatus(..., "queued")`. Once a lease expires, the job remains `expired` and can never be claimed again.
- **The documented disk-space recording stop is not enforced.** The preserved "Webtop / Zoom Recording" section says recording stops when free disk space is "< 10 GiB" (`README.md:400`). The reminder tick calls `checkRecordingDiskSpace`, then only prints `Stopping recording ...` (`src/index.ts:67-70`); it does not signal the agent, change the job state, or otherwise interrupt capture. `checkRecordingDiskSpace` itself only returns `{shouldStop, reason}` (`src/zoom.ts:180-194`).
- **The worker is described as joining the meeting.** The System Overview says the worker "joins as the configured account" (`README.md:28`), and the Webtop testing steps say "the agent joins" (`README.md:413`). `runJob` explicitly skips launching Zoom and waits for an externally opened meeting window before polling for admission (`webtop/agent.ts:186-195`); the worker never joins on its own.

## src/README.md

- **`listPlannerItems` is listed as a `db.ts` export.** The Persistence (`db.ts`) section includes `listPlannerItems` in its planner-item list (`src/README.md:35-36`), but the symbol is exported from `src/planner.ts:64`; `db.ts` neither defines nor re-exports it. The same symbol is correctly listed under `planner.ts` at `src/README.md:54`.
- **Expired Zoom leases do not return to `queued`.** The Zoom invariant repeats the root claim (`src/README.md:191`). Expiration writes `expired` directly (`src/db.ts:928-941`), claims select only `queued` (`src/zoom.ts:82`), and the `expired -> queued` transition-table edge (`src/zoom.ts:133`) is never exercised; the agent status route rejects `queued` (`src/server.ts:489-491`).
- **The recording-limit helpers report a stop but do not perform one.** The Recordings invariant says `checkRecordingLimits` "caps a job" at `MAX_RECORDING_HOURS` and `checkRecordingDiskSpace` "stops at" `MIN_FREE_DISK_GIB` (`src/README.md:196-198`). Both functions only return `{shouldStop, reason}` (`src/zoom.ts:159-194`). Their sole caller logs the reason and continues (`src/index.ts:61-72`); it never stops capture or writes a terminal job state.
- **Source-text privacy preprocessing is undocumented.** `promptMessage` replaces each detected source URL with `[LINK_n]` and redacts values following `passcode`, `password`, or `pwd` before the text is sent to either provider (`src/ai.ts:329-335`). It is called on every extraction input (`src/ai.ts:556`), but the Extraction section (`src/README.md:63-78`) and the "Provider validation" invariant (`src/README.md:159-162`) do not mention this redaction.
- **NVIDIA output normalization is undocumented.** `normalizeNvidiaOutput` fills missing nullable keys, rewrites the `zoom_link_index` ambiguous field to `zoom_url`, deletes app-owned keys from `field_evidence`, and drops empty evidence arrays before strict validation (`src/ai.ts:513-543`); it is wired into the NVIDIA extractor (`src/ai.ts:713`). The Extraction section lists the NVIDIA extractor exports (`src/README.md:71-75`) but not this normalization step.
- **The Server contract omits route validation and error semantics.** The Server section lists the routes (`src/README.md:80-98`) but not their failure contract. Examples in `src/server.ts`: origin rejection `403 invalid_origin` (line 146), `400` validation errors such as `invalid_body`, `invalid_id`, `group_id_required`, and `invalid_job_id` on item, clarification, tracking, and agent routes (e.g. lines 196, 204, 208, 243, 280, 318, 388, 468), `401 unauthorized`/`invalid_password` (lines 156, 177), non-open clarification `409 clarification_not_open` (line 283), non-failed source retry/delete `409 source_not_failed` (lines 348, 368), lease mismatch `409 lease_expired_or_mismatched` (line 460), and missing scheduler config `503 scheduler_not_configured` (line 421).

## scripts/README.md

- **`intake-local.ts` closes the database before printing.** The Local intake section says the script prints `Intake complete: ...` and the status-count lines, "then closes the database" (`scripts/README.md:47-50`). The code calls `db.close()` at `scripts/intake-local.ts:55`, then computes counts and prints at lines 57-61. (The `createConfiguredExtraction` failure path also closes before rethrowing, lines 44-49.)

## web/README.md

No drift detected.

## webtop/README.md

- **The worker also reads `job.itemId`.** The `Job` bullet says "the worker reads only `jobId`, `scheduledStart`, and `leaseExpiresAt`" (`webtop/README.md:25-27`), but `runJob` logs `job.itemId` when a job is claimed (`webtop/agent.ts:136`).
- **The Overview says the container joins Zoom classes.** The opening paragraph says the container "joins scheduled Zoom classes" (`webtop/README.md:5`), which contradicts the "No Zoom launch" invariant (`webtop/README.md:116-118`) and `runJob`'s external-window behavior (`webtop/agent.ts:186-195`).
- **`agent.ts` has no exports, but its internal symbols are presented as the module interface.** The "Agent process" section describes `ZoomAgent`, `PlannerConfig`, `HealthCheck`, and `Job` as interface entries (`webtop/README.md:15-27`), yet `webtop/agent.ts` contains no `export` declarations and is an executable entrypoint (`const agent = new ZoomAgent(config); agent.start()...`). The class and types are module-private and cannot be imported; unlike `src/README.md`, the contract does not state that the module has no exports.
- **The documented claim-error backoff does not match the code.** The Claim loop invariant says claim errors sleep 10 seconds and an empty claim sleeps 30 seconds (`webtop/README.md:90-91`). `claimJob` catches every fetch/HTTP error and returns `null` (`webtop/agent.ts:146-167`), so claim errors take the empty-claim path and sleep 30 seconds. The 10-second backoff in the outer loop (`webtop/agent.ts:77-83`) applies only to errors escaping `claimAndRunJob`, such as `runJob` failures.
- **The container section omits the s6 service and cont-init launch/compile paths.** The doc presents `entrypoint.sh` as the thing that compiles and runs the agent (`webtop/README.md:9-10`, `72-79`, `170-171`). The image also copies `root/` and `custom-cont-init.d/` (`webtop/Dockerfile:64-67`). `custom-cont-init.d/01-zoom-agent-init` waits for X11 and PulseAudio, creates `RECORDING_PATH`, and starts `/entrypoint.sh` in the background with `nohup`; `root/etc/services.d/zoom-agent/run` recompiles if needed and `exec`s `node dist/agent.js`. Neither script is described, and the contract does not address the two independent agent launch paths in the image.
