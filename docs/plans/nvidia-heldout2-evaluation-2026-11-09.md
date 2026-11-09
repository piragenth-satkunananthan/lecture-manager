# NVIDIA 550B Fresh Held-Out Evaluation — 2026-11-09

**Status:** 5/6 pass. The non-announcement rule works: both administrative-reminder/fee cases returned empty items. One deadline-only assignment still sets `details` instead of null.
**Model:** `nvidia/nemotron-3-ultra-550b-a55b`
**Fixture set:** [`test/fixtures/held-out-posts-2.json`](../../test/fixtures/held-out-posts-2.json)
**Artifact:** [`artifacts/model-comparison/2026-11-09T06-10-13-231Z.json`](../../artifacts/model-comparison/2026-11-09T06-10-13-231Z.json)
**First held-out set:** [nvidia-heldout-evaluation-2026-11-09.md](nvidia-heldout-evaluation-2026-11-09.md)

## Why this set exists

The first held-out set exposed a non-announcement false positive. A general rule was added: administrative reminders, notices, fee deadlines, exam-hall instructions, and item-collection requests are not announcements. This second set was written after that rule and was not used to tune it.

## Results

| Fixture | Outcome | Detail |
| --- | --- | --- |
| `fresh-non-announcement-hall-ticket` | Pass | Empty items |
| `fresh-fee-deadline` | Pass | Empty items |
| `fresh-class-lab-location` | Pass | Class, location, date, and time correct |
| `fresh-assignment-deadline` | Pass | Date-only assignment with action details |
| `fresh-class-zoom-link` | Pass | Zoom link derived locally |
| `fresh-assignment-relative-tomorrow` | **Mismatch** | `details` set instead of null for a deadline-only message |

## Interpretation

- The non-announcement rule generalizes to two fresh administrative cases.
- The remaining gap is narrow: for “X assignment is due tomorrow at 9:00 AM,” the model puts a due phrase in `details` instead of nulling it.
- The error is a free-text mismatch, not a wrong date or time. The local validator still checks the value against the source.
- Two held-out sets now stand at 5/6 each, with different failures. The model is conditionally validated, not fully cleared.

## Options

1. Add a narrow rule: if the only action is “is due” or “deadline is,” set `details` to null; validate on a third small held-out set.
2. Accept the conditional validation and proceed to the server/API, keeping `EXTRACTION_ENABLED=false`.
3. Keep tuning the same set; not recommended — it stops being held-out.

Recommendation: proceed to the server/API. The remaining details gap is minor and does not create a wrong calendar date or time; revisit it with a third held-out set before enabling extraction.
