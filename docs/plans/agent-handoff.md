# Agent Handoff

**Updated:** 2026-11-08
**Repository:** `lecture-manager`
**Branch and implementation commit:** `main`, `0145aeb` (`feat: validate extracted fields with source evidence`)

Use this note to continue the approved OpenRouter migration. The EGM brainstorm, draft, review, and resolution stages are already complete. Do not restart those stages or replace the approved design.

## Verified project state

- The user approved the revised design on 2026-11-08. Migration Milestone 1 (design reconciliation) and Milestone 2 (local schema and evidence validation) are complete.
- The current code still uses Gemini. There is no OpenRouter adapter and no free model has been selected.
- `src/ai.ts` validates the strict extraction shape, field evidence, exact quotes, supported values, dates, times, and Zoom link indexes before returning results. Source IDs remain application-owned.
- `scripts/whatsapp-pilot.ts` tests message intake only. It makes no AI calls. Its duplicate tracking is in memory and is not durable.
- There is no planner database or event persistence path. Keep live intake disabled until durable failure retention, pending review, and provenance are implemented.
- The browser GUI and Zoom worker are design/planning work; they are not implemented.
- The last implementation check ran `npm test`: TypeScript build passed and all 26 tests passed. It did not test live Gemini/OpenRouter quality, WhatsApp reconnect recovery, or Zoom behavior.
- `README.md` is stale: it says there is no source code or test command. The implementation plan schedules that documentation correction for a later operations-documentation milestone.
- A separate resolution-report file was not found. Review dispositions are summarized in `docs/plans/student-planner-implementation.md` and the Goldfish reports.

The working tree was clean at commit `0145aeb` before this handoff document was added. Recheck `git status` before making changes.

## Approved decisions to preserve

- OpenRouter was chosen because the user wants a free option. Choose a model only after it passes the synthetic comparison. `google/gemma-4-31b-it:free` is a candidate, not a final selection.
- Use one lecturer post per OpenRouter request and JSON object mode. Require `provider.require_parameters: true`; do not rely on provider-side JSON Schema enforcement.
- Keep strict local Zod, evidence, semantic, date, and Zoom-link validation. Invalid, incomplete, unsupported, contradictory, or unverifiable output must not become a confirmed event.
- Require exact field-level quotes for every non-null factual field. Verify quotes against the original local post and the sanitized model-visible text. Do not send WhatsApp message, group, or sender IDs, actual URLs, or passcodes to OpenRouter.
- Preserve Asia/Colombo handling, the 60-second timeout, one attempt, and the existing fail-safe behavior. Do not add retry loops, paid/Gemini/local runtime fallback, or silent provider switching.
- Use synthetic fixtures for model comparisons. Do not send real WhatsApp posts to model candidates.
- Existing English/ISO date and English field-term checks fail closed for unsupported languages or formats. Add synthetic fixtures for the languages lecturers use before model selection.

## Next work: Migration Milestone 3

Read the approved [design](../designs/student-planner.md) and [OpenRouter migration plan](openrouter-migration-implementation.md), then implement only the adapter milestone:

1. Add a non-streaming OpenRouter Chat Completions adapter using the current Node `fetch` support and the existing injected-generator test seam. Avoid adding an SDK solely for this request.
2. Keep extraction and all local validation shared. Retain the Gemini adapter for the required comparison.
3. Send only the selected post text, timestamp, timezone, URL placeholders, and link indexes. Request JSON object mode and `provider.require_parameters: true` on every request.
4. Enforce one request with a 60-second timeout and no automatic retry. Handle authentication, rate-limit, timeout, empty, malformed, and upstream error responses as extraction failures. Do not log message text, evidence quotes, keys, or links.
5. Add mocked tests for request shape, model ID, JSON mode, provider requirements, timeout, error cases, and excluded sensitive data. Run `npm test` and update the migration plan only after the milestone passes.

Do not begin the synthetic provider comparison, select a production model, change live WhatsApp intake, or perform production cutover as part of Milestone 3. Those are later gates in the migration plan. Do not configure or run the WhatsApp pilot against a live subject group.

## EGM and planning files

- Approved design: [`../designs/student-planner.md`](../designs/student-planner.md)
- Provider migration plan: [`openrouter-migration-implementation.md`](openrouter-migration-implementation.md)
- Overall implementation plan: [`student-planner-implementation.md`](student-planner-implementation.md)
- Historical migration brief: [`../../openrouter_migration_brief.md`](../../openrouter_migration_brief.md)
- Original concept brief: [`../../concepts_brief.md`](../../concepts_brief.md)
- Resolved draft: [`../../design_draft.md`](../../design_draft.md)
- Root Goldfish review: [`../../goldfish_review_report.md`](../../goldfish_review_report.md)
- Consolidated EGM review: [`../../consolidated_review_report.md`](../../consolidated_review_report.md)
- OpenRouter migration review reports: [`../../egm-review-openrouter-migration/reports/`](../../egm-review-openrouter-migration/reports/)

There is no repository `AGENTS.md` in the current file listing. Follow the user's project instructions for repository work and check the working tree before editing.

## Suggested restart prompt

> Continue the existing OpenRouter migration from `docs/plans/agent-handoff.md`. Read the handoff, approved design, migration plan, overall implementation plan, and repository instructions. Do not repeat EGM. Implement only Migration Milestone 3, preserve all approved privacy and fail-safe constraints, add mocked adapter tests, run `npm test`, update the plan, and commit the completed milestone. Do not make live model calls or enable live WhatsApp intake.
