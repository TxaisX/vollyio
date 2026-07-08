// Pure, import-free agreement scoring for the analysis eval harness, so future
// frame/prompt changes can be measured instead of eyeballed. Headless-testable
// via node --test (see lib/eval-score.test.ts). The model-calling runner lives
// in app/api/eval/route.ts and feeds these functions.

export type EvalExpectation = {
  overall_min?: number; // expected overall-score band
  overall_max?: number;
  weakest_metric?: string; // the metric key that should score lowest
  strongest_metric?: string; // the metric key that should score highest
  notes?: string;
};

export type ScoreInput = {
  overall_score: number;
  metrics: { key: string; score: number }[];
  frameIndices: number[]; // every cited frame index (insights + priority_fix)
  frameCount: number;
};

export type CaseCheck = { name: string; ok: boolean; detail: string };

function extremeMetric(
  metrics: { key: string; score: number }[],
  pick: "min" | "max",
): string | null {
  if (metrics.length === 0) return null;
  let best = metrics[0];
  for (const m of metrics) {
    if (pick === "min" ? m.score < best.score : m.score > best.score) best = m;
  }
  return best.key;
}

/** Compare one model output against a case's expectation. `pass` = all checks ok. */
export function checkCase(input: ScoreInput, expected: EvalExpectation): CaseCheck[] {
  const checks: CaseCheck[] = [];

  if (expected.overall_min != null || expected.overall_max != null) {
    const lo = expected.overall_min ?? 0;
    const hi = expected.overall_max ?? 100;
    checks.push({
      name: "overall_in_range",
      ok: input.overall_score >= lo && input.overall_score <= hi,
      detail: `${input.overall_score} vs [${lo}, ${hi}]`,
    });
  }

  if (expected.weakest_metric) {
    const actual = extremeMetric(input.metrics, "min");
    checks.push({
      name: "weakest_metric",
      ok: actual === expected.weakest_metric,
      detail: `expected ${expected.weakest_metric}, got ${actual ?? "none"}`,
    });
  }

  if (expected.strongest_metric) {
    const actual = extremeMetric(input.metrics, "max");
    checks.push({
      name: "strongest_metric",
      ok: actual === expected.strongest_metric,
      detail: `expected ${expected.strongest_metric}, got ${actual ?? "none"}`,
    });
  }

  const badCites = input.frameIndices.filter((i) => i < 0 || i >= input.frameCount);
  checks.push({
    name: "citations_valid",
    ok: badCites.length === 0,
    detail:
      badCites.length > 0
        ? `out-of-range frame indices: ${badCites.join(", ")}`
        : `all ${input.frameIndices.length} valid`,
  });

  return checks;
}

/** Run-to-run stability of the overall score across repeated runs of one case. */
export function checkStability(
  overalls: number[],
  tolerance = 8,
): { range: number; ok: boolean } {
  if (overalls.length < 2) return { range: 0, ok: true };
  const range = Math.max(...overalls) - Math.min(...overalls);
  return { range, ok: range <= tolerance };
}
