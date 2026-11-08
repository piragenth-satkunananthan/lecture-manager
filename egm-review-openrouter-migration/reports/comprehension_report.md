## What this proposes

Replace Gemini with OpenRouter and select a free model by comparing candidates on the same synthetic lecturer posts. Keep each request to one post, validate the expanded event data and its evidence locally, and retain evidence quotes with accepted events. Keep live intake disabled until the provider data policy, extraction contract, and durable retry or review path are addressed.

## How the existing system works, per this document

The current extractor sends one selected post, its timestamp, timezone, and redacted URL placeholders with link indexes to Gemini; it does not send WhatsApp IDs, actual URLs, or passcodes. The app validates Gemini's JSON with strict Zod, checks dates and Zoom-link indexes, and makes one request with a 60-second timeout. The WhatsApp pilot logs extraction failures, and seen-message handling can prevent a failed post from being retried; there is no planner database or event persistence path.

## Findings

### 1. Major: The event data shape is not defined

**Affected scope:** Extraction fields and evidence, lines 36 and 54.

The proposal says to add event type, course, action, cancellation, and rescheduling fields, but leaves their types, null rules, relationships to `kind`, and ambiguity behavior for later definition. A reader can understand the direction, but cannot determine the event data shape or how these cases should be represented.

### 2. Major: The model selection score has no pass rule

**Affected scope:** Recommendation and model selection, lines 9, 53, 57, and 84.

The proposal says to select the model that scores best against expected answers, but it does not say what counts as a better score or an acceptable result. A reader cannot tell how the comparison will choose a model or when a candidate fails.
