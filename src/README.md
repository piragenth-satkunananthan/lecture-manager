# Planner Backend (`src`)

## Overview

TypeScript backend for Lecture Manager. It owns configuration loading, the
SQLite schema and repositories, planner-item lifecycle, extraction through
OpenRouter or NVIDIA Build, the authenticated Fastify API, WhatsApp post
filtering, reminder scheduling and SMTP delivery, Zoom recording-job
scheduling, backup/restore, and Sri Lanka time conversion. The browser client
lives in `../web/`; command-line jobs live in `../scripts/`; the Zoom worker
lives in `../webtop/`.

## Interface

### Configuration and entrypoint

- `loadConfig(env?) -> AppConfig` parses and validates environment settings
  `[config.ts:loadConfig]`.
- `AppConfig` carries host/port, timezone, database and recording paths,
  provider keys and models, extraction flags, planner password and session-key
  path, SMTP settings, Webtop token, Zoom account, disk limits, and backup
  settings `[config.ts:AppConfig]`.
- `src/index.ts` has no exports: it loads config, validates the planner
  password and 32-byte session key, opens the database, builds the server,
  listens, and starts the reminder and backup timers `[index.ts:config]`.

### Persistence (`db.ts`)

- `openPlannerDatabase(path)` and `migrate(db)` create the schema, enable
  foreign keys, and use WAL for file databases `[db.ts:openPlannerDatabase]`,
  `[db.ts:migrate]`.
- Source messages: `insertSourceMessage`, `getSourceMessage`,
  `listFailedSources`, `deleteFailedSource`, `expireFailedSources`,
  `transitionExtractionState`, `expireRawText`.
- Planner items: `createPlannerItem`, `getPlannerItem`, `updatePlannerItem`.
- Clarifications: `createClarification`, `getClarification`,
  `resolveClarificationRecord`.
- Reminders: `createReminderDelivery`, `markReminderDelivered`.
- Settings and WhatsApp tracking: `getSetting`, `setSetting`, `clearSetting`,
  `getTrackedWhatsAppGroup`, `setTrackedWhatsAppGroup`,
  `clearTrackedWhatsAppGroup`.
- Zoom and recordings: `createZoomJob`, `getZoomJob`, `getZoomJobByItem`,
  `listZoomJobsByState`, `claimZoomJob`, `updateZoomJobState`,
  `expireZoomJobLeases`, `createRecordingMetadata`, `getRecordingMetadata`,
  `updateRecordingMetadata`.
- Exported row types include `ExtractionState`, `PlannerItemStatus`,
  `ReminderKind`, `ZoomJobState`, `RecordingFileStatus`, `PlannerItem`,
  `NewPlannerItem`, `PlannerItemPatch`, `Clarification`, `ZoomJob`, and
  `RecordingMetadata` `[db.ts:PlannerItem]`.

### Planner lifecycle (`planner.ts`)

- `listPlannerItems`, `setPlannerItemStatus`, `confirmPlannerItem`,
  `cancelPlannerItem`, `archivePlannerItem`.
- Corrections and updates: `applyUserCorrection`, `clearUserCorrection`,
  `applyMessageUpdate`.
- Duplicate and clarification flow: `findOpenItemForCorrection`,
  `openClarification`, `resolveClarification`.
- `EditableField` enumerates the fields accepted by corrections
  `[planner.ts:EditableField]`.

### Extraction

- `processSourceMessage(db, key, extract, options)` performs the state
  transition, calls the extractor, persists items and clarifications, and
  returns `{source, itemIds, pending}` `[extraction.ts:processSourceMessage]`.
- `createConfiguredExtraction(config)` selects the NVIDIA or OpenRouter
  extractor, or returns `null` when extraction is disabled
  `[extraction-factory.ts:createConfiguredExtraction]`.
- `ai.ts` exports `createOpenRouterGenerate`,
  `createOpenRouterAnnouncementExtractor`, `createNvidiaGenerate`,
  `createNvidiaAnnouncementExtractor`, `createValidatedAnnouncementExtractor`,
  the `ExtractedItem`/`ExtractedAnnouncement` types, and
  `OpenRouterError`/`NvidiaError`.
- Before a provider call, `promptMessage` replaces detected source URLs with
  `[LINK_n]` and redacts `passcode`/`password`/`pwd` values
  `[ai.ts:promptMessage]`.
- `normalizeNvidiaOutput` fills missing nullable keys, maps the
  `zoom_link_index` ambiguous field to `zoom_url`, and removes app-owned or
  empty evidence entries from NVIDIA output before strict validation
  `[ai.ts:normalizeNvidiaOutput]`.
- `intake.ts` exports `ingestWhatsAppPost` and `ingestWhatsAppPosts`, which
  record deduplicated source messages and optionally run extraction
  `[intake.ts:ingestWhatsAppPost]`.

### Server (`server.ts`)

- `buildServer(options) -> Promise<FastifyInstance>` registers secure
  sessions, static web assets, API routes, and agent routes
  `[server.ts:buildServer]`.
