# Stage 5: Initial Zoom Out Review

**Target:** `openrouter_migration_brief.md`
**Review range:** Full document
**Implementation range:** None. The target has no detailed implementation plan, so Stage 9 is not applicable.
**Reviewers:** EGM Zoom Out and Inventive Catalyst

## Findings

### 1. Major: Require JSON mode on the route used for each request

**Affected scope:** Proposed behavior, provider request; Necessary changes, item 2 (target lines 27-32 and 52-55).

The proposal checks whether a model route supports JSON mode during model selection, but OpenRouter may route a later request to a different provider. Its provider routing documentation says unsupported parameters may be ignored unless parameter support is required. A request might therefore reach a free route that does not enforce JSON mode.

**Suggested change:** Require parameter support on every OpenRouter request. If no free route supports JSON mode, fail the request. Do not let OpenRouter silently use a route that ignores `response_format`.

Source: [Saved OpenRouter provider-routing page](../context/provider-routing.html).

### 2. Major: Exclude app-added Zoom links from model quote evidence

**Affected scope:** Extraction fields and evidence (target lines 38-40).

The app replaces URLs with placeholders before sending a message to a model, then attaches a Zoom URL locally using its link index. The proposal does not explicitly say that this app-added `zoom_url` is outside the model's `field_evidence` requirement. If it is included, the model cannot provide an exact quote for the actual URL because it never sees that URL.

**Suggested change:** State that `zoom_url` is derived and validated by the application through the existing link-index check. Do not require a model evidence quote for that field. Continue requiring quotes for factual fields extracted from message text.

Source: [Saved OpenRouter chat API page](../context/chat-completions-api.html).

## Review result

The proposal gives enough context to understand the change, stays at proposal level, and reuses the current extractor and its test seam. The fail-closed rule and free-only limit are explicit. The reviewers found no false compromise that needs a new architecture pattern.
