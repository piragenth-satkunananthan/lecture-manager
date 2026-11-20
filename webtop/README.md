# Zoom Recording Worker (`webtop`)

## Overview

Ubuntu Webtop container that waits for scheduled Zoom classes and records
screen and audio for the planner. `agent.ts` polls the planner's authenticated agent
API, `capture.ts` starts FFmpeg with X11 and PulseAudio inputs, and
`zoom-ui.ts` detects Zoom window state and reads on-screen text with
`xdotool` and Tesseract. The image builds the TypeScript and starts the agent
through `entrypoint.sh` (launched by a cont-init script) and an s6 service;
both paths compile when needed and run `dist/agent.js`. The planner side of
this protocol lives in `../src/server.ts` and `../src/zoom.ts`.

## Interface

### Agent process

`agent.ts` is an executable entrypoint with no exports; `ZoomAgent`,
`PlannerConfig`, `HealthCheck`, and `Job` are module-private
`[agent.ts:ZoomAgent]`.

- `ZoomAgent` has `constructor(config: PlannerConfig)`, `start():
  Promise<void>`, and `reportHealth(health): Promise<void>`; all other methods
  are private.
- `PlannerConfig` requires `PLANNER_BASE_URL`, `WEBTOP_AGENT_TOKEN`,
  `AGENT_ID`, `ZOOM_ACCOUNT_EMAIL`, and `RECORDING_PATH`; optional
  `MAX_RECORDING_HOURS` defaults to 4 `[agent.ts:loadConfig]`.
- `HealthCheck` is `{state: "ready" | "unhealthy", account_email,
  display_available, audio_source_available}` `[agent.ts:HealthCheck]`.
- `Job` carries `jobId`, `itemId`, `leaseId`, `meetingLink`,
  `scheduledStart`, `leaseExpiresAt`, and `item`; the worker reads `jobId`,
  `itemId` (for logging), `scheduledStart`, and `leaseExpiresAt`
  `[agent.ts:Job]`.

### Planner agent API

- `POST {PLANNER_BASE_URL}/agent/health` with a `HealthCheck` body and
  `Authorization: Bearer <WEBTOP_AGENT_TOKEN>` `[agent.ts:reportHealth]`.
- `POST /agent/jobs/claim` with `X-Agent-Id: <AGENT_ID>`; HTTP 204 means no
  job `[agent.ts:claimJob]`.
- `POST /agent/jobs/{jobId}/heartbeat` every 60 seconds while capturing
  `[agent.ts:startHeartbeat]`.
- `POST /agent/jobs/{jobId}/status` with `{state, occurred_at, ...extras}`.
  States sent: `joining`, `waiting`, `recording`, `completed`, and `failed`;
  extras are `recording_path` on completion and `failure_code` on failure
  `[agent.ts:updateJobStatus]`, `[agent.ts:runJob]`.

### Capture

- `captureScreenAudio(outputPath, options?)` spawns FFmpeg with `x11grab` and
  PulseAudio, returning after the first stderr chunk. It rejects on spawn
  error or a 5-second startup timeout `[capture.ts:captureScreenAudio]`.
- `CaptureOptions` supports `display`, `audioSource`, `videoSize`, and
  `frameRate`; defaults are `DISPLAY` or `:0`, `PULSE_SOURCE` or `default`,
  `1920x1080`, and 30 `[capture.ts:CaptureOptions]`.
- `stopCapture()` and `getCaptureProcess()` are exported no-ops
  `[capture.ts:stopCapture]`, `[capture.ts:getCaptureProcess]`.
- The FFmpeg argument set includes `-y`, `x11grab`, `-draw_mouse 1`, `pulse`,
  `libx264`, `ultrafast`, `crf 23`, `aac`, `128k`, `yuv420p`, and
  `+faststart` `[capture.ts:captureScreenAudio]`.

### Zoom UI detection

- `detectZoomUIState()` returns `ZoomUIState`: `sign_in_required`,
  `waiting_room`, `joining`, `in_meeting`, `meeting_ended`, or `unknown`
  `[zoom-ui.ts:ZoomUIState]`.
- `captureScreenText()` returns OCR text for the root window, or `""` on any
  failure `[zoom-ui.ts:captureScreenText]`.
