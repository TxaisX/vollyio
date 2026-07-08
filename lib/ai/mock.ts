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
  const keys = METRICS[skill].map((m) => m.key);
  const weakest = [...metrics].sort((a, b) => a.score - b.score)[0]?.key ?? keys[0];
  return {
    skill,
    overall_score: overall,
    metrics,
    ball_track: [
      { frame_index: 0, x: 0.5, y: 0.35, visible: true },
      { frame_index: 1, x: 0.55, y: 0.28, visible: true },
      { frame_index: 2, x: 0.6, y: 0.22, visible: false },
    ],
    contact_frame_index: 1,
    focus: {
      frame_index: 1,
      label: "Contact point",
      why: "Sample focus moment — enable the coaching service for a real read.",
      time_s: timeAt(1),
    },
    insights: [
      { frame_index: 0, time_s: timeAt(0), type: "strength", observation: "Sample strength observation." },
      { frame_index: 1, time_s: timeAt(1), type: "issue", observation: "Sample issue observation." },
      { frame_index: 2, time_s: timeAt(2), type: "issue", observation: "Second sample issue." },
    ],
    changes: [
      {
        title: "Sample priority change",
        detail: "This is placeholder feedback. Set a real API key to analyze live.",
        target_metric: weakest,
        expected_gain: 12,
        difficulty: "moderate",
        timeframe: "1-2 practices",
      },
      {
        title: "Sample secondary change",
        detail: "A smaller adjustment shown only in mock mode.",
        target_metric: keys[keys.length - 1],
        expected_gain: 6,
        difficulty: "quick",
        timeframe: "this session",
      },
    ],
    priority_fix: {
      title: "Sample priority change",
      detail: "This is placeholder feedback. Set a real API key to analyze live.",
      frame_index: 1,
      time_s: timeAt(1),
    },
    drill_slugs: drillSlugs(skill).slice(0, 2),
    summary: "Sample analysis summary (mock mode).",
  };
}
