import type { Skill } from "@/lib/skills";
import { METRICS, metricLabel } from "@/lib/ai/metrics";
import { drillSlugs } from "@/content/drills";
import type { AnalysisResult } from "@/lib/analysis-types";

export function mockResult(
  skill: Skill,
  timeAt: (index: number) => number | null,
): AnalysisResult {
  const metrics = METRICS[skill].map((m, i) => ({
    key: m.key,
    score: 58 + ((i * 9) % 34),
    note: `Sample read on ${metricLabel(skill, m.key).toLowerCase()} — enable the coaching service for real feedback.`,
  }));
  const overall = Math.round(
    metrics.reduce((a, b) => a + b.score, 0) / metrics.length,
  );
  return {
    skill,
    overall_score: overall,
    metrics,
    insights: [
      { frame_index: 0, time_s: timeAt(0), type: "strength", observation: "Sample strength observation." },
      { frame_index: 1, time_s: timeAt(1), type: "issue", observation: "Sample issue observation." },
      { frame_index: 2, time_s: timeAt(2), type: "issue", observation: "Second sample issue." },
    ],
    priority_fix: {
      title: "Sample priority fix",
      detail: "This is placeholder feedback. Set a real API key to analyze live.",
      frame_index: 2,
      time_s: timeAt(2),
    },
    drill_slugs: drillSlugs(skill).slice(0, 2),
    summary: "Sample analysis summary (mock mode).",
  };
}
