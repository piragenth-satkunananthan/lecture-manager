# Goldfish Annotated Review Report

**Target:** `openrouter_migration_brief.md` (`full file`, lines 1-96)

## Prioritized Findings & AI Suggestions

### [Issue 1] [Design Critic, Structural] - Severity: Blocker

* **Affected Scope:** Lines 60-64 and 82-87 (`Optional, not part of this migration`; `Choices recorded in this brainstorm`)
* **Discrepancy Description:** The proposal lists possible options but does not compare them or explain their concrete trade-offs. The feature standard requires a documented review of viable alternatives.
* **Rationale:** A reader cannot tell why the chosen route fits the user's needs better than keeping Gemini or using a paid or local model. Saying that a choice was made does not show what it costs or changes.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Add an alternatives section. Compare the current Gemini API, free OpenRouter models, a paid schema-capable endpoint, and a local model. Explain the cost, schema support, data handling, and operational trade-offs. The local model is not selected because the user chose OpenRouter's free model catalog; it is not a fallback in this proposal.
* ***Proposed Edit:***
  * Location: After `## Recommendation`.
  * Change: Add `## Alternatives Considered` with a concise comparison table. State that Gemini is the current working baseline, OpenRouter's free models are the user's selected destination, and paid endpoints are out of scope because the user requires a free option. Record the concrete benefits and limitations of each.

### [Issue 2] [Design Critic] - Severity: Major

* **Affected Scope:** Lines 52 and 57 (`Necessary changes`, items 1 and 6)
* **Discrepancy Description:** The steps replace Gemini before requiring a Gemini/OpenRouter comparison, but no complete Gemini baseline is recorded.
* **Rationale:** Removing the current provider before comparison makes the required comparison impossible to repeat.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The user asked for both providers to use the same test dataset. Keep the Gemini test path until the comparison is recorded. This does not allow Gemini as an automatic production fallback.
* ***Proposed Edit:***
  * Location: `Necessary changes`.
  * Change: Order the work as: add the OpenRouter test path while keeping Gemini; run and save both providers' results on the same synthetic fixtures; choose a passing free model; only then remove Gemini from the production configuration. State that runtime provider fallback is not allowed.

### [Issue 3] [Design Critic, Comprehension] - Severity: Major

* **Affected Scope:** Lines 9, 53, 57, 73, and 84 (model choice and test comparison)
* **Discrepancy Description:** The proposal says to pick the model that scores best but gives no scoring method or minimum pass rule.
* **Rationale:** A single overall score could hide a wrong deadline. The proposal cannot currently produce a repeatable choice between candidates.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Define a safety gate and a field-level score. The existing approved plan already expects exact synthetic fixture matches and zero incorrect or ambiguous items automatically confirmed.
* **Proposed Edit:**
  * Location: Add a `Model comparison and pass rule` subsection after `Necessary changes` item 6.
  * Change: Score each expected field by exact normalized match. A candidate fails if any invalid, contradictory, ambiguous, or unsupported result is accepted as a confirmed event, or if any required evidence is missing or invalid. Require exact matches for all critical dates and times. Among candidates that pass these safety checks, select the one with the highest exact field match rate. If none pass, select no model and keep live intake disabled.

### [Issue 4] [Design Critic, Comprehension] - Severity: Major

* **Affected Scope:** Lines 36-40 and 54-57 (extraction fields, evidence, and tests)
* **Discrepancy Description:** The proposal leaves field types, null rules, the relationship to `kind`, evidence shape, and cancellation/rescheduling behavior for later.
* **Rationale:** The current description is not enough to build the validator or expected-answer fixtures.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** State a proposed contract in the migration proposal so the user can review it before implementation.
* **Proposed Edit:**
  * Location: Replace the first paragraph under `Extraction fields and evidence`.
  * Change: Specify that `kind` remains the event type (`assignment` or `class`); `title` is the assignment title; `details` is the action or instruction; `course` and `location` are nullable strings; existing due and class date/time fields retain their current ISO date and 24-hour time formats; and a nullable `change_type` (`cancelled` or `rescheduled`) plus nullable `change_details` records changes. For a reschedule, due/class date and time fields contain the new schedule. Null or conflicting required facts remain pending for clarification. Define `field_evidence` as a map from factual field names to one or more `{ quote }` entries, required for every non-null model-extracted fact. State that `zoom_url` is added locally from the validated link index and is not a model-evidenced field.

### [Issue 5] [Design Critic] - Severity: Major

* **Affected Scope:** Lines 38-40 and 70 (evidence validation)
* **Discrepancy Description:** An exact quote match shows that text exists but does not prove that it supports the extracted value.
* **Rationale:** A message can contain a date without supporting the date the model assigned to a field. The proposal does not define when semantic checks pass or when an item stays pending.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Evidence must support both the field and its normalized value. Ambiguous information must follow the existing clarification path, not become a confirmed event or disappear.
* **Proposed Edit:**
  * Location: Add a paragraph under `Extraction fields and evidence`.
  * Change: Require local checks that each quote directly supports its field. Validate normalized dates and times against the quoted wording and source timestamp in `Asia/Colombo`; require event type, cancellation, and rescheduling status to be stated by the quote. Unsupported or conflicting facts must not become confirmed events. Represent a valid but incomplete announcement as pending clarification; treat malformed output or unverifiable evidence as an extraction failure. Keep the entire item unconfirmed until required fields pass validation.

### [Issue 6] [Design Critic] - Severity: Major

