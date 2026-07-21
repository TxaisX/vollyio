// Interactive labeler for eval cases. Exported cases arrive unlabeled, and an
// unlabeled case silently disables the checks it should have driven, so this
// walks a human through the decisions the harness cannot make for itself.
// It never guesses: every value written here is typed by a person.
//
// Usage:
//   node scripts/label-case.mjs              # walk every unlabeled active case
//   node scripts/label-case.mjs <case-id>    # label one case
//   node scripts/label-case.mjs --list       # just list what needs labeling

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { METRICS } from "../lib/ai/metrics.ts";

const CASES_DIR = "evals/cases";
const argv = process.argv.slice(2);
const listOnly = argv.includes("--list");
const target = argv.find((a) => !a.startsWith("--"));

function readCase(id) {
  return JSON.parse(readFileSync(path.join(CASES_DIR, `${id}.json`), "utf8"));
}

function needsLabel(c) {
  const e = c.expected ?? {};
  const hasWeakest =
    Boolean(e.weakest_metric) || (e.acceptable_weakest_metrics ?? []).length > 0;
  return (
    c.excluded !== true &&
    !hasWeakest &&
    e.weakest_metric_unknown !== true
  );
}

const ids = readdirSync(CASES_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .sort();

const todo = (target ? [target] : ids).filter((id) => {
  try {
    return target ? true : needsLabel(readCase(id));
  } catch {
    return false;
  }
});

if (listOnly || todo.length === 0) {
  console.log(
    todo.length
      ? `${todo.length} case(s) need a weakest_metric decision:\n  ${todo.join("\n  ")}`
      : "Every active case already carries a weakest_metric decision.",
  );
  process.exit(0);
}

const rl = createInterface({ input: stdin, output: stdout });

console.log(
  [
    `${todo.length} case(s) to label.`,
    "For each: name the metric key whose fault most limits this rep.",
    "Enter 'unknown' when the footage genuinely does not resolve one fault -",
    "that records a reviewer-confirmed abstention, which is a real answer.",
    "Enter 'skip' to leave the case untouched. Ctrl-C exits and keeps prior saves.",
    "",
  ].join("\n"),
);

// Asked once and applied to every case saved this session: a labeling pass is
// one reviewer, so re-typing initials per case was pure friction.
const reviewer = (
  await rl.question("your reviewer id (initials, applied to every case this session): ")
).trim();

for (const id of todo) {
  const file = path.join(CASES_DIR, `${id}.json`);
  const c = readCase(id);
  const keys = (METRICS[c.skill] ?? []).map((m) => m.key);
  const e = (c.expected ??= {});

  console.log(`\n--- ${id}`);
  console.log(`skill=${c.skill} discipline=${c.discipline} level=${c.level}`);
  if (e.notes) console.log(`notes: ${e.notes}`);
  console.log(`metric keys: ${keys.join(", ")}`);

  const weakest = (await rl.question("weakest_metric (key | unknown | skip): ")).trim();
  if (weakest === "skip" || weakest === "") {
    console.log("skipped, unchanged");
    continue;
  }
  if (weakest === "unknown") {
    const why = (await rl.question("why is it unresolvable? ")).trim();
    e.weakest_metric_unknown = true;
    delete e.weakest_metric;
    if (why) e.notes = e.notes ? `${e.notes} | abstain: ${why}` : `abstain: ${why}`;
  } else {
    if (!keys.includes(weakest)) {
      console.log(`"${weakest}" is not a ${c.skill} metric key. Skipping to avoid a bad label.`);
      continue;
    }
    e.weakest_metric = weakest;
    delete e.weakest_metric_unknown;
    const alts = (await rl.question("acceptable alternatives (comma-separated, blank for none): "))
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && keys.includes(s) && s !== weakest)
      .slice(0, 2);
    if (alts.length) e.acceptable_weakest_metrics = alts;
    else delete e.acceptable_weakest_metrics;
  }

  if (reviewer) {
    e.labeled_by = reviewer;
    e.labeled_at = new Date().toISOString().slice(0, 10);
  }
  writeFileSync(file, `${JSON.stringify(c, null, 2)}\n`);
  console.log(`saved ${id}`);
}

rl.close();
console.log("\nRe-check coverage with: node scripts/eval-coverage.mjs");
