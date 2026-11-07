# Consolidated EGM Review Report

**Target:** `docs/designs/student-planner.md`
**Preset:** Consolidated report with all review rubrics
**Result:** All five stages completed. No edits were made to the design during review. The review found two blockers and several major implementation and rollout gaps.

## 🔴 Blockers

### C1. Add a live-use authorization and account-risk gate for WhatsApp

The one-group pilot can prove that a client receives messages and reconnects. It cannot establish that automated access is authorized or acceptable for live groups. Both candidate libraries are unofficial, and the saved Terms source is dated 2021. The author has accepted nonzero account-restriction risk; the plan still needs a separate gate for current policy and authorized use. If that gate fails, stop automated intake and use the manual-forwarding fallback.

### C2. Establish an allowed Zoom join and capture path before live use

The host-controlled test meeting can prove one account and meeting configuration. It cannot prove access to every live class. The design must define the host/account permission and admission checks for each recording job, and must not bypass Zoom controls. If the selected desktop path is blocked or not allowed, keep unattended capture disabled and use only a separately approved fallback.

The user has stated that the lecturer and students permitted joining and recording. The remaining gap is how the implementation verifies that the chosen account, host settings, admission path, and recording method work for each live class.

## 🟡 Major Findings

### C3. Specify Webtop's interactive access boundary

“Private” and “off public ports” do not describe how interactive access is protected. Define a private HTTPS route, authentication, and how Android and desktop clients reach it. Keep that path separate from the planner-to-agent token. The Webtop documentation also describes passwordless `sudo` in its GUI, so protect administrative access and do not expose the interface publicly.

### C4. Stop an active recording before it fills the disk

The 80% threshold pauses new recordings, while an active recording can continue for four hours. Define a maximum recording size or minimum free-space stop rule for an active capture, and test it.

### C5. Set observable pass/fail criteria for the feasibility pilots

The pilots use terms such as “reliably enough,” “valid,” “usable,” and “extracts correctly” without measurable thresholds. The fixture list has categories but no expected outputs. Specify expected extracted fields and values, resource ceilings, reconnect and catch-up results, sender filtering, recording quality, and host-end detection before enabling live intake or recording. Include confidently wrong dates and times in the checks.

### C6. Define event lifecycle, cancellation matching, and source provenance

The plan says edits update items and cancellations stop reminders, but it does not define how a cancellation is recognized or matched to an existing item. Define source message identity, event fields and states, how edits interact with user corrections, how cancellations map to prior items, and how duplicate reposts are handled. Explain what source reference remains inspectable after raw message text is deleted.

### C7. Specify planner-to-Webtop and email retry contracts

The SQLite section lists tables without fields, keys, relationships, or lifecycle states. The planner/Webtop link lacks endpoint payloads, job states, retry ownership, and lease behavior. Email retries can duplicate a notice if SMTP accepts it but the process stops before marking it delivered. Define the intended delivery guarantee and recovery behavior.

### C8. Define backup and restore

The plan requires backup/restore verification but does not specify what is backed up, how to take a consistent SQLite copy while the service runs, where it is stored, or how restore works. Define and test recovery of planner state and recording metadata.

### C9. Defer file-level and capture-tool decisions until pilots establish feasibility

The 22-file plan fixes choices such as SQLite schema, X11/PulseAudio/FFmpeg capture, Tesseract, and a custom Webtop startup script before the feasibility pilots pass. Keep the service boundaries and pilot acceptance criteria; defer exact files and low-level tools until those results show what works.

## 🟢 Nits and Open Details

* Define what happens when an assignment post arrives after its due date.
* Clarify how a source reference lets the student inspect provenance after raw text is deleted.
* Replace the broad claim that WhatsApp loss “cannot suppress every alert” with the specific guarantee that email notices remain available.
* Use a consistent neutral voice in Alternatives Considered, shorten repeated rationale, and remove vague terms such as “small” and “plain.”
* Replace “screen/audio-record” with “record the screen and audio,” and reduce stacked hedges in the Overview.

## Traceability Matrix

| Consolidated item | Raw findings mapped |
| --- | --- |
| C1 WhatsApp live-use gate | Stage 5 S5-1; Stage 7 `design_critic-1-1`; Stage 8 S8-1; Stage 9 `implementation_readiness-1-1`, `codebase_details-1-2` |
| C2 Zoom permission and supported path | Stage 5 S5-2; Stage 7 `design_critic-1-2`; Stage 8 S8-2; Stage 9 `implementation_readiness-1-2`, `codebase_details-1-1` |
| C3 Webtop access | Stage 5 S5-3; Stage 7 `design_critic-1-3`; Stage 8 S8-3; Stage 9 `implementation_readiness-1-5`, `codebase_details-1-3` |
| C4 Active-recording storage bound | Stage 7 `design_critic-1-4`; Stage 8 S8-4 |
| C5 Measurable pilot criteria | Stage 7 `design_critic-1-5`, `style-1-1`; Stage 8 S8-5; Stage 9 `implementation_readiness-1-4`, `style-1-1`, `style-1-2` |
| C6 Event lifecycle and provenance | Stage 6 findings 1–2; Stage 8 S8-6 and S8-9; Stage 9 `implementation_readiness-1-3` |
| C7 Agent and reminder contracts | Stage 9 `implementation_readiness-1-3`, `implementation_readiness-1-6` |
| C8 Backup and restore | Stage 9 `implementation_readiness-1-7` |
| C9 Defer detailed implementation choices | Stage 5 S5-4; Stage 8 S8-7 |
| Late assignments | Stage 5 S5-5; Stage 8 S8-8 |
| Device access and wording nits | Stage 6 finding 3; Stage 8 S8-9 and S8-10; Stage 7 style findings 2–4; Stage 9 style finding 3 |

## Stage Artifacts and Reviewer Status

* Stage 5: `zoom_out_report.md` — Zoom Out and Inventive Catalyst completed.
* Stage 6: `comprehension_report.md` — comprehension reviewer completed; no external context was supplied, as required for this stage.
* Stage 7: `critic_report.md` — design critic, structural, and style completed. Style required one retry because the saved Zoom bot-controls HTML was a loading shell; the retry used the rendered article text companion. Structural reported no findings.
* Stage 8: `intermediate_zoom_out_report.md` — Zoom Out completed.
* Stage 9: `implementation_readiness_report.md` — implementation readiness, codebase details, and style completed.

The review was read-only. No implementation files, tests, or runtime checks were created or run. The source snapshots used by reviewers are stored under `review_context/egm-review-sources/`; the Zoom bot-controls page is present as both the raw HTML capture and rendered text because its HTML capture did not contain the article body.
