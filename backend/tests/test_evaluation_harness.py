import pytest
from pathlib import Path

from eval.trace_generator.generator import SyntheticTraceGenerator, SYNTHETIC_DATA_DISCLAIMER
from eval.trace_generator.profiles import PRESET_PROFILES
from eval.baselines.configurations import BASELINE_CONFIGS
from eval.baselines.simulator import BaselineSimulator
from eval.metrics.evaluator import BenchmarkEvaluator
from eval.reports.report_generator import ReportGenerator


def test_synthetic_trace_generation_integrity():
    generator = SyntheticTraceGenerator(seed=123)
    sessions = generator.generate_benchmark_suite(sessions_per_profile=2, num_items_per_session=5)

    assert len(sessions) == 2 * len(PRESET_PROFILES)
    for sess in sessions:
        assert sess.data_source == "synthetic"
        assert "SYNTHETIC" in sess.disclaimer
        assert len(sess.items) == 5
        d = sess.to_dict()
        assert d["data_source"] == "synthetic"
        assert "items" in d


def test_baseline_simulation_and_metrics_contrast():
    generator = SyntheticTraceGenerator(seed=42)
    # Generate test traces for an ADHD student experiencing friction
    adhd_session = generator.generate_session("hesitant_adhd", num_items=6)

    # 1. AdaptAI (Proposed Full System)
    res_adapt = BaselineSimulator.simulate_session(adhd_session, BASELINE_CONFIGS["adapt_ai"])
    assert res_adapt.unconsented_forced_count == 0  # Zero unconsented interventions
    assert res_adapt.disability_alignment_score == 1.0  # Fully disability aligned
    assert res_adapt.is_preemptive is True  # Supported before repeated failure

    # 2. Reactive Baseline (waits for failure streak)
    res_reactive = BaselineSimulator.simulate_session(adhd_session, BASELINE_CONFIGS["reactive"])
    assert res_reactive.is_preemptive is False  # Reactive baseline cannot preempt!

    # 3. Non-Consent Baseline (forces adaptations)
    res_non_consent = BaselineSimulator.simulate_session(adhd_session, BASELINE_CONFIGS["non_consent"])
    assert res_non_consent.unconsented_forced_count >= 1  # Forcibly applied without agency
    assert res_non_consent.consent_requested_count == 0

    # 4. Non-Disability-Aware Baseline
    res_non_dis = BaselineSimulator.simulate_session(adhd_session, BASELINE_CONFIGS["non_disability_aware"])
    assert res_non_dis.disability_alignment_score < 0.60  # Degraded generic accommodation


def test_end_to_end_evaluation_report_generation(tmp_path: Path):
    generator = SyntheticTraceGenerator(seed=99)
    sessions = generator.generate_benchmark_suite(sessions_per_profile=3, num_items_per_session=4)

    results_by_baseline = {k: [] for k in BASELINE_CONFIGS.keys()}
    for b_key, b_config in BASELINE_CONFIGS.items():
        for s in sessions:
            results_by_baseline[b_key].append(BaselineSimulator.simulate_session(s, b_config))

    summaries = BenchmarkEvaluator.evaluate_results(results_by_baseline)
    assert len(summaries) == 4

    # Assert metric contrasts
    adapt_sum = summaries["adapt_ai"]
    reactive_sum = summaries["reactive"]
    non_consent_sum = summaries["non_consent"]
    non_dis_sum = summaries["non_disability_aware"]

    # AdaptAI must have faster or equal time-to-support than Reactive
    assert adapt_sum.mean_time_to_support_items < reactive_sum.mean_time_to_support_items
    assert adapt_sum.preemptive_support_rate > reactive_sum.preemptive_support_rate

    # AdaptAI has 0 forced adaptations; Non-Consent has high forced adaptations
    assert adapt_sum.forced_adaptation_rate == 0.0
    assert non_consent_sum.forced_adaptation_rate == 100.0

    # AdaptAI has higher disability alignment than non-disability-aware
    assert adapt_sum.mean_disability_alignment > non_dis_sum.mean_disability_alignment

    # Generate and verify report artifacts
    report_paths = ReportGenerator.generate_reports(summaries, tmp_path)
    assert report_paths["markdown"].exists()
    assert report_paths["json"].exists()

    md_content = report_paths["markdown"].read_text(encoding="utf-8")
    assert "AdaptAI" in md_content
    assert "Comparative Benchmark Matrix" in md_content
    assert "SYNTHETIC" in md_content.upper()
