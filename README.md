# Lecture Manager

Lecture Manager is a planned student planner for WhatsApp class and assignment announcements. The repository contains a TypeScript foundation and extraction pilots; it is not yet a complete planner application.

## Current state

- OpenRouter and NVIDIA Build are approved. The pinned NVIDIA model is `nvidia/nemotron-3-ultra-550b-a55b`. Extraction is disabled by default with `EXTRACTION_ENABLED=false`, and live WhatsApp intake is disabled.
- A synthetic comparison ran on 2026-11-09. No free OpenRouter candidate completed the gate. NVIDIA's `nvidia/nemotron-3-ultra-550b-a55b` passed 11/11 tuned fixtures; three held-out checks passed 5/6, 5/6, and 5/5. The non-announcement and deadline-only `details` gaps were fixed. Licensing was reviewed: the free Build API is accepted for the pilot, while production support is not confirmed. The HTTPS path is recorded and locally validated; host installation, DNS/CA trust, and the live pilots remain. Extraction stays off pending those gates. See the [fallback evaluation report](docs/plans/model-comparison-2026-11-09-fallback-candidates.md) and [NVIDIA evaluation](docs/plans/nvidia-build-evaluation-2026-11-09.md).
- The comparison runner uses synthetic messages only. It does not read `.env`; provide API keys through the process environment.
- The WhatsApp pilot tests message intake only. It makes no AI calls. With `WHATSAPP_PILOT_INGEST=true`, selected posts are recorded in SQLite with durable deduplication; otherwise it only logs eligible messages. Use a separate test group only.
- NVIDIA Build is available only as an experimental, disabled-by-default evaluation adapter. Do not send it real lecturer posts unless production terms and data handling are explicitly approved. OpenRouter extraction is also disabled until its model/privacy gates pass.
- The planner database schema, item lifecycle, clarification flow, reminder scheduling, extraction pipeline, authenticated Fastify API, SMTP reminder delivery, browser calendar UI, local JSON intake path, and SQLite backup/restore are implemented in `src/` and `web/`. Live WhatsApp intake and the Zoom worker are not implemented.

## Development

Use Node.js 24. Install the locked dependencies and run the build and tests:

```sh
npm ci
npm test
```

`npm test` builds the TypeScript and runs the local test suite.

## Planner core

`src/db.ts` defines SQLite tables for source messages, planner items, clarifications, and reminder deliveries. It enforces unique source-message and reminder keys, foreign keys, and the extraction-state transitions from `received` through `failed`, `pending_review`, `confirmed`, `expired`, and `deleted`. Raw text is cleared on expiry while provenance remains.

`src/planner.ts` handles confirmation, overdue review, cancellation, archive, user corrections, duplicate matching, and clarification resolution. `src/reminders.ts` builds the 09:00 Sri Lanka-time day-before reminders, assignment due-date reminders, and one-hour-before class reminders, with unique delivery keys.

`src/extraction.ts` turns a validated extraction into planner items, clarifications, source-state transitions, and reminder schedules. `src/extraction-factory.ts` selects the configured provider. `src/intake.ts` records source messages, deduplicates by the durable source key, and calls the pipeline only when extraction is enabled. `scripts/intake-local.ts` ingests a local JSON batch. SMTP reminders are connected; live WhatsApp intake is not.

## Planner server

Set `PLANNER_PASSWORD`, then build and start. `npm start` loads `.env` when present:

```sh
PLANNER_PASSWORD=...
# optional: SESSION_KEY_FILE=./storage/session.key
# optional local HTTP origin: PLANNER_ORIGIN=http://127.0.0.1:3000
npm run build
npm start
```

`SESSION_KEY_FILE` defaults to `./storage/session.key`; the file must contain exactly 32 random bytes. Use an `https://` origin only when TLS termination is in front of the server, otherwise the Secure session cookie will not be sent. For plain local HTTP, leave `PLANNER_ORIGIN` unset.

