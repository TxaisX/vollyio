import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const stabilityDir = path.join(root, "stability");
const rankingPath = path.join(root, "benchmark-ranking.json");
const promptPath = path.join(root, "coach-prompt.txt");
const schemaPath = path.join(root, "coach-output.schema.json");
const resultsPath = path.join(root, "stability-results.json");
const frameNames = [
  "key_6.40_penultimate.png",
  "key_6.60_plant.png",
  "key_6.80_takeoff.png",
  "key_7.20_loading.png",
  "key_7.40_cocking.png",
  "key_7.55_contact.png",
  "key_7.63_post_contact.png",
  "key_8.33_landing.png",
];
const frames = frameNames.map((name) => path.join(root, "frames", name));
const repeatsPerVariant = 2;
const concurrency = 3;

await mkdir(stabilityDir, { recursive: true });

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function assertFile(filePath) {
  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size === 0) throw new Error();
  } catch {
    throw new Error(`Required file is missing or empty: ${filePath}`);
  }
}

await Promise.all([
  assertFile(rankingPath),
  assertFile(promptPath),
  assertFile(schemaPath),
  ...frames.map(assertFile),
]);

const rankingDocument = await readJson(rankingPath);
const rankedPractical = (rankingDocument.ranking ?? []).filter(
  (entry) =>
    entry?.tier === "visible" &&
    entry?.effort !== "ultra" &&
    typeof entry.id === "string" &&
    typeof entry.slug === "string" &&
    typeof entry.effort === "string" &&
    Number.isFinite(entry.quality_score),
);
const selected = rankedPractical.slice(0, 3);
if (selected.length < 3) {
  throw new Error(
    `benchmark-ranking.json contains only ${selected.length} ranked visible non-ultra variants; three are required.`,
  );
}

const prompt = await readFile(promptPath, "utf8");

function safeSegment(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function parseUsage(events) {
  let usage = null;
  for (const line of events.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "turn.completed" && event.usage) usage = event.usage;
    } catch {}
  }
  return usage;
}

async function validCoachOutput(filePath) {
  try {
    const output = await readJson(filePath);
    return (
      Number.isFinite(output.attack_score) &&
      Array.isArray(output.phases) &&
      output.phases.length === 8 &&
      Array.isArray(output.priority_changes) &&
      output.priority_changes.length > 0
    );
  } catch {
    return false;
  }
}

async function validCompletedRun(outputPath, metadataPath) {
  if (!(await validCoachOutput(outputPath))) return null;
  try {
    const metadata = await readJson(metadataPath);
    return metadata.status === "complete" && metadata.exit_code === 0
      ? metadata
      : null;
  } catch {
    return null;
  }
}

function pathsFor(job) {
  const variantDir = path.join(stabilityDir, safeSegment(job.id));
  const stem = `repeat-${job.repeat}`;
  return {
    variantDir,
    outputPath: path.join(variantDir, `${stem}.json`),
    eventPath: path.join(variantDir, `${stem}.events.jsonl`),
    errorPath: path.join(variantDir, `${stem}.stderr.txt`),
    metadataPath: path.join(variantDir, `${stem}.metadata.json`),
  };
}

