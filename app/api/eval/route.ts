import { NextResponse, type NextRequest } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { coach, MODEL } from "@/lib/ai/client";
import { getRubric } from "@/lib/ai/rubrics";
import { analysisSchema } from "@/lib/ai/schema";
import { METRICS } from "@/lib/ai/metrics";
import {
  SKILL_LABEL,
  isSkill,
  isDiscipline,
  type Skill,
  type Discipline,
} from "@/lib/skills";
import {
  checkCase,
  checkStability,
  type EvalExpectation,
  type ScoreInput,
} from "@/lib/eval-score";

// Dev-only analysis eval harness. Replays labeled cases from evals/cases/*.json
// through the SAME scoring path as /api/analyze (getRubric + analysisSchema) and
// reports agreement + run-to-run stability, so frame/prompt changes can be
// measured. Never exposed in production. Requires ANTHROPIC_API_KEY.

export const runtime = "nodejs";
export const maxDuration = 300;

type EvalCase = {
  id: string;
  skill: Skill;
  discipline: Discipline;
  frames: { time_s: number | null; data: string }[];
  expected: EvalExpectation;
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
          frames: c.frames,
          expected: (c.expected ?? {}) as EvalExpectation,
        });
      }
    } catch {
      // skip malformed case file
    }
  }
  return cases;
}

async function runModel(c: EvalCase): Promise<ScoreInput | null> {
  const content = c.frames.flatMap((f, i) => [
    {
      type: "text" as const,
      text: f.time_s != null ? `Frame ${i} — t=${f.time_s}s` : `Frame ${i}`,
    },
    {
      type: "image" as const,
      source: { type: "base64" as const, media_type: "image/jpeg" as const, data: f.data },
    },
  ]);

  const response = await coach().messages.parse({
    model: MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: getRubric(c.skill, c.discipline), cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          ...content,
          {
            type: "text",
            text: `Discipline: ${c.discipline}. Player level: intermediate. Analyze this ${SKILL_LABEL[
              c.skill
            ].toLowerCase()} rep sequence across the whole clip.`,
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(analysisSchema(c.skill)) },
  });

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
    ],
    frameCount: c.frames.length,
  };
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const runs = Math.max(
    1,
    Math.min(3, Number(new URL(req.url).searchParams.get("runs")) || 1),
  );

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
        const out = await runModel(c);
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
      });
    } catch (e) {
      results.push({ id: c.id, error: e instanceof Error ? e.message : "run failed" });
    }
  }

  const scored = results.filter(
    (r): r is { pass: boolean } => typeof r === "object" && r !== null && "pass" in r,
  );
  const passRate = scored.length
    ? Math.round((scored.filter((r) => r.pass).length / scored.length) * 100) / 100
    : 0;

  return NextResponse.json({ cases: cases.length, runs, passRate, results });
}
