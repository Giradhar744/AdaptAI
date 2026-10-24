"""Baseline Simulator for evaluating synthetic sessions against baseline modes (PROJECT.md §16).
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

from eval.trace_generator.generator import SyntheticTraceSession, SyntheticTraceItem
from eval.trace_generator.profiles import PRESET_PROFILES
from eval.baselines.configurations import BaselineConfig, BASELINE_CONFIGS
from app.ml.features import extract_behavioural_features
from app.ml.struggle_model import StruggleModel


@dataclass
class SimulationEvent:
    item_index: int
    event_type: str  # 'support_offered', 'consent_approved', 'consent_declined', 'unconsented_forced', 'hint_generated'
    proposal_type: str
    priority_class: str
    requires_consent: bool
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SessionSimulationResult:
    session_id: str
    baseline_key: str
    profile_name: str
    total_items: int
    ground_truth_onset: Optional[int]
    first_support_item_index: Optional[int]
    time_to_support_items: Optional[int]
    is_preemptive: bool
    total_interventions: int
    consent_requested_count: int
    consent_approved_count: int
    consent_declined_count: int
    unconsented_forced_count: int
    disability_alignment_score: float
    simulated_session_completed: bool
    events: List[SimulationEvent] = field(default_factory=list)


class BaselineSimulator:
    """Executes synthetic learning sessions against specified evaluation configurations."""

    @staticmethod
    def simulate_session(
        session: SyntheticTraceSession,
        baseline_config: BaselineConfig,
    ) -> SessionSimulationResult:
        profile = PRESET_PROFILES.get(session.profile_name)
        acceptance_prob = profile.consent_acceptance_probability if profile else 0.85

        consecutive_errors = 0
        first_support_index: Optional[int] = None
        is_preemptive = False
        events: List[SimulationEvent] = []

        total_interventions = 0
        consent_requested = 0
        consent_approved = 0
        consent_declined = 0
        unconsented_forced = 0
        alignment_scores: List[float] = []

        active_cooldown_items = 0

        # Accumulated rolling window history
        accumulated_signals: List[Dict[str, Any]] = []
        accumulated_responses: List[Dict[str, Any]] = []

        for item in session.items:
            # 1. Update response and consecutive errors
            if item.is_correct:
                consecutive_errors = 0
            else:
                consecutive_errors += 1

            accumulated_responses.append({
                "question_id": item.question_id,
                "is_correct": item.is_correct,
                "time_taken_ms": item.time_taken_ms,
                "hints_used": item.hints_used,
            })

            # Update signals
            accumulated_signals.extend([
                {"signal_type": "response_latency", "value": {"time_taken_ms": item.time_taken_ms}},
                {"signal_type": "input_hesitation", "value": {"idle_time_ms": item.idle_hesitation_ms, "option_changes": item.option_changes}},
            ])
            if item.hints_used > 0:
                accumulated_signals.append({
                    "signal_type": "hint_request",
                    "value": {"hints_used": item.hints_used, "escalated": (item.hints_used > 1)},
                })

            # Check disability hint alignment
            if item.hints_used > 0:
                if baseline_config.disability_aware_prompts:
                    # Tailored with bullet points / plain language / audio
                    alignment_scores.append(1.0)
                else:
                    # Generic dense text without neurodivergent scaffolding
                    alignment_scores.append(0.35)

            # 2. Evaluate struggle trigger based on baseline configuration
            struggle_triggered = False
            proposal_type = "scaffold_change"
            priority_class = "pedagogy"
            requires_consent = True

            if baseline_config.proactive_struggle_detection:
                # Proactive ML/Rules model evaluating rolling window
                features = extract_behavioural_features(accumulated_signals, accumulated_responses)
                score, risk_level, _ = StruggleModel.predict(features)
                if risk_level == "high":
                    struggle_triggered = True
                    proposal_type = "break_suggestion"
                    priority_class = "safety"
                    requires_consent = False
                elif risk_level == "medium":
                    struggle_triggered = True
                    proposal_type = "scaffold_change"
                    priority_class = "pedagogy"
                    requires_consent = True
            else:
                # Reactive baseline: Only reacts after >= 3 consecutive failures
                if consecutive_errors >= 3:
                    struggle_triggered = True
                    proposal_type = "scaffold_change"
                    priority_class = "pedagogy"
                    requires_consent = True

            # 3. Handle intervention & student consent
            if struggle_triggered:
                # Check cooldown / anti-nagging
                if active_cooldown_items > 0 and baseline_config.anti_nagging_protection:
                    active_cooldown_items -= 1
                    # Cooldown active, suppress nag
                    continue

                total_interventions += 1
                if first_support_index is None:
                    first_support_index = item.item_index
                    # Preemptive if assistance offered before 3 consecutive failures (the reactive threshold)
                    is_preemptive = (consecutive_errors < 3)

                if baseline_config.enforce_student_consent:
                    if requires_consent:
                        consent_requested += 1
                        # Simulated student decision based on profile probability
                        # Use pseudo-deterministic rule: accept unless high friction
                        if acceptance_prob >= 0.80:
                            consent_approved += 1
                            events.append(SimulationEvent(
                                item_index=item.item_index,
                                event_type="consent_approved",
                                proposal_type=proposal_type,
                                priority_class=priority_class,
                                requires_consent=True,
                            ))
                        else:
                            consent_declined += 1
                            active_cooldown_items = 2  # Set cooldown
                            events.append(SimulationEvent(
                                item_index=item.item_index,
                                event_type="consent_declined",
                                proposal_type=proposal_type,
                                priority_class=priority_class,
                                requires_consent=True,
                            ))
                    else:
                        # Safety break: auto-applied per Priority rule #1
                        events.append(SimulationEvent(
                            item_index=item.item_index,
                            event_type="safety_break_applied",
                            proposal_type=proposal_type,
                            priority_class=priority_class,
                            requires_consent=False,
                        ))
                else:
                    # Non-consent baseline: forced without student agency
                    unconsented_forced += 1
                    events.append(SimulationEvent(
                        item_index=item.item_index,
                        event_type="unconsented_forced",
                        proposal_type=proposal_type,
                        priority_class=priority_class,
                        requires_consent=False,
                    ))

        # Compute time to support (in questions) relative to ground truth onset
        time_to_support: Optional[int] = None
        if session.ground_truth_struggle_onset is not None and first_support_index is not None:
            time_to_support = max(0, first_support_index - session.ground_truth_struggle_onset)

        # Average alignment score
        avg_alignment = (sum(alignment_scores) / len(alignment_scores)) if alignment_scores else 1.0

        # Simulated completion: sessions with timely support and consent agency complete smoothly
        if session.profile_name == "cognitive_overload_struggler" and not is_preemptive and unconsented_forced > 1:
            session_completed = False  # Student simulated as quitting due to forced interventions / late help
        else:
            session_completed = True

        return SessionSimulationResult(
            session_id=session.session_id,
            baseline_key=baseline_config.key,
            profile_name=session.profile_name,
            total_items=session.total_items,
            ground_truth_onset=session.ground_truth_struggle_onset,
            first_support_item_index=first_support_index,
            time_to_support_items=time_to_support,
            is_preemptive=is_preemptive,
            total_interventions=total_interventions,
            consent_requested_count=consent_requested,
            consent_approved_count=consent_approved,
            consent_declined_count=consent_declined,
            unconsented_forced_count=unconsented_forced,
            disability_alignment_score=round(avg_alignment, 2),
            simulated_session_completed=session_completed,
            events=events,
        )
