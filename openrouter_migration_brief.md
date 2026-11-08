# OpenRouter Migration Proposal

* **Date:** 2026-11-08
* **Status:** Brainstorm proposal for user review. This is not an approved design change.
* **Scope:** Change the AI provider and add the requested field-level evidence. Do not change application code in this step.

## Recommendation

The user chose OpenRouter to access its free models and is open to using whichever free model works best for this project. Gemma 4 31B remains a candidate, not a fixed choice. Choose a model using synthetic lecturer-message tests before enabling live intake. Keep the request to one lecturer post. Keep strict Zod, date, evidence, and Zoom-link checks in the application. Send no WhatsApp message, group, or sender IDs to OpenRouter. The app should attach its local source reference only after validation succeeds.

Do not send live intake through this migration until the provider and data policy are recorded in the approved design, the new extraction contract is defined, and the failure path can retain work for retry or review. The current pilot does not have that durable failure path.

## What exists today

The current `src/ai.ts` uses `@google/genai` and Gemini Interactions. It sends one selected post with its timestamp, `Asia/Colombo`, and URL placeholders plus link indexes. It does not send WhatsApp IDs, actual URLs, or passcodes. It asks Gemini for JSON Schema output, then parses with strict Zod, checks dates, and checks Zoom-link indexes. It uses a 60-second timeout and does not retry the provider request.

The extractor is called by `scripts/gemini-pilot.ts` and `scripts/whatsapp-pilot.ts`. Configuration and `.env.example` still use Gemini. The tests and synthetic posts are in `test/ai.test.ts`, `test/config.test.ts`, and `test/fixtures/lecturer-posts.json`. There is no planner database or event-persistence path yet.

The approved design and implementation plan still describe Gemini. The approved design also has stricter language about provider data retention and model training. The user has since said OpenRouter or Google may keep or use submitted text. The documents must record that policy change before implementation.

The approved planner design describes failed messages staying available for retry or manual review. The current WhatsApp pilot does not do this: it logs extraction errors, and its seen-message handling can prevent a failed post from being tried again. Do not describe durable retry or manual review as an existing feature.

## Proposed behavior

### Provider request

- Call OpenRouter Chat Completions using the selected free model and `response_format: { type: "json_object" }`.
- Keep the existing single-post request and its text, timestamp, timezone, and URL-placeholder/link-index data. Do not add source IDs or batch posts.
- Keep requests non-streaming. The current app does not use streaming or tool calls.
- The user accepts the provider route OpenRouter uses for the selected free model. If no free route is available, return an extraction failure. Do not fall back to a paid model, Gemini, or a local model.

Check that each candidate model and provider route supports JSON mode before including it. JSON Schema support depends on the selected model and provider, so always reject malformed JSON, missing or extra properties, incorrect types, missing evidence, and invalid values with local validation. A model response is never trusted just because it is valid JSON.

### Extraction fields and evidence

Keep the existing strict Zod validation and add the user-requested fields for event type, course, assignment title and deadline, lecture date and time, location, action or instruction, and cancellation or rescheduling. Define how each field relates to the current `kind` field (`assignment` or `class`), its type, and when it is null before implementation. These fields expand the approved event contract and may affect the later database and UI.

Each non-null factual field must have one or more `field_evidence` quotes. A quote must be an exact substring of both the post text seen by the model and the original local post. This means the model cannot cite a redacted URL placeholder as if it were text from the original post. Keep Zoom URL index validation as it is; do not send actual URLs to obtain evidence.

The app must verify quote matches, field coverage, value-to-evidence meaning, dates against the original date wording and message timestamp, and Asia/Colombo timezone handling. Reject unsupported, contradictory, incomplete, or unverifiable results. Preserve source references in app-owned context. Never use model-generated IDs, invent evidence, silently drop invalid evidence, or accept part of an invalid event.

The user wants accepted events to keep the evidence quotes after validation. Store the quotes with the validated event and its application-owned source reference. Proposed retention: keep them as long as the event, and delete them when the event is deleted. Do not log them separately. Update the approved design's retention rules to include these copied message excerpts.

### Errors and fail-safe behavior

Keep the current one-attempt, bounded-time request behavior unless a reviewed decision changes it. Treat API errors, rate limits, empty responses, malformed JSON, schema errors, bad evidence, and semantic failures as extraction failures. Do not add unlimited retries or silently switch providers.

The provider adapter can return an error to the existing caller, but the current caller only logs it. A durable retry/manual-review path is a blocker before live intake relies on the approved fail-safe behavior. Until that exists, test with synthetic posts only and keep live intake disabled.

