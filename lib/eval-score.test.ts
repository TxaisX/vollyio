import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCase, checkStability, caseVerdict } from "./eval-score.ts";

const metrics = [
  { key: "toss_quality", score: 40 },
  { key: "arm_swing", score: 82 },
  { key: "contact_point", score: 60 },
];

function find(checks: { name: string }[], name: string) {
  const c = checks.find((x) => x.name === name);
  assert.ok(c, `expected a ${name} check`);
  return c as { name: string; ok: boolean; status: string; reason?: string };
}

test("overall in range passes; out of range fails", () => {
  const input = { overall_score: 61, metrics, frameIndices: [0, 1], frameCount: 8 };
  assert.equal(
    find(checkCase(input, { overall_min: 55, overall_max: 70 }), "overall_in_range").status,
    "pass",
  );
  assert.equal(
    find(checkCase(input, { overall_min: 70, overall_max: 90 }), "overall_in_range").status,
    "fail",
  );
});

test("weakest & strongest metric matching", () => {
  const input = { overall_score: 61, metrics, frameIndices: [0], frameCount: 8 };
  assert.equal(
    find(checkCase(input, { weakest_metric: "toss_quality" }), "weakest_metric").status,
    "pass",
  );
  assert.equal(
    find(checkCase(input, { weakest_metric: "contact_point" }), "weakest_metric").status,
    "fail",
  );
  assert.equal(
    find(checkCase(input, { strongest_metric: "arm_swing" }), "strongest_metric").status,
    "pass",
  );
});

test("an acceptable alternative counts as agreement", () => {
  const input = { overall_score: 61, metrics, frameIndices: [0], frameCount: 8 };
  const checks = checkCase(input, {
    weakest_metric: "contact_point",
    acceptable_weakest_metrics: ["toss_quality"],
  });
  assert.equal(find(checks, "weakest_metric").status, "pass");
});

test("citation validity catches out-of-range frame indices", () => {
  const good = { overall_score: 61, metrics, frameIndices: [0, 7], frameCount: 8 };
  const bad = { overall_score: 61, metrics, frameIndices: [0, 8], frameCount: 8 };
  assert.equal(find(checkCase(good, {}), "citations_valid").status, "pass");
  assert.equal(find(checkCase(bad, {}), "citations_valid").status, "fail");
});

test("missing labels report as skipped, never as passed", () => {
  const input = { overall_score: 61, metrics, frameIndices: [0], frameCount: 8 };
  const checks = checkCase(input, {});
  for (const name of ["overall_in_range", "weakest_metric", "strongest_metric"]) {
    const c = find(checks, name);
    assert.equal(c.status, "skipped");
    assert.equal(c.ok, false, `${name} must not read as ok when it never ran`);
  }
});

test("a placeholder 0-100 band is skipped, not auto-passed", () => {
  const input = { overall_score: 61, metrics, frameIndices: [0], frameCount: 8 };
  const checks = checkCase(input, { overall_min: 0, overall_max: 100 });
  const c = find(checks, "overall_in_range");
  assert.equal(c.status, "skipped");
  assert.equal(caseVerdict(checks), "unverified");
});

test("an empty-string weakest_metric is unlabeled, not an abstention", () => {
  const input = { overall_score: 61, metrics, frameIndices: [0], frameCount: 8 };
  const c = find(checkCase(input, { weakest_metric: "" }), "weakest_metric");
  assert.equal(c.status, "skipped");
  assert.match(c.reason ?? "", /no weakest_metric label/);
});

test("a reviewer-confirmed unknown skips with a distinct reason", () => {
  const input = { overall_score: 61, metrics, frameIndices: [0], frameCount: 8 };
  const c = find(
    checkCase(input, { weakest_metric_unknown: true }),
    "weakest_metric",
  );
  assert.equal(c.status, "skipped");
  assert.match(c.reason ?? "", /reviewer judged/);
});

test("a case with no labels is unverified, not a pass", () => {
  const input = { overall_score: 61, metrics, frameIndices: [0], frameCount: 8 };
  assert.equal(caseVerdict(checkCase(input, {})), "unverified");
  assert.equal(
    caseVerdict(checkCase(input, { overall_min: 55, overall_max: 70 })),
    "pass",
  );
  assert.equal(
    caseVerdict(checkCase(input, { overall_min: 80, overall_max: 90 })),
    "fail",
  );
});

test("a broken citation fails the case even with no labels at all", () => {
  const bad = { overall_score: 61, metrics, frameIndices: [99], frameCount: 8 };
  assert.equal(caseVerdict(checkCase(bad, {})), "fail");
});

test("stability flags a wide score spread", () => {
  assert.ok(checkStability([70, 72, 68]).ok);
  assert.ok(!checkStability([60, 80]).ok);
  assert.ok(checkStability([75]).ok); // single run is trivially stable
});
