# OpenRouter Migration Proposal

* **Date:** 2026-11-08
* **Status:** Reviewed proposal; its OpenRouter and field-evidence decisions were incorporated into the approved design on 2026-11-08.
* **Scope:** Records the provider migration choices and constraints. Implementation follows the approved design and [`docs/plans/openrouter-migration-implementation.md`](docs/plans/openrouter-migration-implementation.md).

This is the historical proposal. The approved [`student planner design`](docs/designs/student-planner.md) controls the current requirements; conditional wording below records the state before approval.

## Recommendation

The user chose OpenRouter to access its free models and is open to using whichever free model works best for this project. Gemma 4 31B remains a candidate, not a fixed choice. Choose a model using synthetic lecturer-message tests before enabling live intake. Keep the request to one lecturer post. Keep the existing strict Zod, date, and Zoom-link checks; add local field-evidence validation. Send no WhatsApp message, group, or sender IDs to OpenRouter. The app should attach its local source reference only after validation succeeds.

Do not send live intake through this migration until the provider and data policy are recorded in the approved design, the new extraction contract is defined, and the failure path can retain work for retry or review. The current pilot does not have that durable failure path.

## Alternatives considered

| Option | Benefits | Costs or limits | Decision |
| --- | --- | --- | --- |
| Keep the current Gemini API | No provider migration; current code already uses Gemini structured output and the approved design uses its free tier. | Does not meet the user's choice to use OpenRouter's free model catalog. The Gemini path still needs a repeatable baseline for the requested comparison. | Keep it for the comparison, then remove it from production only after a free OpenRouter candidate passes. |
| Use a free OpenRouter model | Gives access to multiple free model choices, as the user requested. The same synthetic set can compare candidates. | JSON mode and provider support vary by model route; local validation remains mandatory, and upstream provider data practices apply. | Selected, after a candidate passes the documented test gate. No paid or other-provider fallback. |
| Use a paid schema-capable endpoint | A compatible endpoint may enforce a schema at generation time. | Adds inference cost and does not match the user's free-only requirement. Local validation would still be required. | Not selected. Reconsider only through a separate decision if no free candidate passes. |
| Host a local model | Keeps message text on the user's server and avoids per-request provider fees. | Requires local compute and model operations; it does not use the OpenRouter free model service the user selected. | Not selected for this migration. |

## What exists today

The current `src/ai.ts` uses `@google/genai` and Gemini Interactions. It sends one selected post with its timestamp, `Asia/Colombo`, and URL placeholders plus link indexes. It does not send WhatsApp IDs, actual URLs, or passcodes. It asks Gemini for JSON Schema output, then parses with strict Zod, checks dates, and checks Zoom-link indexes. It uses a 60-second timeout and does not retry the provider request.

The extractor is called by `scripts/gemini-pilot.ts` and `scripts/whatsapp-pilot.ts`. Configuration and `.env.example` still use Gemini. The tests and synthetic posts are in `test/ai.test.ts`, `test/config.test.ts`, and `test/fixtures/lecturer-posts.json`. There is no planner database or event-persistence path yet.

The approved design and implementation plan still describe Gemini. The approved design specifies `store=false` and says Google may use free-tier content to improve its products. The current code requests a schema-based Gemini response. If the migration is approved, update the provider request and record the user's acceptance of OpenRouter's selected provider route and its data practices.

The approved planner design describes failed messages staying available for retry or manual review. The current WhatsApp pilot does not do this: it logs extraction errors, and its seen-message handling can prevent a failed post from being tried again. Do not describe durable retry or manual review as an existing feature.

## Proposed behavior

### Provider request

