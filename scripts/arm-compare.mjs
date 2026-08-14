// Compare model arms on the one thing calibration cannot fix: ORDERING.
//
// The shipping model's scores do not separate a beginners' tutorial from
// advanced footage (measured 2026-08-13: developing 81.7, advanced 81.9), and
// averaging repeated reads does not change that, because sampling noise was
// never the reason. If the ordering is absent, the fix is a different reader,
// not a different curve. This asks which readers have one.
//
// The label here is the SOURCE's claim about the athlete in the video, which is
// weak: an eight-second window from a beginners' tutorial often shows a coach
// demonstrating correct technique. Weak is not useless. A reader that separates
// these populations has some ordering; a reader that returns the same number for
// all four has none, and no weakness in the label can manufacture that result.
//
//   node scripts/arm-compare.mjs --arms shipping=evals/video-results.json,pro=evals/arm-gemini-pro.json

import { readFileSync, existsSync } from "node:fs";
import { distribution } from "../lib/scale.ts";

const args = {};
{
  const rest = process.argv.slice(2);
  for (let i = 0; i < rest.length; i++) if (rest[i]?.startsWith("--")) args[rest[i].slice(2)] = rest[++i];
}
const CORPUS = args.corpus ?? "evals/corpus";
const ARMS = (args.arms ?? "shipping=evals/video-results.json")
  .split(",")
  .map((pair) => {
    const [name, file] = pair.split("=");
    return { name, file };
  })
  .filter((a) => a.file && existsSync(a.file));

const manifest = JSON.parse(readFileSync(`${CORPUS}/manifest.json`, "utf8"));
const levelOf = new Map(manifest.map((m) => [m.id, m.source_level]));
const LEVELS = ["developing", "intermediate", "advanced", "pro"];
const ordinal = new Map(LEVELS.map((l, i) => [l, i]));

function pearson(x, y) {
  const n = x.length;
  if (n < 3) return null;
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
  return dx === 0 || dy === 0 ? null : num / Math.sqrt(dx * dy);
}

// The clips every arm actually attempted, so arms are compared on the same
// footage rather than on whichever subset each happened to answer.
const perArm = ARMS.map((a) => ({
  ...a,
  cases: Object.values(JSON.parse(readFileSync(a.file, "utf8")).cases ?? {}),
}));
const shared = perArm
  .map((a) => new Set(a.cases.map((c) => c.id)))
  .reduce((acc, s) => new Set([...acc].filter((id) => s.has(id))));
const inScope = [...shared].filter((id) => ordinal.has(levelOf.get(id)));

console.log(`arm-compare: ${inScope.length} clips attempted by all ${perArm.length} arms`);

const summary = [];
const levelRows = [];
for (const arm of perArm) {
  const byId = new Map(arm.cases.map((c) => [c.id, c]));
  const rows = inScope.map((id) => ({ id, c: byId.get(id), level: levelOf.get(id) }));
  const scored = rows.filter(({ c }) => typeof c.score === "number");
  const refused = rows.filter(({ c }) => c.refusals > 0).length;
  const errored = rows.filter(({ c }) => c.errors > 0 && typeof c.score !== "number").length;
  const reads = rows.flatMap(({ c }) => c.runs ?? []).filter((r) => typeof r.visible === "number");
  const full = reads.filter((r) => r.visible === r.declared).length;

  const d = distribution(scored.map(({ c }) => c.score));
  // Does the score rise with the level of the footage at all?
  const r = pearson(
    scored.map(({ level }) => ordinal.get(level)),
    scored.map(({ c }) => c.score),
  );
  const meanAt = (level) => {
    const v = scored.filter((x) => x.level === level).map(({ c }) => c.score);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const dev = meanAt("developing");
  const pro = meanAt("pro");

  summary.push({
    arm: arm.name,
    scored: d.n,
    refused,
    errored,
    median: d.median,
    sd: d.sd,
    range: d.range,
    full_visibility: reads.length ? Number((full / reads.length).toFixed(2)) : null,
    level_r: r == null ? null : Number(r.toFixed(3)),
    pro_minus_developing: dev != null && pro != null ? Number((pro - dev).toFixed(1)) : null,
  });

  for (const level of LEVELS) {
    const v = scored.filter((x) => x.level === level).map(({ c }) => c.score);
    if (v.length) {
      const dd = distribution(v);
      levelRows.push({ arm: arm.name, level, n: dd.n, mean: dd.mean, sd: dd.sd });
    }
  }
}

console.table(summary);
console.log("  score by footage level:");
console.table(levelRows.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level)));