The server listens on `HOST`/`PORT`. Routes: `GET /api/health`, `POST/DELETE /api/session`, `GET /api/items`, `GET/PATCH /api/items/:id`, `POST /api/items/:id/recording-permission`, `GET /api/clarifications`, `POST /api/clarifications/:id/answer`, `GET /api/sources/failed`, `POST /api/sources/:groupId/:messageId/retry`, `DELETE /api/sources/:groupId/:messageId`, `GET /api/whatsapp/groups`, and `GET/PUT/DELETE /api/whatsapp/tracking`. State-changing routes require the configured `PLANNER_ORIGIN` when it is set. The recorded HTTPS path is in [docs/deployment/https.md](docs/deployment/https.md).

The server serves the browser UI at `/`. It includes a month calendar, upcoming items, open questions, corrections, cancel/archive actions, evidence and source provenance, per-class recording permission, failed-post retry/delete, and a WhatsApp test-group picker.

The server also runs a reminder tick every minute. SMTP is configured with `SMTP_HOST`, `SMTP_PORT`, optional `SMTP_USER`/`SMTP_PASSWORD`, `SMTP_FROM`, and optional `SMTP_TO` (defaults to `SMTP_FROM`). Failed deliveries are retried with backoff, up to three attempts. Failed extraction posts are retained for 30 days; raw text is cleared at expiry, and the UI can retry or delete them. The server does not start WhatsApp intake, extraction, or Zoom jobs. The HTTPS path is recorded and locally validated with Caddy; host installation, DNS/CA trust, and port 443 remain.

## Local intake

The local intake path accepts a JSON array of already-selected posts:

```json
[
  {
    "groupId": "group-1",
    "messageId": "local-intake-1",
    "senderId": "lecturer-1",
    "sentAt": "2026-11-07T09:00:00+05:30",
    "text": "Data Structures assignment 2 is due on 10 November 2026."
  }
]
```

Run it with:

```sh
npm run intake:local -- test/fixtures/intake-posts.json
```

With `EXTRACTION_ENABLED=false`, it records source messages only and makes no model calls. With extraction enabled and a provider configured, it runs the same validated pipeline. This path does not connect WhatsApp; live intake remains disabled.

## WhatsApp test-group pilot

The Baileys pilot connects only to one configured test group. To find the exact JIDs, run the read-only helper:

```sh
npm run whatsapp:groups
```

Scan the QR code with the test account. The helper lists group names, group JIDs, addressing mode, and participant JIDs, and caches group metadata in `storage/whatsapp-groups.json` for the planner UI. It sends no messages and does not touch the planner database. Do not share its output. Use the separate test group, never a live subject group.

If it reports `WhatsApp session logged out`, move the stale session aside and rerun:

```sh
mv storage/whatsapp-auth storage/whatsapp-auth.logged-out-$(date +%Y%m%d-%H%M%S)
npm run whatsapp:groups
```

Delete the old archived session after a successful login.

If you cannot tell which participant is the lecturer, use the read-only sender listener:

```sh
WHATSAPP_GROUP_IDS=<test-group-jid> npm run whatsapp:who
```

Send one message from the lecturer’s phone. It prints the exact `sender=` value, message ID, and timestamp — never the message text — and does not write to the database. Put that `sender=` value in `LECTURER_IDS`. For LID-addressed groups this is the `@lid` value.

### Allow posts from any group member

The tracked group may contain class links and times posted by students, not only the lecturer. In **WhatsApp tracking**, enable **Accept posts from any group member** and save. This disables the lecturer-only sender allowlist; any member can create items, and sender provenance is still recorded. Leave it off if you want lecturer-only intake. With this mode on, `LECTURER_IDS` can be empty.

Open the planner UI, find **WhatsApp tracking**, select the cached test group, and click **Save group**. The pilot uses that saved selection; `WHATSAPP_GROUP_IDS` remains a fallback when no group is selected in the UI.

If you prefer configuration by environment:

```sh
WHATSAPP_GROUP_IDS=<test-group-jid>
LECTURER_IDS=<test-lecturer-jid>  # optional with any-member mode
WHATSAPP_PILOT_INGEST=true
npm run pilot:whatsapp
```

Selecting a group does not start intake or extraction.

`npm run pilot:whatsapp` reads the UI-selected group (or `WHATSAPP_GROUP_IDS`) and prints a QR code on first connect. With `WHATSAPP_PILOT_INGEST=true`, eligible posts are written to SQLite with durable deduplication; without it, the pilot only logs that an eligible message arrived. By default the pilot does not call a model. For LID-addressed groups, use the `id`/`lid` value shown by the helper, not the `pn` value.