async function run(job) {
  const paths = pathsFor(job);
  await mkdir(paths.variantDir, { recursive: true });
  const cached = await validCompletedRun(paths.outputPath, paths.metadataPath);
  if (cached) return { ...cached, cached: true };

  const args = [
    "exec",
    "--ignore-user-config",
    "--ignore-rules",
    "--skip-git-repo-check",
    "--ephemeral",
    "--sandbox",
    "read-only",
    "--json",
    "--model",
    job.slug,
    "-c",
    `model_reasoning_effort=\"${job.effort}\"`,
    "-c",
    "service_tier=\"default\"",
    "--output-schema",
    schemaPath,
    "--output-last-message",
    paths.outputPath,
  ];
  for (const frame of frames) args.push("--image", frame);
  args.push("-");

  const startedAt = new Date().toISOString();
  const started = performance.now();
  const child = spawn("codex.cmd", args, {
    cwd: root,
    shell: true,
    windowsHide: true,
    env: process.env,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdin.end(prompt);
  const exitCode = await new Promise((resolve) => {
    child.on("error", () => resolve(-1));
    child.on("close", resolve);
  });
  const durationMs = Math.round(performance.now() - started);
  await Promise.all([
    writeFile(paths.eventPath, stdout, "utf8"),
    writeFile(paths.errorPath, stderr, "utf8"),
  ]);
  const complete = exitCode === 0 && (await validCoachOutput(paths.outputPath));
  const metadata = {
    id: job.id,
    slug: job.slug,
    tier: job.tier,
    effort: job.effort,
    repeat: job.repeat,
    status: complete ? "complete" : "failed",
    started_at: startedAt,
    duration_ms: durationMs,
    exit_code: exitCode,
    usage: parseUsage(stdout),
    output_path: path.relative(root, paths.outputPath),
    event_path: path.relative(root, paths.eventPath),
    stderr_path: path.relative(root, paths.errorPath),
    metadata_path: path.relative(root, paths.metadataPath),
  };
  await writeFile(paths.metadataPath, JSON.stringify(metadata, null, 2), "utf8");
  return { ...metadata, cached: false };
}

const jobs = selected.flatMap((variant) =>
  Array.from({ length: repeatsPerVariant }, (_, index) => ({
    ...variant,
    repeat: index + 1,
  })),
);
const runResults = [];
let cursor = 0;
async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    const result = await run(job);
    runResults.push(result);
    process.stdout.write(
      `${result.id} repeat ${result.repeat}: ${result.status}${result.cached ? " (cached)" : ""} ${result.duration_ms ?? 0}ms\n`,
    );
  }
}
await Promise.all(
  Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()),
);

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function stats(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return null;
  const middle = Math.floor(finite.length / 2);
  const median =
    finite.length % 2
      ? finite[middle]
      : (finite[middle - 1] + finite[middle]) / 2;
  return {
    count: finite.length,
    min: finite[0],
    max: finite.at(-1),
    mean: round(finite.reduce((sum, value) => sum + value, 0) / finite.length),
    median: round(median),
  };
}

function pairs(values) {
  const result = [];
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      result.push([values[left], values[right]]);
    }
  }
  return result;
}

const stopWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "before", "by", "for",
  "from", "in", "into", "is", "it", "keep", "more", "of", "on", "so",
  "that", "the", "then", "to", "up", "with", "your",
]);

function tokens(value) {
  return new Set(
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !stopWords.has(token))
      .map((token) => token.replace(/(ing|ed|es|s)$/u, ""))
      .filter(Boolean),
  );
}

function jaccard(left, right) {
  const union = new Set([...left, ...right]);
  if (!union.size) return 1;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / union.size;
}

function normalizedText(value) {
  return [...tokens(value)].sort().join(" ");
}

function priorityText(output) {
  const priority = output.priority_changes?.find((change) => change.rank === 1)
    ?? output.priority_changes?.[0]
    ?? {};
  return [priority.change, priority.why, priority.cue].filter(Boolean).join(" ");
}

function priorityTimestamps(output) {
  const priority = output.priority_changes?.find((change) => change.rank === 1)
    ?? output.priority_changes?.[0]
    ?? {};
  return new Set(priority.evidence_timestamps ?? []);
}

function priorityAgreement(outputs) {
  const comparisons = pairs(outputs).map(([left, right]) => ({
    token_jaccard: jaccard(tokens(priorityText(left)), tokens(priorityText(right))),
    evidence_timestamp_jaccard: jaccard(
      priorityTimestamps(left),
      priorityTimestamps(right),
    ),
    exact_normalized_match:
      normalizedText(priorityText(left)) === normalizedText(priorityText(right)),
  }));
  return {
    mean_pairwise_token_jaccard: round(
      comparisons.reduce((sum, item) => sum + item.token_jaccard, 0)
        / comparisons.length,
      3,
    ),
    mean_pairwise_evidence_timestamp_jaccard: round(
      comparisons.reduce(
        (sum, item) => sum + item.evidence_timestamp_jaccard,
        0,
      ) / comparisons.length,
      3,
    ),
    exact_normalized_match_rate: round(
      comparisons.filter((item) => item.exact_normalized_match).length
        / comparisons.length,
      3,
    ),
    corrections: outputs.map((output) => {
      const priority = output.priority_changes?.find((change) => change.rank === 1)
        ?? output.priority_changes?.[0]
        ?? {};
      return {
        change: priority.change ?? null,
        cue: priority.cue ?? null,
        evidence_timestamps: priority.evidence_timestamps ?? [],
      };
    }),
  };
}

