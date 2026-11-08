# Stage 7: Critic Review

**Target:** `openrouter_migration_brief.md`
**Review range:** Full document, lines 1-96
**Standard:** Feature Specification Standard
**Reviewers:** Design Critic, Structural, Style
**Status:** All three reviewers completed. No files were changed during review.

## Consolidated findings

### S7-B1. Blocker: Compare viable alternatives

**Sources:** Design Critic, Structural
**Affected scope:** `Optional, not part of this migration` and `Choices recorded in this brainstorm`, lines 60-64 and 82-87.

The proposal lists possible options but does not compare them or explain their concrete trade-offs. The feature standard requires a documented review of viable alternatives. Compare keeping Gemini, free OpenRouter candidates, and any other realistic option. State why each is or is not selected, including cost, data handling, model support, and project scope.

### S7-M1. Major: Keep Gemini available until comparison finishes

**Source:** Design Critic
**Affected scope:** Necessary changes, items 1 and 6, lines 52 and 57.

The steps replace Gemini before requiring a Gemini/OpenRouter comparison. The earlier Gemini pilot has no complete recorded baseline. Keep the Gemini path available while both providers run the same fixtures; replace it only after recording the comparison results and choosing a free model.

### S7-M2. Major: Define the model comparison score and pass rule

**Sources:** Design Critic; repeated from Stage 6 Comprehension
**Affected scope:** Recommendation, model selection, tests, and choices, lines 9, 53, 57, 73, and 84.

The proposal says to pick the model that scores best, but does not define the score or minimum acceptable result. An aggregate score could hide a wrong deadline. Define field-level scoring, treat wrong or unsupported dates as critical failures, and set a minimum pass rule. Keep live intake disabled if no free candidate passes.

### S7-M3. Major: Define the event and evidence contract before implementation

**Sources:** Design Critic; repeated from Stage 6 Comprehension
**Affected scope:** Extraction fields and evidence, necessary changes, and test requirements, lines 36-40 and 54-57.

The proposal leaves field types, null rules, the relation to `kind`, evidence shape, and cancellation/rescheduling behavior for later. That is not enough to build the validator or expected-answer fixtures. Define the fields and relationships, how ambiguity is represented, and examples of valid and invalid results.

### S7-M4. Major: Define how evidence supports a value

**Source:** Design Critic
**Affected scope:** Extraction fields and evidence, lines 38-40 and 70.

An exact quote match proves only that the text exists. It does not prove the quote supports the extracted date, time, event type, or other value. Define field-specific checks and which results must stay pending for the user. Add tests for contradictory, unsupported, and misleading quotes.

### S7-M5. Major: Match deletion rules to backup retention

**Source:** Design Critic
**Affected scope:** Evidence retention, line 42; approved backup policy at `docs/designs/student-planner.md:164`.

The proposal says quotes are deleted when an event is deleted, but planner backups remain for seven daily and four weekly copies and can contain data deleted from the live database. State whether deletion means removal from the live database only, and how long backups may still contain the quote.

### S7-M6. Major: Do not imply field evidence validation already exists

**Source:** Style
**Affected scope:** Recommendation and current behavior, lines 9 and 15.

The phrase “keep ... evidence checks” suggests the current app already checks field evidence. `src/ai.ts` currently validates the model shape, dates, and Zoom-link indexes, but has no field-evidence check. Say to keep the existing checks and add local evidence validation.

### S7-M7. Major: Require JSON support on the route used for each request

**Sources:** Style; repeated from Stage 5 Zoom Out
**Affected scope:** Provider request and necessary changes, lines 27-32 and 53.

Checking route support when choosing a model does not ensure later requests use a compatible provider. OpenRouter's provider-routing page says `require_parameters` defaults to `false`; a route may ignore unsupported parameters. Require parameter support on each request (for example, `provider.require_parameters: true`) and fail if no free route supports JSON mode.

Source: [Saved provider-routing page](../context/provider-routing.html).

### S7-M8. Major: Describe the approved Gemini policy precisely

**Source:** Style
**Affected scope:** Current system and outdated decisions, lines 19 and 68-69.

“Stricter language” is subjective and can misstate the approved design. The approved design specifies Gemini, `store=false`, and Google's free-tier data-use policy; the current code sends a schema-based response format. State those facts separately, then identify which provider and data-use decisions would change.

### S7-N1. Nit: Name the current timeout and retry behavior

**Source:** Style
**Affected scope:** Errors and fail-safe behavior, line 46.

“Bounded-time” and “unless a reviewed decision changes it” leave the behavior and approval path unclear. Say to keep the current 60-second timeout and disabled automatic retries unless the approved design changes them.

### S7-N2. Nit: Shorten and link the review history

**Source:** Style
**Affected scope:** Goldfish review summary and choices, lines 76-87.

These sections repeat findings and choices already stated above. The statement that seven lenses reviewed the proposal has no linked report, and “protect evidence quotes from retention” conflicts with the decision to store them with events. Link the reports and keep one accurate list of decisions.

## Findings carried forward from earlier stages

| Earlier finding | Status | Stage 7 trace |
| --- | --- | --- |
| Stage 5: Require a route that supports JSON mode on every request. | Open | S7-M7 repeats this issue. |
| Stage 5: Clarify that app-derived `zoom_url` is outside model quote evidence and remains covered by local link-index validation. | Open | Not raised again by Stage 7 reviewers; still unresolved. |
| Stage 6: Define field types, null rules, relationships, and ambiguity behavior. | Open | S7-M3 repeats this issue. |
| Stage 6: Define the model scoring and pass rule. | Open | S7-M2 repeats this issue. |

## Reviewer traceability

- Design Critic: S7-B1, S7-M1 through S7-M5.
- Structural: S7-B1. Heading hierarchy and Markdown formatting passed.
- Style: S7-M6 through S7-N2.
