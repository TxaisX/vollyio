import type { Metadata } from "next";
import { ViewTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { Reveal } from "@/components/motion";
import { ProgressNav } from "@/components/section-nav";
import { relativeDay } from "@/lib/relative-day";
import { scoreBand } from "@/lib/ratings";
import { displayScore } from "@/lib/score-precision";
import {
  DISCIPLINE_LABEL,
  SKILLS,
  SKILL_LABEL,
  isSkill,
  type Discipline,
  type Skill,
} from "@/lib/skills";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "History",
  description: "Every rep you have filmed, newest first.",
};

// Five scalar columns and no `result`. The list used to select the whole
// result JSON for one string, the priority fix, on every one of up to 100
// rows; the row no longer shows it, so the blob no longer crosses the wire.
type Row = {
  id: string;
  skill: Skill;
  discipline: Discipline;
  overall_score: number;
  created_at: string;
};

export default async function History({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string }>;
}) {
  const { skill: skillParam } = await searchParams;
  const activeSkill = skillParam && isSkill(skillParam) ? skillParam : null;

  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);

  let query = supabase
    .from("analyses")
    .select("id, skill, discipline, overall_score, created_at")
    .eq("user_id", userId!)
    .order("created_at", { ascending: false })
    .limit(100);
  if (activeSkill) query = query.eq("skill", activeSkill);

  const { data, error } = await query;

  if (error) throw error;

  const rows = (data as Row[] | null) ?? [];

  return (
    <section className="max-w-4xl">
      <Reveal>
        {/* Same header rhythm as the dashboard and settings: kicker, title,
            controls, then one rule closing the block off from the content. */}
        <div className="border-b border-line pb-5">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold-ink">
            History
          </p>
          <h1 className="mt-2 font-display text-page-title">
            The film room
          </h1>
          <ProgressNav active="reps" />

          {/* Seven chips, one row, scrolling sideways. They used to wrap, and
              seven 44px targets became two rows on any phone, which put the
              header at roughly 200px before the first rep: taller than the
              slice of the list it was introducing. The chips cannot shrink,
              because they are the tap targets, so the row scrolls instead.

              Same treatment as the hub strips in components/section-nav.tsx,
              deliberately: two scrolling chip rows that behaved differently
              would read as two different controls. The negative margin plus
              matching padding bleeds the row through the shell's px-5 gutter
              (app/(app)/layout.tsx), so a chip is visibly clipped by the screen
              edge and it reads as "more to the right" rather than as a row that
              simply ends. Both are dropped at md where the row fits.

              Unlike those strips this list is NOT reordered to surface the
              active chip. The order here is the skill order players see
              everywhere else in the app, and "All" is first because it is the
              way back. Reordering would move a filter under the finger that
              just tapped a different one. */}
          <div
            tabIndex={0}
            className="-mx-5 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain scroll-px-5 px-5 py-1 [scrollbar-width:none] md:mx-0 md:scroll-px-0 md:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {/* aria-current, because the active filter is otherwise carried by
                the gold fill alone. */}
            <Link
              href="/history"
              aria-current={!activeSkill ? "page" : undefined}
              className={`chip min-h-11 shrink-0 snap-start whitespace-nowrap ${!activeSkill ? "chip-active" : ""}`}
            >
              All
            </Link>
            {SKILLS.map((s) => (
              <Link
                key={s}
                href={`/history?skill=${s}`}
                aria-current={activeSkill === s ? "page" : undefined}
                className={`chip min-h-11 shrink-0 snap-start whitespace-nowrap ${activeSkill === s ? "chip-active" : ""}`}
              >
                {SKILL_LABEL[s]}
              </Link>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Same-route crossfade: the skill filter changes ?skill= on the same
          /history route. Keying the ViewTransition on the active filter lets
          React crossfade the list in place (share="auto") instead of a hard
          swap, while the heading and chips above stay put. The Reveal around
          it stays mounted across filters, so this only animates the swap. */}
      <Reveal delay={80}>
        <ViewTransition
          key={activeSkill ?? "all"}
          name="history-list"
          share="auto"
          default="none"
        >
          {rows.length === 0 ? (
            <div className="card mt-6 p-8 text-center">
              <p className="font-display text-lg font-bold">Nothing here yet.</p>
              <p className="mx-auto mt-1 max-w-xs text-body text-chalk-dim">
                {activeSkill
                  ? `No ${SKILL_LABEL[activeSkill].toLowerCase()} reps logged.`
                  : "No reps logged yet."}
              </p>
              <Link href="/analyze" className="btn-primary mt-5 inline-flex text-sm">
                Film a rep
              </Link>
            </div>
          ) : (
            // THE SAME ROW HOME SHOWS (D-117). This was a flat divide-y line
            // per rep: a date column, one mono line carrying skill and
            // environment, and a bare number. It was the densest thing in the
            // app and it was also the only list of reps that did not look like
            // the list of reps on the dashboard, which is the screen a player
            // arrives from. Two lists of the same rows in two shapes read as
            // two features.
            //
            // What that costs is honest and worth stating: the row goes from
            // about 44px to about 76px, so a phone screen holds roughly five
            // reps where it held eight. Nothing was removed to pay for it. The
            // date became `relativeDay` (lib/relative-day.ts), the environment
            // became a chip beside the band it belongs next to, and the score
            // became the 48px tile that is also the morph source below.
            //
            // The priority fix stays off this row, which is the one thing the
            // dashboard's version carries and this one does not. That was the
            // owner's call when the fix line came off, and 100 rows is exactly
            // where it still holds: anyone who wants to know what to change
            // opens the rep.
            <ul className="mt-6 space-y-2">
              {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/analysis/${r.id}`}
                  className="card card-lift group relative flex items-center gap-3 p-3"
                >
                  {/* Shared-element morph source: this score travels into the
                      breakdown's score ring when the row is opened, and it is
                      now the same 48px tile the dashboard morphs from rather
                      than a bare number, so the two entry points into a
                      breakdown animate identically. share="morph" so it only
                      fires on that shared navigation, not on the filter
                      crossfade wrapping the whole list. */}
                  <ViewTransition
                    name={`rep-${r.id}`}
                    share="morph"
                    default="none"
                  >
                    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-control border border-gold/30 bg-gold/10">
                      <span className="stat-num text-lg text-gold-ink">
                        {displayScore(r.overall_score)}
                      </span>
                      <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-chalk-dim">
                        pts
                      </span>
                    </span>
                  </ViewTransition>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate font-display text-sm font-bold">
                        {SKILL_LABEL[r.skill]}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-chalk-dim">
                        {relativeDay(r.created_at)}
                      </span>
                    </span>
                    {/* BOTH facts stay. The list mixes environments (Trends
                        splits them), so each rep says which one it was,
                        because an outdoor 62 next to an indoor 78 is two facts
                        and not a regression. The exact discipline rather than
                        the indoor/grass group it used to collapse to, matching
                        the dashboard: the group was a shortening, and the chip
                        has room for the real one. */}
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="tag">{scoreBand(r.overall_score)}</span>
                      <span className="tag">{DISCIPLINE_LABEL[r.discipline]}</span>
                    </span>
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0 text-chalk-dim transition-transform group-hover:translate-x-0.5 group-hover:text-chalk"
                    aria-hidden
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              </li>
              ))}
            </ul>
          )}
        </ViewTransition>
      </Reveal>
    </section>
  );
}
