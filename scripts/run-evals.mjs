// Drive /api/eval one case at a time against a local dev server and merge
// results into evals/RESULTS.json. Resumable: cases already in RESULTS are
// skipped unless --force. Stability iteration: any case whose runs spread
// more than the tolerance gets one extra run recorded alongside.
//
// Usage:
//   node scripts/run-evals.mjs [--base http://localhost:3222] [--runs 2]
//     [--case <id prefix>] [--force]

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

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

const ids = readdirSync("evals/cases")
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
  const meta = JSON.parse(readFileSync(`evals/cases/${id}.json`, "utf8"));
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
      { signal: AbortSignal.timeout(15 * 60 * 1000) },
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
        { signal: AbortSignal.timeout(15 * 60 * 1000) },
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
