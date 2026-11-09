# Lecture Manager

Lecture Manager is a planned student planner for WhatsApp class and assignment announcements. The repository contains a TypeScript foundation and extraction pilots; it is not yet a complete planner application.

## Current state

- OpenRouter remains implemented; the NVIDIA adapter is experimental. No model is approved for live posts. Extraction is disabled by default with `EXTRACTION_ENABLED=false`, and live WhatsApp intake is disabled.
- A synthetic comparison ran on 2026-11-09. No free OpenRouter candidate completed the gate. NVIDIA's `nvidia/nemotron-3-ultra-550b-a55b` passed 11/11 tuned fixtures, but two separate held-out checks passed 5/6 each. The model is not approved for real posts or production: NVIDIA's free API trial is for evaluation, and production licensing and data-use approval remain unresolved. Extraction stays off. See the [fallback evaluation report](docs/plans/model-comparison-2026-11-09-fallback-candidates.md) and [NVIDIA evaluation](docs/plans/nvidia-build-evaluation-2026-11-09.md).
- The comparison runner uses synthetic messages only. It does not read `.env`; provide API keys through the process environment.
- The WhatsApp pilot tests message intake only. It does not call an AI model, save planner events, or provide durable deduplication. Use a separate test group only.
- NVIDIA Build is available only as an experimental, disabled-by-default evaluation adapter. Do not send it real lecturer posts unless production terms and data handling are explicitly approved. OpenRouter extraction is also disabled until its model/privacy gates pass.
- The planner database schema, item lifecycle, clarification flow, reminder scheduling, extraction pipeline, and authenticated Fastify API are implemented in `src/`. SMTP delivery, the browser GUI, live intake, and the Zoom worker are not implemented.

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

`src/extraction.ts` turns a validated extraction into planner items, clarifications, source-state transitions, and reminder schedules. `src/extraction-factory.ts` selects the configured provider. The pipeline is behind `EXTRACTION_ENABLED=false`; the server/API exists, but no intake route calls the pipeline yet, and SMTP/live intake are not connected.

## Planner server

Set the operator credentials and origin, then build and start:

```sh
PLANNER_PASSWORD=...
SESSION_KEY_FILE=./storage/session.key
PLANNER_ORIGIN=https://planner.example.lan
npm run build
npm start
```

`SESSION_KEY_FILE` must contain exactly 32 random bytes. The server listens on `HOST`/`PORT`; put HTTPS termination in front of it before exposing it on the LAN. Routes: `GET /api/health`, `POST/DELETE /api/session`, `GET /api/items`, `GET/PATCH /api/items/:id`, `POST /api/items/:id/recording-permission`, `GET /api/clarifications`, and `POST /api/clarifications/:id/answer`. State-changing routes require the configured `PLANNER_ORIGIN` when it is set.

The server does not start WhatsApp intake, extraction, SMTP delivery, or Zoom jobs. The browser UI is not implemented yet.

## Synthetic model comparison

The comparison runner tests free OpenRouter candidates against expected results for the same synthetic fixtures. It uses one request per fixture, a 60-second timeout, and no automatic retries. Results contain model names, provider routes, fixture outcomes, field scores, and safe error categories; they do not contain message text or evidence quotes.

Set `OPENROUTER_API_KEY` in the process environment, then run:

```sh
npm run pilot:compare
```

To test different free OpenRouter models, set `OPENROUTER_CANDIDATE_MODELS` to comma-separated model IDs ending in `:free`. The default candidate is `google/gemma-4-31b-it:free`. The runner saves results under `artifacts/model-comparison/`. An incomplete or failed run does not select a model. Set `OPENROUTER_REQUEST_INTERVAL_MS` to add a delay between fixtures when a free route is rate-limited; the default is 0 milliseconds.

### NVIDIA Build (experimental, disabled by default)

The evaluated model is `nvidia/nemotron-3-ultra-550b-a55b`. Do not enable this trial endpoint for real lecturer posts; production licensing and data-use approval are unresolved. The adapter remains off:

```sh
NVIDIA_API_KEY=...
EXTRACTION_PROVIDER=nvidia
NVIDIA_MODEL=nvidia/nemotron-3-ultra-550b-a55b
EXTRACTION_ENABLED=false
```

The adapter uses JSON mode and disables reasoning with `chat_template_kwargs.enable_thinking: false` so the model can finish within 60 seconds. It passed 11/11 tuned fixtures and two held-out sets at 5/6 each; this is not sufficient to enable live extraction. Production terms, data use, the `details` gap, a third held-out set, and server/API integration remain unresolved.

Do not use real WhatsApp posts for model tests. Do not connect the WhatsApp pilot to a live subject group.

## Project documents

- [Approved design](docs/designs/student-planner.md)
- [Overall implementation plan](docs/plans/student-planner-implementation.md)
- [OpenRouter migration plan](docs/plans/openrouter-migration-implementation.md)
- [Agent handoff](docs/plans/agent-handoff.md)