Verify the run without exposing message text:

```sh
npm run pilot:report
```

### Pilot acceptance check

1. In lecturer-only mode, send 10 eligible messages from the test lecturer and 10 from untrusted senders or other groups.
2. In any-member mode, send 10 messages from members of the tracked group and 10 from other groups.
3. During the run, disconnect and restart the pilot twice.
4. Stop the pilot and run `npm run pilot:report`.

Pass criteria:

- Source messages: **10** (not 20; exactly-once).
- Only the tracked group appears; in lecturer-only mode only the test lecturer appears. In any-member mode multiple senders are expected.
- Pilot totals show `duplicate=0` and `failed=0`.
- State is `received` while extraction is disabled; `processed` or `pending` is expected when extraction is on.

By default the pilot does not call a model and does not insert planner items. To extract items from the tracked group, explicitly enable both extraction and pilot extraction:

```sh
EXTRACTION_ENABLED=true
EXTRACTION_PROVIDER=nvidia
WHATSAPP_PILOT_INGEST=true
WHATSAPP_PILOT_EXTRACT=true
npm run pilot:whatsapp
```

This sends posted message text to NVIDIA and creates planner items. It is not a no-model pilot. Keep it off until you have authorized live extraction for that group.

## Synthetic model comparison

The comparison runner tests free OpenRouter candidates against expected results for the same synthetic fixtures. It uses one request per fixture, a 60-second timeout, and no automatic retries. Results contain model names, provider routes, fixture outcomes, field scores, and safe error categories; they do not contain message text or evidence quotes.

Set `OPENROUTER_API_KEY` in the process environment, then run:

```sh
npm run pilot:compare
```

To test different free OpenRouter models, set `OPENROUTER_CANDIDATE_MODELS` to comma-separated model IDs ending in `:free`. The default candidate is `google/gemma-4-31b-it:free`. The runner saves results under `artifacts/model-comparison/`. An incomplete or failed run does not select a model. Set `OPENROUTER_REQUEST_INTERVAL_MS` to add a delay between fixtures when a free route is rate-limited; the default is 0 milliseconds.

### NVIDIA Build (approved, disabled by default)

The approved model is `nvidia/nemotron-3-ultra-550b-a55b`. Extraction is disabled by default:

```sh
NVIDIA_API_KEY=...
EXTRACTION_PROVIDER=nvidia
NVIDIA_MODEL=nvidia/nemotron-3-ultra-550b-a55b
EXTRACTION_ENABLED=false
```

The adapter uses JSON mode and disables reasoning with `chat_template_kwargs.enable_thinking: false` so the model can finish within 60 seconds. It passed 11/11 tuned fixtures and three held-out checks at 5/6, 5/6, and 5/5. Licensing was reviewed: the free Build API is accepted for this pilot, while production support is not confirmed. The HTTPS path is recorded and locally validated; host installation, DNS/CA trust, and the live WhatsApp/Zoom pilots remain before `EXTRACTION_ENABLED=true`.

Do not use real WhatsApp posts for model tests. Do not connect the WhatsApp pilot to a live subject group.

## Backup and restore

Create an integrity-checked SQLite backup (the server may keep running):

```sh
npm run backup
```

Backups are written to `backups/` with `0600` permissions; the directory is gitignored because it contains planner data.

Restore with the server stopped:

```sh
npm run restore -- backups/planner-2026-11-09T...sqlite
```

Restore verifies the backup first, saves the current database as `*.pre-restore-<timestamp>`, replaces the database, clears WAL sidecars, and verifies the restored file. Backups cover the database only; recordings are not included.

## Deployment

- [NVIDIA licensing review](docs/deployment/nvidia-licensing.md) — free Build API for the pilot; production support not confirmed.
- [HTTPS termination runbook](docs/deployment/https.md) — Caddy internal CA at `planner.home.arpa`, plus a Tailscale alternative.
- [Caddyfile example](deploy/Caddyfile.example).

## Project documents

- [Approved design](docs/designs/student-planner.md)
- [Overall implementation plan](docs/plans/student-planner-implementation.md)
- [OpenRouter migration plan](docs/plans/openrouter-migration-implementation.md)
- [Agent handoff](docs/plans/agent-handoff.md)