- `ServerOptions` requires `db`, `plannerPassword`, and a 32-byte
  `sessionKey`; optional settings include origin checks, extraction,
  web root, WhatsApp cache path, Webtop token, and Zoom scheduler config.
- Public API routes: `GET /api/health`, `POST/DELETE /api/session`,
  `GET /api/items`, `GET/PATCH /api/items/:id`,
  `POST /api/items/:id/recording-permission`, `GET /api/clarifications`,
  `POST /api/clarifications/:id/answer`, `GET /api/sources/failed`,
  `POST /api/sources/:groupId/:messageId/retry`,
  `DELETE /api/sources/:groupId/:messageId`, `GET /api/whatsapp/groups`,
  `GET/PUT/DELETE /api/whatsapp/tracking`, and
  `DELETE /api/recordings/:id`.
- Agent routes: `POST /agent/health`, `POST /agent/jobs/claim`,
  `POST /agent/jobs/:jobId/heartbeat`, and
  `POST /agent/jobs/:jobId/status` `[server.ts:requireAgentAuth]`.
- Route failures use explicit status codes: `400` for malformed ids, bodies,
  and field values; `401` for unauthenticated API and agent requests; `403`
  for origin and agent account/health rejection; `404` for missing items,
  clarifications, and recordings; `409` for non-open clarifications,
  non-failed sources, and expired or mismatched leases; `500` for unhandled
  errors; and `503` when the Zoom scheduler is not configured
  `[server.ts:buildServer]`, `[server.ts:requireAgentAuth]`.

### Reminders and mail (`reminders.ts`, `notifications.ts`)

- `buildReminderSchedule`, `suppressPendingReminders`,
  `ensureReminderSchedule`, `listDueReminders`,
  `markReminderDeliveredById`, `recordReminderFailure`.
- `createSmtpTransport`, `buildReminderMessage`, and
  `deliverDueReminders` send due reminders and record delivery outcomes
  `[notifications.ts:deliverDueReminders]`.

### WhatsApp (`whatsapp.ts`, `whatsapp-groups.ts`)

- `selectLecturerPosts(event, config, catchUpAfter?)` filters a Baileys
  `messages.upsert` event into accepted posts `[whatsapp.ts:selectLecturerPosts]`.
- `readGroupCache` and `writeGroupCache` maintain the WhatsApp group cache
  `[whatsapp-groups.ts:readGroupCache]`.

### Zoom (`zoom.ts`)

- `buildScheduledStart`, `scheduleZoomJobs`, `getNextClaimableJob`,
  `heartbeatZoomJob`, `updateJobStatus`, `getActiveRecordingJob`,
  `checkRecordingLimits`, and `checkRecordingDiskSpace`
  `[zoom.ts:scheduleZoomJobs]`.

### Backup and time

- `backupDatabase(dbPath, backupDir, keyFile?)` and
  `restoreDatabase(backupPath, dbPath, keyFile?)` create and restore
  integrity-checked SQLite snapshots `[backup.ts:backupDatabase]`.
- `sriLankaDateTimeToUtc`, `addCalendarDays`, and `shiftIsoMinutes` handle
  UTC+05:30 conversion and date arithmetic `[time.ts:sriLankaDateTimeToUtc]`.
- `scoreExtraction` compares expected and actual extraction results
  `[model-evaluation.ts:scoreExtraction]`.

## Invariants

- **Extraction state machine**: only `received -> extracting|deleted`;
  `extracting -> pending_review|failed|confirmed|deleted`;
  `failed -> extracting|expired|deleted`;
  `pending_review -> confirmed|expired|deleted`;
  `confirmed -> expired|deleted`; `expired -> deleted`. Invalid transitions
  throw `[db.ts:transitionExtractionState]`.
- **Planner state machine**: `pending -> confirmed|cancelled|overdue_review|archived`;
  `confirmed -> cancelled|overdue_review|archived`;
  `overdue_review -> confirmed|cancelled|archived`;
  `cancelled -> archived`; `archived` is terminal
  `[planner.ts:setPlannerItemStatus]`.
- **Raw text retention**: source rows store raw text until `failed` expiry
  (default 30 days) or `expired`/`deleted`, when raw text is cleared while
  provenance remains `[db.ts:transitionExtractionState]`.
- **Atomic extraction**: items, clarifications, confirmations, and reminder
  schedules are persisted in one database transaction; a thrown extraction or
  persistence error moves the source to `failed`
  `[extraction.ts:processSourceMessage]`.
- **Required fields**: assignments require `title` and `due_date`; classes
  require `title`, `class_date`, and `class_time`. Missing fields force
  `pending_review` and create a clarification `[extraction.ts:missingRequiredFields]`.
- **Extraction is opt-in**: `loadConfig` defaults `EXTRACTION_ENABLED` to
  false; a true value requires a non-disabled provider with its key and model
  `[config.ts:loadConfig]`.
