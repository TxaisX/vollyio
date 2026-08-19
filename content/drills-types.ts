import type { Skill, Level } from "@/lib/skills";

/**
 * Which surface a drill is FOR.
 *
 * Absent means both, and that is the honest default for most of the catalog:
 * a wall contact drill is a wall contact drill wherever you play. The two
 * named values are for drills whose mechanics only make sense on one surface,
 * and the split is real rather than cosmetic. Sand takes away the push-off a
 * hard floor gives back, so the approach is shorter, the footwork is a shuffle
 * rather than a crossover, and a blocker has to be able to pull off the net
 * because there is no third defender behind them. Teaching an indoor four-step
 * approach to a sand player is teaching them to sink.
 *
 * `outdoor` covers grass and sand together, matching DisciplineGroup in
 * lib/skills.ts: both are soft, slow surfaces played two-a-side, and the
 * scoring already folds them into one group rather than judging them apart.
 */
export type DrillSurface = "indoor" | "outdoor";

export type Drill = {
  slug: string;
  name: string;
  skill: Skill;
  level: Level;
  duration_min: number;
  equipment: string[];
  summary: string;
  steps: string[];
  common_mistakes: string[];
  focus_metrics: string[];
  /** Omitted when the drill works anywhere, which is most of them. */
  surface?: DrillSurface;
};
