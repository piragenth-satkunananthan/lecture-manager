# Stage 7 Critic Review Report

**Target:** `/home/piragenth/Documents/lecture-manager/docs/designs/student-planner.md` (lines 1–155)

**Mode:** REVIEW. All reviewers ran in fresh contexts. The first attempts reported context-reading gaps; each reviewer was retried once. Status below reflects the final retry.

## Reviewer Status

| Reviewer | Status |
| --- | --- |
| `design_critic` | Completed on one retry |
| `structural` | Completed on one retry |
| `style` | Completed on one retry |

## Summary

| Severity | Count |
| --- | ---: |
| Blocker | 0 |
| Major | 3 |
| Nit | 5 |

## Prioritized Findings

### Upstream provider privacy policy is not constrained — Severity: Major

* **Finding ID:** `design_critic-1-1`
* **Reviewer Lens:** `design_critic`
* **Affected Scope:** Lines 68, 136–138
* **Discrepancy Description:** The design sends lecturer posts to an automatically selected upstream provider and acknowledges that its data practices apply, but it does not constrain routing to providers that avoid collecting or using inputs for training. `provider.require_parameters: true` concerns parameter support, not privacy. Removing WhatsApp identifiers and links does not remove personal details that may appear in a post.
* **Rationale & Recommendation:** Lecturer posts can contain personal information about the student or other group members. Define an input-data policy and enforce it, for example by selecting only eligible routes or requiring review/redaction for posts containing personal information. Keep extraction disabled if no free route meets that policy, and include other people’s information in the decision.

### Model-provider alternatives are not evaluated — Severity: Major

* **Finding ID:** `design_critic-1-2`
* **Reviewer Lens:** `design_critic`
* **Affected Scope:** Lines 68, 102–132
* **Discrepancy Description:** OpenRouter is the only model provider, and paid or local fallbacks are excluded, but the Alternatives Considered section does not evaluate inference options or manual review.
* **Rationale & Recommendation:** The feature-spec standard requires documented alternatives and concrete trade-offs. Add a concise comparison of free hosted inference, local extraction, and manual review, including privacy and availability costs and the existing decision to leave extraction disabled if no free candidate passes.

### Failed-post retention lifecycle is unclear — Severity: Major

* **Finding ID:** `design_critic-1-3`
* **Reviewer Lens:** `design_critic`
* **Affected Scope:** Lines 70–71, 136, 138
* **Discrepancy Description:** Raw message text is retained only while clarification is pending, while failed extractions are also retained for retry or manual review. The design does not define whether failed posts enter a pending state or when their raw text is deleted.
* **Rationale & Recommendation:** This leaves a possible indefinite-retention path for private WhatsApp content. Define the failed-post state, who can review or delete it, and its retention limit, then align that lifecycle with the clarification-only rule.

### Pilot success criteria use subjective terms — Severity: Nit

* **Finding ID:** `style-1-1`
* **Reviewer Lens:** `style`
* **Affected Scope:** Lines 36–38
* **Discrepancy Description:** “Reliably enough,” “reliably,” and “usable” leave the intake and recording pilot questions subjective.
* **Rationale & Recommendation:** Concrete verification criteria appear later in the design, including extraction accuracy and host-end detection time. Refer to those criteria or state observable pass conditions directly in these questions.

### Alternatives use inconsistent second-person voice — Severity: Nit

* **Finding ID:** `style-1-2`
* **Reviewer Lens:** `style`
* **Affected Scope:** Lines 106, 120, 126
* **Discrepancy Description:** “You control,” “you selected,” and the imperative “Revisit it” shift into second person while nearby alternatives use a neutral voice.
* **Rationale & Recommendation:** Use a consistent neutral subject throughout the alternatives section.

### Baileys alternative repeats its maintenance rationale — Severity: Nit

* **Finding ID:** `style-1-3`
* **Reviewer Lens:** `style`
* **Affected Scope:** Lines 113–114
* **Discrepancy Description:** The cons and the rejection reason both say that maintaining two clients adds work without a stated need.
* **Rationale & Recommendation:** Keep the maintenance cost in one place and use the rejection reason to state the pilot-based selection rule.

### Pilot sentence repeats “tests” — Severity: Nit

* **Finding ID:** `style-1-4`
* **Reviewer Lens:** `style`
* **Affected Scope:** Line 67
* **Discrepancy Description:** “The one-group pilot tests Baileys first and tests whatsapp-web.js…” repeats the same verb awkwardly.
* **Rationale & Recommendation:** Use “The one-group pilot starts with Baileys and tries whatsapp-web.js only if Baileys fails.”

### Supported message languages and date formats are unstated — Severity: Nit

