import { NextResponse, type NextRequest } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { coach, ANALYZE_MODEL } from "@/lib/ai/client";
import { getRubric } from "@/lib/ai/rubrics";
import { outputSpec } from "@/lib/ai/output-spec";
import { analysisSchema } from "@/lib/ai/schema";
import { METRICS } from "@/lib/ai/metrics";
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
  type EvalExpectation,
  type ScoreInput,
} from "@/lib/eval-score";
import { sanitizeMeasurements } from "@/lib/ai/measurements-schema";
import type { MeasurementsBlock } from "@/lib/pose/types";

// Dev-only analysis eval harness. Replays labeled cases from evals/cases/*.json
// through the SAME scoring path as /api/analyze — identical system blocks
// (getRubric + outputSpec) and the case's player level — and reports agreement
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
  // Optional motion-tracking block captured with the case; lets the harness
  // compare grounded vs vision-only scoring on identical frames
  // (?measurements=off replays all cases without their blocks).
  measurements: MeasurementsBlock | null;
};

async function loadCases(): Promise<EvalCase[]> {
  const dir = path.join(process.cwd(), "evals", "cases");
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
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
          measurements: sanitizeMeasurements(c.measurements),
        });
      }
    } catch {
      // skip malformed case file
    }
  }
  return cases;
}

async function runModel(c: EvalCase, useMeasurements: boolean): Promise<ScoreInput | null> {
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

  // Mirrors /api/analyze exactly so the harness measures the shipped prompt.
  const measuredBlock =
    useMeasurements && c.measurements
      ? [
          {
            type: "text" as const,
            text: `Measured data from on-device motion tracking (trusted ground truth; observed the full clip, not just these frames):\n${JSON.stringify(c.measurements)}`,
          },
        ]
      : [];

  // Identical system array + level threading to /api/analyze, so the harness
  // measures the shipped prompt rather than a variant of it.
  const response = await coach().messages.parse(
    {
      model: ANALYZE_MODEL,
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: getRubric(c.skill, c.discipline),
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: outputSpec(c.skill, c.level),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            ...content,
            ...measuredBlock,
            {
              type: "text",
              text: `Discipline: ${c.discipline}. Player level: ${c.level}. Analyze this ${SKILL_LABEL[
                c.skill
              ].toLowerCase()} rep sequence across the whole clip.`,
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(analysisSchema(c.skill)) },
    },
    // Match /api/analyze (CS-7): exponential backoff on 429/5xx; the SDK honors
    // Retry-After and jitters between attempts.
    { maxRetries: 4 },
  );

  const raw = response.parsed_output;
  if (!raw) return null;

  const metricsMap = raw.metrics as Record<string, { score: number; note: string }>;
  return {
    overall_score: raw.overall_score,
    metrics: METRICS[c.skill].map((m) => ({ key: m.key, score: metricsMap[m.key].score })),
    frameIndices: [
      ...raw.insights.map((i) => i.frame_index),
      raw.focus.frame_index,
      raw.contact_frame_index,
      ...raw.ball_track.map((b) => b.frame_index),
    ],
    frameCount: c.frames.length,
  };
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const url = new URL(req.url);
  const runs = Math.max(1, Math.min(3, Number(url.searchParams.get("runs")) || 1));
  // ?measurements=off replays every case vision-only for A/B comparison.
  const useMeasurements = url.searchParams.get("measurements") !== "off";

  const cases = await loadCases();
  if (cases.length === 0) {
    return NextResponse.json({
      cases: 0,
      error:
        "No eval cases found. Record a clip at /analyze?debug, hit “Download eval case”, label it, and drop the JSON into evals/cases/ (see evals/README.md).",
    });
  }

  const results: unknown[] = [];
  for (const c of cases) {
    try {
      const overalls: number[] = [];
      let last: ScoreInput | null = null;
      for (let r = 0; r < runs; r++) {
        const out = await runModel(c, useMeasurements);
        if (!out) break;
        overalls.push(out.overall_score);
        last = out;
      }
      if (!last) {
        results.push({ id: c.id, error: "no model output" });
        continue;
      }
      const checks = checkCase(last, c.expected);
      results.push({
        id: c.id,
        skill: c.skill,
        discipline: c.discipline,
        overall: last.overall_score,
        overalls,
        checks,
        pass: checks.every((x) => x.ok),
        stability: runs > 1 ? checkStability(overalls) : undefined,
        grounded: useMeasurements && c.measurements != null,
      });
    } catch (e) {
      // Never surface the raw SDK message (it can name the vendor or model id);
      // log server-side and return a fixed string.
      console.error(`[eval] case ${c.id} failed`, e);
      results.push({ id: c.id, error: "run failed" });
    }
  }

  const scored = results.filter(
    (r): r is { pass: boolean } => typeof r === "object" && r !== null && "pass" in r,
  );
  const passRate = scored.length
    ? Math.round((scored.filter((r) => r.pass).length / scored.length) * 100) / 100
    : 0;

  return NextResponse.json({
    cases: cases.length,
    runs,
    measurements: useMeasurements ? "on" : "off",
    passRate,
    results,
  });
}
