// Turn eval results (+ coach labels, when they exist) into the scoring map.
//
// Two modes, and it says which one it is in:
//   - PROVISIONAL: no labels yet, so lib/scale.ts's measured-compression map is
//     applied and reported. Useful for seeing the shape of the change; not
//     evidence about any individual rep.
//   - FITTED: coach labels exist, so the map is refitted through them
//     (isotonic, monotone) and the report carries the fit quality: rank
//     correlation between the model's ordering and the coach's, and the mean
//     absolute error after mapping. Rank correlation is the number that decides
//     whether calibrating is even legitimate: if the model cannot ORDER reps,
//     no monotone map can rescue the scale and the fix is upstream.
//
//   node scripts/fit-scale.mjs [--results evals/video-results.json]
//     [--labels evals/labels.json] [--corpus evals/corpus] [--out evals/scale-report.md]

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  calibrate,
  coveragePct,
  coverageCap,
  distribution,
  finalScore,
  fitAnchors,
  PROVISIONAL_ANCHORS,
} from "../lib/scale.ts";
import { runGates, gateVerdict } from "../lib/eval-gate.ts";

const args = {};
{
  const rest = process.argv.slice(2);
  for (let i = 0; i < rest.length; i++) if (rest[i]?.startsWith("--")) args[rest[i].slice(2)] = rest[++i];
}
const RESULTS = args.results ?? "evals/video-results.json";
const LABELS = args.labels ?? "evals/labels.json";
const CORPUS = args.corpus ?? "evals/corpus";
const OUT = args.out ?? "evals/scale-report.md";
// Stability is measured on a SAMPLE, in its own run, because repeating every
// clip three times costs three times a full suite to answer a question a
// fifteen-clip sample answers. Merged in here so one report carries one verdict.
const STABILITY = args.stability ?? "evals/stability-results.json";

if (!existsSync(RESULTS)) {
  console.error(`fit-scale: no results at ${RESULTS}. Run scripts/video-eval.mjs first.`);
  process.exit(1);
}
const results = JSON.parse(readFileSync(RESULTS, "utf8"));
const labels = existsSync(LABELS) ? JSON.parse(readFileSync(LABELS, "utf8")).by_id ?? {} : {};
const manifest = existsSync(`${CORPUS}/manifest.json`)
  ? JSON.parse(readFileSync(`${CORPUS}/manifest.json`, "utf8"))
  : [];
const shipped = new Map(manifest.map((m) => [m.id, m.shipped_score]));

const cases = Object.values(results.cases ?? {}).filter((c) => typeof c.score === "number");
const refused = Object.values(results.cases ?? {}).filter((c) => c.refusals > 0);

// Spearman rank correlation. Ties get average ranks, because the model piles
// many clips onto the same value and treating those as an arbitrary order
// would invent agreement or disagreement that is not there.
function ranks(values) {
  const idx = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = new Array(values.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[idx[k].i] = avg;
    i = j + 1;
  }
  return out;
}
function spearman(a, b) {
  if (a.length < 3) return null;
  const ra = ranks(a);
  const rb = ranks(b);
  const n = a.length;
  const ma = ra.reduce((s, x) => s + x, 0) / n;
  const mb = rb.reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return da === 0 || db === 0 ? null : Number((num / Math.sqrt(da * db)).toFixed(3));
}

const labeled = cases
  .map((c) => ({ c, l: labels[c.id] }))
  .filter(({ l }) => l && !l.unratable && typeof l.mid === "number");

let anchors = PROVISIONAL_ANCHORS;
let mode = "PROVISIONAL";
let rho = null;
let mae = null;

if (labeled.length >= 8) {
  const pairs = labeled.map(({ c, l }) => ({ raw: c.score, label: l.mid }));
  const fitted = fitAnchors(pairs);
  if (fitted) {
    anchors = fitted;
    mode = "FITTED";
  }
  rho = spearman(pairs.map((p) => p.raw), pairs.map((p) => p.label));
  const errs = pairs.map((p) => Math.abs(calibrate(p.raw, anchors) - p.label));
  mae = Number((errs.reduce((a, b) => a + b, 0) / errs.length).toFixed(1));
}

