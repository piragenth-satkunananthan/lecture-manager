# OpenRouter Synthetic Comparison — 2026-11-09

> **Update 2026-11-09:** The user subsequently approved the Gemma non-ZDR exception. The ZDR-only conclusion below is historical; see [the Gemma non-ZDR rerun report](model-comparison-2026-11-09-gemma-nonzdr.md).

**Status:** Historical (superseded in part) — no model was selected under the ZDR-only policy. Extraction and live WhatsApp intake remain disabled.
**Artifact:** [`artifacts/model-comparison/2026-11-09T02-53-10-115Z.json`](../../artifacts/model-comparison/2026-11-09T02-53-10-115Z.json)
**Plan:** [`openrouter-migration-implementation.md`](openrouter-migration-implementation.md) — Migration Milestone 4
**Design:** [`../designs/student-planner.md`](../designs/student-planner.md)

## Scope and controls

- 11 synthetic fixtures; one request per fixture; 60-second timeout; no automatic retries.
- Every request set all four required provider controls: `provider.require_parameters: true`, `provider.data_collection: "deny"`, `provider.zdr: true`, and `provider.allow_fallbacks: false`.
- Only synthetic fixture text, timestamps, the `Asia/Colombo` time zone, URL placeholders, and link indexes were sent. No WhatsApp identifiers, actual URLs, passcodes, or real lecturer posts were sent.
- The OpenRouter key was supplied through the process environment. No key or `.env` contents are recorded here or in the artifact.

## Results

| Candidate | Fixtures recorded | Selected route | Outcome |
| --- | --- | --- | --- |
| `google/gemma-4-31b-it:free` | 1 / 11 | none | HTTP 404 — “No endpoints found matching your data policy (Zero data retention)”. Its only endpoint is Google AI Studio, which the ZDR data policy filters out. Run incomplete. |
| `xingchen-agi/xing4.0-29b-a4b:free` | 3 / 11 | Phala | Fixtures 1–2 returned `invalid_output` (local JSON/schema/evidence validation failed); fixture 3 returned HTTP 429 rate limit. Run incomplete. |

`passingFreeModels` is empty. No candidate met the gate: 100% expected-field accuracy, valid evidence for every non-null fact, and zero invalid, ambiguous, incomplete, or unsupported results confirmed.

## Routing probe

A single-request probe of every free OpenRouter model with the same four controls found:

- 11 of 12 free models returned HTTP 404 under the ZDR data policy.
- Only `xingchen-agi/xing4.0-29b-a4b:free` returned HTTP 200, routed to Phala.

The 404s show that every probed endpoint except Phala was filtered by the Zero Data Retention requirement. Whether the account-level Google and All other models settings are configured exactly as the design requires still needs the operator’s dashboard verification; that check is not recorded and cannot be inferred from these routing errors alone.

## Gate decision

- Do **not** select a model.
- Do **not** enable extraction.
- Do **not** connect live WhatsApp intake or send real posts to a model.
- Do **not** weaken any of the four provider controls to make Gemma 4 31B route. That would change the approved privacy contract.

Reasons:

1. Gemma 4 31B free has one endpoint (Google AI Studio), and the required ZDR filter excludes it. It cannot pass while `zdr: true` remains mandatory.
2. `xingchen-agi/xing4.0-29b-a4b:free` failed two fixtures before the rate limit. Even a resumed complete run could not meet 100% expected-field accuracy.
3. The free-tier request limit (HTTP 429 after three requests) prevents a full 11-fixture run in one pass. Per the plan, this makes the run incomplete, not a pass.

## Required decision

The next step is an explicit operator decision; it is not another automatic retry loop:

- Keep extraction disabled and retry the comparison only if a free model with a ZDR-capable endpoint becomes available; or
- Approve a design change to the privacy or candidate policy (this must be recorded in the approved design before implementation, and no paid or local fallback may be added silently); or
- Keep the model gate closed and defer planner extraction.

The runner and fixtures are ready for a later complete run. A future artifact and an updated report are required before Milestone 4 can be marked complete.