- `waitForAdmission(agentId, timeoutMs)` resolves on `in_meeting` and throws
  `ZoomUIError` on sign-in, meeting end, or timeout
  `[zoom-ui.ts:waitForAdmission]`.
- `waitForMeetingEnd(agentId, timeoutMs)` returns true for meeting-ended,
  sign-in-required, or unknown states, and false only on timeout
  `[zoom-ui.ts:waitForMeetingEnd]`.
- `ZoomUIError` is the exported error subclass for UI failures
  `[zoom-ui.ts:ZoomUIError]`.

### Container launch

- `entrypoint.sh` changes to `/app`, compiles when `dist/` is missing or
  `agent.ts` is newer than `dist/agent.js`, then runs `node dist/agent.js`
  `[entrypoint.sh:11-12]`.
- `custom-cont-init.d/01-zoom-agent-init` waits for X11 and PulseAudio,
  creates `RECORDING_PATH`, and starts `/entrypoint.sh` in the background
  with `nohup` `[custom-cont-init.d/01-zoom-agent-init:9-26]`.
- `root/etc/services.d/zoom-agent/run` recompiles when needed and `exec`s
  `node dist/agent.js` under the s6 service manager
  `[root/etc/services.d/zoom-agent/run:11-18]`.
- The compile command passes `agent.ts`, `capture.ts`, and `zoom-ui.ts` to
  `npx tsc` with `ES2022`, `NodeNext`, `--outDir dist`, `--strict`, and
  `--skipLibCheck` `[entrypoint.sh:11-12]`,
  `[root/etc/services.d/zoom-agent/run:13-14]`.

## Invariants

- **Health gate**: the agent reports healthy only when `xdpyinfo` and
  `pactl info` both succeed. When not ready it reports health and does not
  enter the claim loop `[agent.ts:start]`, `[agent.ts:checkDisplay]`,
  `[agent.ts:checkAudio]`.
- **Single job**: `claimAndRunJob` returns immediately while a job is active;
  the active job is cleared and cleanup runs in a `finally` block
  `[agent.ts:claimAndRunJob]`.
- **Claim loop**: the loop never exits. Fetch and HTTP errors inside
  `claimJob` are caught and treated as an empty claim, so they sleep 30
  seconds; errors escaping `claimAndRunJob` (for example `runJob` failures)
  sleep 10 seconds before retrying `[agent.ts:claimAndRunJob]`,
  `[agent.ts:claimJob]`.
- **Status ordering**: `joining` and `waiting` are posted before the protected
  try block, so a failure in those two posts does not emit `failed`. Errors
  inside the try send `failed` with a failure code and rethrow
  `[agent.ts:runJob]`.
- **Wait until start**: the worker sleeps for the full
  `scheduledStart - now` duration; no early-join offset is applied
  `[agent.ts:runJob]`.
- **Lease is not enforced**: `leaseExpiresAt` is parsed but never compared or
  acted on `[agent.ts:runJob]`.
- **Admission timeout**: `waitForAdmission` is called with a fixed 20-minute
  timeout, independent of the lease `[agent.ts:runJob]`.
- **Recording limits**: the maximum end time is `now +
  MAX_RECORDING_HOURS * 3600 * 1000`; reaching the cap still reports the job
  `completed` `[agent.ts:runJob]`.
- **Recording naming**: the output path is
  `join(RECORDING_PATH, "job_<jobId>_<Date.now()>.mkv")` and that exact path
  is reported as `recording_path` `[agent.ts:runJob]`.
- **Heartbeat lifecycle**: the 60-second interval starts only after capture
  starts and is cleared in cleanup `[agent.ts:startHeartbeat]`,
  `[agent.ts:cleanup]`.
- **Capture handle gap**: `startCapture` awaits a function that returns
  `void`, so the worker's capture handle stays null; `stopCapture` never sends
  `SIGINT` and cleanup never kills FFmpeg `[agent.ts:startCapture]`,
  `[agent.ts:stopCapture]`.
- **No Zoom launch**: `runJob` logs that it is waiting for the Zoom window but
  never assigns `zoomProcess`; the cleanup `SIGTERM` branch is dead
  `[agent.ts:runJob]`, `[agent.ts:cleanup]`.
- **Signal behavior**: `SIGINT` logs and calls `process.exit(0)` immediately,
  skipping cleanup, heartbeat clearing, capture stop, and any `failed` report
  `[agent.ts:process.on("SIGINT")]`.
