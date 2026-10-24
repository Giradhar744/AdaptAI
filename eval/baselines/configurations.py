"""Baseline configurations for comparative evaluation (PROJECT.md §16).

Defines the 4 evaluation configurations:
1. AdaptAI_Full (Proposed: Proactive + Consent-First + Disability-Aware)
2. Baseline_Reactive (Intervenes only after >= 3 consecutive errors)
3. Baseline_NonConsent (Forces adaptations without student ledger approval)
4. Baseline_NonDisabilityAware (Generates generic hints ignoring disability profiles)
"""

from dataclasses import dataclass
from typing import Dict, Any


@dataclass
class BaselineConfig:
    key: str
    name: str
    description: str
    proactive_struggle_detection: bool  # If False: requires >= 3 consecutive errors
    enforce_student_consent: bool      # If False: auto-applies without student ledger agency
    disability_aware_prompts: bool     # If False: ignores disability style rules
    anti_nagging_protection: bool      # If False: no decline frequency reduction


BASELINE_CONFIGS: Dict[str, BaselineConfig] = {
    "adapt_ai": BaselineConfig(
        key="adapt_ai",
        name="AdaptAI (Proposed Full System)",
        description="Proactive friction detection + Consent-First agency ledger + Disability-aware multimodal hints.",
        proactive_struggle_detection=True,
        enforce_student_consent=True,
        disability_aware_prompts=True,
        anti_nagging_protection=True,
    ),
    "reactive": BaselineConfig(
        key="reactive",
        name="Reactive Baseline",
        description="Waits for repeated failure (>= 3 consecutive errors); ignores early latency & hesitation signals.",
        proactive_struggle_detection=False,
        enforce_student_consent=True,
        disability_aware_prompts=True,
        anti_nagging_protection=True,
    ),
    "non_consent": BaselineConfig(
        key="non_consent",
        name="Non-Consent Baseline",
        description="Forcibly auto-applies pedagogical adaptations without student approval or ledger records.",
        proactive_struggle_detection=True,
        enforce_student_consent=False,
        disability_aware_prompts=True,
        anti_nagging_protection=False,
    ),
    "non_disability_aware": BaselineConfig(
        key="non_disability_aware",
        name="Non-Disability-Aware Baseline",
        description="Generic hint and explanation prompts ignoring student neurodivergent/disability style needs.",
        proactive_struggle_detection=True,
        enforce_student_consent=True,
        disability_aware_prompts=False,
        anti_nagging_protection=True,
    ),
}