function phaseScoreMad(outputs) {
  const comparisons = pairs(outputs).map(([left, right]) => {
    const leftScores = new Map(left.phases.map((phase) => [phase.phase, phase.score]));
    const differences = right.phases
      .filter((phase) => Number.isFinite(leftScores.get(phase.phase)))
      .map((phase) => Math.abs(leftScores.get(phase.phase) - phase.score));
    return differences.length
      ? differences.reduce((sum, value) => sum + value, 0) / differences.length
      : null;
  }).filter(Number.isFinite);
  return {
    mean_absolute_difference: comparisons.length
      ? round(comparisons.reduce((sum, value) => sum + value, 0) / comparisons.length)
      : null,
    pairwise_mean_absolute_differences: comparisons.map((value) => round(value)),
  };
}

function tokenStats(runs) {
  const usage = runs.map((run) => run.usage ?? {});
  const keys = [
    "input_tokens",
    "cached_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
  ];
  const result = Object.fromEntries(
    keys.map((key) => [key, stats(usage.map((item) => item[key]))]),
  );
  result.uncached_input_tokens = stats(
    usage.map((item) =>
      Number.isFinite(item.input_tokens)
        ? item.input_tokens - (item.cached_input_tokens ?? 0)
        : null,
    ),
  );
  return result;
}

const stabilityResults = [];
for (const variant of selected) {
  const baselinePath = path.join(root, "raw", `${variant.id}.json`);
  const repeatRuns = runResults
    .filter((run) => run.id === variant.id)
    .sort((left, right) => left.repeat - right.repeat);
  const completedRepeats = repeatRuns.filter((run) => run.status === "complete");
  const outputs = [];
  let baselineOutput = null;
  try {
    baselineOutput = await readJson(baselinePath);
    if (!(await validCoachOutput(baselinePath))) baselineOutput = null;
  } catch {}
  if (baselineOutput) outputs.push(baselineOutput);
  for (const run of completedRepeats) {
    outputs.push(await readJson(path.join(root, run.output_path)));
  }
  const allRuns = [
    {
      source: "matrix-baseline",
      duration_ms: variant.duration_ms,
      usage: variant.usage,
      output_path: path.relative(root, baselinePath),
    },
    ...completedRepeats.map((run) => ({ source: `repeat-${run.repeat}`, ...run })),
  ];
  const attackScores = outputs.map((output) => output.attack_score);
  stabilityResults.push({
    rank: (rankingDocument.ranking ?? []).findIndex((entry) => entry.id === variant.id) + 1,
    id: variant.id,
    key: variant.key,
    slug: variant.slug,
    tier: variant.tier,
    effort: variant.effort,
    quality_score: variant.quality_score,
    status:
      baselineOutput && completedRepeats.length === repeatsPerVariant
        ? "complete"
        : "incomplete",
    completed_outputs: outputs.length,
    attack_score: {
      values: attackScores,
      min: attackScores.length ? Math.min(...attackScores) : null,
      max: attackScores.length ? Math.max(...attackScores) : null,
      range: attackScores.length
        ? Math.max(...attackScores) - Math.min(...attackScores)
        : null,
    },
    priority_correction_agreement:
      outputs.length >= 2 ? priorityAgreement(outputs) : null,
    phase_score_stability:
      outputs.length >= 2 ? phaseScoreMad(outputs) : null,
    latency_ms: stats(allRuns.map((run) => run.duration_ms)),
    token_usage: tokenStats(allRuns),
    runs: allRuns,
  });
}

await writeFile(
  resultsPath,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      source_ranking: path.basename(rankingPath),
      selection_rule: "top 3 ranked variants with tier=visible and effort!=ultra",
      repeats_per_variant: repeatsPerVariant,
      concurrency,
      frames: frameNames,
      results: stabilityResults,
    },
    null,
    2,
  ),
  "utf8",
);

process.stdout.write(`Wrote ${path.relative(root, resultsPath)}\n`);
