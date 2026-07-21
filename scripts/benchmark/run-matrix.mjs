import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const root = process.cwd();
const rawDir = path.join(root, "raw");
await mkdir(rawDir, { recursive: true });
const prompt = await readFile(path.join(root, "coach-prompt.txt"), "utf8");
const schema = path.join(root, "coach-output.schema.json");
const frameDir = path.join(root, "frames");
const frames = ["key_6.40_penultimate.png", "key_6.60_plant.png", "key_6.80_takeoff.png", "key_7.20_loading.png", "key_7.40_cocking.png", "key_7.55_contact.png", "key_7.63_post_contact.png", "key_8.33_landing.png"].map((name) => path.join(frameDir, name));
const catalog = [
  { key: "sol", slug: "gpt-5.6-sol", tier: "visible", efforts: ["low", "medium", "high", "xhigh", "max", "ultra"] },
  { key: "terra", slug: "gpt-5.6-terra", tier: "visible", efforts: ["low", "medium", "high", "xhigh", "max", "ultra"] },
  { key: "luna", slug: "gpt-5.6-luna", tier: "visible", efforts: ["low", "medium", "high", "xhigh", "max"] },
  { key: "5-5", slug: "gpt-5.5", tier: "visible", efforts: ["low", "medium", "high", "xhigh"] },
  { key: "5-4", slug: "gpt-5.4", tier: "legacy", efforts: ["low", "medium", "high", "xhigh"] },
  { key: "5-4-mini", slug: "gpt-5.4-mini", tier: "legacy", efforts: ["low", "medium", "high", "xhigh"] },
  { key: "auto-review", slug: "codex-auto-review", tier: "internal", efforts: ["low", "medium", "high", "xhigh"] },
];
const selected = catalog.flatMap(({ efforts, ...model }) => efforts.map((effort) => ({ ...model, effort, id: `${model.key}--${effort}` })));
const only = process.argv.slice(2);
const jobs = only.length ? selected.filter((job) => only.includes(job.id)) : selected;
let priorById = new Map();
try {
  const prior = JSON.parse(await readFile(path.join(root, "matrix-results.json"), "utf8"));
  priorById = new Map((prior.results ?? []).map((result) => [result.id, result]));
} catch {}

function parseUsage(stdout) {
  let usage = null;
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "turn.completed" && event.usage) usage = event.usage;
    } catch {}
  }
  return usage;
}
async function isComplete(outputPath) {
  try {
    const info = await stat(outputPath);
    if (info.size === 0) return false;
    JSON.parse(await readFile(outputPath, "utf8"));
    return true;
  } catch {
    return false;
  }
}
async function run(job) {
  const outputPath = path.join(rawDir, `${job.id}.json`);
  const eventPath = path.join(rawDir, `${job.id}.events.jsonl`);
  const errorPath = path.join(rawDir, `${job.id}.stderr.txt`);
  if (await isComplete(outputPath)) return { ...job, ...priorById.get(job.id), status: "complete", cached: true, output_path: path.relative(root, outputPath), event_path: path.relative(root, eventPath), stderr_path: path.relative(root, errorPath) };
  const args = ["exec", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check", "--ephemeral", "--sandbox", "read-only", "--json", "--model", job.slug, "-c", `model_reasoning_effort=\"${job.effort}\"`, "-c", "service_tier=\"default\"", "--output-schema", schema, "--output-last-message", outputPath];
  for (const frame of frames) args.push("--image", frame);
  args.push("-");
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const child = spawn("codex.cmd", args, { cwd: root, shell: true, windowsHide: true, env: process.env });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdin.end(prompt);
  const exitCode = await new Promise((resolve) => child.on("close", resolve));
  const durationMs = Math.round(performance.now() - started);
  await writeFile(eventPath, stdout, "utf8");
  await writeFile(errorPath, stderr, "utf8");
  const valid = exitCode === 0 && await isComplete(outputPath);
  return { ...job, status: valid ? "complete" : "failed", started_at: startedAt, duration_ms: durationMs, exit_code: exitCode, usage: parseUsage(stdout), output_path: path.relative(root, outputPath), event_path: path.relative(root, eventPath), stderr_path: path.relative(root, errorPath) };
}
const results = [];
let cursor = 0;
async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    const result = await run(job);
    results.push(result);
    process.stdout.write(`${result.id}: ${result.status} ${result.duration_ms ?? 0}ms\n`);
  }
}
await Promise.all(Array.from({ length: Math.min(3, jobs.length || 1) }, () => worker()));
results.sort((a, b) => selected.findIndex((x) => x.id === a.id) - selected.findIndex((x) => x.id === b.id));
await writeFile(path.join(root, "matrix-results.json"), JSON.stringify({ generated_at: new Date().toISOString(), requested: jobs.length, results }, null, 2), "utf8");
