// Pure, import-free agreement scoring for the analysis eval harness, so future
// frame/prompt changes can be measured instead of eyeballed. Headless-testable
// via node --test (see lib/eval-score.test.ts). The model-calling runner lives
// in app/api/eval/route.ts and feeds these functions.

export type EvalExpectation = {
  overall_min?: number; // expected overall-score band
  overall_max?: number;
  weakest_metric?: string; // the metric key that should score lowest
  // The roadmap allows a reviewer up to two acceptable alternatives to the
  // primary constraint; a hit on any of them counts as agreement.
  acceptable_weakest_metrics?: string[];
  // Set true only when a reviewer looked at the rep and judged that no single
  // weakest metric is resolvable from the footage. Distinguishes a deliberate
  // abstention from a case nobody has labeled yet, which otherwise look
  // identical (both leave weakest_metric falsy) and both silently skip.
  weakest_metric_unknown?: boolean;
  strongest_metric?: string; // the metric key that should score highest
  notes?: string;
  // Provenance, written by scripts/label-case.mjs. A label with no reviewer is
  // a label nobody stands behind.
  labeled_by?: string;
  labeled_at?: string;
};

export type ScoreInput = {
  overall_score: number;
  metrics: { key: string; score: number }[];
  frameIndices: number[]; // every cited frame index (insights + priority_fix)
  frameCount: number;
  // Whether this run actually fed the case's captured measurement block to the
  // model. null when the case carries no block at all.
  measurementsReplayed?: boolean | null;
};

// A check is pass, fail, or skipped. `skipped` exists so a check that never ran
// can never be counted as a check that passed: `ok` is false for skipped, and
// caseVerdict() reports such a case as "unverified" rather than "pass".
export type CheckStatus = "pass" | "fail" | "skipped";

export type CaseCheck = {
  name: string;
  ok: boolean;
  status: CheckStatus;
  detail: string;
  // Why the check did not run. Only set when status is "skipped".
  reason?: string;
};

// Checks that depend on a human-supplied label. If none of these fire, the case
// proved nothing about coaching quality no matter what the model returned.
export const LABEL_CHECKS = [
  "overall_in_range",
  "weakest_metric",
  "strongest_metric",
] as const;

/**
 * A band wide enough that no score could ever fall outside it carries no
 * information. Shared with the coverage report so both agree on what counts as
 * a real label.
 */
export function isVacuousBand(lo?: number | null, hi?: number | null): boolean {
  return (lo ?? 0) <= 0 && (hi ?? 100) >= 100;
}

function ran(name: string, ok: boolean, detail: string): CaseCheck {
  return { name, ok, status: ok ? "pass" : "fail", detail };
}

function skipped(name: string, reason: string): CaseCheck {
  return { name, ok: false, status: "skipped", detail: `skipped: ${reason}`, reason };
}

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

/**
 * Compare one model output against a case's expectation. Always returns one
 * entry per known check; unlabeled checks come back with status "skipped"
 * instead of being omitted, so callers can report what actually ran.
 */
export function checkCase(input: ScoreInput, expected: EvalExpectation): CaseCheck[] {
  const checks: CaseCheck[] = [];

  if (expected.overall_min != null || expected.overall_max != null) {
    const lo = expected.overall_min ?? 0;
    const hi = expected.overall_max ?? 100;
    // A full-width band admits every possible score. Exporters used to write
    // one as a placeholder, which made the check fire and always pass - worse
    // than no check at all, because it looked like agreement.
    if (isVacuousBand(lo, hi)) {
      checks.push(
        skipped("overall_in_range", `band [${lo}, ${hi}] admits every score; placeholder, not a label`),
      );
    } else {
      checks.push(
        ran(
          "overall_in_range",
          input.overall_score >= lo && input.overall_score <= hi,
          `${input.overall_score} vs [${lo}, ${hi}]`,
        ),
      );
    }
  } else {
    checks.push(skipped("overall_in_range", "no overall_min/overall_max label"));
  }

  const accepted = [
    expected.weakest_metric,
    ...(expected.acceptable_weakest_metrics ?? []),
  ].filter((k): k is string => typeof k === "string" && k.length > 0);
  if (accepted.length > 0) {
    const actual = extremeMetric(input.metrics, "min");
    checks.push(
      ran(
        "weakest_metric",
        actual != null && accepted.includes(actual),
        `expected one of [${accepted.join(", ")}], got ${actual ?? "none"}`,
      ),
    );
  } else if (expected.weakest_metric_unknown) {
    checks.push(
      skipped("weakest_metric", "reviewer judged no weakest metric resolvable from this footage"),
    );
  } else {
    checks.push(skipped("weakest_metric", "no weakest_metric label"));
  }

  if (expected.strongest_metric) {
    const actual = extremeMetric(input.metrics, "max");
    checks.push(
      ran(
        "strongest_metric",
        actual === expected.strongest_metric,
        `expected ${expected.strongest_metric}, got ${actual ?? "none"}`,
      ),
    );
  } else {
    checks.push(skipped("strongest_metric", "no strongest_metric label"));
  }

  const badCites = input.frameIndices.filter((i) => i < 0 || i >= input.frameCount);
  checks.push(
    ran(
      "citations_valid",
      badCites.length === 0,
      badCites.length > 0
        ? `out-of-range frame indices: ${badCites.join(", ")}`
        : `all ${input.frameIndices.length} valid`,
    ),
  );

  // Exercising the measurement path at all requires a case that captured one.
  if (input.measurementsReplayed == null) {
    checks.push(
      skipped("measurements_replayed", "case carries no captured measurement block"),
    );
  } else {
    checks.push(
      ran(
        "measurements_replayed",
        input.measurementsReplayed,
        input.measurementsReplayed
          ? "captured block was fed to the model"
          : "block present but replay was disabled for this run",
      ),
    );
  }

  return checks;
}

export type CaseVerdict = "pass" | "fail" | "unverified";

/**
 * A case only passes when at least one label-driven check actually ran. With no
 * label there is nothing to agree or disagree with, so the case is
 * "unverified" - never folded into a pass rate.
 */
export function caseVerdict(checks: CaseCheck[]): CaseVerdict {
  if (checks.some((c) => c.status === "fail")) return "fail";
  const labelRan = checks.some(
    (c) => (LABEL_CHECKS as readonly string[]).includes(c.name) && c.status !== "skipped",
  );
  return labelRan ? "pass" : "unverified";
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
