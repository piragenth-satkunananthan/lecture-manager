# Stage 9: Implementation Readiness Re-audit

**Target:** `docs/designs/student-planner.md` — Detailed Implementation Plan.
**Compared against:** `implementation_readiness_report.md` and the Stage 9 resolution entries in `goldfish_review_report.md`.

## Reviewers

| Reviewer | Status |
| --- | --- |
| Implementation readiness | Completed; returned six Major findings |
| Codebase details | Completed; returned two Major findings |
| Style | Completed; returned one Major and one Nit |

The three reviewers ran in fresh contexts and read their canonical EGM personas. They did not edit files or run tests.

## Re-audit findings and disposition

| Finding | Severity | Disposition |
| --- | --- | --- |
| Worker lease ID was absent from persistence/claim and status contracts | Major | Added persisted random `lease_id`; claim returns it and heartbeat/status require it. Stale or expired leases return 409. |
| Failed-message retry lifecycle lacked persisted state and metadata | Major | Added extraction/review state, safe failure code, attempt count/time, and retry/expiry/deletion transitions with raw-text removal at expiry. |
| Browser login/session setup was unspecified | Major | Added single-user password config, secure-session key file, login/logout routes, six-hour secure cookie, and same-origin mutation checks. |
| Dependencies and online backup API were not selected | Major | Selected Fastify 5, `@fastify/static` 10, `@fastify/secure-session` 8, `better-sqlite3` 13, Nodemailer 10, and `Database.backup()`. Exact resolved versions are locked in `package-lock.json` during implementation. |
| Backup file encryption format and key lookup were unspecified | Major | Specified AES-256-GCM, 32-byte raw key, fresh 12-byte nonce, 16-byte tag, version/key-ID header, key selection, restrictive plaintext temp permissions, and cleanup. |
| Zoom admission UI/account signal was vague | Major | Added `ZOOM_ACCOUNT_EMAIL`, visible profile match, in-meeting controls, fail-closed handling of all unknown/waiting/denied states, and worker startup preflight. |
| Existing and new test files shared one Modify/Create label | Major | Separated existing tests as Modify and planner/reminder/Zoom tests as Create. |
| “Both provider runs” had an unclear referent | Major | Rewrote exit criteria to require every shortlisted model run and the Baileys pilot, with the alternate WhatsApp client conditional on Baileys failure. |
| Webtop “healthy” lacked a measurable condition | Nit | Replaced it with an explicit account/display/audio startup preflight. |

The changes above address the re-audit findings in the plan. No second EGM re-audit was run; the EGM workflow allows one re-audit per stage. Final consistency review found the reported terms aligned, and `git diff --check` passed.

## Limits

No runtime code was changed. OpenRouter model selection, WhatsApp/Zoom pilot results, Webtop image/session, HTTPS termination/certificate, and backup mount/key deployment remain explicit prerequisites. No tests were run.
