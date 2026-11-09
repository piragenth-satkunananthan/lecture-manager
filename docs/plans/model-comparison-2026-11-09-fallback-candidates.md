# Fallback Candidate Evaluation — 2026-11-09

> **Update 2026-11-09:** The NVIDIA Build `nemotron-3-ultra-550b-a55b` candidate later passed 11/11 as a second provider. This report’s OpenRouter-only fallback conclusion still stands: no second free OpenRouter model passed. See [`nvidia-build-evaluation-2026-11-09.md`](nvidia-build-evaluation-2026-11-09.md).

**Status:** No viable free OpenRouter backup found. The bounded fallback chain is authorized in design, but it cannot be populated from the OpenRouter free catalog. Extraction and live WhatsApp intake remain disabled.
**Artifact:** [`artifacts/model-comparison/2026-11-09T03-31-39-374Z.json`](../../artifacts/model-comparison/2026-11-09T03-31-39-374Z.json)
**Related:** [`model-comparison-2026-11-09-gemma-nonzdr.md`](model-comparison-2026-11-09-gemma-nonzdr.md)

## Evaluation policy

- Synthetic fixtures only. No real WhatsApp posts were sent.
- The pilot used the evaluation-only non-ZDR policy for candidate routing (`zdr: false`), because every remaining free candidate that could route was blocked by the ZDR filter. Production extraction still uses the adapter’s default policy: Gemma free only.
- `provider.data_collection: "deny"`, `provider.require_parameters: true`, and `provider.allow_fallbacks: false` remained in force.
- 11 fixtures per candidate, one request per fixture, 60-second timeout, 15-second pacing, no retries.

## Routing probe

| Free model | Probe result |
| --- | --- |
| `dots-studio/dots-3-note-preview:free` | HTTP 200, routed to AtlasCloud |
| `recursive/flint-v1.0:free` | HTTP 200, routed to Recursive |
| `xingchen-agi/xing4.0-29b-a4b:free` | HTTP 200, routed to Phala (already failed validation) |
| `google/gemma-4-26b-a4b-it:free` | HTTP 429 |
| `google/gemma-4-31b-it:free` | HTTP 429 |
| `cohere/north-mini-code:free` | HTTP 404 — no endpoint handles the requested parameters |
| `liquid/lfm-2.5-2.6b:free`, `liquid/lfm-3-1.7b:free` | HTTP 404 — account data policy (Free model training) |
| `nvidia/nemotron-3-*` (five variants) | HTTP 404 — account data policy (Free model training) |

## Full fixture results

| Candidate | Fixtures recorded | Passing fixtures | Result |
| --- | --- | --- | --- |
| `dots-studio/dots-3-note-preview:free` | 9/11 | 1 (`unrelated-message`) | 7 `invalid_output`, then HTTP 400 upstream. Incomplete. |
| `recursive/flint-v1.0:free` | 3/11 | 0 | 2 `invalid_output`, then timeout. Incomplete. |

Neither candidate can meet the gate. The invalid outputs failed local JSON/schema/evidence validation, not transport.

## Conclusion

- The fallback chain has no second passing member. Gemma remains the only model with an approved non-ZDR route, and it is still returning HTTP 429.
- Do not select a backup, enable extraction, or connect live WhatsApp intake.
- The remaining free models are blocked by the account’s “Free model training” data policy or do not support the required request parameters. Unlocking them requires a separate privacy decision; it is not covered by the Gemma exception.

## Options

1. Wait for Gemma’s provider to recover and complete 11/11.
2. Approve a broader account data-policy change to unlock the liquid/NVIDIA free candidates, then evaluate them through the same gate.
3. Keep the chain authorized on paper only until a second model passes. Do not implement an unvalidated backup path as if it were usable.
