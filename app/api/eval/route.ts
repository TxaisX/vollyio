import { NextResponse, type NextRequest } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { coach, ANALYZE_MODEL } from "@/lib/ai/client";
import { getRubric } from "@/lib/ai/rubrics";
import { outputSpec } from "@/lib/ai/output-spec";
import { enforceEvidence, consensusPointers } from "@/lib/ai/pointers";
import { analysisSchema } from "@/lib/ai/schema";
import {
  SKILL_LABEL,
  isSkill,
  isDiscipline,
  type Skill,
  type Discipline,
  type Level,
} from "@/lib/skills";
import {
  checkCase,
  checkStability,
  caseVerdict,
  type CaseCheck,
  type EvalExpectation,
  type ScoreInput,
} from "@/lib/eval-score";
import {
  summarizeCoverage,
  tallyChecks,
  coverageReport,
  coverageSummaryLine,
  coverageGaps,
} from "@/lib/eval-coverage";
import { coherentOverall, scoreBand } from "@/lib/ratings";
import { deriveResult } from "@/lib/ai/derive";
import { hasLocalEvalAccess } from "@/lib/security/request";

// Dev-only analysis eval harness. Replays labeled cases from evals/cases/*.json
// through the SAME scoring path as /api/analyze, identical system blocks
// (getRubric + outputSpec) and the case's player level, and reports agreement
// + run-to-run stability, so frame/prompt changes can be measured against what
// production actually runs. Never exposed in production. Requires
// ANTHROPIC_API_KEY.

export const runtime = "nodejs";
export const maxDuration = 300;

const LEVELS: readonly Level[] = [
  "beginner",
  "intermediate",
  "expert",
  "pro",
];
function toLevel(value: unknown): Level {
  return typeof value === "string" &&
    (LEVELS as readonly string[]).includes(value)
    ? (value as Level)
    : "intermediate";
}

type EvalCase = {
  id: string;
  skill: Skill;
  discipline: Discipline;
  level: Level;
  frames: { time_s: number | null; data: string }[];
  expected: EvalExpectation;
  // Folder-ingested cases can be flagged excluded (no scoreable action);
  // they are skipped unless ?all=1.
  excluded: boolean;
  // The clip window inside the source video, carried by ingested cases. Video
  // mode uses its span as the clip duration for the time-bounds check.
  window?: { startS: number; endS: number };
};

// filterPrefix narrows WHICH FILES ARE PARSED, not just which cases run.
// Every case file carries its full base64 frame set (up to 64 frames), so
// parsing all of them on every request is hundreds of MB of transient JSON;
// six concurrent single-case runs did exactly that and took the dev server
// down. Case filenames are their ids, so prefix-filtering before the parse is
// sound.
async function loadCases(filterPrefix?: string | null): Promise<EvalCase[]> {
  const dir = path.join(process.cwd(), "evals", "cases");
  let files: string[];
  try {
    files = (await readdir(dir)).filter(
      (f) => f.endsWith(".json") && (!filterPrefix || f.startsWith(filterPrefix)),
    );
  } catch {
    return [];
  }
  const cases: EvalCase[] = [];
  for (const f of files) {
    try {
      const c = JSON.parse(await readFile(path.join(dir, f), "utf8"));
      if (
        isSkill(c.skill) &&
        isDiscipline(c.discipline) &&
        Array.isArray(c.frames) &&
        c.frames.length >= 2
      ) {
        cases.push({
          id: typeof c.id === "string" ? c.id : f,
          skill: c.skill,
          discipline: c.discipline,
          level: toLevel(c.level),
          frames: c.frames,
          expected: (c.expected ?? {}) as EvalExpectation,
          excluded: c.excluded === true,
          window:
            typeof c.window?.startS === "number" && typeof c.window?.endS === "number"
              ? { startS: c.window.startS, endS: c.window.endS }
              : undefined,
        });
      }
    } catch {
      // skip malformed case file
    }
  }
  return cases;
}

type RunOut = { score: ScoreInput; raw: unknown; usage: unknown; ms: number };

