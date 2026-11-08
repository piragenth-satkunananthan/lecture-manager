# Stage 9: Implementation Readiness Review

**Target:** `/home/piragenth/Documents/lecture-manager/docs/designs/student-planner.md` — Detailed Implementation Plan, lines 156–294

## Reviewer Status

| Reviewer | Status | Standard |
| --- | --- | --- |
| `implementation_readiness` | completed | `implementation-readiness-standard.md` |
| `codebase_details` | completed | `implementation-readiness-standard.md` |
| `style` | completed | none assigned |

All three reviewers ran in fresh contexts with `fork_turns: "none"`. No reviewer required a retry.

## Prioritized Findings

### Existing web service is claimed but absent — Severity: Blocker

* **Finding ID:** `codebase_details-9-1`
* **Reviewer Lens:** `codebase_details`; corroborated by `implementation_readiness` and `style`
* **Affected Scope:** Line 158
* **Discrepancy:** The plan says to extend an “existing single-user web service.” The repository has a Node.js/TypeScript foundation and extraction/intake pilots, but no planner server or browser interface. `package.json` has no Fastify or SQLite dependency or application start script, and the README says the planner database, GUI, reminders, live intake, and Zoom worker are not implemented.
* **Rationale & Recommendation:** This is a false current-state claim that can mislead every implementer. Describe the work as extending the existing foundation into a single-user web service.

### File and dependency inventory marks existing files for creation — Severity: Major

