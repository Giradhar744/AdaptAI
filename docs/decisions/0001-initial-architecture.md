# 1. Initial Architecture and Swappable Seams

Date: 2026-10-23
Status: Accepted

## Context
AdaptAI requires a robust, disability-inclusive architecture across two portals (Teacher and Student) powered by six specialized agents coordinated via an MCP routing layer and governed by an append-only Consent Ledger and a Priority Engine (`safety > student consent > pedagogy > nudges`). Requirements are subject to future refinement, requiring swappable provider abstractions and data-driven configuration.

## Decisions

1. **Provider Seams (`[PROPOSED]`)**:
   - Abstract interfaces for LLM (`LLMProvider`), Text-to-Speech (`TTSProvider`), Speech-to-Text (`STTProvider`), and Video (`VideoStore`).
   - A deterministic `FakeLLMProvider` is provided for zero-cost, offline testing and CI/CD validation.
   - No agent or service directly imports third-party vendor SDKs.

2. **Open Questions Resolution Defaults (`[OPEN]` items from `PROJECT.md §15`)**:
   - **Disability Types**: Initial seed list: `asd` (Autism Spectrum Disorder), `adhd` (ADHD), `dyslexia` (Dyslexia), `other_idd` (Other Intellectual & Developmental Disabilities).
   - **Age Bands**: Defined as `7-10`, `11-15`, `15-20`. For placement logic, age 15 is routed to `11-15` while retaining report presentation labels.
   - **First Attempt Rule (`[REPORT]`)**: Only `attempt_number = 1` feeds teacher analytics and course rating calculations. Later attempts are preserved for student learning.
   - **Consent Rule (`[REPORT]`)**: Append-only ledger; adaptations requiring consent require affirmative student/parent approval. Declined adaptations adhere to a cooldown window.
   - **Safety Override (`[PROPOSED]`)**: High-risk cognitive/sensory overload detected by the Struggle Detection Agent ranks above consent to offer breaks, while remaining transparent to the user.

3. **Frontend Accessibility & Aesthetics (`[PROPOSED]`)**:
   - Calm, non-overstimulating color palette adhering to WCAG 2.2 AA.
   - Dyslexia font toggle (Lexend/OpenDyslexic style options) and font-size scalers.
   - Clear multimodal feedback (visual text + synthesized audio).

## Consequences
- Enables fully offline development, testing, and evaluation via fake providers.
- Future changes in AI models, speech synthesis, or video storage require changing one adapter file and an environment variable.
