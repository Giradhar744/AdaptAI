"""Deterministic Synthetic Trace Generator (PROJECT.md §16).

Generates simulated student learning traces across configurable struggle profiles.
Every item and session explicitly includes synthetic metadata disclaimers.
"""

import random
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional

from eval.trace_generator.profiles import StruggleProfileConfig, PRESET_PROFILES


SYNTHETIC_DATA_DISCLAIMER = (
    "SYNTHETIC BENCHMARK TRACE: Generated for algorithmic evaluation only per PROJECT.md Section 16. "
    "Contains no real student PII or clinical observations."
)


@dataclass
class SyntheticTraceItem:
    item_index: int
    question_id: str
    expected_correct_key: str
    selected_key: str
    is_correct: bool
    time_taken_ms: int
    idle_hesitation_ms: int
    option_changes: int
    hints_used: int
    hint_modality_requested: Optional[str]
    is_in_struggle_state: bool


@dataclass
class SyntheticTraceSession:
    session_id: str
    profile_name: str
    student_id: str
    disability_type_code: Optional[str]
    age_band_code: str
    total_items: int
    ground_truth_struggle_onset: Optional[int]
    items: List[SyntheticTraceItem]
    data_source: str = "synthetic"
    disclaimer: str = SYNTHETIC_DATA_DISCLAIMER

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "profile_name": self.profile_name,
            "student_id": self.student_id,
            "disability_type_code": self.disability_type_code,
            "age_band_code": self.age_band_code,
            "total_items": self.total_items,
            "ground_truth_struggle_onset": self.ground_truth_struggle_onset,
            "data_source": self.data_source,
            "disclaimer": self.disclaimer,
            "items": [asdict(item) for item in self.items],
        }


class SyntheticTraceGenerator:
    """Generates reproducible, parameterized synthetic student sessions."""

    def __init__(self, seed: int = 42):
        self.seed = seed
        self._rng = random.Random(seed)

    def generate_session(
        self,
        profile_key: str,
        num_items: int = 6,
        session_id: Optional[str] = None,
        student_id: Optional[str] = None,
    ) -> SyntheticTraceSession:
        profile = PRESET_PROFILES.get(profile_key)
        if not profile:
            raise ValueError(f"Unknown struggle profile: {profile_key}. Available: {list(PRESET_PROFILES.keys())}")

        sess_id = session_id or f"syn-sess-{profile_key}-{self._rng.randint(1000, 9999)}"
        stud_id = student_id or f"syn-stud-{profile_key}-{self._rng.randint(100, 999)}"

        items: List[SyntheticTraceItem] = []
        onset_index: Optional[int] = None

        for idx in range(num_items):
            is_struggling = (idx >= profile.struggle_onset_item)
            if is_struggling and onset_index is None:
                onset_index = idx

            # Latency computation
            if is_struggling:
                mean_lat = profile.base_latency_ms * profile.struggling_latency_multiplier
            else:
                mean_lat = profile.base_latency_ms
            latency = max(4000, int(self._rng.gauss(mean_lat, profile.latency_variance_ms)))

            # Hesitation computation
            if is_struggling:
                mean_hes = profile.base_hesitation_ms * profile.struggling_hesitation_multiplier
                option_changes = profile.struggling_option_changes + self._rng.randint(0, 1)
            else:
                mean_hes = profile.base_hesitation_ms
                option_changes = self._rng.randint(0, 1)
            hesitation = max(500, int(self._rng.gauss(mean_hes, profile.hesitation_variance_ms)))

            # Correctness probability
            err_prob = profile.struggling_error_probability if is_struggling else profile.base_error_probability
            is_correct = (self._rng.random() > err_prob)

            expected_key = "A"
            if is_correct:
                selected_key = expected_key
            else:
                selected_key = self._rng.choice(["B", "C", "D"])

            # Hint usage
            hints_used = 0
            hint_modality = None
            if self._rng.random() < profile.hint_request_probability:
                hints_used = self._rng.randint(1, 2)
                hint_modality = "audio" if profile.prefers_audio_hints else "text"

            items.append(
                SyntheticTraceItem(
                    item_index=idx,
                    question_id=f"q-syn-{idx + 1}",
                    expected_correct_key=expected_key,
                    selected_key=selected_key,
                    is_correct=is_correct,
                    time_taken_ms=latency,
                    idle_hesitation_ms=hesitation,
                    option_changes=option_changes,
                    hints_used=hints_used,
                    hint_modality_requested=hint_modality,
                    is_in_struggle_state=is_struggling,
                )
            )

        return SyntheticTraceSession(
            session_id=sess_id,
            profile_name=profile.name,
            student_id=stud_id,
            disability_type_code=profile.disability_type_code,
            age_band_code=profile.age_band_code,
            total_items=num_items,
            ground_truth_struggle_onset=onset_index,
            items=items,
        )

    def generate_benchmark_suite(
        self,
        sessions_per_profile: int = 5,
        num_items_per_session: int = 6,
    ) -> List[SyntheticTraceSession]:
        """Generates a complete benchmark dataset covering all preset profiles."""
        suite: List[SyntheticTraceSession] = []
        for profile_name in PRESET_PROFILES.keys():
            for i in range(sessions_per_profile):
                suite.append(
                    self.generate_session(
                        profile_key=profile_name,
                        num_items=num_items_per_session,
                        session_id=f"suite-{profile_name}-{i+1}",
                        student_id=f"student-{profile_name}-{i+1}",
                    )
                )
        return suite
