// Replay a corpus of CLIPS through the exact prompt /api/analyze ships, offline.
//
// This replaces the frame-path harness D-098 retired. That one drove a dev-only
// /api/eval route which no longer exists, and it graded the 120-pointer catalog
// which the product no longer uses, so `npm run eval:run` has measured nothing
// shipped since 2026-08-05. Everything below reads the SAME prompt builder, the
// same schema and the same request body as app/api/analyze/route.ts, so a
// change to lib/ai/simple-rubric.ts shows up here without being copied.
//
// No server, no auth token, no SDK: a clip goes in and the model's raw reply
// comes out. The three numbers this exists to produce are the ones production
// cannot show, because production stores neither refusals nor repeat reads:
//   - the score DISTRIBUTION on real footage (live rows sit at 71-90)
//   - the REFUSAL rate (ratable:false is a 422 that stores nothing)
//   - the VISIBILITY rate (live reads claim 5 checkpoints of 5 on ~every clip)
//
// Usage:
//   node scripts/video-eval.mjs [--corpus evals/corpus] [--out evals/video-results.json]
//     [--runs 1] [--case <id prefix>] [--force] [--concurrency 2] [--limit N]
//
// The corpus directory holds the clips plus a manifest.json written by
// scripts/pull-prod-clips.mjs (or by hand):
//   [{ "id": "...", "file": "x.mp4", "skill": "attack", "discipline": "indoor" }]

import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import {
  simpleRubric,
  simpleRatingSchema,
  focusLabelInstruction,
  repGate,
} from "../lib/ai/simple-rubric.ts";
import { METRICS } from "../lib/ai/metrics.ts";
import { metricKnowledge } from "../content/technique.ts";
import { drillSlugs } from "../content/drills.ts";
import { withPrivateRouting } from "../lib/ai/routing.ts";
import { SKILL_LABEL } from "../lib/skills.ts";

// Mirrors lib/ai/client.ts VISION_MODEL and the route's readVideo options. Kept
// as literals rather than imported because both of those modules are
// `server-only` and throw outside a Next runtime.
const DEFAULT_MODEL = "google/gemini-3.7-flash";
const MAX_TOKENS = 8192;
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 90_000;
const MIME = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };

const args = {};
{
  const rest = process.argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--force") args.force = true;
    else if (rest[i] === "--failed") args.failed = true;
    else if (rest[i]?.startsWith("--")) args[rest[i].slice(2)] = rest[++i];
  }
}
// A mistyped number used to be silent and the silence looked like success.
// `--limit` with no value made LIMIT NaN, `slice(0, NaN)` returned nothing, and
// the run printed "nothing to run" and exited 0. `--runs` was worse: RUNS
// became NaN, `i < NaN` never ran the loop, and every case recorded zero runs
// and was logged as ERROR, which reads as a model problem rather than a typo.
function bounded(name, value, fallback, lo, hi) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    console.error(`video-eval: --${name} needs a number, got "${value}".`);
    process.exit(1);
  }
  return Math.max(lo, Math.min(hi, n));
}

// --model exists for the discrimination bakeoff, not for production. The route
// is pinned to VISION_MODEL; this only asks whether a different model orders
// reps better than the one that ships.
const MODEL = args.model ?? DEFAULT_MODEL;
// The Vertex pin is a Gemini-specific fix (lib/ai/vision.ts): AI Studio takes
// YouTube links where Vertex takes base64 data URLs, so an unpinned video
// request succeeds or fails by routing luck. Pinning it on a non-Google model
// would route the request to a provider that does not serve it at all.
const PIN_VERTEX = MODEL.startsWith("google/");
// A candidate rep gate, REPLACING the shipped repGate() block so the candidate
// is measured in the exact shape it would ship: rubric first, ONE gate second
// (D-126). Stacked after the shipped gate instead, it would grade two
// overlapping refusal policies at once, a prompt no production config sends.
// D-034 forbids tuning calibration by wording; this exists so a change to the
// ABSTAIN rule is measured against labeled cases rather than argued about.
const EXTRA_SYSTEM = args["extra-system"] ? readFileSync(args["extra-system"], "utf8") : null;
const CORPUS = args.corpus ?? "evals/corpus";
const OUT = args.out ?? "evals/video-results.json";
const RUNS = bounded("runs", args.runs, 1, 1, 5);
const CONCURRENCY = bounded("concurrency", args.concurrency, 2, 1, 4);
const LIMIT = bounded("limit", args.limit, Infinity, 1, Infinity);

