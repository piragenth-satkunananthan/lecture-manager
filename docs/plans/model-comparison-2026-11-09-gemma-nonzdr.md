# OpenRouter Gemma Non-ZDR Rerun — 2026-11-09

**Status:** Incomplete — the approved Gemma route is reachable, but Google AI Studio returns HTTP 429. Three paced retries all stopped at 1/11. No model is selected. Extraction and live WhatsApp intake remain disabled.
**Artifact:** [`artifacts/model-comparison/2026-11-09T04-51-34-735Z.json`](../../artifacts/model-comparison/2026-11-09T04-51-34-735Z.json) (latest retry); earlier reruns: [`2026-11-09T03-17-41-801Z.json`](../../artifacts/model-comparison/2026-11-09T03-17-41-801Z.json), [`2026-11-09T03-02-47-378Z.json`](../../artifacts/model-comparison/2026-11-09T03-02-47-378Z.json)
**Supersedes:** The ZDR-only conclusion in [`model-comparison-2026-11-09.md`](model-comparison-2026-11-09.md), after the user-approved design change below.
**Plan:** [`openrouter-migration-implementation.md`](openrouter-migration-implementation.md) — Migration Milestone 4
**Design:** [`../designs/student-planner.md`](../designs/student-planner.md)

## Approved design change

On 2026-11-09 the user approved allowing the non-ZDR Google AI Studio endpoint for `google/gemma-4-31b-it:free`. This is the only `provider.zdr: false` exception.

- `provider.require_parameters: true` — retained for every request.
- `provider.data_collection: "deny"` — retained for every request.
- `provider.allow_fallbacks: false` — retained for every request.
- `provider.zdr: true` — retained for every model except the Gemma free path.
- `provider.zdr: false` — Gemma free only.

The account-level Google group must be set to the least-permissive non-ZDR option that permits Google AI Studio; the All other models group must remain ZDR-only. Those dashboard settings and the check date still need the operator's verification and record.

## Code and tests

- [src/ai.ts](../../src/ai.ts) now selects the provider controls through a narrow policy: only `google/gemma-4-31b-it:free` gets `zdr: false`; every other model keeps `zdr: true`.
- [test/openrouter.test.ts](../../test/openrouter.test.ts) asserts the Gemma exception and a strict-ZDR non-Gemma model.
- [scripts/model-comparison-pilot.ts](../../scripts/model-comparison-pilot.ts) adds optional `OPENROUTER_REQUEST_INTERVAL_MS` pacing between fixtures. It does not retry failures.
- `npm test`: **72/72 pass** (32/32 at the time of this run; NVIDIA adapter, SQLite/planner/reminder/extraction, and server tests added later).

## Routing and availability evidence

| Probe | Provider controls | Result |
| --- | --- | --- |
| Gemma, pre-change | `zdr: true`, data collection denied | HTTP 404 — ZDR data policy filtered the only endpoint |
| Gemma, post-change | `zdr: false`, data collection denied | HTTP 429 — provider returned an error |
| Gemma, post-change | `zdr: false`, data collection allowed | HTTP 429 — provider returned an error |
| Gemma, 75 seconds later | `zdr: false`, data collection denied | HTTP 429 — still provider-limited |
| Paced 11-fixture run, 03:02Z | `zdr: false`, data collection denied | 1/11 recorded, then HTTP 429 |
| Paced 11-fixture retry, 03:17Z | `zdr: false`, data collection denied | 1/11 recorded, then HTTP 429 |
| Paced 11-fixture retry, 04:51Z | `zdr: false`, data collection denied | 1/11 recorded, then HTTP 429, after roughly 1.5 hours |

The 404 is gone: routing now reaches Google AI Studio. The failure has moved to the upstream provider. `free_model_daily_requests` reported 3/50 used at the time of the check, so this is not the daily free-model quota; it is a provider-side or transient limit. The endpoint metadata showed status 0 and 100% one-day uptime, but OpenRouter’s status fields do not report per-minute free-tier throttling.

## Gate decision

- Do **not** select a model; `passingFreeModels` is empty.
- Do **not** enable extraction or live WhatsApp intake.
- Do **not** add a paid or local fallback, and do **not** weaken `data_collection`, `require_parameters`, or `allow_fallbacks`.
- Model quality remains untested: Gemma has not completed a single fixture.

## Next action

Retry the comparison later when Google AI Studio stops returning HTTP 429, using:

```sh
OPENROUTER_CANDIDATE_MODELS="google/gemma-4-31b-it:free" \
OPENROUTER_REQUEST_INTERVAL_MS=15000 \
npm run pilot:compare
```

Save a new artifact and update this report. A 429 or incomplete run is never a pass. The 2026-11-09T04:51Z retry, after roughly 1.5 hours, still returned HTTP 429, so this is a persistent provider-side limit rather than a short per-minute window. Before enabling extraction, record the Google non-ZDR and All other models ZDR-only account settings.
