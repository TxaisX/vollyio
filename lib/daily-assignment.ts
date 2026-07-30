// What the player is told to do today, and why.
//
// This is deliberately a PURE function of state the caller already holds: the
// day key, the player's level, their skill ratings, and the checkpoint the last
// breakdown named. No database, no clock, no model call, so it is unit-tested
// directly and costs nothing per use, which is the whole point of a daily loop
// that has to run every day for a free player.
//
// Relative imports with the extension, not the "@/" alias, for the same reason
// as lib/progression.ts: this file is exercised under `node --test`, which
// resolves imports itself and knows nothing about the bundler's path mapping.
// Type-only imports are erased before that matters, so they may use the alias.
import { DRILLS } from "../content/drills.ts";
import { drillsForMetric } from "../content/technique.ts";
import { metricLabel } from "./ai/metrics.ts";
import { SKILLS } from "./skills.ts";
import type { Drill } from "@/content/drills-types";
import type { Skill, Level } from "@/lib/skills";

/** A drill the player can only do with a court, a partner, or a net. */
const COURT_EQUIPMENT = new Set(["net", "court", "partner", "hitter", "setter", "teammate"]);

/** Levels a player of a given level is allowed to be handed. Mirrors the pool
 *  the previous random challenge used, so nobody's difficulty band changes. */
const LEVEL_POOL: Record<Level, Level[]> = {
  beginner: ["beginner"],
  intermediate: ["beginner", "intermediate"],
  expert: ["intermediate", "expert"],
  pro: ["expert", "pro"],
};

export type WeakPoint = {
  skill: Skill;
  /** A METRICS[skill] key, when the last breakdown named one. */
  metricKey: string | null;
};

export type Assignment = {
  /** `drill` needs a ball and usually a wall or court; `study` needs neither. */
  kind: "drill" | "study";
  skill: Skill;
  metricKey: string | null;
  /** Set when kind is "drill". */
  drill: Drill | null;
  /** Set when kind is "study": where the reading lives. */
  studyHref: string | null;
  title: string;
  /** One line naming why THIS was chosen. Never decorative, if we cannot say
   *  why, the honest answer is that nothing has been measured yet. */
  why: string;
  /** True when the choice is grounded in the player's own measured state
   *  rather than a fallback. Drives whether the card claims to be targeted. */
  targeted: boolean;
};

/** FNV-1a. Stable across runs and machines, unlike anything seeded from the
 *  clock, so the same player sees the same assignment all day and a refresh
 *  never reshuffles the work they already started. */
export function stableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pick<T>(pool: T[], seed: string): T {
  return pool[stableHash(seed) % pool.length];
}

/**
 * The skill today's work should target.
 *
 * Order of authority: the checkpoint the last breakdown actually named, then
 * the lowest rating on the board, then a stable rotation. The rotation is the
 * only branch that is not evidence-driven, and callers can tell which they got
 * from `Assignment.targeted`.
 */
export function targetSkill(
  ratings: Partial<Record<Skill, number>>,
  weak: WeakPoint | null,
  seed: string,
): { skill: Skill; targeted: boolean } {
  if (weak) return { skill: weak.skill, targeted: true };

  const rated = SKILLS.filter((s) => typeof ratings[s] === "number");
  if (rated.length > 0) {
    // Lowest first; ties broken by the fixed SKILLS order so the answer is
    // deterministic rather than dependent on object key iteration.
    const lowest = rated.reduce((a, b) => (ratings[b]! < ratings[a]! ? b : a));
    return { skill: lowest, targeted: true };
  }

  return { skill: pick([...SKILLS], seed), targeted: false };
}

/** Does this drill need something a player at home on a Tuesday will not have? */
export function needsCourt(drill: Drill): boolean {
  return drill.equipment.some((e) => COURT_EQUIPMENT.has(e.toLowerCase()));
}

/**
 * Today's assignment.
 *
 * `courtFree` narrows to drills a player can do alone with a ball and a wall,
 * and falls through to a reading task when even that is empty, because a
 * streak that only survives on court days is a streak designed to break.
 */
export function assignmentFor(opts: {
  userId: string;
  dayKey: string;
  level: Level;
  ratings: Partial<Record<Skill, number>>;
  weak: WeakPoint | null;
  courtFree?: boolean;
}): Assignment {
  const { userId, dayKey, level, ratings, weak, courtFree = false } = opts;
  const seed = `${userId}:${dayKey}`;
  const { skill, targeted } = targetSkill(ratings, weak, seed);
  const metricKey = weak && weak.skill === skill ? weak.metricKey : null;
  const allowed = LEVEL_POOL[level] ?? LEVEL_POOL.beginner;

  // Widen in steps, never to nothing: the player always gets an assignment.
  // Each step gives up one dimension of fit, most specific first.
  const bySkillAndLevel = DRILLS.filter(
    (d) => d.skill === skill && allowed.includes(d.level),
  );
  const bySkill = DRILLS.filter((d) => d.skill === skill);
  let pool = bySkillAndLevel.length > 0 ? bySkillAndLevel : bySkill;

  // Prefer drills that train the exact checkpoint the breakdown flagged. Only
  // when that leaves something to choose from; an empty intersection means the
  // catalog has no drill for that checkpoint, not that the player has no work.
  if (metricKey) {
    const onMetric = drillsForMetric(skill, metricKey).filter((d) =>
      pool.some((p) => p.slug === d.slug),
    );
    if (onMetric.length > 0) pool = onMetric;
  }

  if (courtFree) {
    const alone = pool.filter((d) => !needsCourt(d));
    if (alone.length > 0) {
      pool = alone;
    } else {
      // Nothing in this skill can be done alone today. Read instead of forcing
      // a drill the player cannot actually run.
      return studyAssignment(skill, metricKey, targeted);
    }
  }

  if (pool.length === 0) return studyAssignment(skill, metricKey, targeted);

  const drill = pick(pool, seed);
  return {
    kind: "drill",
    skill,
    metricKey,
    drill,
    studyHref: null,
    title: drill.name,
    why: whyLine(skill, metricKey, targeted, ratings),
    targeted,
  };
}

function studyAssignment(
  skill: Skill,
  metricKey: string | null,
  targeted: boolean,
): Assignment {
  return {
    kind: "study",
    skill,
    metricKey,
    drill: null,
    studyHref: `/learn/${skill}`,
    title: metricKey
      ? `Study: ${metricLabel(skill, metricKey)}`
      : `Study the ${skill} checkpoints`,
    why: "No court today. Read the checkpoint you are working on so the next rep has a target.",
    targeted,
  };
}

function whyLine(
  skill: Skill,
  metricKey: string | null,
  targeted: boolean,
  ratings: Partial<Record<Skill, number>>,
): string {
  if (metricKey) {
    return `Targets ${metricLabel(skill, metricKey).toLowerCase()}, the checkpoint your last breakdown flagged.`;
  }
  if (targeted) {
    const rating = ratings[skill];
    return rating != null
      ? `Your lowest rating right now (${Math.round(rating)}).`
      : "Your lowest rating right now.";
  }
  return "Nothing measured yet, so this is a starting point rather than a diagnosis.";
}
