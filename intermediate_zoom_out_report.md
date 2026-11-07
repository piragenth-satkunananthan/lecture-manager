# Stage 8: Intermediate Zoom Out Review

## Assessment

The student-planner objective is clear and fits the repository's blueprint. The repository still has no implementation to reuse. The pilot-first sequence helps expose feasibility risks, but it does not resolve several rollout and safety gaps.

## Findings

### S8-1 (Major): WhatsApp live-use gate remains missing

**Affected scope:** Open Questions; Message Intake and Planning; Feasibility Pilot; live rollout.
**Finding:** The pilot tests client reliability, not current policy or account-risk acceptability. The supplied Terms page is dated January 4, 2021, and the client sources identify unofficial-client risks. Manual forwarding exists as a fallback, but the plan does not define the policy check that triggers it.
**Suggested action:** Add an explicit current-policy and account-risk go/no-go before live-group intake.

### S8-2 (Major): Zoom test does not establish permission or access for live meetings

**Affected scope:** The Problem; CUJ 3; Zoom Scheduling and Capture; rollout requirements.
**Finding:** The design lacks a per-meeting permission and admission check. The Zoom sources describe bot detection for automated Native/Web App use and host-controlled access. A host-controlled test does not establish that all live meetings will permit or admit the worker.
**Suggested action:** Make verified permission and admission conditions prerequisites for each recording job.

### S8-3 (Major): Webtop access controls remain vague

**Affected scope:** Non-Functional Requirements; deployment plan.
**Finding:** “Keep Webtop private” and “off public ports” do not define HTTPS, authentication, or how the user's devices reach the private network. The supplied Webtop documentation says authentication is off by default, HTTPS is needed for browser audio/video, and the GUI includes a terminal with passwordless `sudo`.
**Suggested action:** Specify authenticated HTTPS access restricted to a private network, separate from the worker token.

### S8-4 (Major): Active recordings can still exhaust storage

**Affected scope:** Recording policy; Storage and Runtime Limits; Zoom Worker.
**Finding:** The four-hour cap and 80% threshold do not stop an active recording if it fills the remaining disk first. There is no maximum recording size or active-capture free-space stop condition.
**Suggested action:** Define a tested size or free-space stop rule for active capture.

### S8-5 (Major): Pilot pass criteria remain subjective

**Affected scope:** Open Questions; AI, WhatsApp, and Zoom pilots; Verification Plan.
**Finding:** “Reliably enough,” “valid,” and “usable” lack observable thresholds. The extraction pilot has no acceptance rule for confidently wrong dates or times.
**Suggested action:** Define measurable required fields, representative samples, extraction acceptance, reconnection outcomes, recording quality, and live-enablement conditions.

### S8-6 (Major): Cancellation behavior is named but undefined

**Affected scope:** Message Intake and Planning; Planner Core; `src/ai.ts`; `src/planner.ts`.
**Finding:** The plan says cancellations stop reminders but does not define how an incoming post signals cancellation or how it matches the prior item. The extraction fields do not identify cancellation status or the item being cancelled.
**Suggested action:** Define a cancellation state and a rule for matching a cancellation or correction to its source item.

### S8-7 (Major): Implementation detail is fixed before feasibility results

**Affected scope:** Detailed Implementation Plan; Target Files to Create or Modify.
**Finding:** The 22-file plan commits to SQLite tables, X11/PulseAudio/FFmpeg capture, Tesseract, and a custom agent startup path before the pilots establish what works.
**Suggested action:** Keep the service boundaries and pilot acceptance criteria; defer exact files and tools until pilot results.

### S8-8 (Nit): Late-post behavior remains open

**Affected scope:** Open Questions; Planner Core; Reminders.
**Finding:** Overdue assignments remain unresolved, with no rule for whether a late post is review-only or whether reminders are suppressed.

### S8-9 (Nit): Source provenance and client access details are incomplete

**Affected scope:** Overview; Message Intake and Planning; Privacy; User Access.
**Finding:** The student is promised a source reference, but after raw text is deleted its contents and inspectability are unspecified. Password protection and a private network partially address access, but the phone/desktop connection path is not described.

### S8-10 (Nit): Stage 7 wording findings remain

**Affected scope:** Overview; Notifications and Data Flow; Alternatives Considered.
**Finding:** The overview stacks hedges; the email claim says a lost WhatsApp session cannot suppress “every alert”; and the alternatives use second-person wording and repeat a rationale.

## Read Confirmation

The reviewer confirmed reading its persona, Zoom-out standard, the full target document, Stage 5–7 reports, and all nine approved source files, including the rendered Zoom bot-controls article text. It also inspected the README and searched the repository for implementation files. No files were edited.
