from typing import List, Dict, Any, Optional
from statistics import mean, median
from app.core.config import settings


def extract_behavioural_features(
    signals: List[Dict[str, Any]],
    responses: List[Dict[str, Any]],
    student_baseline_latency_ms: Optional[float] = None,
    student_baseline_hesitation_ms: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Extracts rolling window behavioural features per PROJECT.md §10.5:
    - Latency: mean, median, ratio to student baseline
    - Errors: error rate, consecutive error streak, repeat error on same question
    - Hesitation: idle time before first interaction, edit/option-change count
    - Hints: total hint requests, hint escalation
    """
    default_baseline_latency = student_baseline_latency_ms or 15000.0  # 15s default
    default_baseline_hesitation = student_baseline_hesitation_ms or 5000.0  # 5s default

    # 1. Latency metrics
    latencies = [
        s.get("value", {}).get("time_taken_ms", 0)
        for s in signals
        if s.get("signal_type") == "response_latency"
    ]
    # Fallback to response latencies if signal not explicitly sent
    if not latencies and responses:
        latencies = [r.get("time_taken_ms", 0) for r in responses if r.get("time_taken_ms")]

    mean_latency = mean(latencies) if latencies else default_baseline_latency
    med_latency = median(latencies) if latencies else default_baseline_latency
    latency_ratio = mean_latency / default_baseline_latency if default_baseline_latency > 0 else 1.0

    # 2. Hesitation metrics
    hesitations = [
        s.get("value", {}).get("idle_time_ms", 0)
        for s in signals
        if s.get("signal_type") == "input_hesitation"
    ]
    mean_hesitation = mean(hesitations) if hesitations else 0.0
    hesitation_ratio = mean_hesitation / default_baseline_hesitation if default_baseline_hesitation > 0 else 0.0

    edit_counts = [
        s.get("value", {}).get("option_changes", 0) + s.get("value", {}).get("edit_count", 0)
        for s in signals
        if s.get("signal_type") == "input_hesitation"
    ]
    total_edits = sum(edit_counts)

    # 3. Error metrics
    # Inspect responses or error_pattern signals
    error_signals = [
        s.get("value", {})
        for s in signals
        if s.get("signal_type") == "error_pattern"
    ]
    if responses:
        total_attempts = len(responses)
        incorrect_attempts = sum(1 for r in responses if not r.get("is_correct"))
        error_rate = (incorrect_attempts / total_attempts) if total_attempts > 0 else 0.0

        # Calculate consecutive error streak at the end of the window
        consecutive_errors = 0
        for r in reversed(responses):
            if not r.get("is_correct"):
                consecutive_errors += 1
            else:
                break
    elif error_signals:
        total_attempts = len(error_signals)
        incorrect_attempts = sum(1 for s in error_signals if not s.get("is_correct", True))
        error_rate = (incorrect_attempts / total_attempts) if total_attempts > 0 else 0.0
        consecutive_errors = 0
        for s in reversed(error_signals):
            if not s.get("is_correct", True):
                consecutive_errors += 1
            else:
                break
    else:
        error_rate = 0.0
        consecutive_errors = 0

    # Repeat errors on same question
    question_ids = [r.get("question_id") for r in responses if r.get("question_id")]
    repeat_errors = sum(
        1 for q in set(question_ids)
        if sum(1 for r in responses if r.get("question_id") == q and not r.get("is_correct")) > 1
    )

    # 4. Hint metrics
    hint_signals = [
        s.get("value", {})
        for s in signals
        if s.get("signal_type") == "hint_request"
    ]
    total_hints = sum(h.get("hints_used", 1) for h in hint_signals)
    if not total_hints and responses:
        total_hints = sum(r.get("hints_used", 0) for r in responses)

    hint_escalations = sum(1 for h in hint_signals if h.get("escalated", False))

    return {
        "mean_latency_ms": round(mean_latency, 1),
        "median_latency_ms": round(med_latency, 1),
        "latency_ratio": round(latency_ratio, 2),
        "mean_hesitation_ms": round(mean_hesitation, 1),
        "hesitation_ratio": round(hesitation_ratio, 2),
        "total_edits": total_edits,
        "error_rate": round(error_rate, 2),
        "consecutive_errors": consecutive_errors,
        "repeat_errors": repeat_errors,
        "total_hints": total_hints,
        "hint_escalations": hint_escalations,
        "window_size": len(responses) or len(signals),
    }
