# Stage 9 Resolution Report

**Target:** `docs/designs/student-planner.md` and the dependent implementation plans.
**Source:** `implementation_readiness_report.md` (Stage 9).
**Resolution:** Findings were accepted and applied as plan corrections. The review did not authorize runtime implementation; pilot results and machine-specific deployment values remain explicit gates.

| Finding | Classification | Resolution |
| --- | --- | --- |
| `codebase_details-9-1` Existing web service claimed but absent (Blocker) | PROPOSE FIX | Described the repository as a Node.js/TypeScript foundation with an extraction adapter and specified building the planner service and browser interface. |
| `codebase_details-9-2` Stale file/dependency inventory (Major) | PROPOSE FIX | Corrected existing paths to Modify, corrected test names, documented current callers, dependency reuse, and exact Baileys/alternate-client selection requirements. |
| `codebase_details-9-3` Baileys pilot version unspecified (Major) | PROPOSE FIX | Pinned pilot/deployment requirements to `@whiskeysockets/baileys` `7.0.0-rc14`, with one exact tested alternate only if the pilot fails. |
| `codebase_details-9-4` No model runtime configuration (Major) | PROPOSE FIX | Added `OPENROUTER_MODEL`; extraction and intake remain disabled until a passing free model and required configuration are present. |
| `implementation_readiness-9-2` Persisted keys and relationships incomplete (Major) | PROPOSE FIX | Specified source, clarification, reminder, Zoom job, and recording metadata keys, references, and uniqueness constraints. |
| `implementation_readiness-9-3` Browser/worker API contracts incomplete (Major) | PROPOSE FIX | Specified browser and agent routes, payloads, authorization, errors, lease handling, and legal job transitions. |
| `implementation_readiness-9-4` Failed-post retention/retry conflict (Major) | PROPOSE FIX | Set 30-day maximum raw-text retention, user-triggered retry/deletion, and failure behavior; carried it into the plan and user interface inventory. |
| `implementation_readiness-9-5` Archive outcome undefined (Major) | PROPOSE FIX | Added `archived`; archived overdue items are hidden from default views, suppress reminders/recording, and retain item/provenance until user deletion. |
| `implementation_readiness-9-6` Upstream data-use policy missing (Major) | PROPOSE FIX | Required per-request `data_collection: deny`, `zdr: true`, no fallbacks, required parameter support, and account ZDR-only settings for Google and All other models. Fail closed if policy or eligible routing cannot be verified. |
| `implementation_readiness-9-7` Per-class permission/admission state undefined (Major) | PROPOSE FIX | Added stored permission decision, confirmer/time, explicit user confirmation, and fail-closed behavior for unknown/denied Zoom admission. |
| `implementation_readiness-9-8` Webtop/HTTPS deployment choices open (Major) | PROPOSE FIX | Made deployment conditional on recording a pinned Webtop image/session and tested capture devices, plus the HTTPS termination point, certificate renewal path, and private hostname. Values dependent on the operator's host remain deployment gates. |
| `implementation_readiness-9-9` Backup boundary/key handling absent (Major) | PROPOSE FIX | Added backup script/module inventory, `BACKUP_PATH`, external `BACKUP_ENCRYPTION_KEY_FILE`, encryption, retention, rotation, restore, and a verified separate-storage deployment gate. |
| `implementation_readiness-9-10` WhatsApp pilot lacks pass threshold (Major) | PROPOSE FIX | Required at least 10 eligible and 10 untrusted messages, two disconnect/restart cycles, complete exactly-once recovery of eligible messages, and zero untrusted acceptance. |
| `implementation_readiness-9-11` Duplicate test bullets (Nit) | PROPOSE FIX | Consolidated overlapping test inventory bullets into one specification. |
| `style-9-1` “Plain” is not measurable (Nit) | PROPOSE FIX | Removed the subjective interface adjective; retained “responsive browser interface.” |
| `readiness-rerun` Worker lease contract incomplete (Major) | PROPOSE FIX | Added a random stored `lease_id` to the claim response and required it on heartbeat and status requests; stale leases return 409. |
| `readiness-rerun` Failed-message state not persisted (Major) | PROPOSE FIX | Added extraction/review states, safe failure code, attempts, last-attempt time, and explicit retry/expiry/deletion transitions to source-message storage. |
| `readiness-rerun` Browser authentication flow unspecified (Major) | PROPOSE FIX | Added `PLANNER_PASSWORD`, `SESSION_KEY_FILE`, login/logout routes, six-hour secure cookie settings, and same-origin checks for mutations. |
| `readiness-rerun` Dependency and backup APIs unspecified (Major) | PROPOSE FIX | Selected Fastify/static/session, better-sqlite3, and Nodemailer packages; selected `Database.backup()` and Node crypto AES-256-GCM snapshot format. |
| `readiness-rerun` Backup encryption format missing (Major) | PROPOSE FIX | Specified a versioned AES-256-GCM envelope, nonce/tag/key sizes, key ID lookup, restricted plaintext temporary file, and cleanup behavior. |
| `readiness-rerun` Zoom admission signal vague (Major) | PROPOSE FIX | Added configured Zoom account email, required profile match plus visible in-meeting controls, explicit fail-closed UI states, and worker startup health checks. |
| `codebase-rerun` Test-file operations mixed (Major) | PROPOSE FIX | Marked existing config/WhatsApp/AI/OpenRouter tests Modify and planner/reminder/Zoom tests Create. |
| `codebase-rerun` Dependency categories unnamed (Major) | PROPOSE FIX | Named Fastify 5, `@fastify/static` 10, `@fastify/secure-session` 8, `better-sqlite3` 13, Nodemailer 10, and better-sqlite3 types. |
| `style-rerun` “Both provider runs” unclear (Major) | PROPOSE FIX | Required each shortlisted model run and clarified the Baileys/conditional alternate WhatsApp pilot pass sequence. |
| `style-rerun` Webtop health undefined (Nit) | PROPOSE FIX | Replaced generic health with explicit signed-in account and available display/audio preflight. |

## Follow-up constraints

- OpenRouter's current documentation identifies Safety Retention exceptions separately for the Google and All other models groups. The project requires ZDR-only settings for both groups; the account UI labels must be checked at implementation time.
- No model has passed the synthetic comparison yet. Keep model selection, extraction, and live WhatsApp intake disabled until the documented gates pass.
- Webtop image/session, TLS/certificate details, backup mount, and key location are environment-specific. Deployment is blocked until the operator records and verifies concrete values.
- No runtime files were changed and no tests were run.
