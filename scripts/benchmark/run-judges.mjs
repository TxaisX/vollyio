import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const root = process.cwd();
const judgeDir = path.join(root, "judging");
await mkdir(judgeDir, { recursive: true });
const matrix = JSON.parse(await readFile(path.join(root, "matrix-results.json"), "utf8"));
const candidates = [];
for (const [index, run] of matrix.results.filter((result) => result.status === "complete").entries()) {
  candidates.push({ blind_id: `C${String(index + 1).padStart(2, "0")}`, run, response: JSON.parse(await readFile(path.join(root, run.output_path), "utf8")) });
}
const mapping = Object.fromEntries(candidates.map(({ blind_id, run }) => [blind_id, { id: run.id, key: run.key, slug: run.slug, tier: run.tier, effort: run.effort }]));
await writeFile(path.join(judgeDir, "blind-map.json"), JSON.stringify(mapping, null, 2), "utf8");
const evidence = await readFile(path.join(root, "video-evidence-notes.md"), "utf8");
const schema = path.join(root, "judge-output.schema.json");
const frames = ["key_6.40_penultimate.png", "key_6.60_plant.png", "key_6.80_takeoff.png", "key_7.20_loading.png", "key_7.40_cocking.png", "key_7.55_contact.png", "key_7.63_post_contact.png", "key_8.33_landing.png"].map((name) => path.join(root, "frames", name));
const judges = [{ id: "judge-a", slug: "gpt-5.6-sol" }, { id: "judge-b", slug: "gpt-5.6-terra" }];
const batches = Array.from({ length: 3 }, (_, index) => candidates.slice(index * 11, index * 11 + 11));

function promptFor(batch) {
  const payload = batch.map(({ blind_id, response }) => ({ candidate_id: blind_id, response }));
  return `Act as a senior volleyball coaching director evaluating candidate film-review reports. Analyze only the shirtless right-handed attacker's attacking mechanics. Candidate identities are blinded. Score advice quality, not writing resemblance.

Use the attached chronological frames as primary evidence. The expert evidence anchor below is a careful reference, not an answer key. Allow well-supported alternative interpretations, but penalize contradictions and unsupported precision.

Score each dimension from 0 to 100:
- evidence_grounding: visible, correctly timestamped, right athlete
- biomechanical_accuracy: technically sound attack-mechanics interpretation
- prioritization: highest-leverage correction first without manufactured faults
- actionability: cue, drill, dosage, and success test guide the next practice
- realism: advice fits one rep and the athlete shown
- uncertainty_discipline: respects rear angle, single rep, grass, slow motion, and tactical limits
- clarity: concise enough for a player with useful causal explanation

Penalize actual speed or duration claims from slowed footage; exact angles, heights, velocity, spin, medical risk, or consistency claims; tactical grading without context; another player or skill; visible contradictions; and generic drills unrelated to the stated fault. Return exactly one evaluation for every candidate ID.

EXPERT EVIDENCE ANCHOR
${evidence}

BLINDED CANDIDATES
${JSON.stringify(payload)}`;
}
function parseUsage(stdout) {
  let usage = null;
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { const event = JSON.parse(line); if (event.type === "turn.completed" && event.usage) usage = event.usage; } catch {}
  }
  return usage;
}
async function runJudge(judge, batch, batchIndex) {
  const name = `${judge.id}--batch-${batchIndex + 1}`;
  const outputPath = path.join(judgeDir, `${name}.json`);
  const eventPath = path.join(judgeDir, `${name}.events.jsonl`);
  const errorPath = path.join(judgeDir, `${name}.stderr.txt`);
  const args = ["exec", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check", "--ephemeral", "--sandbox", "read-only", "--json", "--model", judge.slug, "-c", "model_reasoning_effort=\"max\"", "-c", "service_tier=\"default\"", "--output-schema", schema, "--output-last-message", outputPath];
  for (const frame of frames) args.push("--image", frame);
  args.push("-");
  const started = performance.now();
  const child = spawn("codex.cmd", args, { cwd: root, shell: true, windowsHide: true, env: process.env });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdin.end(promptFor(batch));
  const exitCode = await new Promise((resolve) => child.on("close", resolve));
  const durationMs = Math.round(performance.now() - started);
  await writeFile(eventPath, stdout, "utf8");
  await writeFile(errorPath, stderr, "utf8");
  return { name, judge: judge.id, batch: batchIndex + 1, exit_code: exitCode, duration_ms: durationMs, usage: parseUsage(stdout), output_path: path.relative(root, outputPath) };
}
const tasks = judges.flatMap((judge) => batches.map((batch, index) => ({ judge, batch, index })));
const results = [];
let cursor = 0;
async function worker() {
  while (cursor < tasks.length) {
    const task = tasks[cursor++];
    const result = await runJudge(task.judge, task.batch, task.index);
    results.push(result);
    process.stdout.write(`${result.name}: exit=${result.exit_code} ${result.duration_ms}ms\n`);
  }
}
await Promise.all(Array.from({ length: 2 }, () => worker()));
await writeFile(path.join(judgeDir, "judge-runs.json"), JSON.stringify(results, null, 2), "utf8");
const dimensions = { evidence_grounding: 0.25, biomechanical_accuracy: 0.20, prioritization: 0.15, actionability: 0.15, realism: 0.10, uncertainty_discipline: 0.10, clarity: 0.05 };
const scored = Object.fromEntries(candidates.map(({ blind_id }) => [blind_id, []]));
for (const run of results) {
  if (run.exit_code !== 0) continue;
  const output = JSON.parse(await readFile(path.join(root, run.output_path), "utf8"));
  for (const evaluation of output.evaluations) if (scored[evaluation.candidate_id]) scored[evaluation.candidate_id].push({ judge: run.judge, ...evaluation });
}
const ranking = candidates.map(({ blind_id, run, response }) => {
  const evaluations = scored[blind_id];
  const judgeScores = evaluations.map((evaluation) => Object.entries(dimensions).reduce((sum, [key, weight]) => sum + evaluation[key] * weight, 0));
  const quality = judgeScores.length ? judgeScores.reduce((sum, score) => sum + score, 0) / judgeScores.length : null;
  const disagreement = judgeScores.length === 2 ? Math.abs(judgeScores[0] - judgeScores[1]) : null;
  return { blind_id, ...mapping[blind_id], quality_score: quality == null ? null : Math.round(quality * 10) / 10, judge_disagreement: disagreement == null ? null : Math.round(disagreement * 10) / 10, attack_score: response.attack_score, confidence: response.confidence, duration_ms: run.duration_ms, usage: run.usage, evaluations };
}).sort((a, b) => (b.quality_score ?? -1) - (a.quality_score ?? -1));
await writeFile(path.join(root, "benchmark-ranking.json"), JSON.stringify({ generated_at: new Date().toISOString(), dimensions, ranking, judge_runs: results }, null, 2), "utf8");
