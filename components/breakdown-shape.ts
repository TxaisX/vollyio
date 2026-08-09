// The two derivations that decide what the breakdown shows, kept out of the
// JSX so they can be tested against a real stored row rather than asserted
// against source text. Relative .ts imports for the same reason
// content/technique.ts uses them: `node --test` has to be able to load this
// module, and it cannot resolve the `@/` alias.
//
// There are TWO stored result shapes and both must render forever (D-097).
// Everything that branches on which one a row is lives here, in one place, so
// the component never has to sniff for missing fields halfway down the page.
import { metricKeys } from "../lib/ai/metrics.ts";
import type { AnalysisResult } from "../lib/analysis-types.ts";
import type { Skill } from "../lib/skills.ts";

/** One entry in the "what worked" column, from either stored shape. */
export type WorkedItem = {
  title: string;
  /** Null on a v1 row: a timeline insight is one sentence with no title. */
  detail: string | null;
  /** The METRICS key this point is about. Absent on v1 and on any v2 row
   *  written before the columns carried their checkpoint key. */
  key?: string;
};

/** Which column, if either, a checkpoint was ranked into on this rep. */
export type CheckpointStanding = Record<string, "worked" | "change">;

/**
 * What worked, in one shape whichever engine wrote the row.
 *
 * A v2 row names its strengths directly. A v1 row has no `strengths` at all and
 * expresses the same thing as timeline insights of type "strength", so they are
 * read out of the timeline instead. Without this a v1 row, and there are 38 of
 * them, would render an empty left column while its strengths sat in a section
 * that is now behind the Advanced switch.
 */
export function workedItems(result: AnalysisResult): WorkedItem[] {
  const strengths = result.strengths ?? [];
  if (strengths.length > 0) {
    return strengths.map((s) => ({ title: s.title, detail: s.detail, key: s.key }));
  }
  return (result.insights ?? [])
    .filter((i) => i.type === "strength")
    .map((i) => ({ title: i.observation, detail: null }));
}

/**
 * Which checkpoint each column entry is about, so the checkpoints section can
 * say which column it was ranked into.
 *
 * Both `key` fields are optional and are absent on every row written before
 * D-099, including the ones already in production, so such a row gets an empty
 * map and no labels anywhere rather than a blank chip. A key the catalog does
 * not recognise is dropped for the same reason: metricLabel falls back to the
 * raw key, and "tempo_decision" is not a thing to show a player.
 *
 * A checkpoint claimed by both columns resolves to "change", because that is
 * the half the player is meant to act on. The rubric forbids the model from
 * doing this, which is exactly why the reader must not depend on it.
 */
export function checkpointStanding(
  skill: Skill,
  result: AnalysisResult,
): CheckpointStanding {
  const known = metricKeys(skill);
  const standing: CheckpointStanding = {};
  for (const s of workedItems(result)) {
    if (s.key && known.includes(s.key)) standing[s.key] = "worked";
  }
  for (const c of result.changes ?? []) {
    if (c.key && known.includes(c.key)) standing[c.key] = "change";
  }
  return standing;
}

/**
 * The five checkpoints, ordered strongest to weakest.
 *
 * This is the honest answer to "where did my score come from", and it is the
 * ONLY one available: `overall_score` is a single judgement the model returns
 * about the whole rep and is not derived from these rows (see the note above
 * `checkpoints` in lib/ai/simple-rubric.ts). Putting a number on each row would
 * describe a sum that does not happen, and it is the same move that
 * ceiling-pegged the frame path at a median of 97 (D-094).
 *
 * The ORDER, by contrast, is the part D-099 measured as reliable: rank
 * correlation held at 0.708 across a re-anchor that moved the median 55 -> 78
 * -> 97. So the ranking is shown and the magnitudes are not.
 *
 * Strengths keep the order the model ranked them in, improvements keep theirs,
 * and anything it did not rank sits between the two: unranked means "not among
 * the best or the worst here", which is exactly the middle.
 */
export function checkpointRank(
  skill: Skill,
  result: AnalysisResult,
): string[] {
  const known = metricKeys(skill);
  const standing = checkpointStanding(skill, result);
  const rankedWorked = workedItems(result)
    .map((s) => s.key)
    .filter((k): k is string => k != null && known.includes(k));
  const rankedChanges = (result.changes ?? [])
    .map((c) => c.key)
    .filter((k): k is string => k != null && known.includes(k));
  const seen = new Set<string>();
  const push = (keys: string[]) => keys.filter((k) => !seen.has(k) && seen.add(k));
  return [
    ...push(rankedWorked),
    ...push(known.filter((k) => standing[k] == null)),
    ...push(rankedChanges),
    // Anything the catalog names that somehow escaped the three passes above.
    // All five rows render on every rep whatever the clip showed, and that
    // promise outranks the ordering.
    ...known.filter((k) => !seen.has(k)),
  ];
}

/** True only for a key the catalog actually names, so an unknown key renders
 *  no label at all rather than raw machine text. */
export function isKnownCheckpoint(skill: Skill, key?: string): key is string {
  return key != null && metricKeys(skill).includes(key);
}