* **Affected Scope:** Line 42 (evidence retention); approved backup policy at `docs/designs/student-planner.md:164`
* **Discrepancy Description:** The proposal says quotes are deleted when an event is deleted but does not account for planner backups, which can retain deleted data until snapshots expire.
* **Rationale:** Deletion from the live database does not delete a quote from existing daily or weekly backups.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** State the actual deletion boundary and use the existing backup retention window rather than promising immediate deletion everywhere.
* **Proposed Edit:**
  * Location: Evidence retention paragraph.
  * Change: Say deletion removes evidence from the live event with that event. Existing encrypted backups may retain the quote until those snapshots expire under the approved seven-daily and four-weekly rotation. Do not log quotes separately.

### [Issue 7] [Zoom Out, Style] - Severity: Major

* **Affected Scope:** Lines 27-32 and 53 (provider request and model selection)
* **Discrepancy Description:** The proposal checks JSON-mode support when selecting a model but does not ensure each routed request reaches a provider that supports the requested parameter.
* **Rationale:** OpenRouter's provider-routing documentation says `require_parameters` defaults to false, so a route may ignore unsupported request parameters.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The request must fail closed if a free provider cannot honor JSON mode. Checking once during model selection does not protect later requests.
* **Proposed Edit:**
  * Location: `Provider request` and `Necessary changes` item 2.
  * Change: Require parameter support on each request (for example, set `provider.require_parameters: true`). Fail the request if no free route supports JSON mode. Keep local parsing and strict validation in all cases.

### [Issue 8] [Zoom Out; carried forward from Stage 5] - Severity: Major

* **Affected Scope:** Lines 38-40 (field evidence and Zoom link handling)
* **Discrepancy Description:** The proposal does not explicitly exclude the app-added `zoom_url` from model `field_evidence` coverage.
* **Rationale:** The model sees a placeholder, not the real URL. It cannot return an exact quote of the original URL, and the application already validates and attaches that link by index.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Keep model evidence for facts extracted from message text and keep Zoom URL selection under the existing local index check.
* **Proposed Edit:**
  * Location: `Extraction fields and evidence`.
  * Change: State that `zoom_url` is derived and validated locally from `zoom_link_index`; it is not a model-extracted factual field and does not need a quote. Do not send the actual URL to the model.

### [Issue 9] [Style] - Severity: Major

* **Affected Scope:** Lines 9 and 15 (recommendation and current behavior)
* **Discrepancy Description:** “Keep ... evidence checks” implies field-evidence validation already exists.
* **Rationale:** The current `src/ai.ts` validates the response shape, dates, and Zoom-link indexes, but does not validate field-level evidence.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Distinguish existing checks from the new validation this proposal requires.
* **Proposed Edit:**
  * Location: Recommendation paragraph.
  * Change: Replace “Keep strict Zod, date, evidence, and Zoom-link checks in the application” with “Keep the existing strict Zod, date, and Zoom-link checks; add local field-evidence validation.”

### [Issue 10] [Style] - Severity: Major

* **Affected Scope:** Lines 19 and 68-69 (approved design and data policy)
* **Discrepancy Description:** “Stricter language” and “the approved design ... assumes Gemini-specific JSON Schema output” are imprecise claims about the existing design.
* **Rationale:** The approved design specifies Gemini, `store=false`, and Google's free-tier data-use policy. The current code uses a schema-based Gemini response format. These are separate facts.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** State what the design and code actually say before describing which decisions the migration changes.
* ***Proposed Edit:***
  * Location: Paragraphs under `What exists today` and `Main risks and outdated decisions`.
  * Change: Replace subjective wording with: “The approved design specifies Gemini, `store=false`, and Google's free-tier data-use policy. The current extractor requests a schema-based response. If this migration is approved, update the provider request and record the user's acceptance of OpenRouter's selected provider route and its data practices.”

### [Issue 11] [Style] - Severity: Nit

* **Affected Scope:** Line 46 (timeout and retries)
* **Discrepancy Description:** “Bounded-time” and “unless a reviewed decision changes it” do not state the actual behavior or who approves a change.
* **Rationale:** The current adapter has a 60-second timeout and disables automatic retries.
* ***AI Suggestion:*** PROPOSE FIX
* **Justification:*** Naming the existing limits makes the proposal testable.
* ***Proposed Edit:***
  * Location: `Errors and fail-safe behavior`.
  * Change: Replace the first sentence with “Keep the current 60-second timeout and disabled automatic retries unless an approved design update changes them.”

### [Issue 12] [Style] - Severity: Nit

* **Affected Scope:** Lines 76-87 (review history and choices)
* **Discrepancy Description:** The review summary repeats earlier points, has no links to the seven-lens review artifacts, and says to protect evidence quotes from retention even though the proposal stores them with events.
* **Rationale:** The summary is hard to verify and conflicts with the stated evidence-retention choice.
* ***AI Suggestion:*** PROPOSE FIX
* **Justification:*** Keep a single decision list and link only review reports that exist in the project.
* ***Proposed Edit:***
  * Location: `Goldfish review summary` and `Choices recorded in this brainstorm`.
  * Change: Replace both sections with one short `Decisions recorded` section. Remove the unsupported seven-lens summary, or link the saved brainstorm/review reports. State that evidence is retained with its event and excluded from separate logs.

## Resolution status

No finding has been contested or escalated. All findings are proposed edits for user review. No changes have been applied to the target document.
