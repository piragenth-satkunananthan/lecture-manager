# Operational Scripts (`scripts`)

## Overview

Command-line entrypoints for Lecture Manager. They are run through the npm
scripts in `../package.json` and operate on the planner database, SQLite
backups, synthetic extraction fixtures, or a WhatsApp session. These scripts
are operational tools, not library modules; most read configuration directly
from `process.env` and print human-readable output.

## Interface

### npm entrypoints

| npm command | Script | Purpose |
| --- | --- | --- |
| `npm run backup` | `backup.ts` | Create an integrity-checked, optionally encrypted SQLite backup. |
| `npm run restore -- <backup>` | `restore.ts` | Restore a backup, keeping a safety copy. |
| `npm run intake:local -- <json>` | `intake-local.ts` | Ingest a JSON array of selected posts. |
| `npm run pilot:compare` | `model-comparison-pilot.ts` | Score free OpenRouter models against synthetic fixtures. |
| `npm run pilot:nvidia` | `nvidia-comparison-pilot.ts` | Score the NVIDIA Build model against fixtures. |
| `npm run pilot:report` | `pilot-report.ts` | Print source-message counts and failure summaries. |
| `npm run whatsapp:groups` | `whatsapp-list-groups.ts` | List joined groups and cache metadata. |
| `npm run pilot:whatsapp` | `whatsapp-pilot.ts` | Run the WhatsApp intake pilot. |
| `npm run whatsapp:who` | `whatsapp-who.ts` | Print sender IDs for one tracked group. |

### Backup and restore

- `backup.ts` reads `DATABASE_PATH` (default `./storage/planner.sqlite`),
  `BACKUP_PATH` (default `./backups`), and optional
  `BACKUP_ENCRYPTION_KEY_FILE`, then calls `backupDatabase` and prints
  `Backup written: <path>` plus size, integrity, and encryption status
  `[backup.ts:backupDatabase]`.
- `restore.ts` requires the backup path as `argv[2]`, then calls
  `restoreDatabase` with `DATABASE_PATH` and the optional key file. It prints
  `Restored <dbPath>` and either the safety-copy path or
  `No previous database existed` `[restore.ts:restoreDatabase]`.

### Local intake

- `intake-local.ts` requires a JSON file path as `argv[2]`; missing arguments
  throw the usage line `Usage: npm run intake:local -- <path-to-json>`
  `[intake-local.ts:inputPath]`.
- The file must be a JSON array of objects with non-empty string `groupId`,
  `messageId`, `senderId`, and `text`, plus a string `sentAt` that parses to a
  valid date `[intake-local.ts:asPost]`.
- It opens `config.databasePath`, calls `ingestWhatsAppPosts`, closes the
  database, then prints `Intake complete: <N> post(s)` and one status-count
  line per observed status. When extraction is disabled it prints the
  extraction-disabled notice `[intake-local.ts:counts]`.

### Synthetic comparison

- `model-comparison-pilot.ts` requires `OPENROUTER_API_KEY`; candidates come
  from `OPENROUTER_CANDIDATE_MODELS` (default
  `google/gemma-4-31b-it:free`), with `TIME_ZONE` and
  `OPENROUTER_REQUEST_INTERVAL_MS` optional. Every candidate must contain `/`,
  end with `:free`, and contain no whitespace `[model-comparison-pilot.ts:candidateModels]`.
- It reads the fixed fixture file `test/fixtures/lecturer-posts.json`, calls
  `createOpenRouterAnnouncementExtractor`, and scores results with
  `scoreExtraction`. Outcomes are `pass`, `mismatch`, `invalid_output`,
  `incomplete`, or `route_missing`; run status is `passed`, `failed`, or
  `incomplete` `[model-comparison-pilot.ts:FixtureResult]`.
- Results are written to
  `artifacts/model-comparison/<timestamp>.json` with mode `0600`
  `[model-comparison-pilot.ts:outputFile]`.
- `nvidia-comparison-pilot.ts` uses `NVIDIA_API_KEY`, optional
  `NVIDIA_FIXTURES`, `NVIDIA_MODEL` (default
  `nvidia/nemotron-3.5-lightning-30b-a3b`), `TIME_ZONE`,
  `NVIDIA_REQUEST_INTERVAL_MS`, and `NVIDIA_MAX_TOKENS` (default 4096). It
  writes the same artifact shape with `provider: "NVIDIA Build"` and optional
  `errorDetail` capped at 240 characters `[nvidia-comparison-pilot.ts:detail]`.

### Pilot report

- `pilot-report.ts` reads `DATABASE_PATH` (default
  `./storage/planner.sqlite`) and issues only `SELECT` statements against
  `source_messages`. It prints the database path, total source messages, state
  and sender breakdowns when the total is non-zero, and failure counts grouped
  by `failure_code` (null shown as `unknown`) `[pilot-report.ts:failures]`.

### WhatsApp helpers

- `whatsapp-list-groups.ts` connects with Baileys, writes auth state under
  `./storage/whatsapp-auth`, caches groups in `./storage/whatsapp-groups.json`
  via `writeGroupCache`, and prints group IDs, addressing modes, participant
  counts, and participant IDs. It reads no configuration from the environment
  `[whatsapp-list-groups.ts:writeGroupCache]`.
- `whatsapp-pilot.ts` requires exactly one group after applying the SQLite
  tracked-group override to `WHATSAPP_GROUP_IDS`, and requires a non-empty
  `LECTURER_IDS` unless any-member mode is enabled. It reads
  `WHATSAPP_ALLOW_ALL_SENDERS`, `WHATSAPP_PILOT_INGEST`, and
  `WHATSAPP_PILOT_EXTRACT`; only the literal value `true` enables a flag
  `[whatsapp-pilot.ts:pilotIngest]`, `[whatsapp-pilot.ts:allowAllSenders]`.