- **Required environment**: a missing required variable throws
  `<NAME> is required`; the top-level start rejection logs and exits 1
  `[agent.ts:loadConfig]`, `[agent.ts:agent.start]`.
- **Recompile trigger**: both the entrypoint and the s6 service runner compile
  only when `dist/` is missing or `agent.ts` is newer than `dist/agent.js`;
  edits to `capture.ts` or `zoom-ui.ts` alone do not trigger a recompile. The
  entrypoint uses `set -e` `[entrypoint.sh:9]`.
- **Capture startup**: capture requires one stderr `data` event within 5
  seconds; otherwise it rejects with `FFmpeg startup timeout`
  `[capture.ts:captureScreenAudio]`.
- **UI state precedence**: per window title, sign-in strings win, then waiting
  room, meeting ended, and Zoom meeting; a meeting window counts as
  `in_meeting` only when width > 800 and height > 600, otherwise `joining`
  `[zoom-ui.ts:detectZoomUIState]`.
- **Admission polling**: `waitForAdmission` polls every 5 seconds and logs at
  most every 30 seconds; `joining` and `waiting_room` do not terminate the
  loop `[zoom-ui.ts:waitForAdmission]`.
- **Meeting-end polling**: `waitForMeetingEnd` polls every 10 seconds and
  treats `meeting_ended`, `sign_in_required`, and `unknown` as ended
  `[zoom-ui.ts:waitForMeetingEnd]`.
- **OCR is non-fatal**: any `xdotool`, `xwd`, or Tesseract failure returns
  `""` `[zoom-ui.ts:captureScreenText]`.
- **Dead helpers**: `checkAdmitted`, `checkWaitingRoom`, `checkMeetingEnded`,
  and `checkLeftMeeting` are module-private and unreferenced by exported
  functions `[zoom-ui.ts:checkAdmitted]`.

## Side Effects

- Outbound HTTP posts to the planner's `/agent/health`,
  `/agent/jobs/claim`, `/agent/jobs/{id}/heartbeat`, and
  `/agent/jobs/{id}/status` `[agent.ts:reportHealth]`,
  `[agent.ts:updateJobStatus]`.
- Spawns `xdpyinfo` and `pactl` for health checks `[agent.ts:checkDisplay]`,
  `[agent.ts:checkAudio]`.
- Spawns FFmpeg to record the X11 display and PulseAudio source into an
  `.mkv`, overwriting the target with `-y`, and creates the output directory
  recursively `[capture.ts:captureScreenAudio]`.
- Spawns `xdotool` to list windows and activate the active window, writes
  `/tmp/zoom-debug.xwd` with `xwd`, and runs Tesseract OCR on it
  `[zoom-ui.ts:captureScreenText]`.
- Timers: a 60-second heartbeat interval, 5-second capture startup timeout,
  5-second stop timeout, and polling sleeps `[agent.ts:startHeartbeat]`,
  `[capture.ts:captureScreenAudio]`.
- Process exit: `process.exit(0)` on `SIGINT` and `process.exit(1)` when
  start fails `[agent.ts:process.on("SIGINT")]`,
  `[agent.ts:agent.start]`.
- Console logging of lifecycle, health, job claims, Zoom UI state, OCR
  excerpts, FFmpeg progress, and errors `[agent.ts:start]`.
- The container starts the agent through `entrypoint.sh` (launched by the
  cont-init script) and the `zoom-agent` s6 service; both compile when needed
  and run `node dist/agent.js` `[entrypoint.sh:9-16]`,
  `[root/etc/services.d/zoom-agent/run:11-18]`.
- Environment reads: `PLANNER_BASE_URL`, `WEBTOP_AGENT_TOKEN`, `AGENT_ID`,
  `ZOOM_ACCOUNT_EMAIL`, `RECORDING_PATH`, `MAX_RECORDING_HOURS`, `DISPLAY`,
  and `PULSE_SOURCE` `[agent.ts:loadConfig]`,
  `[capture.ts:captureScreenAudio]`.

## Verification

- Run: `npm test` for the repository suite. The image builds the `webtop`
  TypeScript with `npx tsc`, and the entrypoint and s6 service recompile when
  needed; this directory has no separate test runner `[Dockerfile:62]`,
  `[entrypoint.sh:9-12]`.
