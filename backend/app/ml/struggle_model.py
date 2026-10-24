from typing import Dict, Any, List, Tuple


class StruggleModel:
    """
    Transparent, lightweight struggle scoring model per PROJECT.md §10.5 & §15.7.
    Produces:
    - struggle_score (0.0 to 1.0)
    - risk_level ('low', 'medium', 'high')
    - contributing_factors (list of human-readable rationale strings)
    """

    VERSION: str = "v1.0-rules"

    @classmethod
    def predict(cls, features: Dict[str, Any]) -> Tuple[float, str, List[str]]:
        contributing_factors: List[str] = []

        # 1. Error factor (weight 0.40)
        error_rate = features.get("error_rate", 0.0)
        consecutive_errors = features.get("consecutive_errors", 0)
        repeat_errors = features.get("repeat_errors", 0)

        error_score = min(1.0, (error_rate * 0.6) + (consecutive_errors * 0.25) + (repeat_errors * 0.15))
        if consecutive_errors >= 2:
            contributing_factors.append(f"{consecutive_errors} consecutive incorrect attempts")
        elif error_rate >= 0.5:
            contributing_factors.append(f"Elevated error rate ({int(error_rate * 100)}%)")

        # 2. Latency & Hesitation factor (weight 0.35)
        latency_ratio = features.get("latency_ratio", 1.0)
        hesitation_ratio = features.get("hesitation_ratio", 0.0)

        latency_component = min(1.0, max(0.0, (latency_ratio - 1.0) * 0.5))
        hesitation_component = min(1.0, max(0.0, (hesitation_ratio - 1.0) * 0.4))
        time_score = min(1.0, (latency_component * 0.6) + (hesitation_component * 0.4))

        if latency_ratio >= 1.75:
            contributing_factors.append(f"Response time is {latency_ratio:.1f}x higher than baseline")
        if hesitation_ratio >= 1.5:
            contributing_factors.append(f"Pronounced idle hesitation before first action ({features.get('mean_hesitation_ms', 0) / 1000:.1f}s)")

        # 3. Hint & Edit factor (weight 0.25)
        total_hints = features.get("total_hints", 0)
        total_edits = features.get("total_edits", 0)
        hint_escalations = features.get("hint_escalations", 0)

        effort_score = min(1.0, (total_hints * 0.25) + (total_edits * 0.15) + (hint_escalations * 0.3))
        if total_hints >= 2:
            contributing_factors.append(f"{total_hints} hints requested across recent problems")
        if total_edits >= 3:
            contributing_factors.append(f"Multiple answer revisions ({total_edits} option changes)")

        # Aggregate weighted score
        raw_score = (error_score * 0.45) + (time_score * 0.35) + (effort_score * 0.20)
        struggle_score = round(min(1.0, max(0.0, raw_score)), 2)

        # Determine risk level with high-priority overrides
        if struggle_score >= 0.70 or consecutive_errors >= 3 or (consecutive_errors >= 2 and latency_ratio >= 2.0):
            risk_level = "high"
            if not contributing_factors:
                contributing_factors.append("Sustained high friction detected across multiple behavioural signals")
        elif struggle_score >= 0.40 or consecutive_errors >= 2 or latency_ratio >= 1.8:
            risk_level = "medium"
            if not contributing_factors:
                contributing_factors.append("Moderate learning friction detected")
        else:
            risk_level = "low"

        return struggle_score, risk_level, contributing_factors
