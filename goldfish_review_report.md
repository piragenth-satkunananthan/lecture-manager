# Goldfish Annotated Review Report

**Target:** `docs/designs/student-planner.md` (`full file`)
**Status:** resolved

## Prioritized Findings & AI Suggestions

### Issue 1 [zoom_out, design_critic, implementation_readiness] - Severity: Blocker
* **Affected Scope:** Lines 36-39, 67, 136, 156, 206-208 ([docs/designs/student-planner.md](docs/designs/student-planner.md#L36-L39)) (WhatsApp live-use gate)
* **Discrepancy Description:** The one-group pilot can prove that a client receives messages and reconnects. It cannot establish that automated access is authorized or acceptable for live groups. Both candidate libraries are unofficial, and the saved Terms source is dated 2021. The author has accepted nonzero account-restriction risk; the plan still needs a separate gate for current policy and authorized use. If that gate fails, stop automated intake and use the manual-forwarding fallback.
* **Rationale:** A reliability pilot does not establish current policy or account-risk acceptability for live groups.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The live-use gate is a rollout requirement. The user's stated risk acceptance can be recorded, but it does not replace checking current policy or defining the fallback when automated intake is unacceptable or the account is restricted.
* ***Proposed Edit:***
    * Location: Add a rollout gate after line 67 and align the release gate at line 136.
    * Change: Add: “Before enabling live-group intake, the owner checks the current WhatsApp terms and the selected client's current policy, records the check date and account-risk decision, and uses manual forwarding if automated access is not acceptable. If the account is restricted, stop automated intake and alert the user.”

### Issue 2 [zoom_out, design_critic, implementation_readiness] - Severity: Blocker
* **Affected Scope:** Lines 15, 57-59, 74-76, 136, 159, 279 ([docs/designs/student-planner.md](docs/designs/student-planner.md#L74-L76)) (Zoom permission and access gate)
* **Discrepancy Description:** The host-controlled test meeting can prove one account and meeting configuration. It cannot prove access to every live class. The design must define the host/account permission and admission checks for each recording job, and must not bypass Zoom controls. If the selected desktop path is blocked or not allowed, keep unattended capture disabled and use only a separately approved fallback.
* **Rationale:** The design lacks a per-meeting permission and admission check; a test meeting does not establish that every live meeting permits or admits the worker.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The user has said the lecturer and students permitted joining and recording. The document should retain that consent as a precondition while also requiring the specific account, host settings, and admission path to allow each job.
* ***Proposed Edit:***
    * Location: Add a precondition to “Zoom scheduling and capture” after line 74 and repeat it in the rollout gate at line 136.
    * Change: Add: “Create a recording job only when permission for that class is confirmed and the worker can verify admission through the configured account and host settings. Do not bypass blocked controls. If permission or admission cannot be confirmed, do not capture; report the failure and keep unattended recording disabled for that class.”

### Issue 3 [design_critic, zoom_out, implementation_readiness, codebase_details] - Severity: Major
* **Affected Scope:** Lines 133, 152, 158, 187, 192, 237, 247, 279 ([docs/designs/student-planner.md](docs/designs/student-planner.md#L133)) (Webtop interactive access)
* **Discrepancy Description:** “Private” and “off public ports” do not describe how interactive access is protected. Define a private HTTPS route, authentication, and how Android and desktop clients reach it. Keep that path separate from the planner-to-agent token. The Webtop documentation also describes passwordless `sudo` in its GUI, so protect administrative access and do not expose the interface publicly.
* **Rationale:** The Webtop documentation says authentication is disabled by default and its GUI includes a terminal with passwordless `sudo`; a private bind alone does not authenticate interactive access.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The document needs an explicit access boundary and separate interactive authentication before deployment. This does not require choosing a VPN or proxy product now.
* ***Proposed Edit:***
    * Location: Replace the final sentence of the Privacy and security bullet at line 133.
    * Change: Replace “Password-protect the planner and keep Webtop private; do not mount the container engine socket into the application.” with “Require authenticated HTTPS for planner access. Expose the Webtop interface only on the user's private network, require its own interactive authentication separate from the planner-to-agent token, and restrict terminal and passwordless-sudo access to the user. Do not expose Webtop publicly or mount the container engine socket into the application.”

### Issue 4 [design_critic, zoom_out] - Severity: Major
* **Affected Scope:** Lines 81, 135, 159, 187, 280 ([docs/designs/student-planner.md](docs/designs/student-planner.md#L81)) (Active-recording storage bound)
* **Discrepancy Description:** The 80% threshold pauses new recordings, while an active recording can continue for four hours. Define a maximum recording size or minimum free-space stop rule for an active capture, and test it.
* **Rationale:** An active capture can exhaust the remaining disk before the four-hour cap.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Pausing new jobs does not protect disk space during a current recording. A low-space stop rule should finalize the file and notify the user.
* ***Proposed Edit:***
    * Location: Extend the Storage and runtime limits bullet at line 135 and the Zoom Worker stage at line 159.
    * Change: Add: “During capture, check free space at least every 15 seconds and stop and finalize the recording if free space falls below 10 GiB. Send an alert and test this stop condition in the Zoom pilot.” Treat 10 GiB as the proposed deployment floor, configurable if the server's storage layout requires a larger reserve.

### Issue 5 [design_critic, zoom_out, implementation_readiness, style] - Severity: Major
* **Affected Scope:** Lines 36-38, 156, 267-280 ([docs/designs/student-planner.md](docs/designs/student-planner.md#L156)) (Pilot acceptance criteria)
* **Discrepancy Description:** The pilots use terms such as “reliably enough,” “valid,” “usable,” and “extracts correctly” without measurable thresholds. The fixture list has categories but no expected outputs. Specify expected extracted fields and values, resource ceilings, reconnect and catch-up results, sender filtering, recording quality, and host-end detection before enabling live intake or recording. Include confidently wrong dates and times in the checks.
* **Rationale:** The document does not define observable pass/fail results for extraction, resource use, reconnects, recording quality, or end detection.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The live rollout gates need observable results. Exact expected outputs make a pilot failure distinguishable from a subjective “looks good” judgment.
* ***Proposed Edit:***
    * Location: Replace the pilot descriptions in lines 156 and 278-281; extend fixture guidance at line 267.
    * Change: Add these acceptance rules: “Each synthetic fixture records the expected structured fields and normalized values. Extraction passes only when every required field matches its fixture; missing, ambiguous, contradictory, or incorrect dates and times remain pending, with zero incorrect items auto-confirmed. The intake pilot passes only when every eligible test post is recovered after disconnect and restart without a lost or duplicated planner item, and untrusted senders/groups are ignored. The Zoom pilot passes only when a reviewer confirms both screen and audio are usable in a saved sample, host-end detection stops capture within 30 seconds, the low-space stop works, and the worker stays within configured container resource limits without an out-of-memory termination. Enable each live path only after its corresponding criteria pass.”

### Issue 6 [comprehension, zoom_out, implementation_readiness] - Severity: Major
* **Affected Scope:** Lines 63-70, 157, 199-202, 209-217 ([docs/designs/student-planner.md](docs/designs/student-planner.md#L63-L70)) (Event lifecycle and source identity)
* **Discrepancy Description:** The plan says edits update items and cancellations stop reminders, but it does not define how a cancellation is recognized or matched to an existing item. Define source message identity, event fields and states, how edits interact with user corrections, how cancellations map to prior items, and how duplicate reposts are handled. Explain what source reference remains inspectable after raw message text is deleted.
* **Rationale:** A reader cannot tell what behavior is intended when a lecturer cancels or changes an assignment or class; the listed extraction fields do not include cancellation status or a link to the prior item.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** These rules determine deduplication, reminders, and user-visible event state, so they belong in the design before implementation.
* ***Proposed Edit:***
    * Location: Add lifecycle and key definitions to the Planner Core stage at line 157 and the SQLite/Planner file descriptions at lines 202 and 217.
    * Change: Add: “Store a stable source identity as group ID, message ID, sender ID, and sent timestamp. Planner items have `pending`, `confirmed`, or `cancelled` status and retain their source identity. A quoted/replied-to message identifies the item changed or cancelled; without that reference, apply a correction or cancellation only when exactly one open item in that group matches the stated subject and date, otherwise ask the user. A user's corrected field takes precedence over later message edits until the user clears that correction. Repeated delivery of the same message ID is idempotent; identical content under a new ID remains in duplicate review.”

### Issue 7 [implementation_readiness, codebase_details] - Severity: Major
* **Affected Scope:** Lines 134, 199-202, 229-237, 249-257 ([docs/designs/student-planner.md](docs/designs/student-planner.md#L199-L202)) (Planner/Webtop and SMTP contracts)
* **Discrepancy Description:** The SQLite section lists tables without fields, keys, relationships, or lifecycle states. The planner/Webtop link lacks endpoint payloads, job states, retry ownership, and lease behavior. Email retries can duplicate a notice if SMTP accepts it but the process stops before marking it delivered. Define the intended delivery guarantee and recovery behavior.
* **Rationale:** The worker has no specified claim/lease/recovery protocol, and SMTP cannot make the send-and-database-commit sequence atomic.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The contract can be defined in a few sentences without committing to additional architecture. Email delivery must be described as at-least-once because a duplicate is possible in the SMTP-accepted/database-update failure window.
* ***Proposed Edit:***
    * Location: Add a worker contract after line 237 and an email delivery guarantee after line 222.
    * Change: Add: “The planner owns job state: `queued`, `claimed`, `joining`, `waiting`, `recording`, `completed`, `failed`, or `expired`. The agent claims one job through an authenticated `POST /agent/jobs/claim` call; the response includes job ID, planner item ID, meeting link, scheduled start, and lease expiry. The agent renews its 60-second lease every 20 seconds and reports state through authenticated status updates. The planner retries queued jobs and jobs whose lease expires before recording begins. If a lease expires after recording begins, mark the job failed for review and do not start a duplicate capture until its saved-file state is reconciled. Also state: “Email delivery is at-least-once. A duplicate notice is possible if SMTP accepts a message and the service stops before recording delivery; persist each attempt and expose delivery status in the planner. Do not promise exactly-once SMTP delivery.”

### Issue 8 [implementation_readiness] - Severity: Major
* **Affected Scope:** Lines 133, 160, 187, 272, 280 ([docs/designs/student-planner.md](docs/designs/student-planner.md#L160)) (Backup and restore)
* **Discrepancy Description:** The plan requires backup/restore verification but does not specify what is backed up, how to take a consistent SQLite copy while the service runs, where it is stored, or how restore works. Define and test recovery of planner state and recording metadata.
* **Rationale:** The recovery check has no defined backup contents, destination, consistency method, retention, or restore procedure.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** A short operational rule makes the recovery requirement testable and clarifies what a backup can restore. Excluding video files avoids silently retaining large recordings after the user deletes them, but means those files cannot be restored from backup.
* ***Proposed Edit:***
    * Location: Extend the Private pilot and recovery stage at line 160 and README scope at line 272.
    * Change: Add: “Create a daily encrypted SQLite online backup, including planner state and recording metadata, on storage separate from the live database; retain seven daily and four weekly copies. Do not include WhatsApp/Zoom credentials or recording video files. Restoring requires stopping the service, restoring a selected snapshot, and verifying planner items, reminders, and metadata before restart. The pilot must restore a snapshot and confirm these records. State that video files are not recoverable from this backup and that expired snapshots may contain data deleted from the live database until their retention period ends.”

### Issue 9 [zoom_out, intermediate_zoom_out] - Severity: Major
* **Affected Scope:** Lines 148-160, 162-272 ([docs/designs/student-planner.md](docs/designs/student-planner.md#L148-L160)) (Implementation-plan detail before pilots)
* **Discrepancy Description:** The 22-file plan fixes choices such as SQLite schema, X11/PulseAudio/FFmpeg capture, Tesseract, and a custom Webtop startup script before the feasibility pilots pass. Keep the service boundaries and pilot acceptance criteria; defer exact files and low-level tools until those results show what works.
* **Rationale:** The recommendation to defer details conflicts with the user's earlier approval of the Detailed Implementation Plan, which was provided outside the files available to reviewers.
* ***AI Suggestion:*** ESCALATE
* ***Justification:*** The user explicitly approved the detailed implementation plan and asked to finalize it. That decision is conversation context unavailable to the reviewers, so this item is surfaced without editing the approved plan.
* ***Proposed Edit:***
    * Location: No change to the target document unless the user revises the prior approval.
    * Change: None; preserve the approved detailed plan.

### Issue 10 [zoom_out, intermediate_zoom_out] - Severity: Nit
* **Affected Scope:** Lines 39, 157, 222 ([docs/designs/student-planner.md](docs/designs/student-planner.md#L39)) (Late assignments)
* **Discrepancy Description:** The document identifies posts received after the due date as an open question, but the implementation plan does not state how they appear or whether reminders are suppressed.
* **Rationale:** Overdue assignments remain unresolved, with no rule for review-only handling or reminder suppression.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The planner should not send reminders for a deadline that has already passed when the post arrives; a review-only state keeps the item visible without implying it is upcoming.
* ***Proposed Edit:***
    * Location: Replace the Open Questions bullet at line 39 and specify behavior in Planner Core at line 157.
    * Change: Add: “If an assignment arrives after its due time, create it as `overdue_review`, send no scheduled deadline reminders, and ask the user whether to keep it for reference or archive it.”

### Issue 11 [comprehension, intermediate_zoom_out] - Severity: Nit
* **Affected Scope:** Lines 63, 69, 133, 217, 242 ([docs/designs/student-planner.md](docs/designs/student-planner.md#L63-L69)) (Source provenance after raw-text deletion)
* **Discrepancy Description:** The student is meant to check an item's source, but after clarification the raw message is deleted and only a “source reference” remains. The document does not say what that reference contains or whether it can show the original post.
* **Rationale:** It is unclear what provenance the student can still inspect after raw text is deleted.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Keeping source metadata supports auditability without retaining the message body. The UI should not imply that deleted text can still be reproduced.
* ***Proposed Edit:***
    * Location: Clarify lines 63 and 69 and the source reference shown by the UI at line 242.
    * Change: Add: “After raw message text is deleted, retain only the group, message ID, sender, timestamp, and an original-message link if WhatsApp provides one. The planner displays this as provenance; it does not reproduce the deleted message body.”

### Issue 12 [comprehension, intermediate_zoom_out] - Severity: Nit
* **Affected Scope:** Lines 63, 133, 158, 187, 192, 242 ([docs/designs/student-planner.md](docs/designs/student-planner.md#L63)) (Android and desktop access path)
* **Discrepancy Description:** The planner and Webtop are described as private-network services, but the document does not explain how the student's Android phone and Arch Linux desktop connect to that network.
* **Rationale:** A reader cannot tell whether access is LAN-only or available remotely, or how the two user devices authenticate.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Naming a simple access route makes the private-network requirement usable without selecting a specific VPN product.
* ***Proposed Edit:***
    * Location: Extend the architecture paragraph at line 63 and User Access stage at line 158.
    * Change: Add: “The Android phone and Arch Linux desktop use a browser to reach the planner over authenticated HTTPS on the private LAN; remote access requires the user's VPN into that network.”

### Issue 13 [style, intermediate_zoom_out] - Severity: Nit
* **Affected Scope:** Lines 80, 134 ([docs/designs/student-planner.md](docs/designs/student-planner.md#L80)) (Email availability wording)
* **Discrepancy Description:** The email claim says a lost WhatsApp session cannot suppress “every alert,” which is broader than the described independent email path.
* **Rationale:** The stated guarantee should be limited to the documented email notices and should make clear it depends on SMTP.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The current sentence overstates what email independence guarantees.
* ***Proposed Edit:***
    * Location: Replace the final clause of the Notifications and data flow bullet at line 80.
    * Change: Replace “so a lost WhatsApp session cannot suppress every alert” with “so email notices remain available when WhatsApp intake is disconnected, provided SMTP is working.”

### Issue 14 [style] - Severity: Nit
* **Affected Scope:** Line 11 ([docs/designs/student-planner.md](docs/designs/student-planner.md#L11)) (Overview wording)
* **Discrepancy Description:** The overview stacks hedges and uses the compressed phrase “screen/audio-record.”
* **Rationale:** The service scope can be stated directly while retaining the test-meeting limitation.
* ***AI Suggestion:*** PROPOSE FIX
* **Justification:** This small wording change improves readability without changing the approved scope.
* ***Proposed Edit:***
    * Location: Replace the Overview paragraph at line 11.
    * Change: Replace it with: “The Student Planner tracks classes and assignments announced in the student's subject WhatsApp groups. It adds lecturer posts to its planner-owned calendar, sends reminders, and is designed to join Zoom classes and record the screen and audio on the user's server. The calendar is available from Android and Arch Linux browsers. Unattended joining, admission, and host-end detection must pass a test meeting before live recording is enabled.”

### Issue 15 [style, implementation_readiness] - Severity: Nit
* **Affected Scope:** Lines 105, 111, 117, 150 ([docs/designs/student-planner.md](docs/designs/student-planner.md#L105)) (Alternatives voice and vague descriptors)
* **Discrepancy Description:** Alternatives use a different voice and repeat one rationale; “small” and “plain” are subjective descriptors.
* **Rationale:** These are editorial concerns with little effect on the design's implementation or user decisions. The alternatives also preserve the author's approved choices.
* ***AI Suggestion:*** DECLINE
* ***Justification:*** Decline these cosmetic edits to preserve the approved alternatives and avoid spending review effort on wording that does not change the design.
* ***Proposed Edit:***
    * Location: No change.
    * Change: None.