const rows = cases
  .map((c) => {
    const run = (c.runs ?? []).find((r) => typeof r.visible === "number");
    const visible = run?.visible ?? 5;
    const declared = run?.declared ?? 5;
    const out = finalScore(c.score, visible, declared, anchors);
    const l = labels[c.id];
    return {
      id: c.id,
      skill: c.skill,
      shipped: shipped.get(c.id) ?? null,
      raw: c.score,
      calibrated: out.calibrated,
      coverage: out.coverage_pct,
      score: out.score,
      capped: out.capped,
      coach: l && !l.unratable ? l.label : l?.unratable ? "cannot rate" : "",
      coach_mid: l?.mid ?? null,
    };
  })
  .sort((a, b) => a.score - b.score);

const before = distribution(rows.map((r) => r.raw));
const after = distribution(rows.map((r) => r.score));

// Discrimination, without waiting for a single coach label.
//
// Sourced footage carries the SOURCE's claim about the athlete: a beginners'
// tutorial is beginner footage, an Olympian highlight is professional footage.
// That is a weak label about the athlete and not about the rep, so it can never
// calibrate anything. It can still answer the question calibration depends on:
// does the model score a beginner below a professional AT ALL? If those two
// populations come back at the same number, the ordering signal a monotone map
// needs is not there, and the fix is upstream of any map.
const levelOf = new Map(manifest.map((m) => [m.id, m.shipped_score != null ? "production" : m.source_level]));
const byLevel = {};
for (const r of rows) {
  const level = levelOf.get(r.id) ?? "unknown";
  (byLevel[level] ??= []).push(r.raw);
}
const levelOrder = ["developing", "intermediate", "advanced", "pro", "production", "unknown"];
const levelRows = levelOrder
  .filter((l) => byLevel[l]?.length)
  .map((l) => ({ level: l, ...distribution(byLevel[l]) }));
// Refusals are counted per level too: a beginners' tutorial and a highlight reel
// should not refuse at the same rate, and a corpus-wide rate hides that.
const refusedByLevel = {};
for (const c of refused) {
  const level = levelOf.get(c.id) ?? "unknown";
  refusedByLevel[level] = (refusedByLevel[level] ?? 0) + 1;
}

// Read noise, pooled across every clip that was read more than once. Measured
// rather than estimated: the within-clip sd IS the noise, where a spread is a
// range statistic that has to be converted with an assumption about n.
function pooledNoiseSd(files) {
  let ss = 0;
  let df = 0;
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const c of Object.values(JSON.parse(readFileSync(file, "utf8")).cases ?? {})) {
      const s = (c.scores ?? []).filter((n) => Number.isFinite(n));
      if (s.length < 2) continue;
      const m = s.reduce((a, b) => a + b, 0) / s.length;
      ss += s.reduce((acc, x) => acc + (x - m) ** 2, 0);
      df += s.length - 1;
    }
  }
  return df > 0 ? Math.sqrt(ss / df) : undefined;
}
const noiseSd = pooledNoiseSd([RESULTS, STABILITY]);

// The gates, run against the CALIBRATED scores: the question is never "was the
// model's raw output acceptable", it is "is what the player would see
// acceptable". Refusal gates need coach labels and skip until those exist.
const allCases = Object.values(results.cases ?? {});
const visibilityReads = allCases.flatMap((c) => c.runs ?? []).filter((r) => typeof r.visible === "number");
const gates = runGates({
  scores: rows.map((r) => r.score),
  refusedRatable: refused.filter((c) => labels[c.id] && labels[c.id].unratable === false).length,
  scoredRatable: rows.filter((r) => labels[r.id] && labels[r.id].unratable === false).length,
  refusedUnratable: refused.filter((c) => labels[c.id]?.unratable === true).length,
  scoredUnratable: rows.filter((r) => labels[r.id]?.unratable === true).length,
  fullVisibility: visibilityReads.filter((r) => r.visible === r.declared).length,
  visibilityReads: visibilityReads.length,
  rawScores: rows.map((r) => r.raw),
  noiseSd,
  spreads: [
    ...allCases.filter((c) => (c.scores ?? []).length > 1).map((c) => c.spread),
    ...(existsSync(STABILITY)
      ? Object.values(JSON.parse(readFileSync(STABILITY, "utf8")).cases ?? {})
          .filter((c) => (c.scores ?? []).length > 1)
          .map((c) => c.spread)
      : []),
  ],
});
const verdict = gateVerdict(gates);