// .env.local is read by Next, never by a bare script. Parsed here rather than
// pulled in as a dependency; the file is two dozen KEY=VALUE lines.
function loadEnv(file = ".env.local") {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.replace(/^﻿/, "").match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    // TRIMMED, and not for tidiness. `.env.local` holds at least one key
    // written as `NAME= eyJ...` with a leading space, and a version of this
    // helper that only strips quotes sends that space inside the bearer token.
    // The API answers 401, which reads exactly like a rotated key, and the hour
    // after that is spent in a dashboard instead of on the one character
    // responsible.
    const value = m[2].trim().replace(/^["']|["']$/g, "").trim();
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}
loadEnv();

if (!process.env.OPENROUTER_API_KEY) {
  console.error("video-eval: OPENROUTER_API_KEY is required (.env.local or env).");
  process.exit(1);
}

const manifestPath = path.join(CORPUS, "manifest.json");
if (!existsSync(manifestPath)) {
  console.error(`video-eval: no manifest at ${manifestPath}. Run scripts/pull-prod-clips.mjs first.`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// Same composition as the route's checkpointCatalog(): key and label from the
// metric catalog, the plain-language "what this is" from the knowledge core.
function checkpointCatalog(skill, discipline) {
  return METRICS[skill].map((m) => ({
    key: m.key,
    label: m.label,
    what: metricKnowledge(skill, discipline, m.key)?.what ?? m.label,
  }));
}

const schemaJson = z.toJSONSchema(simpleRatingSchema, { io: "output" });

async function readOnce(entry, clipB64, durationS) {
  const catalog = checkpointCatalog(entry.skill, entry.discipline);
  const body = JSON.stringify({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    ...withPrivateRouting(PIN_VERTEX ? { only: ["google-vertex"] } : undefined),
    messages: [
      { role: "system", content: simpleRubric(entry.skill, entry.discipline, drillSlugs(entry.skill), catalog) },
      { role: "system", content: EXTRA_SYSTEM ?? repGate() },
      {
        role: "user",
        content: [
          {
            type: "video_url",
            video_url: { url: `data:${MIME[entry.ext ?? "mp4"] ?? MIME.mp4};base64,${clipB64}` },
          },
          ...(durationS != null
            ? [{ type: "text", text: `This clip is ${durationS.toFixed(1)} seconds long.` }]
            : []),
          // WHO to analyze, which production always sends and this harness
          // did not until 2026-08-13. On two-player footage an unmarked read
          // grades whoever the model picks, so two arms can disagree by 60
          // points while both are describing a rep correctly - just a
          // different person's. The marker travels as a description, which is
          // the D-100 path, because a corpus clip has no tap coordinate.
          ...(entry.focus_label ? [{ type: "text", text: focusLabelInstruction(entry.focus_label) }] : []),
          {
            type: "text",
            text: `Discipline: ${entry.discipline}. Rate this ${SKILL_LABEL[entry.skill].toLowerCase()} rep across the whole clip.`,
          },
          {
            type: "text",
            // Mirrors JSON_ONLY in app/api/analyze/route.ts (D-131).
            text: "Reply with ONLY the JSON object for the analysis schema: no prose before or after it, no headings, no markdown fences.",
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "analysis", strict: false, schema: schemaJson },
    },
  });

  // One retry, as the route does (maxRetries: 1). A transport failure on a
  // 40 MB upload is common enough that not retrying would report the network
  // as a model refusal, which is exactly the confusion this harness exists to
  // remove.
  const started = Date.now();
  let res = null;
  let text = "";
  let transport = null;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "content-type": "application/json",
          "HTTP-Referer": "https://vollyio.com",
          "X-Title": "Vollyio",
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      text = await res.text();
      transport = null;
      const retryable = res.status === 408 || res.status === 429 || res.status >= 500;
      if (!retryable || attempt === 2) break;
    } catch (err) {
      transport = err instanceof Error ? err.message : String(err);
      res = null;
      if (attempt === 2) break;
    }
    await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
  }
  const ms = Date.now() - started;
  if (transport) return { error: `transport: ${transport}`, ms };
  if (!res) return { error: "no response", ms };
  if (!res.ok) return { error: `HTTP ${res.status}: ${text.slice(0, 200)}`, ms };
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return { error: "unparseable gateway body", ms };
  }
  if (payload?.error?.message) return { error: String(payload.error.message), ms };
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    return { error: "empty reply", ms, usage: payload?.usage ?? null };
  }
  const unfenced = content.match(/^\s*```(?:json)?\s*\n([\s\S]*?)\n\s*```\s*$/);
  let json;
  try {
    json = JSON.parse(unfenced ? unfenced[1] : content);
  } catch {
    return { error: "reply was not JSON", ms };
  }
  const parsed = simpleRatingSchema.safeParse(json);
  if (!parsed.success) return { error: `schema refused: ${parsed.error.issues[0]?.message}`, ms };

  const r = parsed.data;
  const visible = (r.checkpoints ?? []).filter((c) => c.visible === true).length;
  const declared = METRICS[entry.skill].length;
  return {
    ms,
    provider: payload?.provider ?? null,
    usage: payload?.usage ?? null,
    ratable: r.ratable !== false,
    not_ratable_reason: r.not_ratable_reason ?? null,
    // Only meaningful when ratable; a refusal carries whatever number the model
    // happened to emit and it must never reach a distribution.
    score: r.ratable === false ? null : Math.max(0, Math.min(100, Math.round(r.overall_score))),
    raw_score: r.overall_score,
    confidence: r.confidence,
    visible,
    declared,
    strengths: r.strengths.length,
    improvements: r.improvements.length,
    summary: r.summary,
  };
}

function clipDurationSeconds(file) {
  // ffprobe is already a hard requirement of scripts/ingest-eval-clip.mjs, but
  // a missing duration must not stop a read: the route sends null when the
  // browser could not decode one either.
  try {
    const out = execFileSync(process.env.FFPROBE_PATH ?? "ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", file,
    ]).toString().trim();
    const n = Number(out);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

const results = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { model: MODEL, cases: {} };
results.model = MODEL;
results.cases ??= {};

const only = args.ids ? new Set(args.ids.split(",").map((s) => s.trim())) : null;
const queue = manifest
  .filter((e) => !only || only.has(e.id))
  .filter((e) => !args.case || e.id.startsWith(args.case))
  // --failed re-runs only the cases that errored, so a network blip costs one
  // clip and not a whole suite run.
  .filter((e) =>
    args.force ||
    !results.cases[e.id] ||
    (args.failed && results.cases[e.id].score == null && !results.cases[e.id].refusals),
  )
  .slice(0, LIMIT);

if (queue.length === 0) {
  console.log("video-eval: nothing to run (use --force to re-run recorded cases).");
} else {
  console.log(`video-eval: ${queue.length} clips x ${RUNS} run(s), concurrency ${CONCURRENCY}`);
}

const total = queue.length;
let done = 0;
async function runCase(entry) {
  const file = path.join(CORPUS, entry.file);
  if (!existsSync(file)) {
    results.cases[entry.id] = { id: entry.id, error: "clip file missing" };
    return;
  }
  const ext = path.extname(entry.file).slice(1).toLowerCase();
  const b64 = readFileSync(file).toString("base64");
  const duration = entry.duration_s ?? clipDurationSeconds(file);
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    try {
      runs.push(await readOnce({ ...entry, ext }, b64, duration));
    } catch (err) {
      runs.push({ error: err instanceof Error ? err.message : String(err) });
    }
  }
  const scored = runs.filter((r) => typeof r.score === "number");
  const scores = scored.map((r) => r.score);
  results.cases[entry.id] = {
    id: entry.id,
    skill: entry.skill,
    discipline: entry.discipline,
    duration_s: duration,
    bytes: statSync(file).size,
    runs,
    score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    scores,
    spread: scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 0,
    refusals: runs.filter((r) => r.ratable === false).length,
    errors: runs.filter((r) => r.error).length,
  };
  done++;
  const c = results.cases[entry.id];
  console.log(
    `[${done}/${total}] ${entry.id} ${entry.skill} -> ${c.score ?? (c.refusals ? "REFUSED" : "ERROR")}` +
      (c.runs[0]?.visible != null ? ` visible ${c.runs[0].visible}/${c.runs[0].declared}` : "") +
      (c.spread ? ` spread ${c.spread}` : ""),
  );
  writeFileSync(OUT, JSON.stringify(results, null, 2));
}

const lanes = Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length > 0) {
    const entry = queue.shift();
    if (!entry) return;
    await runCase(entry);
  }
});
await Promise.all(lanes);

