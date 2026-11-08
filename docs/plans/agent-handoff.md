# Agent Handoff

**Updated:** 2026-11-08
**Repository:** `lecture-manager`
**Branch:** `main`

Use this note to continue the approved OpenRouter migration. The EGM brainstorm, draft, review, and resolution stages are already complete. Do not restart those stages or replace the approved design.

## Verified project state

- The user approved the revised design on 2026-11-08. Migration Milestones 1-3 (design reconciliation, local schema/evidence validation, and OpenRouter adapter) are complete.
- Gemini remains available for comparison. The OpenRouter adapter is implemented, but no free model has been selected and no live comparison has run.
- `src/ai.ts` validates the strict extraction shape, field evidence, exact quotes, supported values, dates, times, and Zoom link indexes before returning results. Source IDs remain application-owned.
- `scripts/whatsapp-pilot.ts` tests message intake only. It makes no AI calls. Its duplicate tracking is in memory and is not durable.
- There is no planner database or event persistence path. Keep live intake disabled until durable failure retention, pending review, and provenance are implemented.
- The browser GUI and Zoom worker are design/planning work; they are not implemented.
- The latest implementation check ran `npm test`: TypeScript build passed and all 31 tests passed. Mocked OpenRouter tests cover request shape, privacy, free-model restriction, one-attempt behavior, timeout, and API response failures. No live Gemini/OpenRouter quality test, WhatsApp reconnect test, or Zoom test has run.
- `README.md` is stale: it says there is no source code or test command. The implementation plan schedules that documentation correction for a later operations-documentation milestone.
- A separate resolution-report file was not found. Review dispositions are summarized in `docs/plans/student-planner-implementation.md` and the Goldfish reports.

Implementation through Milestone 2 is recorded at commit `0145aeb`. Recheck `git status` and `git log` before making changes.

## Approved decisions to preserve

- OpenRouter was chosen because the user wants a free option. Choose a model only after it passes the synthetic comparison. `google/gemma-4-31b-it:free` is a candidate, not a final selection.
- Use one lecturer post per OpenRouter request and JSON object mode. Require `provider.require_parameters: true`; do not rely on provider-side JSON Schema enforcement.
- Keep strict local Zod, evidence, semantic, date, and Zoom-link validation. Invalid, incomplete, unsupported, contradictory, or unverifiable output must not become a confirmed event.
- Require exact field-level quotes for every non-null factual field. Verify quotes against the original local post and the sanitized model-visible text. Do not send WhatsApp message, group, or sender IDs, actual URLs, or passcodes to OpenRouter.
- Preserve Asia/Colombo handling, the 60-second timeout, one attempt, and the existing fail-safe behavior. Do not add retry loops, paid/Gemini/local runtime fallback, or silent provider switching.
- Use synthetic fixtures for model comparisons. Do not send real WhatsApp posts to model candidates.
- Existing English/ISO date and English field-term checks fail closed for unsupported languages or formats. Add synthetic fixtures for the languages lecturers use before model selection.

## Next work: Migration Milestone 4

Read the approved [design](../designs/student-planner.md) and [OpenRouter migration plan](openrouter-migration-implementation.md), then run the synthetic comparison milestone:

1. Run Gemini and shortlisted free OpenRouter models on the same saved synthetic fixtures. The Gemini pilot previously ended early with timeouts and HTTP 503 responses, so do not treat it as a completed baseline.
2. Record model IDs, provider routes, fixture outcomes, errors, and per-field scores. Send no real WhatsApp content. Keep one request per fixture, 60-second timeout, and no retry loops.
3. Require every expected field to match, all non-null facts to have valid evidence, and zero unsupported, ambiguous, incomplete, or contradictory item to be confirmed. Select no model if a required run is incomplete or fails.
4. If credentials are unavailable, stop at the synthetic harness and report the comparison as pending. Do not read or print `.env` contents.
5. Update the plans and this handoff with results before moving to Milestone 5.

Do not select or cut over to a production model unless the comparison passes. Do not change live WhatsApp intake or run the WhatsApp pilot against a live subject group.

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

> Continue the existing OpenRouter migration from `docs/plans/agent-handoff.md`. Read the handoff, approved design, migration plan, overall implementation plan, and repository instructions. Do not repeat EGM. Continue with Migration Milestone 4 using synthetic fixtures only, preserve all approved privacy and fail-safe constraints, record exact comparison results, and update the handoff as work progresses. Do not enable live WhatsApp intake.
