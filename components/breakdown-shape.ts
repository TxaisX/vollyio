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

/** True only for a key the catalog actually names, so an unknown key renders
 *  no label at all rather than raw machine text. */
export function isKnownCheckpoint(skill: Skill, key?: string): key is string {
  return key != null && metricKeys(skill).includes(key);
}
