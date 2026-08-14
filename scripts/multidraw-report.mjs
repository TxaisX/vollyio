// Does reading a clip more than once make the score mean more?
//
// The one gate the calibrated scale still fails is reliability: measured 0.64,
// meaning about a third of the variance a player sees between two reps is the
// same clip read twice. Calibration cannot touch that, because a monotone map
// stretches signal and noise together. More samples can.
//
// This measures the answer rather than assuming it. Sampling theory says the
// median of three reads should cut noise variance roughly threefold; whether it
// does depends on whether the draws are actually independent, which is an
// empirical question about one gateway and one model.
//
//   node scripts/multidraw-report.mjs [--results evals/multidraw-results.json]
//     [--corpus evals/corpus]

import { readFileSync, existsSync } from "node:fs";
import { combineReads, reliability, distribution } from "../lib/scale.ts";

const args = {};
{
  const rest = process.argv.slice(2);
  for (let i = 0; i < rest.length; i++) if (rest[i]?.startsWith("--")) args[rest[i].slice(2)] = rest[++i];
}
const RESULTS = args.results ?? "evals/multidraw-results.json";
// Measured per-read cost for the arm being reported. Defaults to the shipping
// model's observed $0.0185 (3,291 input and 1,808 output tokens at its rates);
// pass --rate when reporting a different model or the cost column lies.
const RATE = Number(args.rate ?? 0.0185);
const CORPUS = args.corpus ?? "evals/corpus";

if (!existsSync(RESULTS)) {
  console.error(`multidraw-report: no results at ${RESULTS}.`);
  process.exit(1);
}
const cases = Object.values(JSON.parse(readFileSync(RESULTS, "utf8")).cases ?? {});
const manifest = existsSync(`${CORPUS}/manifest.json`)
  ? JSON.parse(readFileSync(`${CORPUS}/manifest.json`, "utf8"))
  : [];
const levelOf = new Map(
  manifest.map((m) => [m.id, m.shipped_score != null ? "production" : m.source_level]),
);

// Pooled within-clip sd. The unbiased estimate of a single read's noise, and
// the input every reliability figure below shares.
function pooledNoise(perClipScores) {
  let ss = 0;
  let df = 0;
  for (const s of perClipScores) {
    if (s.length < 2) continue;
    const m = s.reduce((a, b) => a + b, 0) / s.length;
    ss += s.reduce((acc, x) => acc + (x - m) ** 2, 0);
    df += s.length - 1;
  }
  return df > 0 ? { sd: Math.sqrt(ss / df), df } : { sd: 0, df: 0 };
}

const usable = cases.filter((c) => (c.scores ?? []).length >= 2);
const perClip = usable.map((c) => c.scores);
const noise = pooledNoise(perClip);

// Arm A: one read, as production does it today. Taking the FIRST draw of each
// clip rather than the best or the mean, because one draw is exactly what a
// player gets.
const single = usable.map((c) => c.scores[0]);

// Arm B: the shipped combiner over every draw.
const combined = usable.map((c) => {
  const reads = (c.runs ?? []).map((r) => ({
    score: typeof r.score === "number" ? r.score : null,
    ratable: r.ratable !== false && typeof r.score === "number",
    visible: r.visible ?? 0,
    declared: r.declared ?? 5,
  }));
  return combineReads(reads);
});
const medians = combined.filter((c) => typeof c.score === "number").map((c) => c.score);

// The median of n draws has a standard error of about sd/sqrt(n) for n=3 on
// roughly normal draws; reported alongside the measured single-read noise so
// the improvement is attributable rather than asserted.
const nDraws = Math.min(...usable.map((c) => c.scores.length));
const medianNoise = noise.sd / Math.sqrt(nDraws);

// Test-retest, the version of this that assumes nothing.
//
// The reliability figures below are derived from a noise estimate, which
// carries an assumption about how the draws are distributed. Correlating draw 1
// against draw 2 across clips measures the same quantity directly: it IS the
// reliability of a single read. Spearman-Brown then says what averaging k reads
// buys, and it is the standard result rather than a guess.
function pearson(x, y) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
}
const retest = pearson(
  perClip.map((s) => s[0]),
  perClip.map((s) => s[1]),
);
const spearmanBrown = (k) => (k * retest) / (1 + (k - 1) * retest);

const dSingle = distribution(single);
const dMedian = distribution(medians);

console.log(`multidraw-report: ${usable.length} clips read ${nDraws}+ times each`);
console.log(`  single-read noise sd: ${noise.sd.toFixed(2)} (${noise.df} df)`);
console.log(`  median-of-${nDraws} noise sd (expected): ${medianNoise.toFixed(2)}`);
console.table([
  {
    arm: "single read (ships today)",
    n: dSingle.n,
    median: dSingle.median,
    sd: dSingle.sd,
    range: dSingle.range,
    reliability: Number(reliability(single, noise.sd).toFixed(2)),
  },
  {
    arm: `median of ${nDraws}`,
    n: dMedian.n,
    median: dMedian.median,
    sd: dMedian.sd,
    range: dMedian.range,
    reliability: Number(reliability(medians, medianNoise).toFixed(2)),
  },
]);

console.log(`  test-retest r for ONE read: ${retest.toFixed(3)} (measured, no distribution assumed)`);
console.table(
  [1, 2, 3, 5].map((k) => ({
    reads_averaged: k,
    reliability: Number(spearmanBrown(k).toFixed(3)),
    cost_per_analysis_usd: Number((RATE * k).toFixed(4)),
  })),
);

// Separation by footage level, on both arms. Cutting noise cannot CREATE
// ordering that was never there, so if the levels stay flat under the median
// the problem is the judgement and not the sampling. That distinction is the
// whole point of running this.
const rows = [];
for (const arm of ["single", "median"]) {
  const byLevel = {};
  usable.forEach((c, i) => {
    const level = levelOf.get(c.id) ?? "unknown";
    const value = arm === "single" ? single[i] : combined[i].score;
    if (typeof value === "number") (byLevel[level] ??= []).push(value);
  });
  for (const [level, values] of Object.entries(byLevel)) {
    const d = distribution(values);
    rows.push({ arm, level, n: d.n, mean: d.mean, sd: d.sd });
  }
}
console.log("  separation by footage level:");
console.table(rows.sort((a, b) => a.level.localeCompare(b.level) || a.arm.localeCompare(b.arm)));

const refusedNow = combined.filter((c) => !c.ratable).length;
console.log(
  `  refusals under majority voting: ${refusedNow}/${usable.length} (a clip most reads refuse is refused)`,
);
