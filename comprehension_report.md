# Stage 6: Comprehension Test

**What this proposes**

**FeatureRange (lines 1–147):** The planner would collect new posts from configured subject WhatsApp groups, extract assignment and class details, and put clear items and reminders on its own calendar. It would ask the student to resolve missing or ambiguous details instead of guessing. For confirmed Zoom classes, it would try to join and record through a server-side desktop workflow, with a test meeting required before relying on unattended recording. The proposal also sets privacy, storage, and rollout limits and compares alternative intake, recording, and calendar approaches.

**DetailedRange (lines 148–285):** The implementation would start as a Node.js and TypeScript web service with SQLite storage, local Ollama extraction, email notices, and a browser calendar. A separate Ubuntu Webtop container would run the Zoom client and recording worker, communicating with the planner over an authenticated private connection. The stages begin with WhatsApp, AI, and Zoom pilots, then build the planner, user interface, worker, and recovery process. The plan lists the files, tests, and pilot checks intended to support that rollout.

**How the existing system works, per this document**

The document says the repository has no application source or dependencies, so there is no existing planner system to describe. It describes a system to be built: a service would receive WhatsApp posts, store planner state, and schedule reminders and Zoom jobs. The WhatsApp and Zoom workflows are proposed, and the document says they must pass pilots before live use.

### Findings

1. **Severity: Major**
   **Affected Scope:** Technical Plan — Message intake and planning; Detailed Implementation Plan — planner lifecycle and `src/planner.ts`
   **Discrepancy Description & Rationale:** The plan says edits update an existing item and cancellations stop its reminders, but it does not explain how a cancellation is recognized in an incoming post or matched to the item it cancels. The extraction fields listed for `src/ai.ts` do not include cancellation status or a link to the prior item. A reader cannot tell what behavior is intended when a lecturer cancels or changes an assignment or class.

2. **Severity: Nit**
   **Affected Scope:** Overview; Technical Plan — Message intake and planning; Non-Functional Requirements — Privacy and security
   **Discrepancy Description & Rationale:** The student is meant to check an item’s source, but after clarification the raw message is deleted and only a “source reference” remains. The document does not say what that reference contains or whether it can show the original post. It is unclear what provenance the student can still inspect.

3. **Severity: Nit**
   **Affected Scope:** Overview; Technical Plan — Notifications and data flow; Detailed Implementation Plan — User access and alerts
   **Discrepancy Description & Rationale:** The planner and Webtop are described as private-network services, but the document does not explain how the student’s Android phone and Arch Linux desktop connect to that network. The later README is expected to document deployment, but the proposed access path is not yet described here.

### Read Confirmation

The reviewer confirmed reading the comprehension persona and the complete `docs/designs/student-planner.md` target. Stage 6 received no external context files and made no edits.
