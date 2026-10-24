"""Synthetic student struggle profiles for evaluation benchmarks (PROJECT.md §16).

DISCLAIMER: All profiles and generated data are strictly SYNTHETIC models of
behavioural friction patterns (latency, hesitation, error streaks, hint usage)
used solely to evaluate algorithmic sensitivity. No clinical or real student data is used.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class StruggleProfileConfig:
    name: str
    description: str
    disability_type_code: Optional[str]
    age_band_code: str
    base_latency_ms: float
    latency_variance_ms: float
    base_hesitation_ms: float
    hesitation_variance_ms: float
    base_error_probability: float
    struggle_onset_item: int  # Item index where friction begins to manifest
    struggling_error_probability: float
    struggling_latency_multiplier: float
    struggling_hesitation_multiplier: float
    struggling_option_changes: int
    hint_request_probability: float
    prefers_audio_hints: bool = False
    consent_acceptance_probability: float = 0.85  # Likelihood of approving helpful pedagogy proposals


PRESET_PROFILES: Dict[str, StruggleProfileConfig] = {
    "smooth_learner": StruggleProfileConfig(
        name="smooth_learner",
        description="Neurotypical or well-accommodated learner experiencing minimal friction.",
        disability_type_code=None,
        age_band_code="11-15",
        base_latency_ms=10000.0,
        latency_variance_ms=2000.0,
        base_hesitation_ms=2000.0,
        hesitation_variance_ms=800.0,
        base_error_probability=0.08,
        struggle_onset_item=999,  # Never triggers major struggle
        struggling_error_probability=0.15,
        struggling_latency_multiplier=1.1,
        struggling_hesitation_multiplier=1.1,
        struggling_option_changes=0,
        hint_request_probability=0.05,
        prefers_audio_hints=False,
        consent_acceptance_probability=0.90,
    ),
    "hesitant_adhd": StruggleProfileConfig(
        name="hesitant_adhd",
        description="Learner with ADHD experiencing executive function hurdles: high initial idle hesitation, rapid option switching, and multi-step friction.",
        disability_type_code="adhd",
        age_band_code="11-15",
        base_latency_ms=16000.0,
        latency_variance_ms=5000.0,
        base_hesitation_ms=9000.0,
        hesitation_variance_ms=3000.0,
        base_error_probability=0.25,
        struggle_onset_item=2,
        struggling_error_probability=0.60,
        struggling_latency_multiplier=1.8,
        struggling_hesitation_multiplier=2.4,
        struggling_option_changes=3,
        hint_request_probability=0.45,
        prefers_audio_hints=False,
        consent_acceptance_probability=0.88,
    ),
    "dyslexia_slow_reader": StruggleProfileConfig(
        name="dyslexia_slow_reader",
        description="Learner with Dyslexia: high text-decoding latency, low hesitation once started, benefits from multimodal audio and plain-language formatting.",
        disability_type_code="dyslexia",
        age_band_code="11-15",
        base_latency_ms=28000.0,
        latency_variance_ms=6000.0,
        base_hesitation_ms=4000.0,
        hesitation_variance_ms=1200.0,
        base_error_probability=0.20,
        struggle_onset_item=3,
        struggling_error_probability=0.55,
        struggling_latency_multiplier=1.7,
        struggling_hesitation_multiplier=1.3,
        struggling_option_changes=1,
        hint_request_probability=0.60,
        prefers_audio_hints=True,
        consent_acceptance_probability=0.92,
    ),
    "cognitive_overload_struggler": StruggleProfileConfig(
        name="cognitive_overload_struggler",
        description="Learner entering severe cognitive friction / sensory fatigue: escalating latency, consecutive errors, and erratic hint usage.",
        disability_type_code="asd",
        age_band_code="11-15",
        base_latency_ms=18000.0,
        latency_variance_ms=4000.0,
        base_hesitation_ms=5000.0,
        hesitation_variance_ms=2000.0,
        base_error_probability=0.30,
        struggle_onset_item=2,
        struggling_error_probability=0.85,
        struggling_latency_multiplier=2.5,
        struggling_hesitation_multiplier=2.6,
        struggling_option_changes=4,
        hint_request_probability=0.75,
        prefers_audio_hints=False,
        consent_acceptance_probability=0.80,
    ),
}