// Shape the derived result the same way for both vendors, so a cross-vendor arm
// is scored by exactly the path production uses.
function scoreFrom(c: EvalCase, raw: AnalysisReply, strict = false): ScoreInput {
  const rawMap = raw.metrics as Record<
    string,
    { note: string; pointers: { key: string; status: string; frame?: number }[] }
  >;
  // Strict mode (D-095): an uncited or unanswerable met/missed becomes
  // not_visible BEFORE derivation, so the enforcement lands in the same place
  // the score is computed rather than anywhere the model can see.
  const metricsMap = strict
    ? Object.fromEntries(
        Object.entries(rawMap).map(([k, v]) => [
          k,
          { ...v, pointers: enforceEvidence(v?.pointers, c.frames.length) },
        ]),
      )
    : rawMap;
  const derived = deriveResult(c.skill, metricsMap);
  return {
    overall_score: derived.overall ?? raw.overall_score,
    // Only OBSERVED metrics, see the note at the Anthropic call site.
    metrics: derived.metrics
      .filter((m) => m.observed)
      .map((m) => ({ key: m.key, score: m.score })),
    frameIndices: [
      ...raw.insights.map((i) => i.frame_index),
      raw.focus.frame_index,
      raw.contact_frame_index,
    ],
    frameCount: c.frames.length,
  };
}

type AnalysisReply = {
  overall_score: number;
  metrics: unknown;
  insights: { frame_index: number }[];
  focus: { frame_index: number };
  contact_frame_index: number;
};

/**
 * OpenRouter arm. Any model id containing a slash (google/gemini-3.6-flash) is
 * routed here instead of to the Anthropic SDK, so one eval suite can be replayed
 * across vendors. Plain fetch on purpose: OpenRouter is OpenAI-shaped REST and a
 * second SDK would not earn its place in the dependency budget.
 *
 * The reply is validated against the SAME zod schema the Anthropic path uses, so
 * a model that drifts off-shape fails here rather than producing a score that
 * silently means something else.
 */
/**
 * Video arm (arm B). The clip replaces the frame set as the model's visual
 * evidence; the schema stays frozen, so every frame_index field is re-purposed
 * to carry TENTHS of a second from clip start (2.4s -> 24). That keeps the
 * moment recoverable without touching the response contract, and it turns the
 * citations_valid check into the video-native bound: a cited moment must fall
 * inside the clip. The provider is pinned because Gemini's AI Studio upstream
 * takes YouTube links only while Vertex takes base64 data URLs; unpinned, the
 * same request succeeds or fails by routing luck.
 */
function videoContent(c: EvalCase, clipB64: string, durationS: number) {
  return [
    {
      type: "video_url",
      video_url: { url: `data:video/mp4;base64,${clipB64}` },
    },
    {
      type: "text",
      text:
        `You are watching one continuous clip, ${durationS.toFixed(1)} seconds long, not a frame sequence. ` +
        "Judge every pointer on how the mechanic holds ACROSS its phase, citing moments as decimal seconds from clip start in every note. " +
        "Wherever the output format asks for an integer frame index (contact_frame_index, focus.frame_index, insights[].frame_index), report the moment as TENTHS OF A SECOND from clip start: 2.4s becomes 24. Never cite a time beyond the clip's end.",
    },
  ];
}

