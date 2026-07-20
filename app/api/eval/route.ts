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
import { hasLocalEvalAccess } from "@/lib/security/request";

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
  // Folder-ingested cases can be flagged excluded (no scoreable action);
  // they are skipped unless ?all=1.
  excluded: boolean;
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
          excluded: c.excluded === true,
        });
      }
    } catch {
      // skip malformed case file
    }
  }
  return cases;
}

async function runModel(
  c: EvalCase,
): Promise<{ score: ScoreInput; raw: unknown } | null> {
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
    score: {
      overall_score: raw.overall_score,
      metrics: METRICS[c.skill].map((m) => ({ key: m.key, score: metricsMap[m.key].score })),
      frameIndices: [
        ...raw.insights.map((i) => i.frame_index),
        raw.focus.frame_index,
        raw.contact_frame_index,
      ],
      frameCount: c.frames.length,
    },
    raw,
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

  const allCases = await loadCases();
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
      const overalls: number[] = [];
      let last: { score: ScoreInput; raw: unknown } | null = null;
      for (let r = 0; r < runs; r++) {
        const out = await runModel(c);
        if (!out) break;
        overalls.push(out.score.overall_score);
        last = out;
      }
      if (!last) {
        results.push({ id: c.id, error: "no model output" });
        continue;
      }
      const checks = checkCase(last.score, c.expected);
      ranChecks.push(checks);
      const verdict = caseVerdict(checks);
      const coherent = coherentOverall(
        last.score.overall_score,
        last.score.metrics.map((m) => m.score),
      );
      results.push({
        id: c.id,
        skill: c.skill,
        discipline: c.discipline,
        overall: last.score.overall_score,
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
