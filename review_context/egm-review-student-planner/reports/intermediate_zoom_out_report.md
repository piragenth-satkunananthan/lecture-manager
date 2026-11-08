# Stage 8: Intermediate Zoom Out Review

**Target:** `/home/piragenth/Documents/lecture-manager/docs/designs/student-planner.md` (full file, lines 1–294)
**Reviewer:** `zoom_out` — completed

## Findings

### Major — Existing files are labeled “Create,” and the existing service is overstated

**Affected scope:** Lines 158, 172–220, 267–276.

The repository already contains `package.json`, `package-lock.json`, `tsconfig.json`, `.env.example`, `.gitignore`, `src/config.ts`, `src/whatsapp.ts`, `src/ai.ts`, `test/whatsapp.test.ts`, and the lecturer-post fixtures. Extraction tests are in `test/ai.test.ts`. The README and implementation plan say there is no planner server yet, so “extend the existing single-user web service” is inaccurate. This inventory could lead to replacing or duplicating working foundation code. The test inventory also repeats its requirements on lines 270–271.

**Recommendation:** Mark existing files as Modify, describe what to extend, and reserve Create for missing planner components. Align the test file names with the repository and remove the duplicate test bullet. Describe the existing foundation without implying a planner server is already implemented.

### Major — Archived assignments have no defined state or behavior

**Affected scope:** Lines 39, 165, 210, 225, 230.

The student can choose to keep an overdue assignment or archive it, but the listed states contain no archived state and do not say whether archiving hides, retains, or deletes the item. The user choice therefore has no specified outcome.

**Recommendation:** Define what archive means and how the planner represents archived items, or change the user-facing choice to match the lifecycle states.

### Major — Failed-post retention has no lifecycle limit

**Affected scope:** Lines 70–71, 138, 210–220.

The design says raw text is kept only while clarification is pending, but also says failed posts remain for retry or manual review. It does not define a failed-post state, deletion path, or retention period. A failed message could therefore remain indefinitely outside the clarification lifecycle.

**Recommendation:** Define the failed-post state, review/delete path, and retention limit, then reconcile it with the clarification-only raw-text rule.

### Major — Upstream model-provider data use is acknowledged but not constrained

**Affected scope:** Lines 68, 136, 287.

Posts are sent to an automatically selected upstream provider, and lecturer text may contain personal information. The design leaves routing and data practices to user acceptance. The captured OpenRouter documentation describes provider data controls, but the current adapter only sets `provider.require_parameters`; that setting does not control data collection.

**Recommendation:** Define an eligible-route or redaction policy and fail closed when no route meets it.

### Major — Supported message languages and date formats are unstated

**Affected scope:** Lines 68, 164, 287–290.

The target requires fixture accuracy but does not state which input languages or date formats those fixtures cover. The handoff and current extraction code describe English field terms and English/ISO date handling, with unsupported forms failing closed. Without an explicit support scope and representative fixtures, a perfect fixture score would not establish coverage for the lecturer posts the planner will receive.

**Recommendation:** State the supported input scope and require representative synthetic fixtures before selecting a model.

### Major — Backup retention is described as both existing and future work

**Affected scope:** Lines 70, 136, 138, 168, 289.

The target refers to an “existing” seven-daily/four-weekly rotation, while its recovery stage says to create the backup process. The implementation plan places backups in a later milestone, and the repository has no planner backup path. This makes it unclear when the quoted-deletion retention window begins and what backup behavior currently applies.

**Recommendation:** Describe the retention window as a planned policy until backups exist, and define when the deletion window starts.

### Major — Inference alternatives are not evaluated

**Affected scope:** Lines 68, 102–132, 160.

The alternatives section compares intake, Zoom, and calendar choices, but not free hosted inference, local extraction, or manual review. The plan commits to OpenRouter-only extraction without documenting the privacy, availability, and manual-work trade-offs behind that choice.

**Recommendation:** Add the inference alternatives and the concrete trade-offs that support the OpenRouter-only decision.

### Nit — The link-index rule is implemented, but the design describes it only by reference

**Affected scope:** Lines 68–69, 220.

Code search found an existing contract in `src/ai.ts`: URLs become numbered placeholders, the model receives indexed links with Zoom flags, and the app validates the selected index and derives the URL locally. The target says to reuse the existing validation, so this does not require a new utility; a brief reference to the existing mapping would close the Stage 6 comprehension gap.

## Repeated Finding Disposition

The file inventory issue repeats Stage 5. The privacy, failed-post retention, language/date coverage, and inference alternatives issues repeat Stage 7. Backup timing and archive behavior were also identified by Stage 6. These remain open because the target was not edited during this review. The earlier concern about committing to file-level and capture-tool details before pilots remains; the prior Goldfish report records it as escalated because the detailed plan had been approved, so it is not raised again here.

## Completeness

The reviewer read the Zoom-out persona and standard, the full 294-line target, and the Stage 5–7 reports. It checked relevant passages in the 16 project/design Markdown files, all 12 readable source captures, the rendered Zoom bot-controls companions, and searched the codebase for reusable files and link-index behavior.

Unrelated portions of the source pages were not reviewed, including API parameters unrelated to JSON/provider routing, unrelated Webtop configuration, other privacy-policy sections, and model benchmark details. Raw HTML was not opened; readable captures were used. No tests were run and no files were edited.
