// Freeze a baseline from evals/RESULTS.json so later frame/prompt/pose changes
// can be diffed against a recorded state instead of a memory. Writes
// evals/BASELINE.json (machine-diffable) and evals/BASELINE.md (readable).
//
// The baseline records coverage next to results, per roadmap "Coverage cannot
// be hidden": a baseline that omitted how little of the suite is labeled would
// read as a stronger result than it is. Nothing here is invented - every number
// comes from the case files and a real recorded run.
//
// Usage:
//   node scripts/make-baseline.mjs [--label "pre-rubric-rewrite"] [--force]
//
// Refuses to write when RESULTS.json is missing or holds no scored case;
// --force still writes but marks the baseline provisional.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import {
  summarizeCoverage,
  coverageReport,
  coverageGaps,
  coverageSummaryLine,
} from "../lib/eval-coverage.ts";
import { loadCoverageCases } from "./eval-coverage.mjs";

const args = {};
const rest = process.argv.slice(2);
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--force") args.force = true;
  else if (rest[i]?.startsWith("--")) args[rest[i].slice(2)] = rest[++i];
}

const RESULTS_PATH = "evals/RESULTS.json";
const results = existsSync(RESULTS_PATH)
  ? JSON.parse(readFileSync(RESULTS_PATH, "utf8"))
  : { results: {} };
const rows = Object.values(results.results ?? {});
const scored = rows.filter((r) => !r.error);

// NOTHING PRODUCES evals/RESULTS.json ANY MORE. Its only writer was
// scripts/run-evals.mjs, which drove the dev-only /api/eval route; both were
// removed once that route stopped existing, because the command had been
// posting into a 404 and measuring nothing since 2026-08-05.
//
// This script is deliberately NOT removed with them: four live documents send
// people here (evals/README.md, evals/LABELING.md, docs/post-cap-validation.md,
// docs/vollyio-100-playbook.md). What it can still do is freeze a baseline from
// a recording, and the recording it has is real. What it can no longer do is
// get a fresh one.
//
// So the staleness is said out loud instead of being left to be inferred from a
// file date. A baseline frozen from a retired scoring path is not a lie, but it
// is history, and a historical number quoted forward as current is exactly the
// failure this repo keeps writing decisions about.
if (scored.length > 0) {
  console.warn(
    [
      `NOTE: ${RESULTS_PATH} is a RECORDING and nothing regenerates it.`,
      "It came from the retired frame-path harness, which graded a rubric the",
      "product no longer ships. Treat anything frozen from it as history.",
      "The live harness is `npm run eval:run` (scripts/video-eval.mjs), whose",
      "results land in evals/video-results.json in a different shape.",
      "",
    ].join("\n"),
  );
}

if (scored.length === 0 && !args.force) {
  console.error(
    [
      `No scored cases in ${RESULTS_PATH}, and nothing writes that file any more.`,
      "The harness that produced it drove /api/eval, which no longer exists, so",
      "both were removed. The live harness is `npm run eval:run`",
      "(scripts/video-eval.mjs), which writes evals/video-results.json in a",
      "DIFFERENT shape this script cannot read yet.",
      "Use --force to record a coverage-only, provisional baseline.",
    ].join("\n"),
  );
  process.exit(1);
}

const coverage = summarizeCoverage(loadCoverageCases());
const gaps = coverageGaps(coverage);

function gitRev() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

const verdicts = { pass: 0, fail: 0, unverified: 0 };
for (const r of scored) {
  // Results recorded before verdicts existed have no verdict field; they are
  // counted unverified rather than assumed to have passed.
  verdicts[r.verdict in verdicts ? r.verdict : "unverified"]++;
}

const checkTally = {};
for (const r of scored) {
  for (const c of r.checks ?? []) {
    const row = (checkTally[c.name] ??= { fired: 0, passed: 0, skipped: 0 });
    if (c.status === "skipped") row.skipped++;
    else {
      row.fired++;
      if (c.status === "pass") row.passed++;
    }
  }
}

