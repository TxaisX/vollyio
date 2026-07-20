import { test } from "node:test";
import assert from "node:assert/strict";
import {
  summarizeCoverage,
  coverageGaps,
  tallyChecks,
  coverageReport,
  type CoverageCase,
} from "./eval-coverage.ts";
import { checkCase } from "./eval-score.ts";

function mk(over: Partial<CoverageCase> = {}): CoverageCase {
  return {
    id: "c",
    skill: "serve",
    discipline: "indoor",
    level: "pro",
    excluded: false,
    expected: {},
    ...over,
  };
}

test("counts active vs excluded and slices by level", () => {
  const cov = summarizeCoverage([
    mk({ id: "a" }),
    mk({ id: "b", excluded: true }),
    mk({ id: "c", level: "intermediate" }),
  ]);
  assert.equal(cov.total, 3);
  assert.equal(cov.active, 2);
  assert.equal(cov.excluded, 1);
  assert.equal(cov.byLevel.intermediate, 1);
  assert.equal(cov.targetPopulation, 1);
});

test("separates an unlabeled weakest_metric from a confirmed unknown", () => {
  const cov = summarizeCoverage([
    mk({ id: "a", expected: { weakest_metric: "" } }),
    mk({ id: "b", expected: { weakest_metric_unknown: true } }),
    mk({ id: "c", expected: { weakest_metric: "toss_quality" } }),
  ]);
  assert.equal(cov.labels.weakest_metric, 1);
  assert.equal(cov.labels.weakest_metric_unknown, 1);
  assert.equal(cov.labels.weakest_metric_missing, 1);
});

test("gaps name the target population and label coverage", () => {
  const gaps = coverageGaps(summarizeCoverage([mk()]));
  assert.ok(gaps.some((g) => g.includes("intermediate/expert")));
  assert.ok(gaps.some((g) => g.includes("weakest_metric label")));
});

test("a fully covered suite reports no gaps", () => {
  const cov = summarizeCoverage([
    mk({
      level: "intermediate",
      expected: { overall_min: 50, overall_max: 70, weakest_metric: "toss_quality" },
    }),
  ]);
  assert.deepEqual(coverageGaps(cov), []);
});

test("check tally separates fired from skipped", () => {
  const input = { overall_score: 61, metrics: [{ key: "a", score: 5 }], frameIndices: [0], frameCount: 4 };
  const tally = tallyChecks([
    checkCase(input, { overall_min: 50, overall_max: 70 }),
    checkCase(input, {}),
  ]);
  assert.deepEqual(tally.overall_in_range, { fired: 1, passed: 1, skipped: 1 });
  assert.equal(tally.weakest_metric.fired, 0);
  assert.equal(tally.weakest_metric.skipped, 2);
});

test("report calls out a check that never ran", () => {
  const input = { overall_score: 61, metrics: [{ key: "a", score: 5 }], frameIndices: [0], frameCount: 4 };
  const lines = coverageReport(
    summarizeCoverage([mk()]),
    tallyChecks([checkCase(input, {})]),
  );
  assert.ok(lines.some((l) => l.includes("weakest_metric") && l.includes("NEVER RAN")));
});
