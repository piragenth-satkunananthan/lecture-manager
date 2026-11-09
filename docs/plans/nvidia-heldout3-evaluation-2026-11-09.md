# NVIDIA 550B Third Held-Out Evaluation — 2026-11-09

**Status:** 5/5 pass. The deadline-only `details` gap is fixed, and the main 11-fixture gate was re-run at 11/11 after the change.
**Model:** `nvidia/nemotron-3-ultra-550b-a55b`
**Fixture set:** [`test/fixtures/held-out-posts-3.json`](../../test/fixtures/held-out-posts-3.json)
**Artifact:** [`artifacts/model-comparison/2026-11-09T06-51-52-036Z.json`](../../artifacts/model-comparison/2026-11-09T06-51-52-036Z.json)
**Main gate artifact:** [`artifacts/model-comparison/2026-11-09T06-51-07-019Z.json`](../../artifacts/model-comparison/2026-11-09T06-51-07-019Z.json)

## Why this set exists

The second held-out set exposed one remaining gap: a deadline-only assignment set `details` instead of null. A rule was added before this set was written:

- If the message only says an assignment/class is due, scheduled, or cancelled on a date/time, `details` is null.
- Use `details` only for a separate action or instruction.
- For a cancellation, use the short cancellation phrase and do not put the class date in `change_details`.

## Results

| Fixture | Outcome | Detail |
| --- | --- | --- |
| `fresh3-deadline-only-assignment` | Pass | `details` null, date/time correct |
| `fresh3-class-only` | Pass | `details` null, class date/time correct |
| `fresh3-assignment-with-action` | Pass | Separate “Submit the report and dataset” kept in `details` |
| `fresh3-non-announcement` | Pass | Empty items |
| `fresh3-deadline-word` | Pass | Deadline-only assignment, `details` null |

## Regression check

The new rule initially caused one main-gate mismatch on a cancelled class (`change_details`). A tighter cancellation rule fixed it. The main gate then passed **11/11** again.

## Model-quality summary

- Tuned gate: **11/11**.
- Held-out set 1: **5/6** (non-announcement gap; fixed).
- Held-out set 2: **5/6** (deadline-only `details` gap; fixed).
- Held-out set 3: **5/5**.
- No known open model-quality gap on the current synthetic cases.

Residual risks: the pass is still synthetic-only; the provider can vary outputs at temperature 0; and the fixtures do not cover every language or date format.

## Conclusion

The model is conditionally validated for a controlled pilot. Extraction remains disabled (`EXTRACTION_ENABLED=false`) pending licensing confirmation, HTTPS termination, and the WhatsApp/Zoom gates.