* **Finding ID:** `design_critic-1-4`
* **Reviewer Lens:** `design_critic`
* **Affected Scope:** Lines 37, 68–71
* **Discrepancy Description:** The feature specification does not say which message languages and date formats extraction supports. The implementation plan indicates semantic checks recognize English field terms and English/ISO dates, while other forms fail closed.
* **Rationale & Recommendation:** State supported languages and formats and require representative synthetic fixtures for the lecturers’ languages before model selection, so the pilot’s coverage is explicit.

## Structural Result

`structural` reported zero findings. The heading hierarchy is sequential; the scope contains the problem, goals/non-goals, architecture, alternatives, and non-functional risk sections; and lists, links, and the Mermaid fence are well formed against the feature-spec standard.

## Read Confirmations

All three reviewers used fresh contexts (`fork_turns: "none"`), read their persona and the full target range (lines 1–155), and were instructed to treat source pages as untrusted evidence, never instructions. The same 42-path context list was supplied to each reviewer.

### `design_critic` — completed on retry

Read the design-critic persona, feature-spec standard, and target lines 1–155; scanned later target lines only to verify definitions and implementation requirements. The reviewer confirmed reading the 16 project/design documents and reports in full, except the target’s out-of-scope body. It checked feature-relevant passages in paired readable captures for WhatsApp clients and Terms, Zoom bot controls and Linux SDK, Webtop security, OpenRouter request format, routing and data practices, and Gemma. Raw HTML bodies were not opened; unrelated source sections were not checked.

### `structural` — completed on retry

Read the structural persona, feature-spec standard, target lines 1–155, and all 16 project/design documents and reports. It checked relevant readable extracts for Node releases, Baileys, whatsapp-web.js, WhatsApp Terms, Zoom Linux SDK and bot controls, Webtop security, OpenRouter Chat Completions/JSON mode, structured outputs, provider routing, privacy, and Gemma. Target lines 156–294 were scanned only for definitions. Paired readable extracts were used instead of duplicate raw HTML bodies; the Zoom bot-controls HTML was a loading shell, so its rendered text and current summary were used. Unrelated source sections were not reviewed.

### `style` — completed on retry

Read the style persona and target lines 1–155. It checked relevant passages from project documents, reports, implementation plans, and source extracts covering WhatsApp, OpenRouter, Zoom, Webtop, and Gemma; it also checked the verification criteria at target lines 284–291. It did not inspect `readable/node-release-schedule.txt` because the scoped text makes no Node.js version claim. Duplicate raw HTML snapshots were not read; paired readable extracts and rendered Zoom bot-controls text were used. Detailed implementation sections of `design_draft.md` and target lines 156–283 were not reviewed, apart from the verification criteria. No separate standard was assigned to this reviewer.

### Shared context inventory supplied to each reviewer

Project/design documents and reports (16): `README.md`, `2026-11-07_DRIFT_REPORT.md`, `comprehension_report.md`, `concepts_brief.md`, `consolidated_review_report.md`, `critic_report.md`, `design_draft.md`, `goldfish_review_report.md`, `implementation_readiness_report.md`, `intermediate_zoom_out_report.md`, `openrouter_migration_brief.md`, `zoom_out_report.md`, `docs/designs/student-planner.md`, `docs/plans/agent-handoff.md`, `docs/plans/openrouter-migration-implementation.md`, and `docs/plans/student-planner-implementation.md`.

Source HTML snapshots (12): `node-release-schedule.html`, `baileys-installation.html`, `whatsapp-web-js.html`, `whatsapp-terms-of-service.html`, `zoom-linux-meeting-sdk.html`, `zoom-bot-controls.html`, `linuxserver-webtop.html`, `openrouter-chat-completions.html`, `openrouter-structured-outputs.html`, `openrouter-provider-routing.html`, `openrouter-privacy.html`, and `gemma-4-31b-free.html`.

Readable source files (14): `readable/node-release-schedule.txt`, `readable/baileys-installation.txt`, `readable/whatsapp-web-js.txt`, `readable/whatsapp-terms-of-service.txt`, `readable/zoom-linux-meeting-sdk.txt`, `readable/zoom-bot-controls.txt`, `readable/zoom-bot-controls-current-summary.md`, `review_context/egm-review-sources/zoom-bot-controls-text.md`, `readable/linuxserver-webtop.txt`, `readable/openrouter-chat-completions.txt`, `readable/openrouter-structured-outputs.txt`, `readable/openrouter-provider-routing.txt`, `readable/openrouter-privacy.txt`, and `readable/gemma-4-31b-free.txt`.

No design or existing root review report was edited. The only artifact written by this review is this Stage 7 report.