- `whatsapp-who.ts` requires exactly one group, prints
  `sender=<participant> message=<id> time=<ISO timestamp or unknown>` for
  eligible posts, and never reads or persists message text
  `[whatsapp-who.ts:console.log]`.

## Invariants

- **Defaults**: blank or whitespace-only environment values fall back to their
  defaults; an empty `BACKUP_ENCRYPTION_KEY_FILE` is treated as unset
  `[backup.ts:keyFile]`.
- **Intake validation**: the top-level JSON value must be an array, and each
  item must pass `asPost` before any database access; a missing argument throws
  before the file is read `[intake-local.ts:Array.isArray]`,
  `[intake-local.ts:inputPath]`.
- **Intake cleanup**: `db.close()` runs immediately after ingestion and before
  the result lines are printed, and also when `createConfiguredExtraction`
  throws; ingestion itself has no `finally` cleanup `[intake-local.ts:db.close]`.
- **Comparison gates**: a missing or empty API key throws before any network
  call; the request interval must be finite and non-negative, and NVIDIA
  `maxTokens` must be a positive safe integer
  `[model-comparison-pilot.ts:requestIntervalMs]`,
  `[nvidia-comparison-pilot.ts:maxTokens]`.
- **Comparison retry policy**: only `empty_response` and `invalid_output`
  errors continue to the next fixture; every other error kind marks the run
  `incomplete` and stops it. A non-incomplete run with a failed fixture is
  finalized as `failed` `[model-comparison-pilot.ts:runModel]`.
- **Route metadata**: OpenRouter records `route_missing` when
  `selectedProvider` is absent or `responseModel` is missing; NVIDIA checks
  only `responseModel`. Scoring and fixture insertion happen before that check
  `[nvidia-comparison-pilot.ts:run]`.
- **Artifact permissions**: comparison artifacts are written with mode `0600`
  and a trailing newline; the directory is created recursively
  `[model-comparison-pilot.ts:writeFile]`.
- **Fixtures are trusted**: both pilots parse fixture JSON and cast it without
  runtime schema validation `[model-comparison-pilot.ts:fixtures]`.
- **Report is read-only**: `pilot-report.ts` performs no insert, update, or
  delete `[pilot-report.ts:db.prepare]`.
- **Single tracked group**: the WhatsApp pilot and sender listener require
  exactly one group after the SQLite tracked-group override; validation closes
  the database before throwing `[whatsapp-pilot.ts:whatsappGroupIds]`,
  `[whatsapp-who.ts:groupIds]`.
- **Pilot flags are literal**: `WHATSAPP_PILOT_INGEST` and
  `WHATSAPP_PILOT_EXTRACT` are true only for the exact string `true`; a
  tracked-group `allowAllSenders: false` overrides an environment `true`
  `[whatsapp-pilot.ts:pilotIngest]`.
- **Pilot deduplication**: `seenMessageIds` deduplicates for the process
  lifetime and adds an ID before ingestion, so a failed ingest is not retried
  by the same process `[whatsapp-pilot.ts:seenMessageIds]`.
- **Per-message faults**: ingest errors and unknown statuses are counted as
  `failed` and do not stop the message loop
  `[whatsapp-pilot.ts:handleUpsert]`.
- **Shutdown**: a logged-out disconnect sets exit code 1 and suppresses
  reconnects; shutdown clears the reconnect timer, ends the socket, closes the
  database if open, and prints totals only when ingestion was enabled
  `[whatsapp-pilot.ts:shutdown]`.
- **Sender privacy**: `whatsapp-who.ts` reads only group ID, sender, message
  ID, and timestamp for output; it does not read message text
  `[whatsapp-who.ts:messages.upsert]`.

## Side Effects

- **Database**: `backup.ts` checkpoints and snapshots the database;
  `restore.ts` replaces it and may write a `.pre-restore-*` safety copy;
  `intake-local.ts` and `whatsapp-pilot.ts` insert source messages and may
  write planner items; `pilot-report.ts` reads only
  `[backup.ts:backupDatabase]`, `[restore.ts:restoreDatabase]`.
- **Network**: OpenRouter and NVIDIA Build HTTP calls in the comparison
  pilots; Baileys WhatsApp connections in the three WhatsApp scripts
  `[model-comparison-pilot.ts:createOpenRouterGenerate]`,
  `[whatsapp-pilot.ts:makeWASocket]`.
- **Filesystem**: backup directory and snapshots; comparison artifacts under
  `artifacts/model-comparison/`; WhatsApp auth state under
  `./storage/whatsapp-auth`; group cache at `./storage/whatsapp-groups.json`
  `[whatsapp-list-groups.ts:writeGroupCache]`.
- **Stdout disclosure**: `whatsapp-list-groups.ts` prints QR codes and group
  and participant identifiers (including phone numbers and LIDs)
  `[whatsapp-list-groups.ts:console.log]`.
- **Process control**: WhatsApp scripts set `process.exitCode`, schedule
  2-second reconnects, and end the socket on `SIGINT`/`SIGTERM`
  `[whatsapp-list-groups.ts:reconnectTimer]`.
- **Timers**: the comparison pilots delay between fixtures with `setTimeout`
  `[model-comparison-pilot.ts:delay]`.

## Verification

- Run: `npm test` (TypeScript build and Node test suite).
