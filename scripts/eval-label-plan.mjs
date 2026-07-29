// Pick a small, balanced set of cases to hand-label, and print the exact
// commands to label them.
//
// Why this exists: `eval-coverage.mjs` reports 852 unlabeled cases, and
// `label-case.mjs` with no argument walks all 852. At the ~2 minutes a case
// that LABELING.md budgets, that is a 28-hour job, which is why it has stayed
// at 0. The accuracy gate does not need 852 labels. It needs enough labeled
// cases, spread across skills, to say something with an interval, and the rest
// can follow later if the number turns out to be worth defending.
//
// This selects a stratified sample and emits one `label-case.mjs <id>` command
// per case, so the session is bounded and resumable: label ten tonight, ten
// tomorrow, and coverage climbs monotonically because each save is per-case.
//
//   node scripts/eval-label-plan.mjs            # 18 cases, balanced by skill
//   node scripts/eval-label-plan.mjs --n 30     # a bigger pass
//   node scripts/eval-label-plan.mjs --skill serve
//
// Selection is deterministic (sorted ids, round-robin across skills) so the
// same command always proposes the same set and a half-finished session can be
// resumed by re-running it.

import fs from "node:fs";
import path from "node:path";
import { resolveCasesDir } from "./eval-cases-dir.mjs";

// The TRACKED set by default. This planner originally read `evals/cases/`,
// which is gitignored ingest scratch, and so proposed a 28-hour job over
// hundreds of cases nobody intended to hand-label. The reviewed set is small on
// purpose.
const CASES = path.join(process.cwd(), resolveCasesDir());
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const want = Number(flag("n", 18));
const onlySkill = flag("skill", null);

if (!fs.existsSync(CASES)) {
  console.error(`no case directory at ${CASES}`);
  process.exit(1);
}

const bySkill = new Map();
let alreadyLabeled = 0;

for (const file of fs.readdirSync(CASES).sort()) {
  if (!file.endsWith(".json")) continue;
  let c;
  try {
    c = JSON.parse(fs.readFileSync(path.join(CASES, file), "utf8"));
  } catch {
    continue;
  }
  // A case already carrying a human weakest_metric is done; never propose it
  // again, so re-running this after a session shows only what is left.
  if (c?.expected?.weakest_metric) {
    alreadyLabeled++;
    continue;
  }
  const skill = c?.skill ?? "unknown";
  if (onlySkill && skill !== onlySkill) continue;
  if (!bySkill.has(skill)) bySkill.set(skill, []);
  bySkill.get(skill).push(c.id ?? file.replace(/\.json$/, ""));
}

const skills = [...bySkill.keys()].sort();
if (skills.length === 0) {
  console.log("Nothing left to label.");
  process.exit(0);
}

// Round-robin so a short sample still spans skills instead of taking 18 serves.
const picked = [];
for (let round = 0; picked.length < want; round++) {
  let addedThisRound = false;
  for (const s of skills) {
    if (picked.length >= want) break;
    const pool = bySkill.get(s);
    if (round < pool.length) {
      picked.push({ skill: s, id: pool[round] });
      addedThisRound = true;
    }
  }
  if (!addedThisRound) break;
}

const minutes = Math.round(picked.length * 2);
const spread = skills
  .map((s) => `${s} ${picked.filter((p) => p.skill === s).length}`)
  .join(", ");

console.log(`${picked.length} case(s) proposed, about ${minutes} minutes.`);
console.log(`Balance: ${spread}`);
console.log(`Already human-labeled: ${alreadyLabeled}`);
console.log(
  `\nRun these in order. Each one saves on its own, so stopping part-way keeps`,
);
console.log(`everything done so far. Re-run this planner to see what is left.\n`);
for (const p of picked) {
  console.log(`node scripts/label-case.mjs ${p.id}`);
}
console.log(`\nThen: node scripts/eval-coverage.mjs`);