const md = [
  `# Scoring scale report`,
  ``,
  `Mode: **${mode}**${mode === "PROVISIONAL" ? " (no coach labels yet; the map is a measured guess, not evidence)" : ` from ${labeled.length} coach-labeled clips`}`,
  `Corpus: ${cases.length} scored clips, ${refused.length} refused. Model: ${results.model}`,
  rho != null ? `Rank correlation model vs coach: **${rho}** (this decides whether calibration is legitimate at all)` : ``,
  mae != null ? `Mean absolute error after mapping: **${mae}** points` : ``,
  ``,
  `## Gates`,
  ``,
  `Verdict: **${verdict.toUpperCase()}**`,
  ``,
  `| gate | status | detail |`,
  `|---|---|---|`,
  ...gates.map((g) => `| ${g.name} | ${g.status} | ${g.detail} |`),
  ``,
  `## Distribution`,
  ``,
  `| | n | min | p10 | median | p90 | max | sd | range used |`,
  `|---|---|---|---|---|---|---|---|---|`,
  `| raw (what ships today) | ${before.n} | ${before.min} | ${before.p10} | ${before.median} | ${before.p90} | ${before.max} | ${before.sd} | ${before.range} |`,
  `| calibrated | ${after.n} | ${after.min} | ${after.p10} | ${after.median} | ${after.p90} | ${after.max} | ${after.sd} | ${after.range} |`,
  ``,
  `## Discrimination: raw score by footage level`,
  ``,
  `The level is the SOURCE's claim about the athlete, not a label about the rep.`,
  `It cannot calibrate anything. It can show whether the model separates a`,
  `beginners' tutorial from professional footage at all.`,
  ``,
  `| level | n | min | median | max | mean | sd | refused |`,
  `|---|---|---|---|---|---|---|---|`,
  ...levelRows.map(
    (l) =>
      `| ${l.level} | ${l.n} | ${l.min} | ${l.median} | ${l.max} | ${l.mean} | ${l.sd} | ${refusedByLevel[l.level] ?? 0} |`,
  ),
  ``,
  `## Anchors in force`,
  ``,
  `| model says | player sees |`,
  `|---|---|`,
  ...anchors.map((a) => `| ${a.raw} | ${a.final} |`),
  ``,
  `## Every clip, worst first`,
  ``,
  `| clip | skill | shipped | model raw | coverage | proposed | coach |`,
  `|---|---|---|---|---|---|---|`,
  ...rows.map(
    (r) =>
      `| ${r.id} | ${r.skill} | ${r.shipped ?? "-"} | ${r.raw} | ${r.coverage}%${r.capped ? " (capped)" : ""} | **${r.score}** | ${r.coach} |`,
  ),
  ``,
].filter(Boolean).join("\n");

writeFileSync(OUT, md);
writeFileSync(
  OUT.replace(/\.md$/, ".json"),
  JSON.stringify({ mode, verdict, gates, anchors, rho, mae, before, after, levelRows, rows }, null, 2),
);

console.log(`fit-scale: ${mode}, ${cases.length} clips${labeled.length ? `, ${labeled.length} labeled` : ""}`);
if (rho != null) console.log(`  rank correlation: ${rho}   MAE after mapping: ${mae}`);
console.table([
  { scale: "raw (ships today)", ...before },
  { scale: "calibrated", ...after },
]);
console.log("  raw score by footage level (discrimination check):");
console.table(levelRows.map((l) => ({ ...l, refused: refusedByLevel[l.level] ?? 0 })));
console.log(`  gates: ${verdict.toUpperCase()}`);
console.table(gates.map((g) => ({ gate: g.name, status: g.status, detail: g.detail })));
console.log(`  report: ${OUT}`);
