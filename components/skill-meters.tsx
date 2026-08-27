import Link from "next/link";
import { SkillIcon } from "@/components/skill-icons";
import { LinkPending } from "@/components/link-pending";
import { skillTrend, type Trend } from "@/lib/skill-trend";
import { SKILLS, SKILL_LABEL, type Skill } from "@/lib/skills";
import { displayScore } from "@/lib/score-precision";

/**
 * The six skills as one compact list: where each one stands, and which way it
 * is moving.
 *
 * THE WINDOW SWITCH IS GONE. This carried a 7 days / All time segmented control
 * and rendered two full lists into the DOM so CSS could swap them. Two windows
 * behind a switch asked the player to hold both numbers in their head and do
 * the comparison themselves, which is work almost nobody does. There is one
 * number now, the rolling rating, and the comparison the switch used to invite
 * is drawn as the arrow beside it (lib/skill-trend.ts).
 *
 * IT SAYS WHERE, NOT WHAT. The row carries no fix text, deliberately. This
 * block sits directly below the Focus now card, which prints the newest
 * priority fix in full, and directly above Recent activity, whose rows each
 * print the fix for their rep. A focus line per skill would put the same
 * sentence on screen three times, run every row to three lines, and truncate
 * mid-sentence into something less useful than the arrow already was. The job
 * here is to make a player notice that blocking is red; the answer to "what do
 * I fix" is one tap away, which is why a rated row opens that skill's newest
 * breakdown rather than a list of past ones.
 *
 * An unrated skill still renders, with an empty track and a dash, so the six
 * rows keep one baseline to read down and a skill nobody has filmed is visibly
 * missing rather than silently absent. Those rows open the technique page
 * instead, because there is no breakdown to open and "read how this works" is
 * the honest next step.
 */
export function SkillMeters({
  ratings,
  recent,
  latestId,
}: {
  /** Rolling rating per skill, the number the row shows. */
  ratings: Partial<Record<Skill, number>>;
  /** Mean of the reps filmed in the last 7 days, per skill. Decides the arrow
   *  and is never itself displayed. */
  recent: Partial<Record<Skill, { mean: number; n: number }>>;
  /** Newest analysis id per skill, so a row can open the breakdown that
   *  explains its own number. */
  latestId: Partial<Record<Skill, string>>;
}) {
  const anyRated = SKILLS.some((s) => ratings[s] != null);

  return (
    <div>
      <h2 className="section-head">Current skills</h2>

      <div className="card mt-3 overflow-hidden">
        <ul className="divide-y divide-line">
          {SKILLS.map((skill) => {
            const rating = ratings[skill];
            const rated = rating != null;
            const shown = rated ? displayScore(rating) : null;
            const trend = skillTrend(rating, recent[skill]);
            const id = latestId[skill];
            const href = rated && id ? `/analysis/${id}` : `/learn/${skill}`;

            return (
              <li key={skill}>
                <Link
                  href={href}
                  className="group relative flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-navy-lighter/45 sm:px-4"
                >
                  <span className="row-tile">
                    <SkillIcon skill={skill} className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="truncate font-display text-sm font-bold">
                      {SKILL_LABEL[skill]}
                    </span>
                    {/* The track is drawn for every skill, rated or not, so the
                        six rows keep one baseline to read down. An unrated
                        skill leaves it empty rather than collapsing the row. */}
                    {rated ? (
                      <span
                        role="progressbar"
                        aria-label={SKILL_LABEL[skill]}
                        aria-valuenow={shown!}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuetext={`about ${shown!} out of 100`}
                        className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line"
                      >
                        <span
                          className="block h-full rounded-full bg-gold"
                          style={{
                            width: `${Math.max(0, Math.min(100, rating))}%`,
                          }}
                        />
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="mt-1.5 block h-1.5 rounded-full bg-line/50"
                      />
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {rated ? (
                      <>
                        <span className="stat-num text-lg text-gold-ink">
                          {shown}
                        </span>
                        <TrendMark trend={trend} />
                      </>
                    ) : (
                      <span className="font-mono text-sm text-chalk-dim">
                        <span className="sr-only">
                          {SKILL_LABEL[skill]}: not rated yet
                        </span>
                        <span aria-hidden="true">&mdash;</span>
                      </span>
                    )}
                  </span>
                  <LinkPending />
                </Link>
              </li>
            );
          })}
        </ul>
        {!anyRated && (
          <p className="border-t border-line px-4 py-3 font-mono text-[11px] text-chalk-dim">
            No rating yet. Your first rep on a skill seeds it.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Green up or red down, and nothing at all otherwise. `teal-ink` and
 * `coral-ink` are the palette's green and red at text weight; the bright fills
 * beside them are for backgrounds and do not clear contrast as a glyph on sand.
 */
function TrendMark({ trend }: { trend: Trend }) {
  if (trend === "flat") return null;
  const up = trend === "up";
  return (
    <span className={up ? "text-teal-ink" : "text-coral-ink"}>
      <span className="sr-only">
        {up
          ? ", this week's reps are above it"
          : ", this week's reps are below it"}
      </span>
      <svg
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        {up ? (
          <path d="M6 10V2m0 0L2.5 5.5M6 2l3.5 3.5" />
        ) : (
          <path d="M6 2v8m0 0l3.5-3.5M6 10L2.5 6.5" />
        )}
      </svg>
    </span>
  );
}