- Call OpenRouter Chat Completions using the selected free model and `response_format: { type: "json_object" }`.
- Keep the existing single-post request and its text, timestamp, timezone, and URL-placeholder/link-index data. Do not add source IDs or batch posts.
- Keep requests non-streaming. The current app does not use streaming or tool calls.
- The user accepts the provider route OpenRouter uses for the selected free model. Require parameter support on every request, for example with `provider.require_parameters: true`. If no free route supports JSON mode, return an extraction failure. Do not fall back to a paid model, Gemini, or a local model.

Check that each candidate model and provider route supports JSON mode before including it. Require all expected properties with explicit nulls for unavailable fields. Reject malformed JSON, missing or extra properties, incorrect types, missing evidence, and invalid values with local validation. JSON Schema support depends on the selected model and provider; strict local validation remains required either way.

### Extraction fields and evidence

Use the existing `kind` field (`assignment` or `class`) as the event type. Keep `title` for the assignment title, `details` for actions or instructions, and the current `due_date`, `due_time`, `class_date`, and `class_time` fields with their existing normalized formats. Add nullable string fields `course` and `location`, `change_type: "cancelled" | "rescheduled" | null`, and `change_details: string | null`. For a rescheduled item, the due or class date/time fields contain the new schedule. A null field has no evidence. Add each unclear field to `ambiguous_fields`; retain valid but incomplete announcements as pending clarification, not as confirmed events.

For each non-null model-extracted factual field, `field_evidence` maps the field name to one or more `{ quote }` entries. Each quote must be an exact substring of both the post text seen by the model and the original local post. The model receives no WhatsApp identifiers. The app resolves the quote against the one original post and attaches its local source reference. `zoom_url` is added locally from the validated `zoom_link_index`; it is not a model-extracted field and does not need a model quote. Keep Zoom-link index validation unchanged and do not send actual URLs to obtain evidence.

The app must verify exact quote matches, evidence for every non-null factual field, and that each quote supports its field and normalized value. Check dates and times against the quoted wording and source timestamp in `Asia/Colombo`. Event type, cancellation, and rescheduling status must be supported by the quote. Treat malformed output or unverifiable evidence as an extraction failure. Keep valid but incomplete or ambiguous announcements pending clarification; do not confirm them, guess missing facts, or partially accept them as validated events. Preserve source references in app-owned context. Never use model-generated IDs or silently discard invalid evidence. A cancellation or reschedule that cannot be matched unambiguously to a local planner item stays pending; do not send other messages or source IDs to the model for matching.

The user wants accepted events to keep the evidence quotes after validation. Store quotes with the event and its application-owned source reference. Delete them from the live database when the event is deleted, and do not log them separately. Existing encrypted backups may retain deleted quotes until snapshots expire under the approved seven-daily and four-weekly rotation. Update the approved design's retention rules to include these copied message excerpts and backup limits.

### Errors and fail-safe behavior

Keep the current 60-second timeout and disabled automatic retries unless an approved design update changes them. Treat API errors, rate limits, empty responses, malformed JSON, schema errors, bad evidence, and semantic failures as extraction failures. Do not add unlimited retries or silently switch providers.

The provider adapter can return an error to the existing caller, but the current caller only logs it. A durable retry/manual-review path is a blocker before live intake relies on the approved fail-safe behavior. Until that exists, test with synthetic posts only and keep live intake disabled.

## Necessary changes if this proposal is approved

1. Add an OpenRouter test path while keeping the Gemini test path. Reuse the current extractor's injected-generator seam. Prefer Node's built-in `fetch` if it fits the supported runtime; do not add an SDK just for this request.
2. Expand the synthetic fixtures with expected values and evidence. Run Gemini and free OpenRouter candidates on the same posts and save both results. Do not use real WhatsApp messages.
3. Choose a free candidate only after it passes the model comparison and local validation rules below. Do not permit a paid model or an automatic provider fallback. After the comparison is recorded and a candidate passes, replace Gemini in the production configuration.
4. Implement the defined event and evidence contract. Keep source IDs local, verify exact quotes against the original and model-visible post, and preserve the existing Zoom-link index checks.
5. Add tests for malformed JSON, missing and extra fields, incorrect types, empty output, incomplete dates, ambiguous posts, unsupported values, invalid evidence, API failures, and rate limits. Use saved sample responses for regular automated tests so they do not call live APIs.
6. Update the README, `.env.example`, provider config, approved design, and implementation plan. Record the changed data policy, quote retention and backup limits, and the actual retry/manual-review behavior.

