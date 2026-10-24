#!/usr/bin/env python3
"""AdaptAI Evaluation Harness Runner (PROJECT.md §16).

Usage:
    python -m eval.run_evaluation
    or
    python eval/run_evaluation.py
"""

import sys
from pathlib import Path

# Add workspace root and backend directory to path
workspace_root = Path(__file__).parent.parent
backend_dir = workspace_root / "backend"
sys.path.insert(0, str(workspace_root))
sys.path.insert(0, str(backend_dir))

from eval.trace_generator.generator import SyntheticTraceGenerator
from eval.baselines.configurations import BASELINE_CONFIGS
from eval.baselines.simulator import BaselineSimulator, SessionSimulationResult
from eval.metrics.evaluator import BenchmarkEvaluator
from eval.reports.report_generator import ReportGenerator


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    print("=" * 80)
    print("  AdaptAI -- Evaluation Harness & Comparative Baseline Benchmark (Week 13)")
    print("=" * 80)
    print("\n[Notice] Generating synthetic learning traces (PROJECT.md Section 16)...")

    generator = SyntheticTraceGenerator(seed=42)
    sessions = generator.generate_benchmark_suite(
        sessions_per_profile=8,  # 8 sessions per profile * 4 profiles = 32 sessions
        num_items_per_session=6,
    )
    print(f"Generated {len(sessions)} synthetic student sessions across 4 profiles.")

    results_by_baseline: dict[str, list[SessionSimulationResult]] = {k: [] for k in BASELINE_CONFIGS.keys()}

    print("\n[Simulating] Executing sessions across 4 baseline configurations...")
    for b_key, b_config in BASELINE_CONFIGS.items():
        print(f"  -> Running configuration: {b_config.name}...")
        for sess in sessions:
            res = BaselineSimulator.simulate_session(sess, b_config)
            results_by_baseline[b_key].append(res)

    print("\n[Evaluating] Calculating comparative benchmark metrics...")
    summaries = BenchmarkEvaluator.evaluate_results(results_by_baseline)

    output_dir = workspace_root / "eval" / "reports"
    print(f"\n[Reporting] Exporting evaluation reports to: {output_dir}...")
    paths = ReportGenerator.generate_reports(summaries, output_dir)
    print(f"  [OK] Markdown report generated: {paths['markdown']}")
    print(f"  [OK] JSON summary generated:     {paths['json']}")

    # Print summary table to terminal
    print("\n" + "=" * 80)
    print("  COMPARATIVE EVALUATION SUMMARY (SYNTHETIC DATA BENCHMARK)")
    print("=" * 80)
    print(f"{'Baseline Config':<32} | {'Time to Support':<16} | {'Preemptive %':<12} | {'Consent %':<10} | {'Alignment':<10}")
    print("-" * 80)
    for b_key, summary in summaries.items():
        tts_str = f"{summary.mean_time_to_support_items} items"
        preempt_str = f"{summary.preemptive_support_rate}%"
        consent_str = f"{summary.student_consent_rate}%"
        align_str = f"{summary.mean_disability_alignment}"
        print(f"{summary.baseline_name:<32} | {tts_str:<16} | {preempt_str:<12} | {consent_str:<10} | {align_str:<10}")

    print("=" * 80)
    print("Evaluation completed successfully with zero external API dependencies.\n")


if __name__ == "__main__":
    main()
