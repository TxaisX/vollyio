import { metricKeys, metricLabel } from "@/lib/ai/metrics";
import { metricKnowledge } from "@/content/technique";
import { ADVANCED_ONLY } from "@/components/detail-level";
import type { CheckpointStanding } from "@/components/breakdown-shape";
import type { AnalysisCheckpoint } from "@/lib/analysis-types";
import type { Skill, Discipline } from "@/lib/skills";

// The five named checkpoints of the skill, observed rather than scored (D-099).
//
// EVERY ROW IS RENDERED FROM THE CATALOG, IN CATALOG ORDER, whether or not the
// analysis had anything to say about it. The player asked to see "the skills we
// were tracking", and a list that shrinks to whatever the model happened to
// mention answers a different question: it makes a quiet clip look like a
// shorter skill. metricKeys() is the order METRICS declares, which is the order
// the rubric asks in and the order the old scorecard showed, so a player
// comparing two reps finds the same thing in the same place.
//
// The teaching content under each row (what it is, why it matters, what 90
// looks like, the scoring ladder) is READ FROM content/technique.ts, never from
// the stored result. It is authored prose about volleyball, identical for every
// player, so storing it per row would cost bytes on every read and, worse, make
// it something a reply could get wrong.
export function CheckpointList({
  skill,
  discipline,
  checkpoints,
  standing = {},
  order,
}: {
  skill: Skill;
  discipline: Discipline;
  checkpoints: AnalysisCheckpoint[];
  /** Keyed by METRICS key. Empty on a row stored before the columns carried
   *  their checkpoint key, which is every row already in production. */
  standing?: CheckpointStanding;
  /** The five keys, strongest to weakest (`checkpointRank`). Falls back to
   *  catalog order, which is what every row stored before the ranking existed
   *  still renders in. */
  order?: string[];
}) {
  const seen = new Map(checkpoints.map((c) => [c.key, c]));

  return (
    <ul className="card p-0">
      {(order?.length ? order : metricKeys(skill)).map((key) => {
        const label = metricLabel(skill, key);
        const found = seen.get(key);
        // Two different silences read as one to the player, deliberately. A
        // checkpoint the footage hid (visible: false) and a checkpoint the
        // reply never mentioned are both "no read on this one", and inventing a
        // distinction between them would be inventing evidence. Neither is a
        // mark against the rep, so neither is written as one.
        const observation = found?.visible ? found.observation.trim() : "";
        const knowledge = metricKnowledge(skill, discipline, key);
        const ranked = standing[key];

        return (
          <li key={key} className="border-b border-line p-4 last:border-b-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-display font-bold">{label}</p>
              {/* The back half of the tie between the two columns and this
                  section: the cards up there name their checkpoint, and the
                  checkpoint names which column it was ranked into. Both are
                  static labels rather than jump links because a link needs a
                  44px target, and five of those in the columns would have added
                  back most of the vertical space this layout exists to remove. */}
              {ranked && (
                <span
                  className={`tag shrink-0 ${
                    ranked === "worked"
                      ? "border-teal/40 text-teal"
                      : "border-gold/40 text-gold"
                  }`}
                >
                  {ranked === "worked" ? "Worked" : "To change"}
                </span>
              )}
            </div>
            <p
              className={`mt-1 text-body leading-relaxed ${
                observation ? "text-chalk-dim" : "text-chalk-dim/70"
              }`}
            >
              {observation || "This clip didn’t show this one well enough to call it."}
            </p>

            {knowledge && (
              // Native disclosure: keyboard and screen-reader correct with no
              // client JS, and it survives a page whose JavaScript never runs.
              // Same treatment MetricBar already gives "what 90 looks like".
              <details className="mt-2">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center font-mono text-[10px] uppercase tracking-wide text-teal">
                  {/* Five identical toggles on one page are five identical
                      entries in a screen reader's control list, so each one
                      names its own checkpoint. */}
                  <span className="sr-only">{label}: </span>
                  What good looks like
                </summary>
                <div className="pb-1">
                  <p className="text-sm leading-relaxed text-chalk-dim">
                    {knowledge.what}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-chalk-dim">
                    {knowledge.why}
                  </p>
                  <p className="mt-2.5 font-mono text-[10px] uppercase tracking-wide text-teal">
                    What 90 looks like
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-chalk-dim">
                    {knowledge.elite_marker}
                  </p>

                  {/* The scoring ladder is the Advanced half of a v2 row: it is
                      how the number was calibrated rather than what to do
                      tonight, and three more paragraphs per checkpoint is
                      fifteen on the page. */}
                  <div className={`mt-3 ${ADVANCED_ONLY}`}>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
                      Where it sits on the 100
                    </p>
                    <dl className="mt-1 space-y-1.5 text-sm text-chalk-dim">
                      {(
                        [
                          ["40 developing", knowledge.anchors.developing],
                          ["70 solid", knowledge.anchors.solid],
                          ["90 advanced", knowledge.anchors.advanced],
                        ] as const
                      ).map(([band, prose]) => (
                        <div key={band}>
                          <dt className="font-mono text-[10px] uppercase tracking-wide text-chalk">
                            {band}
                          </dt>
                          <dd className="leading-relaxed">{prose}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}