async function runOpenRouter(
  c: EvalCase,
  model: string,
  clip: { b64: string; durationS: number } | null = null,
  strict = false,
): Promise<RunOut | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set.");

  const schema = analysisSchema(c.skill);
  const started = Date.now();
  // One retry on the gateway's overload signals, same semantics as
  // lib/ai/vision.ts: a mid-suite 429 should cost a pause, not a run.
  let res: Response;
  for (let attempt = 0; ; attempt++) {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      // Pin Gemini to the upstream that accepts base64 video (see videoContent).
      ...(clip ? { provider: { only: ["google-vertex"] } } : {}),
      messages: [
        { role: "system", content: getRubric(c.skill, c.discipline) },
        { role: "system", content: outputSpec(c.skill, strict) },
        {
          role: "user",
          content: [
            ...(clip
              ? videoContent(c, clip.b64, clip.durationS)
              : c.frames.flatMap((f, i) => [
                  {
                    type: "text",
                    text: f.time_s != null ? `Frame ${i}, t=${f.time_s}s` : `Frame ${i}`,
                  },
                  {
                    type: "image_url",
                    image_url: { url: `data:image/jpeg;base64,${f.data}` },
                  },
                ])),
            {
              type: "text",
              text: `Discipline: ${c.discipline}. Player level: ${c.level}. Analyze this ${SKILL_LABEL[
                c.skill
              ].toLowerCase()} rep sequence across the whole clip.`,
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "analysis",
          // strict would require additionalProperties:false on every nested
          // object; the zod validation below is the real guard either way.
          strict: false,
          schema: z.toJSONSchema(schema, { io: "output" }),
        },
      },
    }),
    });
    if (
      attempt === 0 &&
      (res.status === 408 || res.status === 429 || res.status >= 500)
    ) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 20_000)
          : 2000;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    break;
  }
  const ms = Date.now() - started;
  if (!res.ok) {
    throw new Error(`openrouter ${res.status}`);
  }
  const body = await res.json();
  const text = body?.choices?.[0]?.message?.content;
  if (typeof text !== "string") return null;
  const parsed = schema.safeParse(JSON.parse(text));
  if (!parsed.success) return null;
  const raw = parsed.data as unknown as AnalysisReply;

  const u = body.usage ?? {};
  const score = scoreFrom(c, raw, strict);
  if (clip) {
    // frame_index fields carry tenths of a second in video mode, so the bound
    // for citations_valid is the clip's length in tenths, not a frame count.
    score.frameCount = Math.ceil(clip.durationS * 10) + 1;
  }
  return {
    score,
    raw,
    // Re-labelled into the Anthropic usage shape so one cost calculator serves
    // both arms.
    usage: {
      input_tokens: u.prompt_tokens ?? 0,
      output_tokens: u.completion_tokens ?? 0,
      cache_read_input_tokens: u.prompt_tokens_details?.cached_tokens ?? 0,
      cache_creation_input_tokens: 0,
    },
    ms,
  };
}

async function runModel(
  c: EvalCase,
  model: string = ANALYZE_MODEL,
  effort: "low" | "medium" | "high" | "xhigh" | "max" | null = null,
  clip: { b64: string; durationS: number } | null = null,
  strict = false,
): Promise<RunOut | null> {
  if (model.includes("/")) return runOpenRouter(c, model, clip, strict);
  if (clip) throw new Error("video mode is gateway-only");
  const content = c.frames.flatMap((f, i) => [
    {
      type: "text" as const,
      text: f.time_s != null ? `Frame ${i}, t=${f.time_s}s` : `Frame ${i}`,
    },
    {
      type: "image" as const,
      source: { type: "base64" as const, media_type: "image/jpeg" as const, data: f.data },
    },
  ]);

  // Identical system array + level threading to /api/analyze, so the harness
  // measures the shipped prompt rather than a variant of it.
  const started = Date.now();
  const response = await coach().messages.parse(
    {
      model,
      // 8192, matching /api/analyze since D-093: a reply truncated at the
      // ceiling arrives as unparseable JSON and reads as a failed run.
      max_tokens: 8192,
      system: [
        {
          type: "text",
          text: getRubric(c.skill, c.discipline),
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: outputSpec(c.skill, strict),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            ...content,
            {
              type: "text",
              text: `Discipline: ${c.discipline}. Player level: ${c.level}. Analyze this ${SKILL_LABEL[
                c.skill
              ].toLowerCase()} rep sequence across the whole clip.`,
            },
          ],
        },
      ],
      // effort is omitted for models that reject it (Haiku 4.5 errors on it).
      output_config: {
        ...(effort ? { effort } : {}),
        format: zodOutputFormat(analysisSchema(c.skill)),
      },
    },
    // Match /api/analyze (CS-7): exponential backoff on 429/5xx; the SDK honors
    // Retry-After and jitters between attempts.
    { maxRetries: 4 },
  );
  const ms = Date.now() - started;

  const raw = response.parsed_output;
  if (!raw) return null;

  // One scoring path with the analyze route (D-045) and with the OpenRouter arm:
  // weighted derivation from pointer verdicts, so an eval measures exactly what
  // production scores no matter which vendor produced the verdicts.
  return {
    score: scoreFrom(c, raw as unknown as AnalysisReply, strict),
    raw,
    usage: response.usage,
    ms,
  };
}