* **Finding ID:** `codebase_details-9-2`
* **Reviewer Lens:** `codebase_details`, `implementation_readiness`
* **Affected Scope:** Lines 172–220 and 267–276
* **Discrepancy:** The plan labels existing paths as **Create**, including `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `src/config.ts`, `src/whatsapp.ts`, `src/ai.ts`, `test/whatsapp.test.ts`, and `test/fixtures/lecturer-posts.json`. It names `test/extraction.test.ts`, while extraction coverage exists in `test/ai.test.ts` and `test/openrouter.test.ts`. Existing callers include the comparison pilot and AI/OpenRouter tests for `createOpenRouterAnnouncementExtractor`, and the WhatsApp pilot/tests for `selectLecturerPosts`.
* **Rationale & Recommendation:** A stale write inventory risks replacing working code or duplicating tests. Mark existing paths **Modify**, identify the intended extensions, correct test paths, and specify the dependency choices and caller compatibility requirements.

### Baileys version used for the pilot is unspecified — Severity: Major

* **Finding ID:** `codebase_details-9-3`
* **Reviewer Lens:** `codebase_details`
* **Affected Scope:** Lines 158 and 212–215
* **Discrepancy:** The rationale calls Baileys a stable package, while the existing manifest and lockfile pin `@whiskeysockets/baileys` to `7.0.0-rc14`. The plan does not identify the exact version to pilot or use for deployment.
* **Rationale & Recommendation:** Pilot results only establish behavior for the tested version. Name the version for the pilot and deployment, and ensure the test and live client use that same version.

### Selected free model has no runtime configuration contract — Severity: Major

* **Finding ID:** `codebase_details-9-4`
* **Reviewer Lens:** `codebase_details`
* **Affected Scope:** Lines 160, 195, 205, and 217–220
* **Discrepancy:** The plan requires choosing a free model after comparison, but current `AppConfig` and `.env.example` have no model setting, and extraction has no production wiring. `src/ai.ts` accepts a model through `OpenRouterConfig`; the comparison pilot is the current caller.
* **Rationale & Recommendation:** Specify how the passing model is pinned and supplied to extraction, including the setting or constant and the disabled behavior when no candidate passes.

### Persisted record keys and relationships are incomplete — Severity: Major

* **Finding ID:** `implementation_readiness-9-2`
* **Reviewer Lens:** `implementation_readiness`
* **Affected Scope:** Lines 207–210, 225, 230, 240, and 245
* **Discrepancy:** The database section names tables and some item fields but does not define keys and relationships for clarifications, reminder deliveries, Zoom jobs, and recording metadata. It requires a unique reminder key without defining how that key is formed.
* **Rationale & Recommendation:** These choices affect replay, edits, reminder deduplication, deletion, and recovery. Specify the fields, keys, relationships, and constraints for each persisted record.

### Browser and worker API contracts are incomplete — Severity: Major

* **Finding ID:** `implementation_readiness-9-3`
* **Reviewer Lens:** `implementation_readiness`
* **Affected Scope:** Lines 245–250
* **Discrepancy:** The plan names agent claim, heartbeat, and status routes but omits heartbeat/status request and response schemas, allowed state transitions, and error behavior. It also requires clarification answers, manual corrections/cancellations, and recording deletion without defining the browser API routes or payloads.
* **Rationale & Recommendation:** The implementer must design interfaces that the plan should settle. Specify route contracts, validation and authorization behavior, error responses, and allowed job-state transitions.

### Failed-post retention and retry behavior conflict with the raw-text rule — Severity: Major

* **Finding ID:** `implementation_readiness-9-4`
* **Reviewer Lens:** `implementation_readiness`; retry wording also noted by `style`
* **Affected Scope:** Lines 160, 164–165, 210, 220, 250, and 287
* **Discrepancy:** The plan retains failed posts for retry or manual review, but says raw message text is kept only while clarification is pending. It does not say whether failed extraction enters that state, how long text remains, who reviews or deletes it, or whether retry is user-triggered. The pilot separately specifies one attempt with no automatic retry.
* **Rationale & Recommendation:** Define the failed-post state, review and retry flow, retry actor, and raw-text deletion rule so retention cannot become indefinite and the live-intake gate is implementable.

### Overdue archive choice has no defined outcome — Severity: Major

* **Finding ID:** `implementation_readiness-9-5`
* **Reviewer Lens:** `implementation_readiness`, `codebase_details`
* **Affected Scope:** Lines 165, 210, 225, and 250
* **Discrepancy:** The student may keep an overdue assignment or archive it, but the listed item states do not include an archived state and the plan does not say whether archiving hides, retains, or deletes the item.
* **Rationale & Recommendation:** Define the archived representation and effects on display, reminders, and retention, or remove “archive” from the user choice.

### Upstream provider data practices have no acceptance policy — Severity: Major

* **Finding ID:** `implementation_readiness-9-6`
* **Reviewer Lens:** `implementation_readiness`, `style`
* **Affected Scope:** Lines 160, 164, 220, 281, and 287
* **Discrepancy:** The plan says OpenRouter may route posts to an upstream provider and its data practices apply, but only requires omitting identifiers, URLs, and passcodes. It does not decide which provider practices are acceptable or what happens if no free route meets the policy. The supplied provider-routing material documents data-collection controls.
* **Rationale & Recommendation:** State the accepted route policy and fail-closed behavior, or explicitly define the user's decision at model/provider selection. A data-use notice alone does not constrain routing.

### Per-class permission and admission checks lack a defined input and stored state — Severity: Major

* **Finding ID:** `implementation_readiness-9-7`
* **Reviewer Lens:** `implementation_readiness`
* **Affected Scope:** Lines 165–167, 207–210, 237–260, and 288–290
* **Discrepancy:** Zoom jobs require confirmed permission, but the item schema and UI do not define how permission is confirmed or stored. “Verify admission through the configured account and host settings” also does not define the signals that satisfy admission verification.
* **Rationale & Recommendation:** Define the per-class confirmation flow or field, what evidence the worker checks, and the fail-closed result when permission or admission is unknown.

### Webtop and HTTPS deployment choices remain open — Severity: Major

* **Finding ID:** `implementation_readiness-9-8`
* **Reviewer Lens:** `implementation_readiness`
* **Affected Scope:** Lines 200, 245, and 252–260
* **Discrepancy:** The plan does not select a Webtop image tag or desktop session although capture depends on X11, `xdotool`, and PulseAudio. It requires HTTPS but does not say where TLS terminates or how certificates are provided; the overall implementation plan records TLS/certificate provisioning as unresolved.
* **Rationale & Recommendation:** Specify the Webtop image/session and capture environment, plus the HTTPS and certificate path, before deployment work begins.

### Backup implementation boundary and key handling are missing — Severity: Major

* **Finding ID:** `implementation_readiness-9-9`
* **Reviewer Lens:** `implementation_readiness`
* **Affected Scope:** Lines 168, 195, 197–210, 281, and 289
* **Discrepancy:** The plan requires daily encrypted online backups to separate storage but does not specify a destination, encryption-key handling, configuration, or which file/process performs the scheduled backup.
* **Rationale & Recommendation:** Add the backup implementation to the file boundary and specify its destination, key configuration, rotation, and restore procedure.

### WhatsApp pilot has no explicit pass threshold — Severity: Major

* **Finding ID:** `implementation_readiness-9-10`
* **Reviewer Lens:** `implementation_readiness`
* **Affected Scope:** Lines 164, 215, 287, and 290
* **Discrepancy:** The plan says to test or verify recovery, filtering, edits, duplicates, and restarts but does not state the expected outcomes that constitute a pass.
* **Rationale & Recommendation:** Define observable pilot criteria, including eligible-message recovery after disconnect/restart without loss or duplicate planner items, and rejection of untrusted groups and senders.

### Test coverage is specified twice — Severity: Nit

* **Finding ID:** `implementation_readiness-9-11`
* **Reviewer Lens:** `implementation_readiness`, `codebase_details`, `style`
* **Affected Scope:** Lines 267–271
* **Discrepancy:** Two adjacent “Proposed Changes” bullets overlap; the second expands the first without saying whether it replaces or supplements it.
* **Rationale & Recommendation:** Combine them into one definitive test specification.

### “Plain” does not define an interface requirement — Severity: Nit

* **Finding ID:** `style-9-1`
* **Reviewer Lens:** `style`
* **Affected Scope:** Line 158
* **Discrepancy:** “Plain” is subjective and adds no measurable interface requirement.
* **Rationale & Recommendation:** Remove it; “responsive browser interface” states the requirement directly.

## Severity Breakdown

| Blocker | Major | Nit |
| ---: | ---: | ---: |
| 1 | 12 | 2 |

## Read Confirmations and Limits

All three reviewers read their assigned personas and the target range, lines 156–294. `implementation_readiness` and `codebase_details` read the implementation-readiness standard; `style` had no separate standard. Each read all four Stage 5–8 reports: `zoom_out_report.md`, `comprehension_report.md`, `critic_report.md`, and `intermediate_zoom_out_report.md`.

Each reviewer confirmed the 16 project/design Markdown files: `2026-11-07_DRIFT_REPORT.md`, `README.md`, `comprehension_report.md`, `concepts_brief.md`, `consolidated_review_report.md`, `critic_report.md`, `design_draft.md`, `docs/designs/student-planner.md` (target range only), `docs/plans/agent-handoff.md`, `docs/plans/openrouter-migration-implementation.md`, `docs/plans/student-planner-implementation.md`, `goldfish_review_report.md`, `implementation_readiness_report.md`, `intermediate_zoom_out_report.md`, `openrouter_migration_brief.md`, and `zoom_out_report.md`.

All reviewers inspected implementation-relevant sections in the 12 raw HTML sources and 12 readable extracts: Baileys installation, Gemma, LinuxServer Webtop, Node.js releases, OpenRouter Chat Completions, privacy, provider routing and structured outputs, WhatsApp Terms, whatsapp-web.js, Zoom bot controls, and the Zoom Linux Meeting SDK. They also read the Zoom-controls current summary and rendered-text companion. The Zoom bot-controls HTML is a loading shell; reviewers used the summary and rendered companion for its article content.

`codebase_details` additionally inspected current `src/` and `scripts/` files, package/config files, tests and fixtures, and traced relevant callers and APIs. Source pages were reviewed only in sections relevant to implementation constraints, not end to end. Unrelated sections and runtime behavior were not checked. No required file was reported inaccessible. No files were edited by reviewers and no tests were run.

**Review limit:** Findings address the bounded implementation-plan range and the supplied context; unrelated source-page sections and runtime behavior remain unreviewed.
