"""Evaluation metrics calculation and benchmark synthesis (PROJECT.md §16).

Aggregates simulation results across all baseline configurations and profiles.
"""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
from statistics import mean

from eval.baselines.simulator import SessionSimulationResult
from eval.baselines.configurations import BASELINE_CONFIGS


@dataclass
class BaselineMetricSummary:
    baseline_key: str
    baseline_name: str
    total_sessions_evaluated: int
    struggling_sessions_count: int
    support_trigger_count: int
    mean_time_to_support_items: float
    preemptive_support_rate: float
    student_consent_rate: float
    forced_adaptation_rate: float
    mean_disability_alignment: float
    simulated_completion_rate: float
    profile_breakdown: Dict[str, Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class BenchmarkEvaluator:
    """Computes comparative quantitative metrics across baseline configurations."""

    @staticmethod
    def evaluate_results(
        results_by_baseline: Dict[str, List[SessionSimulationResult]],
    ) -> Dict[str, BaselineMetricSummary]:
        summaries: Dict[str, BaselineMetricSummary] = {}

        for b_key, results in results_by_baseline.items():
            config = BASELINE_CONFIGS.get(b_key)
            b_name = config.name if config else b_key

            total_sessions = len(results)
            struggling_sessions = [r for r in results if r.ground_truth_onset is not None]

            # Time to support
            tt_supports = [
                r.time_to_support_items
                for r in struggling_sessions
                if r.time_to_support_items is not None
            ]
            mean_tts = round(mean(tt_supports), 2) if tt_supports else 99.0

            # Preemptive support rate
            supported_struggling = [r for r in struggling_sessions if r.first_support_item_index is not None]
            preemptive_count = sum(1 for r in supported_struggling if r.is_preemptive)
            preempt_rate = round(preemptive_count / len(supported_struggling) * 100, 1) if supported_struggling else 0.0

            # Consent & Agency metrics
            total_proposals = sum(r.total_interventions for r in results)
            total_consented = sum(r.consent_approved_count for r in results)
            total_forced = sum(r.unconsented_forced_count for r in results)

            consent_rate = round(total_consented / total_proposals * 100, 1) if total_proposals > 0 else 100.0
            forced_rate = round(total_forced / total_proposals * 100, 1) if total_proposals > 0 else 0.0

            # Disability alignment
            alignments = [r.disability_alignment_score for r in results]
            mean_alignment = round(mean(alignments), 2) if alignments else 1.0

            # Completion rate
            completed_count = sum(1 for r in results if r.simulated_session_completed)
            completion_rate = round(completed_count / total_sessions * 100, 1) if total_sessions > 0 else 100.0

            # Profile breakdown
            profile_stats: Dict[str, Dict[str, Any]] = {}
            profiles = set(r.profile_name for r in results)
            for p_name in profiles:
                p_results = [r for r in results if r.profile_name == p_name]
                p_tts = [r.time_to_support_items for r in p_results if r.time_to_support_items is not None]
                p_preempt = sum(1 for r in p_results if r.is_preemptive)
                profile_stats[p_name] = {
                    "sessions": len(p_results),
                    "mean_time_to_support": round(mean(p_tts), 2) if p_tts else None,
                    "preemptive_rate": round(p_preempt / len(p_results) * 100, 1) if p_results else 0.0,
                    "mean_alignment": round(mean(r.disability_alignment_score for r in p_results), 2),
                    "completion_rate": round(sum(1 for r in p_results if r.simulated_session_completed) / len(p_results) * 100, 1),
                }

            summaries[b_key] = BaselineMetricSummary(
                baseline_key=b_key,
                baseline_name=b_name,
                total_sessions_evaluated=total_sessions,
                struggling_sessions_count=len(struggling_sessions),
                support_trigger_count=len(supported_struggling),
                mean_time_to_support_items=mean_tts,
                preemptive_support_rate=preempt_rate,
                student_consent_rate=consent_rate,
                forced_adaptation_rate=forced_rate,
                mean_disability_alignment=mean_alignment,
                simulated_completion_rate=completion_rate,
                profile_breakdown=profile_stats,
            )

        return summaries