## Necessary changes if this proposal is approved

1. Replace Gemini request and configuration with OpenRouter. Reuse the existing extractor and injected-generator test seam. Prefer Node's built-in `fetch` if it fits the supported runtime; do not add an SDK just for this request.
2. Select the free model that best meets the agreed synthetic test results. Do not permit a paid model. Use the provider route OpenRouter selects; if no free route is available, fail closed.
3. Define the complete event and evidence schema, including field types, null rules, relationships, ambiguity behavior, and semantic checks. Resolve the meaning of the existing `kind` field.
4. Verify exact quotes locally against the original post and model-visible text. Keep source IDs local and preserve the existing URL-index checks.
5. Add tests for malformed JSON, missing and extra fields, incorrect types, empty output, incomplete dates, ambiguous posts, unsupported values, invalid evidence, API failures, and rate limits.
6. Use the same synthetic dataset for Gemini and free OpenRouter candidates. Add an expected answer for each synthetic post, then run both models on the same posts and score each against those answers. The user agreed to this comparison. Use saved sample responses for normal automated tests so tests do not need live API calls. The current fixtures do not include the new fields or evidence, and the earlier Gemini pilot did not produce a complete recorded baseline. Do not use real WhatsApp messages.
7. Update the README, `.env.example`, provider config, approved design, and implementation plan. Record the changed data policy and the actual retry/manual-review behavior.

## Optional, not part of this migration

- Evaluate a paid endpoint with native JSON Schema support only if the free model fails the agreed tests, and only after a separate approval. The current sources do not establish that a particular paid endpoint is selected or supported.
- Add streaming or tool calling only if a later product need requires them.
- Add another provider or local fallback only after a separate design decision. They conflict with the current free-model-only choice.

## Main risks and outdated decisions

- The approved design names Gemini and assumes Gemini-specific JSON Schema output. Both decisions are outdated if this migration is approved.
- The approved hosted-provider data policy conflicts with the user's later acceptance that OpenRouter or its selected model provider may keep or use lecturer text. The user accepts OpenRouter's provider route. Record this data policy change in the approved design.
- Exact text matches show that a quote exists; they do not show that the quote supports the normalized value. Field-specific semantic validation is required.
- Course, location, action, cancellation, and rescheduling are new event data, not just a provider swap. They must be included consistently in later storage and UI design.
- The request says to preserve retry and manual review, but the current pilot does not provide them. This must be fixed in the appropriate planner milestone before live extraction depends on it.
- The Gemini/OpenRouter comparison is not repeatable until the synthetic fixtures include expected values and evidence for the new contract. Model outputs can vary, so exact raw-response equality is not a useful pass rule.
- Free model availability and limits can change. Do not depend on quoted latency or quota figures; check current OpenRouter terms when implementing.

## Goldfish review summary

Seven review lenses checked the proposal against the approved design, current code, and OpenRouter documentation. They agreed on the need to resolve provider/data-policy changes, define the expanded schema before coding, protect evidence quotes from retention and logs, pin free-only routing, describe real failure behavior, and make the synthetic comparison repeatable. No reviewer proposed changing the single-post or local-source-reference decisions.

The reviews challenge several assumptions in the draft: the current pilot does not retry failed posts; the new fields widen the event contract; a quote alone does not prove a value; URL redaction can make a model quote unverifiable; and OpenRouter's live performance and quota figures should not be treated as stable. The user wants the best fitting free OpenRouter model, accepts the provider route OpenRouter uses, wants evidence quotes stored with accepted events, and agrees to compare models on the same synthetic posts.

## Choices recorded in this brainstorm

- Use the free OpenRouter model that scores best on the shared synthetic test set. Gemma 4 31B is one candidate.
- Accept the provider route OpenRouter selects. Record this data policy in the approved design.
- Store evidence quotes with accepted events. Proposed deletion: remove the quotes when the event is deleted.
- Compare Gemini and free OpenRouter candidates on the same synthetic posts. Use saved responses for regular automated tests.

## Official OpenRouter sources

- [Gemma 4 31B free model](https://openrouter.ai/google/gemma-4-31b-it:free): one candidate, with its current model listing and provider routes.
- [Structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs): JSON and JSON Schema support by model and provider.
- [Chat Completions API](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion): request and response shape.
- [Provider routing](https://openrouter.ai/docs/guides/routing/provider-selection): provider selection and parameter support.
- [OpenRouter privacy policy](https://openrouter.ai/privacy): handling of prompts and upstream provider policies.
- [OpenRouter pricing](https://openrouter.ai/pricing): current pricing and free-tier limits.
