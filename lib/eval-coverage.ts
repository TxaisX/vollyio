// Pure, import-free coverage accounting for the eval harness. Answers the
// question the pass rate cannot: how much of the suite is actually capable of
// measuring anything, and which checks really ran. A harness that reports
// "18/18 passed" while every label is missing is reporting nothing, so these
// numbers are printed next to every result.
//
// Kept dependency-free (no "@/" aliases) so scripts/*.mjs can import it
// directly under Node's type stripping, same as lib/eval-score.ts.

import type { CaseCheck, EvalExpectation } from "./eval-score.ts";
import { isVacuousBand } from "./eval-score.ts";

// The population the product actually targets (see
// docs/analysis-validation-roadmap.md decision 5). Pro footage is a regression
// set, not the product eval, so it does not count toward target coverage.
export const TARGET_LEVELS = ["intermediate", "expert"] as const;

export type CoverageCase = {
  id: string;
  skill: string;
  discipline: string;
  level: string;
  excluded: boolean;
  expected: EvalExpectation;
};

export type Coverage = {
  total: number;
  active: number;
  excluded: number;
  byLevel: Record<string, number>;
  bySkill: Record<string, number>;
  byDiscipline: Record<string, number>;
  targetPopulation: number; // active cases at intermediate or expert
  labels: {
    overall_band: number;
    weakest_metric: number;
    weakest_metric_unknown: number; // reviewer-confirmed abstention
    weakest_metric_missing: number; // neither labeled nor confirmed unknown
    strongest_metric: number;
  };
  // Active cases with no label-driven check available at all: they can never
  // pass or fail, only sit unverified.
  unverifiable: number;
};

function tally(rows: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r] = (out[r] ?? 0) + 1;
  return out;
}

export function summarizeCoverage(cases: CoverageCase[]): Coverage {
  const active = cases.filter((c) => !c.excluded);
  const hasWeakest = (e: EvalExpectation) =>
    Boolean(e.weakest_metric) || (e.acceptable_weakest_metrics ?? []).length > 0;
  // A placeholder 0-100 band is not a label; it just makes the check pass.
  const hasBand = (e: EvalExpectation) =>
    (e.overall_min != null || e.overall_max != null) &&
    !isVacuousBand(e.overall_min, e.overall_max);

  return {
    total: cases.length,
    active: active.length,
    excluded: cases.length - active.length,
    byLevel: tally(active.map((c) => c.level)),
    bySkill: tally(active.map((c) => c.skill)),
    byDiscipline: tally(active.map((c) => c.discipline)),
    targetPopulation: active.filter((c) =>
      (TARGET_LEVELS as readonly string[]).includes(c.level),
    ).length,
    labels: {
      overall_band: active.filter((c) => hasBand(c.expected)).length,
      weakest_metric: active.filter((c) => hasWeakest(c.expected)).length,
      weakest_metric_unknown: active.filter(
        (c) => !hasWeakest(c.expected) && c.expected.weakest_metric_unknown === true,
      ).length,
      weakest_metric_missing: active.filter(
        (c) => !hasWeakest(c.expected) && c.expected.weakest_metric_unknown !== true,
      ).length,
      strongest_metric: active.filter((c) => Boolean(c.expected.strongest_metric)).length,
    },
    unverifiable: active.filter(
      (c) =>
        !hasBand(c.expected) &&
        !hasWeakest(c.expected) &&
        !c.expected.strongest_metric,
    ).length,
  };
}

export type CheckTally = Record<string, { fired: number; passed: number; skipped: number }>;

/** How many times each named check actually ran vs was skipped across a run. */
export function tallyChecks(perCase: CaseCheck[][]): CheckTally {
  const out: CheckTally = {};
  for (const checks of perCase) {
    for (const c of checks) {
      const row = (out[c.name] ??= { fired: 0, passed: 0, skipped: 0 });
      if (c.status === "skipped") row.skipped++;
      else {
        row.fired++;
        if (c.status === "pass") row.passed++;
      }
    }
  }
  return out;
}

/**
 * Human-readable report. Deliberately blunt: every zero is called out as a gap
 * that needs a human, not left for the reader to notice.
 */
export function coverageReport(cov: Coverage, checks?: CheckTally): string[] {
  const lines: string[] = [];
  const pct = (n: number) => (cov.active ? `${Math.round((n / cov.active) * 100)}%` : "0%");

  lines.push(`Cases: ${cov.total} total, ${cov.active} active, ${cov.excluded} excluded`);
  lines.push(
    `  level: ${Object.entries(cov.byLevel)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ") || "none"}`,
  );
  lines.push(
    `  skill: ${Object.entries(cov.bySkill)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ") || "none"}`,
  );
  lines.push(
    `  discipline: ${Object.entries(cov.byDiscipline)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ") || "none"}`,
  );
  lines.push("Label coverage (active cases):");
  const l = cov.labels;
  lines.push(`  overall band       ${l.overall_band}/${cov.active} (${pct(l.overall_band)})`);
  lines.push(`  weakest_metric     ${l.weakest_metric}/${cov.active} (${pct(l.weakest_metric)})`);
  lines.push(`    reviewer-confirmed unknown: ${l.weakest_metric_unknown}`);
  lines.push(`    unlabeled (needs a human):  ${l.weakest_metric_missing}`);
  lines.push(
    `  strongest_metric   ${l.strongest_metric}/${cov.active} (${pct(l.strongest_metric)})`,
  );
  lines.push(
    `Target population (intermediate/expert): ${cov.targetPopulation}/${cov.active} (${pct(cov.targetPopulation)})`,
  );

  if (checks && Object.keys(checks).length > 0) {
    lines.push("Checks (this run):");
    for (const [name, row] of Object.entries(checks)) {
      const verdict =
        row.fired === 0
          ? "NEVER RAN"
          : `${row.passed}/${row.fired} passed`;
      lines.push(`  ${name.padEnd(20)} ${verdict}, ${row.skipped} skipped`);
    }
  }

  for (const gap of coverageGaps(cov)) lines.push(`GAP: ${gap}`);
  return lines;
}

/** Blocking gaps: reasons the current suite cannot support a product claim. */
export function coverageGaps(cov: Coverage): string[] {
  const gaps: string[] = [];
  if (cov.targetPopulation === 0) {
    gaps.push(
      "0 active cases at intermediate/expert. The suite cannot measure the stated target population.",
    );
  }
  if (cov.labels.weakest_metric === 0) {
    gaps.push(
      `0 of ${cov.active} active cases carry a weakest_metric label, so the constraint-diagnosis check never fires. Needs human labeling.`,
    );
  }
  if (cov.labels.weakest_metric_missing > 0) {
    gaps.push(
      `${cov.labels.weakest_metric_missing} active cases have neither a weakest_metric nor a reviewer-confirmed weakest_metric_unknown flag; they are unlabeled, not abstentions.`,
    );
  }
  if (cov.unverifiable > 0) {
    gaps.push(
      `${cov.unverifiable} active cases carry no label of any kind and can only ever report "unverified".`,
    );
  }
  return gaps;
}

/** One-line summary suitable for CI logs and the API response. */
export function coverageSummaryLine(cov: Coverage): string {
  const l = cov.labels;
  return `${cov.active} active cases | band ${l.overall_band} | weakest ${l.weakest_metric} | strongest ${l.strongest_metric} | target-level ${cov.targetPopulation} | ${coverageGaps(cov).length} blocking gaps`;
}