const spread = (o) => (o?.length > 1 ? Math.max(...o) - Math.min(...o) : 0);
const spreads = scored.map((r) => spread(r.overalls)).sort((a, b) => a - b);
const median = spreads.length ? spreads[Math.floor(spreads.length / 2)] : null;

const provisional = scored.length === 0 || gaps.length > 0;
const verifiable = verdicts.pass + verdicts.fail;

const baseline = {
  version: 1,
  label: args.label ?? null,
  created_at: new Date().toISOString(),
  git_rev: gitRev(),
  provisional,
  // Why this baseline cannot yet support a product claim. Empty means the
  // suite covers what the roadmap requires.
  blocking_gaps: gaps,
  coverage,
  scored_cases: scored.length,
  failed_runs: rows.length - scored.length,
  verdicts,
  pass_rate_over_verifiable: verifiable
    ? Math.round((verdicts.pass / verifiable) * 100) / 100
    : null,
  checks: checkTally,
  checks_never_ran: Object.entries(checkTally)
    .filter(([, r]) => r.fired === 0)
    .map(([n]) => n),
  stability: { median_run_spread: median, max_run_spread: spreads.at(-1) ?? null },
  bands: ["Elite", "Advanced", "Solid", "Developing"].reduce((acc, b) => {
    acc[b] = scored.filter((r) => r.band === b).length;
    return acc;
  }, {}),
  cases: scored.map((r) => ({
    id: r.id,
    skill: r.skill,
    discipline: r.discipline,
    coherent_overall: r.coherent_overall,
    band: r.band,
    overalls: r.overalls,
    verdict: r.verdict ?? "unverified",
    grounded: r.grounded ?? false,
  })),
};

writeFileSync("evals/BASELINE.json", `${JSON.stringify(baseline, null, 2)}\n`);

const md = [
  "# Eval baseline",
  "",
  `Recorded ${baseline.created_at.slice(0, 10)}${baseline.git_rev ? ` at \`${baseline.git_rev}\`` : ""}${baseline.label ? ` (${baseline.label})` : ""}.`,
  "",
  provisional
    ? "**Provisional.** This baseline does not support any product accuracy claim. See blocking gaps below."
    : "All roadmap coverage requirements are met for this suite.",
  "",
  "## Coverage",
  "",
  "```",
  ...coverageReport(coverage, checkTally),
  "```",
  "",
  coverageSummaryLine(coverage),
  "",
  "## Blocking gaps",
  "",
  gaps.length ? gaps.map((g) => `- ${g}`).join("\n") : "- none",
  "",
  "## Results",
  "",
  `- scored cases: ${baseline.scored_cases} (failed runs: ${baseline.failed_runs})`,
  `- verdicts: ${verdicts.pass} pass, ${verdicts.fail} fail, ${verdicts.unverified} unverified`,
  `- pass rate over verifiable cases: ${baseline.pass_rate_over_verifiable ?? "n/a (no verifiable case)"}`,
  `- run-spread: median ${median ?? "n/a"}, max ${spreads.at(-1) ?? "n/a"}`,
  baseline.checks_never_ran.length
    ? `- checks that never ran: ${baseline.checks_never_ran.join(", ")}`
    : "- every check ran at least once",
  "",
  "## Per case",
  "",
  "| id | skill | discipline | overall | band | verdict | grounded |",
  "|---|---|---|---|---|---|---|",
  ...baseline.cases.map(
    (c) =>
      `| ${c.id} | ${c.skill ?? ""} | ${c.discipline ?? ""} | ${c.coherent_overall ?? ""} | ${c.band ?? ""} | ${c.verdict} | ${c.grounded ? "yes" : "no"} |`,
  ),
  "",
  "## What this baseline is not",
  "",
  "Regenerate with `node scripts/make-baseline.mjs` after a real run. Numbers here",
  "come only from recorded runs and the case files; nothing is estimated.",
  "",
].join("\n");

writeFileSync("evals/BASELINE.md", md);

console.log(
  `Wrote evals/BASELINE.json and evals/BASELINE.md${provisional ? " (PROVISIONAL)" : ""}`,
);
for (const g of gaps) console.log(`GAP: ${g}`);
