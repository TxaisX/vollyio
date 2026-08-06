/**
 * What a player's history says, derived in code rather than asked of a model.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: the scoring read stays BLIND. It would
 * be easy, and wrong, to tell the read "this player struggles with Release, look
 * at that". D-094 is the record of what this model does when pointed at a
 * conclusion: given a checklist to confirm, it confirmed 90 to 100% of it. Prime
 * it with a history and it will find the history, and the finding will look
 * exactly like evidence. So every rep is scored knowing nothing about the player,
 * and continuity is computed here afterwards, where it is deterministic and
 * cannot be talked into anything.
 *
 * THE SECOND RULE: trend, not point deltas. Rank correlation across a complete
 * re-anchor was 0.708 while the median moved 55, 78 and 97
 * (docs/model-findings-2026-08-05.md). Ordering survives what absolute level does
 * not, so "Release moved out of your bottom two" is a claim this data supports
 * and "Release improved 6 points" is mostly noise wearing a number. Nothing here
 * returns a score delta, and that is deliberate rather than an omission.
 *
 * Pure and dependency-light on purpose: the caller supplies rows, so this is
 * unit tested against fixtures instead of a database, and the same derivation
 * serves the coach context and any progress surface without a second
 * implementation drifting from the first.
 */

/** One analysis, reduced to what a journey can be derived from. */
export type JourneyRow = {
  skill: string;
  /** ISO date, newest first is NOT assumed; this module sorts. */
  created_at: string;
  /** METRICS[skill] keys the analysis ranked as strengths. */
  strengthKeys: string[];
  /** METRICS[skill] keys the analysis ranked as needing work. */
  changeKeys: string[];
  /**
   * Whether the player told us this read was wrong (`analysis_feedback`).
   * A read that analysed the wrong person is not evidence about this player,
   * and letting it into a trend is worse than having no trend: it is a
   * confident statement built on a row the player has already disputed.
   */
  disputed?: boolean;
};

export type CheckpointStanding = "working" | "improving" | "strength" | "unseen";

export type CheckpointHistory = {
  key: string;
  /** How many analyses ranked it a strength, and how many ranked it a fix. */
  strengthCount: number;
  changeCount: number;
  /** Where it landed in the MOST RECENT analysis that mentioned it at all. */
  latest: "strength" | "change" | null;
  /**
   * Consecutive most-recent analyses that ranked it a fix. This is the number
   * that matters: one mention is a note, four in a row is the thing the player
   * keeps being told and has not managed to change.
   */
  changeStreak: number;
  standing: CheckpointStanding;
};

const STUCK_AFTER = 3;

/**
 * Per-checkpoint history for ONE skill, newest analysis first in the result's
 * reasoning but stable in key order for the caller to sort as it likes.
 *
 * Disputed rows are dropped entirely rather than down-weighted. There is no
 * honest partial credit for a read that looked at the wrong player.
 */
export function checkpointHistory(rows: readonly JourneyRow[], skill: string): CheckpointHistory[] {
  const usable = rows
    .filter((r) => r.skill === skill && !r.disputed)
    .slice()
    // Newest first, because every question below is about the recent past.
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const keys = new Set<string>();
  for (const r of usable) {
    for (const k of r.strengthKeys) keys.add(k);
    for (const k of r.changeKeys) keys.add(k);
  }

  return [...keys].map((key) => {
    let strengthCount = 0;
    let changeCount = 0;
    let latest: "strength" | "change" | null = null;
    let changeStreak = 0;
    let streakOpen = true;

    for (const r of usable) {
      const isChange = r.changeKeys.includes(key);
      const isStrength = r.strengthKeys.includes(key);
      if (isChange) changeCount++;
      if (isStrength) strengthCount++;
      if (latest === null && (isChange || isStrength)) {
        latest = isChange ? "change" : "strength";
      }
      // The streak counts back from the newest analysis and stops at the first
      // one that did NOT call this a fix. A row that mentions the checkpoint
      // not at all breaks it too: silence is not continued failure, and
      // treating it as such would manufacture a streak out of a clip that
      // simply did not show the mechanic.
      if (streakOpen) {
        if (isChange) changeStreak++;
        else streakOpen = false;
      }
    }

    return {
      key,
      strengthCount,
      changeCount,
      latest,
      changeStreak,
      standing: standingOf(latest, changeCount, strengthCount, changeStreak),
    };
  });
}

function standingOf(
  latest: "strength" | "change" | null,
  changeCount: number,
  strengthCount: number,
  changeStreak: number,
): CheckpointStanding {
  if (latest === null) return "unseen";
  if (latest === "change") return "working";
  // It reads as a strength now. "Improving" is reserved for the case worth
  // telling a player about: it USED to be a fix and is not any more. Without
  // that history it is simply a strength, and calling it improvement would
  // credit them for progress nothing observed.
  if (changeCount > 0 && changeStreak === 0) return "improving";
  void strengthCount;
  return "strength";
}

/**
 * The checkpoints a player keeps being told about, worst first.
 *
 * Three consecutive analyses is the threshold, and it is a judgement rather than
 * a measurement: twice is a coincidence a coach would not remark on, and waiting
 * for four means a player hears the same note a fourth time before anything in
 * the product notices. Revisit it against real usage rather than by taste.
 */
export function stuckCheckpoints(history: readonly CheckpointHistory[]): CheckpointHistory[] {
  return history
    .filter((h) => h.changeStreak >= STUCK_AFTER)
    .slice()
    .sort((a, b) => b.changeStreak - a.changeStreak);
}

export type JourneySummary = {
  skill: string;
  analyses: number;
  /** Checkpoints ranked as fixes in the most recent analysis. */
  working: string[];
  /** Was a fix before, is a strength now. The earned statement. */
  improved: string[];
  /** Fix for STUCK_AFTER or more analyses running, with the count. */
  stuck: { key: string; times: number }[];
  /** Disputed reads excluded from all of the above, so the coach can say so. */
  excluded: number;
};

/**
 * The whole journey for one skill, shaped for a prompt rather than a chart.
 *
 * Deliberately carries NO scores and no deltas. What it carries is what the
 * data supports: which checkpoints are currently the problem, which ones the
 * player has genuinely moved, and which ones they have been told about
 * repeatedly without moving. That last list is the one that should change what
 * the coach SAYS rather than being recited: a player on their fourth identical
 * note does not need the note again, they need a different approach to it.
 */
export function journeySummary(rows: readonly JourneyRow[], skill: string): JourneySummary {
  const forSkill = rows.filter((r) => r.skill === skill);
  const history = checkpointHistory(rows, skill);
  return {
    skill,
    analyses: forSkill.filter((r) => !r.disputed).length,
    working: history.filter((h) => h.standing === "working").map((h) => h.key),
    improved: history.filter((h) => h.standing === "improving").map((h) => h.key),
    stuck: stuckCheckpoints(history).map((h) => ({ key: h.key, times: h.changeStreak })),
    excluded: forSkill.filter((r) => r.disputed).length,
  };
}

/**
 * Whether there is enough history to say anything at all.
 *
 * One analysis is a point, not a journey, and a product that announces a trend
 * off a single rep is the same failure as a model inventing the other end of a
 * range from one score (see the range guard in lib/ai/coach-prompt.ts). Two is
 * the floor for any statement about movement.
 */
export function hasJourney(summary: JourneySummary): boolean {
  return summary.analyses >= 2;
}