export async function GET(req: NextRequest) {
  if (
    process.env.NODE_ENV === "production" ||
    !hasLocalEvalAccess(req, process.env.EVAL_TOKEN)
  ) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const url = new URL(req.url);
  const runs = Math.max(1, Math.min(3, Number(url.searchParams.get("runs")) || 1));
  // ?case=<id prefix> narrows the run; ?full=1 includes the parsed analysis
  // (and its band) per case; ?all=1 also runs excluded cases.
  const caseFilter = url.searchParams.get("case");
  const full = url.searchParams.get("full") === "1";
  const includeExcluded = url.searchParams.get("all") === "1";
  // ?video=1: arm B. The case's cut clip replaces its frames as the model's
  // visual evidence; gateway models only.
  const video = url.searchParams.get("video") === "1";
  // ?strict=1: evidence enforcement (D-095). Uncited or unanswerable
  // met/missed verdicts degrade to not_visible before scoring.
  const strict = url.searchParams.get("strict") === "1";
  // ?consensus=1: a pointer counts met only if a strict majority of runs say so.
  const consensus = url.searchParams.get("consensus") === "1";
  // ?model= / ?effort= exist so one suite can be replayed across model tiers.
  // Dev-only route, so an arbitrary model string is the caller's problem.
  const model = url.searchParams.get("model") || ANALYZE_MODEL;
  const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
  const effortParam = url.searchParams.get("effort");
  const effort =
    effortParam && (EFFORTS as readonly string[]).includes(effortParam)
      ? (effortParam as (typeof EFFORTS)[number])
      : null;

  const allCases = await loadCases(url.searchParams.get("case"));
  // Coverage is computed over the whole suite, not the filtered run, so a
  // single-case run still reports the state of the suite it belongs to.
  const coverage = summarizeCoverage(
    allCases.map((c) => ({
      id: c.id,
      skill: c.skill,
      discipline: c.discipline,
      level: c.level,
      excluded: c.excluded,
      expected: c.expected,
    })),
  );

  let cases = allCases;
  if (caseFilter) cases = cases.filter((c) => c.id.startsWith(caseFilter));
  if (!includeExcluded) cases = cases.filter((c) => !c.excluded);
  if (cases.length === 0) {
    return NextResponse.json({
      cases: 0,
      error:
        "No eval cases found. Record a clip at /analyze?debug, hit “Download eval case”, label it, and drop the JSON into evals/cases/ (see evals/README.md).",
    });
  }

  const results: unknown[] = [];
  const ranChecks: CaseCheck[][] = [];
  for (const c of cases) {
    try {
      // Video mode (arm B): the clip is local scratch cut by
      // scripts/cut-eval-clips.mjs, keyed by case id. A case with no clip is
      // an explicit per-case error, never a silent fall-back to frames: the
      // arms must not blur.
      let clip: { b64: string; durationS: number } | null = null;
      if (video) {
        const clipPath = path.join(process.cwd(), "evals", "clips", `${c.id}.mp4`);
        let bytes: Buffer;
        try {
          bytes = await readFile(clipPath);
        } catch {
          results.push({ id: c.id, error: "no clip cut for this case" });
          continue;
        }
        const durationS = c.window
          ? c.window.endS - c.window.startS
          : Math.max(...c.frames.map((f) => f.time_s ?? 0), 1);
        clip = { b64: bytes.toString("base64"), durationS };
      }
      const overalls: number[] = [];
      const usages: unknown[] = [];
      const timings: number[] = [];
      let last: {
        score: ScoreInput;
        raw: unknown;
        usage: unknown;
        ms: number;
      } | null = null;
      const rawRuns: AnalysisReply[] = [];
      for (let r = 0; r < runs; r++) {
        const out = await runModel(c, model, effort, clip, strict);
        if (!out) break;
        overalls.push(out.score.overall_score);
        usages.push(out.usage);
        timings.push(out.ms);
        rawRuns.push(out.raw as AnalysisReply);
        last = out;
      }
      if (!last) {
        results.push({ id: c.id, error: "no model output" });
        continue;
      }
      // Consensus (D-095): merge the runs' pointer verdicts before scoring, so
      // a `met` has to survive more than one look. Scored through the same
      // derivation, so only the verdicts differ from a single-run result.
      let scored = last.score;
      if (consensus && rawRuns.length > 1) {
        const merged: Record<string, { note: string; pointers: { key: string; status: string }[] }> = {};
        const lastMap = last.raw as { metrics: Record<string, { note: string; pointers: { key: string; status: string }[] }> };
        for (const key of Object.keys(lastMap.metrics ?? {})) {
          merged[key] = {
            note: lastMap.metrics[key]?.note ?? "",
            pointers: consensusPointers(
              rawRuns.map((rr) => ((rr as unknown as { metrics: Record<string, { pointers: { key: string; status: string }[] }> }).metrics?.[key]?.pointers) ?? []),
            ),
          };
        }
        scored = scoreFrom(c, { ...(last.raw as AnalysisReply), metrics: merged }, false);
      }
      const checks = checkCase(scored, c.expected);
      ranChecks.push(checks);
      const verdict = caseVerdict(checks);
      const coherent = coherentOverall(
        scored.overall_score,
        scored.metrics.map((m) => m.score),
      );
      results.push({
        id: c.id,
        skill: c.skill,
        discipline: c.discipline,
        overall: scored.overall_score,
        overalls,
        coherent_overall: coherent,
        band: scoreBand(coherent),
        checks,
        // verdict is the honest field: "unverified" means no labeled check ran.
        // `pass` is kept for existing consumers and is true only for a real pass.
        verdict,
        pass: verdict === "pass",
        checks_fired: checks.filter((x) => x.status !== "skipped").length,
        checks_skipped: checks.filter((x) => x.status === "skipped").map((x) => x.name),
        stability: runs > 1 ? checkStability(overalls) : undefined,
        usages,
        timings,
        // Marked so stored arm results can never be mistaken for frame runs,
        // and because frame_index fields carry tenths of a second here.
        video: video || undefined,
        analysis: full ? last.raw : undefined,
      });
    } catch (e) {
      // Never surface the raw SDK message (it can name the vendor or model id);
      // log server-side and return a fixed string.
      console.error(`[eval] case ${c.id} failed`, e);
      results.push({ id: c.id, error: "run failed" });
    }
  }

  const scored = results.filter(
    (r): r is { verdict: string } =>
      typeof r === "object" && r !== null && "verdict" in r,
  );
  const passed = scored.filter((r) => r.verdict === "pass").length;
  const failed = scored.filter((r) => r.verdict === "fail").length;
  const unverified = scored.filter((r) => r.verdict === "unverified").length;
  const verifiable = passed + failed;
  // passRate is over VERIFIABLE cases only. Unverified cases are excluded from
  // the denominator and reported separately, so an unlabeled suite can never
  // manufacture a 100% pass rate.
  const rate = (n: number, d: number) => (d ? Math.round((n / d) * 100) / 100 : 0);
  const checkTally = tallyChecks(ranChecks);
  const neverRan = Object.entries(checkTally)
    .filter(([, row]) => row.fired === 0)
    .map(([name]) => name);

  return NextResponse.json({
    cases: cases.length,
    runs,
    model,
    effort,
    passRate: rate(passed, verifiable),
    passed,
    failed,
    unverified,
    verifiable,
    // Fraction of the run that produced any verdict at all beyond "unverified".
    verifiedRate: rate(verifiable, scored.length),
    checks: checkTally,
    checks_never_ran: neverRan,
    coverage,
    coverage_gaps: coverageGaps(coverage),
    summary: [
      `${passed} passed, ${failed} failed, ${unverified} UNVERIFIED of ${scored.length} scored`,
      coverageSummaryLine(coverage),
      neverRan.length ? `checks that never ran: ${neverRan.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" || "),
    coverage_report: coverageReport(coverage, checkTally),
    results,
  });
}
