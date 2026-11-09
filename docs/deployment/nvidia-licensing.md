# NVIDIA Build Licensing Review — 2026-11-09

**Status:** Reviewed. The free Build API is appropriate for a controlled prototype/pilot. A production license or support contract is **not** confirmed.

## Official terms reviewed

- [NVIDIA Build FAQ](https://build.nvidia.com/api/runtime/content/help-center-faq.yaml): all models on build.nvidia.com are free to prototype with; the free tier is rate-limited (up to 40 RPM for most models) with no per-token billing. Once limits are hit, NVIDIA points to partner endpoints or a locally deployed NIM.
- [NIM Offerings](https://docs.nvidia.com/nim/large-language-models/2.0.13/about-nim-llm/nim-offerings.html):
  - NIM is available at no charge under the applicable license terms and is not covered by NVIDIA Enterprise support.
  - NIM Certified Feature Branch is available at no charge under the applicable license terms; enterprise support requires an active NVIDIA AI Enterprise subscription.
  - NIM Certified Production Branch requires an active NVIDIA AI Enterprise subscription.

## Decision for this project

The planner is a single-user personal tool. The free Build API is acceptable for the current controlled pilot and synthetic evaluation. It is **not** a production support or licensing guarantee.

Before any multi-user, publicly exposed, or commercially relied-on deployment:

1. Choose one of:
   - self-hosted NIM under its applicable license terms, or
   - NVIDIA AI Enterprise / NIM Certified Production Branch, or
   - a different provider with explicit production terms.
2. Record the chosen license, support level, and date.
3. Keep extraction disabled until that decision is recorded.

This note records the review; it is not legal advice. The user owns the commercial/licensing decision.
