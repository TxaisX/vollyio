import type { Skill, Discipline } from "@/lib/skills";

// The shared volleyball knowledge core. One typed source of truth for both the
// player-facing Learn section and (later) the coaching layer. Keyed off the same
// vocabulary as everything else: Skill / Discipline from lib/skills.ts and the
// five metric keys per skill from lib/ai/metrics.ts. Drill links are DERIVED from
// each drill's focus_metrics (content/drills.ts), never re-stored here.

/** The 0-100 scoring bands, ported from the RUBRIC ~40 / ~70 / ~90 anchor prose. */
export type MetricAnchors = {
  developing: string; // ~40
  solid: string; // ~70
  advanced: string; // ~90
};

/** Knowledge for ONE scored metric of a skill, in ONE discipline.
 *  `key` must be a METRICS[skill] key (enforced by content/technique.test.ts). */
export type MetricKnowledge = {
  key: string;
  what: string; // plain-language: what this metric is
  why: string; // why it matters to the outcome
  elite_marker: string; // the pro version of this metric
  common_faults: string[]; // the amateur tells
  anchors: MetricAnchors; // the 0-100 scoring bands
  exemplars?: string[]; // illustrative pro names, UI ONLY, never sent to the model
};

/** A teaching phase of the skill's motion. */
export type SkillPhase = { name: string; detail: string };

/** Everything that can diverge between indoor and beach for one skill. */
export type DisciplineVariant = {
  overview: string; // "what good looks like" in one paragraph
  highest_leverage_metric: string; // a metric key, the one that drives the others
  highest_leverage_note: string;
  context_note?: string; // e.g. the beach context (wind / sand / two-player)
  phases: SkillPhase[];
  metrics: Record<string, MetricKnowledge>; // one entry per METRICS[skill] key
};

/** The core entry for one skill across both disciplines. */
export type SkillTechnique = {
  skill: Skill;
  persona: string; // seed for the future rubric generator ("elite indoor serving coach…")
  byDiscipline: Record<Discipline, DisciplineVariant>;
};
