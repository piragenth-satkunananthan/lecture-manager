# Stage 7: Critic Review

**Target:** FeatureRange, lines 1–147 of `docs/designs/student-planner.md`
**Reviewers:** design critic, structural, and style
**Status:** All three reviewers completed. The style review required one retry because the saved Zoom bot-controls HTML was a loading shell; the retry read the rendered article text in `review_context/egm-review-sources/zoom-bot-controls-text.md`.

## Findings

### Major

#### `design_critic-1-1` — WhatsApp intake may be blocked or disallowed

**Affected scope:** Message intake; Baileys pilot; live rollout.
**Finding:** A reliability pilot proves that a client can receive and recover messages; it does not establish that automated access is authorized or acceptable for live subject groups. The supplied client sources describe unofficial clients, and the supplied Terms restrict some automated access.
**Proposed action:** Add a current-policy and account-risk go/no-go before live-group intake. Keep manual forwarding as the fallback if the automated path is not acceptable.

#### `design_critic-1-2` — Recording permission and Zoom support are not live rollout gates

**Affected scope:** The Problem; CUJ 3; Zoom Scheduling and Capture; rollout requirements.
**Finding:** The document says recording is permitted but does not define how live permission, host recording settings, or admission conditions are checked. A test meeting proves only its own account and meeting setup.
**Proposed action:** Require host or institutional authorization and a per-meeting check that capture is allowed before enabling the worker. Do not start capture if admission or permission cannot be confirmed.

#### `design_critic-1-3` — Webtop access controls are underspecified

**Affected scope:** Non-Functional Requirements; Webtop deployment.
**Finding:** “Keep Webtop private” does not specify network restriction or authentication. The supplied Webtop documentation describes default-disabled authentication, a terminal with passwordless `sudo`, and privileged host access.
**Proposed action:** Define HTTPS, authentication, and a private-network boundary for interactive Webtop access, separate from the planner-to-agent token.

#### `design_critic-1-4` — An active recording can exhaust disk space

**Affected scope:** Recording policy; storage requirements.
**Finding:** The 80% threshold pauses new recordings, but an active capture may continue for up to four hours and exhaust the remaining disk.
**Proposed action:** Define and test a maximum recording size or free-space stop condition for active captures.

#### `design_critic-1-5` and `style-1-1` — Pilot success lacks measurable criteria

**Affected scope:** Open Questions; AI extraction; WhatsApp and Zoom pilots.
**Finding:** Terms such as “reliably enough,” “valid,” “usable,” and “reliable” do not define observable pass/fail results. AI extraction also has no acceptance threshold or rule for confidently wrong dates and times.
**Proposed action:** Define representative inputs, required fields, acceptable extraction results, restart/reconnect outcomes, recording quality, and the exact conditions that enable live intake or recording.

### Nits

#### `style-1-2` — Overview uses stacked hedges and compressed wording

**Affected scope:** Overview.
**Finding:** “Is intended to help,” “aims to,” and “should be able to” weaken the description, and “screen/audio-record” is awkward.
**Proposed action:** State the service scope directly and use “record the screen and audio.”

#### `style-1-3` — Email independence is overstated

**Affected scope:** Notifications and data flow.
**Finding:** “Cannot suppress every alert” is broader than the described independent email path.
**Proposed action:** Say specifically that losing the WhatsApp session does not prevent email notices.

#### `style-1-4` — Alternatives use a different voice and repeat a rationale

**Affected scope:** Alternatives Considered.
**Finding:** Second-person phrasing differs from the rest of the document, and the two-client alternative repeats its maintenance rationale.
**Proposed action:** Use a consistent neutral subject and shorten the reason for selecting one client.

## No Findings

The structural reviewer reported no structural findings in FeatureRange lines 1–147.

## Read Confirmation

All reviewers confirmed reading their assigned persona, target range, required standard where assigned, and approved GoldfishContext files. The style retry also read the rendered Zoom bot-controls article text. Reviewers made no edits.
