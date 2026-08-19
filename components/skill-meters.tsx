import Link from "next/link";
import { SkillIcon } from "@/components/skill-icons";
import { SKILLS, SKILL_LABEL, type Skill } from "@/lib/skills";

/**
 * The six skills as one compact meter list, with a window switch above it.
 *
 * This replaces the 2-and-3-column grid of momentum cards that stood here
 * before (D-116). Six cards, each carrying a sparkline and a truncated focus
 * line, ran about 620px on a phone and could not be read as a ranking: the eye
 * had to jump between two columns to compare two numbers. Six rows on one axis
 * run about 300px and sort themselves.
 *
 * Nothing was dropped in the trade. The rating, the all-time best and the
 * focus line all still render; the sparkline is the one thing that went, and
 * the trend it drew is the whole subject of /history, which every row still
 * links to.
 *
 * THE WINDOW SWITCH IS PURE CSS, for the same reason the breakdown's Detail
 * switch is (components/detail-level.tsx): two real radios carry the state and
 * `:has()` on the checked one swaps which list is visible. Both lists are in
 * the server-rendered HTML, so the control works before any JavaScript arrives
 * and keeps working if none ever does. The cost is one duplicated six-row list
 * in the DOM, which is the cheaper half of that trade by a wide margin.
 *
 * The two windows are DIFFERENT MEASUREMENTS and are labelled as such rather
 * than presented as one number over two ranges:
 *  - All time is the rolling rating from `skill_ratings`, the asymmetric
 *    estimator in lib/ratings.ts. It is what the product means by "where your
 *    form is".
 *  - Last 7 days is the plain mean of the reps actually filmed this week. It
 *    moves faster because it is not an estimator, which is exactly why a
 *    player wants it after a week of work on one fix.
 */
export function SkillMeters({
  ratings,
  recent,
  bests,
  latestFix,
}: {
  /** Rolling rating per skill, all time. */
  ratings: Partial<Record<Skill, number>>;
  /** Mean of the reps filmed in the last 7 days, per skill. */
  recent: Partial<Record<Skill, number>>;
  /** All-time high-water mark per skill. */
  bests: Partial<Record<Skill, number>>;
  /** Latest priority fix per skill, for the row's one-line focus note. */
  latestFix: Partial<Record<Skill, string>>;
}) {
  return (
    <div className="group/window">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-head">Current skills</h2>
        <fieldset className="min-w-0">
          <legend className="sr-only">Which window to rate over</legend>
          <div className="segmented">
            <label className="cursor-pointer">
              <input
                type="radio"
                name="skill-window"
                className="sr-only"
                defaultChecked
              />
              <span className="segmented-option">7 days</span>
            </label>
            <label className="cursor-pointer">
              <input
                type="radio"
                name="skill-window"
                className="window-all sr-only"
              />
              <span className="segmented-option">All time</span>
            </label>
          </div>
        </fieldset>
      </div>

      <div className="card mt-3 overflow-hidden">
        {/* Named group, not the bare `group` the Detail switch uses: these rows
            contain their own `.group` links for hover state, and an unnamed
            scope here would be shadowed by the nearest one. */}
        <MeterList
          className="group-has-[.window-all:checked]/window:hidden"
          window="Last 7 days"
          values={recent}
          bests={bests}
          latestFix={latestFix}
          emptyLine="No reps filmed in the last 7 days. Film one and this fills in."
        />
        <MeterList
          className="hidden group-has-[.window-all:checked]/window:block"
          window="All time"
          values={ratings}
          bests={bests}
          latestFix={latestFix}
          emptyLine="No rating yet. Your first rep on a skill seeds it."
        />
      </div>
    </div>
  );
}

function MeterList({
  className,
  window,
  values,
  bests,
  latestFix,
  emptyLine,
}: {
  className: string;
  window: string;
  values: Partial<Record<Skill, number>>;
  bests: Partial<Record<Skill, number>>;
  latestFix: Partial<Record<Skill, string>>;
  emptyLine: string;
}) {
  const anyRated = SKILLS.some((s) => values[s] != null);
  return (
    <div className={className}>
      <ul className="divide-y divide-line">
        {SKILLS.map((skill) => {
          const value = values[skill];
          const rated = value != null;
          const shown = rated ? Math.round(value) : null;
          const best = bests[skill];
          const fix = latestFix[skill];
          return (
            <li key={skill}>
              <Link
                href={`/history?skill=${skill}`}
                className="group flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-navy-lighter/45 sm:px-4"
              >
                <span className="row-tile">
                  <SkillIcon skill={skill} className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate font-display text-sm font-bold">
                      {SKILL_LABEL[skill]}
                    </span>
                    {best != null && rated && (
                      <span className="shrink-0 font-mono text-[10px] text-chalk-dim">
                        best {best}
                      </span>
                    )}
                  </span>
                  {/* The track is drawn for every skill, rated or not, so the
                      six rows keep one baseline to read down. An unrated skill
                      leaves it empty rather than collapsing the row. */}
                  {rated ? (
                    <span
                      role="progressbar"
                      aria-label={`${SKILL_LABEL[skill]}, ${window}`}
                      aria-valuenow={shown!}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuetext={`${shown} out of 100`}
                      className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line"
                    >
                      <span
                        className="block h-full rounded-full bg-gold"
                        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                      />
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="mt-1.5 block h-1.5 rounded-full bg-line/50"
                    />
                  )}
                  {fix && rated && (
                    <span className="mt-1.5 block truncate font-mono text-[10px] text-chalk-dim">
                      <span className="text-gold-ink">Focus:</span> {fix}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  {rated ? (
                    <span className="stat-num text-lg text-gold-ink">{shown}</span>
                  ) : (
                    <span className="font-mono text-sm text-chalk-dim">
                      <span className="sr-only">
                        {SKILL_LABEL[skill]}: not rated in this window
                      </span>
                      <span aria-hidden="true">&mdash;</span>
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {!anyRated && (
        <p className="border-t border-line px-4 py-3 font-mono text-[11px] text-chalk-dim">
          {emptyLine}
        </p>
      )}
    </div>
  );
}