- **Provider validation**: every non-null field needs verbatim evidence, and
  ambiguous fields must be null. OpenRouter requires a free model ID and uses
  ZDR/data-collection-deny routing unless the model is explicitly non-ZDR
  approved `[ai.ts:validateFieldEvidence]`, `[ai.ts:providerRouting]`.
  Source URLs are replaced with `[LINK_n]` markers and passcode/password
  values are redacted before the provider call `[ai.ts:promptMessage]`.
- **Session security**: the planner password and exactly 32 session-key bytes
  are required. `/api/session` and `/api/health` are exempt; every other
  `/api/` route requires an authenticated session. Origin checks apply to
  state-changing `/api/` requests when `PLANNER_ORIGIN` is set
  `[server.ts:preHandler]`, `[server.ts:onRequest]`.
- **Agent authentication**: `/agent/*` routes require
  `Authorization: Bearer <WEBTOP_AGENT_TOKEN>`; health reports must match the
  configured Zoom account and report ready display and audio
  `[server.ts:requireAgentAuth]`.
- **Configuration guards**: database and recording paths must differ; SMTP
  user/password must both be set or both empty; `WEBTOP_AGENT_TOKEN` is
  required and at least 32 characters; `ZOOM_ACCOUNT_EMAIL` must be a valid
  address `[config.ts:loadConfig]`.
- **Time zone**: scheduling defaults to `Asia/Colombo` (UTC+05:30);
  date/time helpers reject malformed input `[time.ts:sriLankaDateTimeToUtc]`.
- **Reminders**: only `confirmed` items produce schedules. Assignment
  reminders fire at 09:00 the day before and 09:00 on the due date; class
  reminders fire at 09:00 the day before and 60 minutes before class. Delivery
  keys are unique, and failed sends retry up to three attempts
  `[reminders.ts:buildReminderSchedule]`, `[reminders.ts:listDueReminders]`.
- **WhatsApp filtering**: posts must come from a tracked group, not be
  `fromMe`, have a sender, timestamp, and text; the sender must be in
  `LECTURER_IDS` unless `allowAllSenders` is true
  `[whatsapp.ts:toLecturerPost]`.
- **Zoom jobs**: only confirmed class items with confirmed recording
  permission, a date/time, and a Zoom URL are scheduled; one job per item.
  Claim leases last 300 seconds and transitions are
  `queued -> claimed -> joining -> waiting -> recording -> completed|failed`;
  lapsed leases are marked `expired` and are not re-queued, so they are no
  longer claimable `[zoom.ts:updateJobStatus]`,
  `[db.ts:expireZoomJobLeases]`.
- **Backup/restore**: encrypted backups use AES-256-GCM with a 32-byte key;
  only format version 1 is accepted; integrity is checked before and after
  restore, and the prior database is kept as a `.pre-restore-*` safety copy
  `[backup.ts:restoreDatabase]`.
- **Recordings**: `checkRecordingLimits` reports when a recording exceeds
  `MAX_RECORDING_HOURS` (default 4); `checkRecordingDiskSpace` reports when
  free space is below `MIN_FREE_DISK_GIB` (default 10). Both return only a
  `shouldStop` flag and reason; the planner tick logs the reason without
  stopping capture or changing job state `[zoom.ts:checkRecordingLimits]`,
  `[zoom.ts:checkRecordingDiskSpace]`, `[index.ts:reminderTimer]`. The delete
  route marks metadata deleted; it does not remove files
  `[server.ts:DELETE /api/recordings/:id]`.

## Side Effects

- SQLite reads and writes for every repository operation, including WAL
  checkpointing during backup `[db.ts:openPlannerDatabase]`.
- HTTP requests to OpenRouter (`openrouter.ai`) and NVIDIA Build
  (`integrate.api.nvidia.com`) with 60-second timeouts
  `[ai.ts:createOpenRouterGenerate]`, `[ai.ts:createNvidiaGenerate]`.
- SMTP delivery through Nodemailer and delivery-status database writes
  `[notifications.ts:createSmtpTransport]`.
- Fastify binds `HOST:PORT` and serves `web/` at `/`
  `[index.ts:app.listen]`, `[server.ts:fastifyStatic]`.
- Filesystem access: reads the session key and WhatsApp group cache; writes
  the group cache with mode `0600`, backup snapshots, encrypted backups, and
  restore safety copies `[whatsapp-groups.ts:writeGroupCache]`,
  `[backup.ts:backupDatabase]`.
- Timers: a 60-second reminder/expiry/Zoom tick and a 24-hour backup tick
  `[index.ts:reminderTimer]`, `[index.ts:backupPath]`.
- Process lifecycle: `SIGINT`/`SIGTERM` close the interval, server, and
  database, then exit 0 `[index.ts:signal]`.
- Console logging for server errors, startup, reminders, and backups
  `[server.ts:setErrorHandler]`.

## Verification

- Run: `npm test` (builds TypeScript and runs `dist/test/*.test.js`).
