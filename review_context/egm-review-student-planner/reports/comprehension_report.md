# Stage 6: Comprehension Test

## What this proposes

The planner would turn trusted lecturers’ new WhatsApp posts into calendar items, using AI extraction with local checks and asking the student to resolve missing or unclear details. It would own a calendar and send reminders, while keeping source provenance and data private. After separate pilots and permission checks, a Webtop worker could join scheduled Zoom classes and capture screen and audio.

## How the existing system works, per this document

The document describes an existing Node.js 24 TypeScript foundation, an OpenRouter extraction adapter, and a single-user web service. It does not describe existing calendar storage, WhatsApp intake, reminders, Zoom capture, or backup behavior; those are proposed implementation work or pilot steps.

## Findings

1. **Severity: Major**
   **Affected Scope:** Late assignments, lines 39, 165, 225
   **Discrepancy & Rationale:** The document says the student can archive an `overdue_review` assignment, but the listed item states are `pending`, `confirmed`, `cancelled`, and `overdue_review`. It does not say what archiving does or how the archived item is represented, so the outcome of that user choice is unclear.

2. **Severity: Major**
   **Affected Scope:** Message intake and planning, lines 68–69; feasibility pilot, line 164
   **Discrepancy & Rationale:** The plan refers to “link indexes with Zoom flags” and “existing Zoom-link index validation,” but does not define the index or placeholder format, or the validation rules. Since the model must not receive actual URLs and the app derives `zoom_url` from a validated index, this contract is needed to understand how a post’s link is safely matched to the extracted item.

3. **Severity: Major**
   **Affected Scope:** Evidence retention, lines 70, 136, 210, 289; backup plan, line 168
   **Discrepancy & Rationale:** Earlier sections call the seven-daily and four-weekly backup rotation “existing,” while the implementation plan says to create that backup process during the private pilot. This leaves unclear whether the stated retention behavior already applies or begins after that stage, which affects the deletion and retention expectation.

4. **Severity: Nit**
   **Affected Scope:** Test file specification, lines 270–271
   **Discrepancy & Rationale:** The same file has two “Proposed Changes” bullets with overlapping test requirements. The second expands the first, but the document does not say whether it replaces or supplements it.

## Read Confirmation

The reviewer read the comprehension persona and the complete 294-line target, including FeatureRange lines 1–155 and DetailedRange lines 156–294. No GoldfishContext files were supplied to this stage, as required.
