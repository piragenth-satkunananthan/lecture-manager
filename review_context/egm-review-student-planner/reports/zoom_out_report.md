# Goldfish Review Report

**Target:** `/home/piragenth/Documents/lecture-manager/docs/designs/student-planner.md` (full file, lines 1-294)

## Reviewer Status

| Reviewer | Status |
| --- | --- |
| `zoom_out` | completed after one retry |
| `inventive_catalyst` | completed |

## Prioritized Findings (Blockers -> Major -> Nits)

### Implementation inventory would recreate existing files - Severity: Major

* **Reviewer Lens:** `zoom_out`
* **Affected Scope:** Lines 172-220 and 267-276
* **Discrepancy Description:** The target labels several existing files as "Create," including `package.json`, `tsconfig.json`, `package-lock.json`, `.env.example`, `src/config.ts`, `src/whatsapp.ts`, `src/ai.ts`, `test/whatsapp.test.ts`, and `test/fixtures/lecturer-posts.json`. It also lists `test/extraction.test.ts`, while the existing extraction tests are in `test/ai.test.ts`. Line 271 repeats the "Proposed Changes" bullet from line 270.
* **Rationale & Recommendation:** This conflicts with the plan’s stated intent to extend the existing Node.js and OpenRouter foundation and could lead an implementer to replace or duplicate working code. Mark existing paths as “Modify” and describe what to extend; reserve “Create” for missing planner components, and align the test inventory with the current suite. Remove the duplicated test bullet.

### Fixture criteria do not bound supported lecturer languages and date formats - Severity: Major

* **Reviewer Lens:** `inventive_catalyst`
* **Affected Scope:** Lines 68-69, 164, and 287-290
* **Discrepancy Description:** The design requires 100% accuracy on synthetic fixtures and strict semantic/date validation, but does not say which languages or date formats those fixtures cover. The implementation context describes English field terms and English or ISO dates; a narrow fixture set could pass while ordinary lecturer posts in other formats remain unprocessable.
* **Rationale & Recommendation:** Define the supported source languages and date formats, and include synthetic fixtures representative of the lecturer posts before selecting a model. Keep unsupported posts pending for manual review and do not treat a model as qualified for inputs outside the tested scope.

## Severity Breakdown

| Blocker | Major | Nit |
| ---: | ---: | ---: |
| 0 | 2 | 0 |

## Review Completeness

Both reviewers read the full target and the supplied Markdown context. `zoom_out` searched the repository for reusable configuration, WhatsApp intake, OpenRouter extraction, fixtures, tests, and planner-related components. It found existing configuration, intake, extraction, comparison tooling, fixtures, and tests, but no planner database, calendar, reminder scheduler, application server, browser UI, or Zoom worker. `inventive_catalyst` reviewed the source-page content extracted from all supplied HTML captures. The Zoom bot-controls HTML is a loading shell; the rendered-text companion and current-page summary were also reviewed.

This was a read-only design review. No tests, live model calls, WhatsApp pilot, or Zoom pilot were run.
