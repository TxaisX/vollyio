// Drive /api/eval one case at a time against a local dev server and merge
// results into evals/RESULTS.json. Resumable: cases already in RESULTS are
// skipped unless --force. Stability iteration: any case whose runs spread
// more than the tolerance gets one extra run recorded alongside.
//
// Usage:
//   node scripts/run-evals.mjs [--base http://localhost:3222] [--runs 2]
//     [--case <id prefix>] [--force] [--cases <dir>]
//
// --cases exists because evals/cases/*.json is gitignored local scratch, while
// the case set BASELINE.json's ids resolve to is tracked at
// evals/cases-pro-regression. Without a way to point at it, the committed
// baseline could not be reproduced from a fresh clone.

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  summarizeCoverage,
  coverageReport,
  coverageGaps,
} from "../lib/eval-coverage.ts";
import { loadCoverageCases } from "./eval-coverage.mjs";

const args = {};
const rest = process.argv.slice(2);
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--force") args.force = "1";
  else if (rest[i]?.startsWith("--")) args[rest[i].slice(2)] = rest[++i];
}
const BASE = args.base ?? "http://localhost:3222";
const RUNS = Math.max(1, Math.min(3, Number(args.runs ?? 2)));
const STABILITY_TOLERANCE = 8;
const RESULTS_PATH = "evals/RESULTS.json";
const CASES_DIR = (args.cases ?? "evals/cases").replace(/[\\/]+$/, "");
const EVAL_TOKEN = process.env.EVAL_TOKEN;

if (!existsSync(CASES_DIR)) {
  throw new Error(`No case directory at ${CASES_DIR}.`);
}

if (!EVAL_TOKEN) {
  throw new Error("EVAL_TOKEN is required.");
}

const requestOptions = () => ({
  headers: { authorization: `Bearer ${EVAL_TOKEN}` },
  signal: AbortSignal.timeout(15 * 60 * 1000),
});

const ids = readdirSync(CASES_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .filter((id) => !args.case || id.startsWith(args.case))
  .sort();

const results = existsSync(RESULTS_PATH)
  ? JSON.parse(readFileSync(RESULTS_PATH, "utf8"))
  : { runs: RUNS, results: {} };

function save() {
  writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
}

for (const id of ids) {
  const meta = JSON.parse(readFileSync(`${CASES_DIR}/${id}.json`, "utf8"));
  if (meta.excluded) {
    console.log(`${id}: excluded, skipped`);
    continue;
  }
  if (results.results[id] && !args.force) {
    console.log(`${id}: already run, skipped (use --force to redo)`);
    continue;
  }
  process.stdout.write(`${id}: running x${RUNS} ... `);
  try {
    const res = await fetch(
      `${BASE}/api/eval?case=${encodeURIComponent(id)}&runs=${RUNS}&full=1`,
      requestOptions(),
    );
    const body = await res.json();
    const r = body.results?.[0];
    if (!r || r.error) {
      console.log(`FAILED (${r?.error ?? res.status})`);
      results.results[id] = { id, error: r?.error ?? `http ${res.status}` };
      save();
      continue;
    }
    // Unstable runs get one extra sample so the viewer can show the spread.
    const spread = (o) => Math.max(...o) - Math.min(...o);
    if (r.overalls.length > 1 && spread(r.overalls) > STABILITY_TOLERANCE) {
      const extra = await fetch(
        `${BASE}/api/eval?case=${encodeURIComponent(id)}&runs=1&full=1`,
        requestOptions(),
      );
      const eb = await extra.json();
      const er = eb.results?.[0];
      if (er && !er.error) {
        r.overalls = [...r.overalls, ...er.overalls];
        r.stability_iterated = true;
      }
    }
    results.results[id] = r;
    save();
    console.log(
      `overall=${r.coherent_overall} band=${r.band} overalls=[${r.overalls.join(",")}]`,
    );
  } catch (e) {
    console.log(`FAILED (${e?.message ?? e})`);
  }
}

const done = Object.values(results.results).filter((r) => !r.error);
console.log(`\n${done.length}/${ids.length} cases scored -> ${RESULTS_PATH}`);
for (const band of ["Elite", "Advanced", "Solid", "Developing"]) {
  const n = done.filter((r) => r.band === band).length;
  if (n) console.log(`  ${band}: ${n}`);
}

// Print verdicts and coverage last so nobody reads a pass rate without also
// reading how many cases could not be judged at all.
const verdicts = { pass: 0, fail: 0, unverified: 0 };
for (const r of done) verdicts[r.verdict in verdicts ? r.verdict : "unverified"]++;
const verifiable = verdicts.pass + verdicts.fail;
console.log(
  `\nVerdicts: ${verdicts.pass} pass, ${verdicts.fail} fail, ${verdicts.unverified} UNVERIFIED` +
    ` (pass rate over verifiable: ${verifiable ? Math.round((verdicts.pass / verifiable) * 100) : 0}%` +
    `, ${verifiable}/${done.length} judgeable)`,
);

const coverage = summarizeCoverage(loadCoverageCases(CASES_DIR));
console.log("");
for (const line of coverageReport(coverage)) console.log(line);
if (coverageGaps(coverage).length) {
  console.log(
    "\nThis suite cannot yet support a coaching-quality claim. See the GAP lines above.",
  );
}
