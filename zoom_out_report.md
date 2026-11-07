# Stage 5: Initial Zoom Out Review

## Scope

The full design document was reviewed by the EGM Zoom Out and Inventive Catalyst lenses against the Zoom-out standard and the eight approved source pages. No files were edited by the reviewers.

## Strengths

* The document states the single-student problem, the separate subject-group context, and the need for one planner calendar.
* It defines the Sri Lanka time defaults and asks for clarification instead of guessing missing class details.
* It makes local storage, independent email alerts, restricted Webtop access, and test-group rollout visible requirements.

## Findings

### S5-1 (Major): WhatsApp feasibility does not establish live-use authorization

**Affected areas:** Open Questions; Message Intake and Planning; Feasibility Pilot; Manual Forwarding alternative.

The one-group pilot can show whether a client receives and recovers messages. It cannot establish that automated access is permitted or that an account restriction risk is acceptable for the live subject groups. The supplied WhatsApp client pages describe unofficial clients, and the supplied Terms page restricts certain unauthorized automated access. Make current policy and account acceptability an explicit go/no-go before connecting a live group. Keep manual forwarding as the fallback if the automation path is not acceptable. One reviewer also noted that the supplied Terms snapshot appears dated January 4, 2021, so it does not establish current policy.

### S5-2 (Major): A test meeting does not prove access to each live class

**Affected areas:** The Problem; CUJ 3; Zoom Scheduling and Capture; Zoom Pilot.

The host-controlled test can prove one account and meeting configuration. It cannot prove every live meeting will admit the unattended client or expose the same end signal. Keep permission and admission conditions as explicit preconditions for each live recording. If the worker cannot verify admission or permission, it should not start capture and should report the failure.

### S5-3 (Major): “Private Webtop” needs concrete access controls

**Affected areas:** Non-Functional Requirements; `compose.yaml`; `webtop/Dockerfile`; deployment instructions.

The Webtop source says authentication is disabled by default, browser audio/video features require HTTPS, and its GUI provides a terminal with passwordless `sudo`. Restricting the port alone does not authenticate interactive access. Define HTTPS and an authenticated access path restricted to the user's private network, separate from the planner-to-agent token.

### S5-4 (Major): The implementation plan fixes too many details before feasibility is proven

**Affected areas:** Detailed Implementation Plan, especially Target Files to Create or Modify.

The 22-file list and choices such as SQLite tables, FFmpeg/X11/PulseAudio capture, Tesseract detection, and a custom agent startup script are more specific than the evidence supports before the WhatsApp, local-model, and Zoom pilots pass. Preserve the service boundaries and pilot acceptance criteria, then defer file-by-file and tool-level choices until those results establish what works.

### S5-5 (Nit): Late assignment behavior is still open

**Affected areas:** Open Questions; Planner Core; Reminders.

The document identifies posts received after the due date as an open question, but the implementation plan does not state how they appear or whether reminders are suppressed. Define a review-only behavior for late posts before enabling automatic planning.

## Reviewer Read Confirmation

Both reviewers confirmed reading their assigned persona, the Zoom-out standard, the full target document, and all eight approved source files. The supplied source HTML is retained under `review_context/egm-review-sources/`.