### Model comparison and pass rule

Score each expected field by exact normalized match against the synthetic expected answers. A candidate passes only if every expected field matches, every required evidence quote is valid, and no malformed, contradictory, ambiguous, unsupported, or incomplete result becomes a confirmed event. Ambiguous or incomplete announcements must remain pending clarification. Any wrong or unsupported date/time, missing evidence, or unexpected confirmed event fails the candidate. This requires 100% expected-field accuracy. If no candidate passes, choose no model and keep live intake disabled. If several candidates pass, use Gemma 4 31B if it passed; otherwise choose one of the passing candidates and record the tie-break reason.

## Optional, not part of this migration

- Evaluate a paid endpoint with native JSON Schema support only if the free model fails the agreed tests, and only after a separate approval. The current sources do not establish that a particular paid endpoint is selected or supported.
- Add streaming or tool calling only if a later product need requires them.
- Add another provider or local fallback only after a separate design decision. They conflict with the current free-model-only choice.

## Main risks and outdated decisions

- The approved design specifies Gemini, `store=false`, and Google's free-tier data-use policy. The current code requests a schema-based Gemini response. Update the provider-specific request and record the user's acceptance of OpenRouter's selected provider route if this migration is approved.
- OpenRouter may route to upstream model providers with different data practices. The user accepts OpenRouter's selected provider route; record that scope in the approved design and do not add unaccepted data sources.
- Exact text matches show that a quote exists; they do not show that the quote supports the normalized value. Field-specific semantic validation is required.
- Course, location, action, cancellation, and rescheduling are new event data, not just a provider swap. They must be included consistently in later storage and UI design.
- Evidence quotes are retained with events, and encrypted backups can keep deleted quotes until their snapshots expire. State this limit in the approved retention rules.
- The request says to preserve retry and manual review, but the current pilot does not provide them. This must be fixed in the appropriate planner milestone before live extraction depends on it.
- The Gemini/OpenRouter comparison is not repeatable until the synthetic fixtures include expected values and evidence for the new contract. Model outputs can vary, so exact raw-response equality is not a useful pass rule.
- Free model availability and limits can change. Do not depend on quoted latency or quota figures; check current OpenRouter terms when implementing.

## Decisions recorded

- Use the free OpenRouter model that passes the synthetic test gate. Gemma 4 31B is one candidate.
- Accept the provider route OpenRouter selects and record its data policy in the approved design.
- Store evidence quotes with accepted events; remove them from the live database when the event is deleted. Backups may retain them until snapshots expire.
- Compare Gemini and free OpenRouter candidates on the same synthetic posts. Use saved responses for regular automated tests.

Review reports: [Stage 5](egm-review-openrouter-migration/reports/zoom_out_report.md), [Stage 6](egm-review-openrouter-migration/reports/comprehension_report.md), and [Stage 7](egm-review-openrouter-migration/reports/critic_report.md).

## Official OpenRouter sources

- [Gemma 4 31B free model](https://openrouter.ai/google/gemma-4-31b-it:free): one candidate, with its current model listing and provider routes.
- [Structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs): JSON and JSON Schema support by model and provider.
- [Chat Completions API](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion): request and response shape.
- [Provider routing](https://openrouter.ai/docs/guides/routing/provider-selection): provider selection and parameter support.
- [OpenRouter privacy policy](https://openrouter.ai/privacy): handling of prompts and upstream provider policies.
- [OpenRouter pricing](https://openrouter.ai/pricing): current pricing and free-tier limits.
