// Report what the eval suite can and cannot measure, without calling the model.
// Runs offline and costs nothing, so it can gate CI and be checked before any
// run: a pass rate over an unlabeled suite is meaningless, and this prints why.
//
// Usage:
//   node scripts/eval-coverage.mjs [--json] [--strict]
//
// --strict exits 1 when there is at least one blocking coverage gap.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  summarizeCoverage,
  coverageReport,
  coverageGaps,
  coverageSummaryLine,
} from "../lib/eval-coverage.ts";

const args = new Set(process.argv.slice(2));
const CASES_DIR = "evals/cases";

export function loadCoverageCases(dir = CASES_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const c = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
      return {
        id: c.id ?? f.replace(/\.json$/, ""),
        skill: c.skill ?? "unknown",
        discipline: c.discipline ?? "unknown",
        level: c.level ?? "unknown",
        excluded: c.excluded === true,
        expected: c.expected ?? {},
        hasMeasurements: c.measurements != null,
      };
    });
}

// Guarded so scripts/make-baseline.mjs can reuse loadCoverageCases() without
// triggering this CLI's output or its exit code.
if (import.meta.main) main();

function main() {
const cases = loadCoverageCases();
const coverage = summarizeCoverage(cases);
const gaps = coverageGaps(coverage);

if (args.has("--json")) {
  console.log(JSON.stringify({ coverage, gaps }, null, 2));
} else {
  for (const line of coverageReport(coverage)) console.log(line);
  console.log(`\n${coverageSummaryLine(coverage)}`);
  const unlabeled = cases.filter(
    (c) =>
      !c.excluded &&
      !c.expected.weakest_metric &&
      !(c.expected.acceptable_weakest_metrics ?? []).length &&
      c.expected.weakest_metric_unknown !== true,
  );
  if (unlabeled.length) {
    console.log(`\nCases needing a weakest_metric decision from a human (${unlabeled.length}):`);
    for (const c of unlabeled) console.log(`  ${c.id}`);
    console.log("Label them with: node scripts/label-case.mjs <case-id>");
  }
}

if (args.has("--strict") && gaps.length > 0) process.exit(1);
}
