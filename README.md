# Lecture Manager

Lecture Manager is a planned student planner for WhatsApp class and assignment announcements. The repository contains a TypeScript foundation and extraction pilots; it is not yet a complete planner application.

## Current state

- OpenRouter is the only model provider. Extraction uses JSON mode and strict local schema, evidence, date, and Zoom-link checks. No OpenRouter model has been selected for production.
- The comparison runner uses synthetic messages only. It does not read `.env`; provide API keys through the process environment.
- The WhatsApp pilot tests message intake only. It does not call an AI model, save planner events, or provide durable deduplication. Use a separate test group only.
- The planner database, browser GUI, reminders, live intake, and Zoom worker are not implemented.

## Development

Use Node.js 24. Install the locked dependencies and run the build and tests:

```sh
npm ci
npm test
```

`npm test` builds the TypeScript and runs the local test suite.

## Synthetic model comparison

The comparison runner tests free OpenRouter candidates against expected results for the same synthetic fixtures. It uses one request per fixture, a 60-second timeout, and no automatic retries. Results contain model names, provider routes, fixture outcomes, field scores, and safe error categories; they do not contain message text or evidence quotes.

Set `OPENROUTER_API_KEY` in the process environment, then run:

```sh
npm run pilot:compare
```

To test different free OpenRouter models, set `OPENROUTER_CANDIDATE_MODELS` to comma-separated model IDs ending in `:free`. The default candidate is `google/gemma-4-31b-it:free`. The runner saves results under `artifacts/model-comparison/`. An incomplete or failed run does not select a model.

Do not use real WhatsApp posts for model tests. Do not connect the WhatsApp pilot to a live subject group.

## Project documents

- [Approved design](docs/designs/student-planner.md)
- [Overall implementation plan](docs/plans/student-planner-implementation.md)
- [OpenRouter migration plan](docs/plans/openrouter-migration-implementation.md)
- [Agent handoff](docs/plans/agent-handoff.md)