// The summary is the point of the run: per-case numbers say nothing about
// whether the SCALE is usable, and a suite where every case passes its own
// check can still be pinned into a 20-point window.
const all = Object.values(results.cases).filter((c) => c.skill);
const scored = all.filter((c) => typeof c.score === "number");
const scores = scored.map((c) => c.score).sort((a, b) => a - b);
const q = (p) => (scores.length ? scores[Math.min(scores.length - 1, Math.floor(p * scores.length))] : null);
const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
const sd = scores.length
  ? Math.sqrt(scores.reduce((s, x) => s + (x - mean) ** 2, 0) / scores.length)
  : 0;
const visibleRuns = all.flatMap((c) => c.runs ?? []).filter((r) => typeof r.visible === "number");
const fullyVisible = visibleRuns.filter((r) => r.visible === r.declared).length;

results.summary = {
  clips: all.length,
  scored: scored.length,
  refused: all.filter((c) => c.refusals > 0).length,
  errored: all.filter((c) => c.errors > 0 && !c.score).length,
  min: scores[0] ?? null,
  p10: q(0.1),
  median: q(0.5),
  p90: q(0.9),
  max: scores[scores.length - 1] ?? null,
  mean: Number(mean.toFixed(1)),
  sd: Number(sd.toFixed(1)),
  range_used: scores.length ? scores[scores.length - 1] - scores[0] : 0,
  full_visibility_rate: visibleRuns.length
    ? Number((fullyVisible / visibleRuns.length).toFixed(3))
    : null,
  mean_spread: scored.length
    ? Number((scored.reduce((s, c) => s + c.spread, 0) / scored.length).toFixed(1))
    : 0,
};
writeFileSync(OUT, JSON.stringify(results, null, 2));

console.log("\n--- distribution ---");
console.table([results.summary]);
