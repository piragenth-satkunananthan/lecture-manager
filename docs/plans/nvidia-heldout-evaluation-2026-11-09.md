# NVIDIA 550B Held-Out Evaluation — 2026-11-09

**Status:** 5 of 6 held-out cases pass. The single failure is a fail-closed false positive on a non-announcement reminder. The model remains **conditionally validated**, not enabled.
**Model:** `nvidia/nemotron-3-ultra-550b-a55b`
**Fixture set:** [`test/fixtures/held-out-posts.json`](../../test/fixtures/held-out-posts.json)
**Artifact:** [`artifacts/model-comparison/2026-11-09T06-02-38-672Z.json`](../../artifacts/model-comparison/2026-11-09T06-02-38-672Z.json)
**Main gate:** [nvidia-build-evaluation-2026-11-09.md](nvidia-build-evaluation-2026-11-09.md)

## Why this run exists

The 11/11 main gate was tuned on the same fixtures used for prompt work. These six cases were written after that tuning and were **not** used to change the prompt. They test whether the rules generalize.

## Results

| Fixture | Outcome | Detail |
| --- | --- | --- |
| `heldout-relative-weekday-assignment` | Pass | `next Monday` resolved to 2026-11-09; details and due time correct |
| `heldout-two-items-in-one-message` | Pass | Assignment and class extracted as two items |
| `heldout-tutorial-no-link` | Pass | Class date/time correct; Zoom ambiguity added locally |
| `heldout-cancelled-class-no-replacement` | Pass | Cancellation and ambiguity fields correct |
| `heldout-reminder-not-an-announcement` | **Invalid output** | Model created an item from a reminder about bringing a student ID to an exam hall; its `kind` evidence did not support assignment or class |
| `heldout-assignment-with-details` | Pass | Details, date, and time correct |

## Interpretation

- The five positive cases generalize beyond the tuned fixtures.
- The failure is not a wrong calendar entry. The local evidence validator rejects the item, so the source would go to failed/manual review. That is safe but noisy.
- The model still needs a general non-announcement rule: administrative reminders that do not announce an assignment or class should return an empty `items` array.
- Do not tune on these six cases and then treat them as held-out again. If the prompt changes, create a fresh held-out set.

## Conclusion

- Keep `EXTRACTION_ENABLED=false`.
- The 550B is conditionally validated: strong positive extraction, one fail-closed false-positive class.
- Before enabling extraction, add the non-announcement rule and validate it against a fresh held-out set.
- Server/API work can proceed in parallel; it does not depend on the model gate.
