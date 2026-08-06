import type { Metadata } from "next";
import { ViewTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { Reveal } from "@/components/motion";
import { ProgressNav } from "@/components/section-nav";
import { SkillIcon } from "@/components/skill-icons";
import {
  DISCIPLINE_LABEL,
  SKILLS,
  SKILL_LABEL,
  disciplineGroup,
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
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
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
            // ONE LINE PER REP, and the whole point is how many fit. The row
            // used to carry the priority fix on a second line, which made a
            // phone screen hold about four reps; the owner's call was that
            // anyone who wants to know what to change opens the rep, so the
            // fix line is gone rather than truncated. What is left is what you
            // scan a list of reps by: when, what, where, how it scored.
            //
            // p-3 with min-h-11 rather than a tighter padding: the row still
            // has to be a 44px target, so the height floor holds it there and
            // the space came out of the second line instead.
            <ul className="mt-6 divide-y divide-line">
              {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/analysis/${r.id}`}
                  className="group flex min-h-11 items-center gap-3 rounded-control p-3 transition-colors hover:bg-navy-light"
                >
                  <span className="w-12 shrink-0 font-mono text-xs text-chalk-dim">
                    {new Date(r.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  {/* Skill and environment share one mono line instead of two
                      filled pills. BOTH facts stay: the list mixes
                      environments (Trends splits them), so each rep says which
                      one it was, because an outdoor 62 next to an indoor 78 is
                      two facts and not a regression. Two boxes for two short
                      words was the chrome, not the information. */}
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-chalk-dim">
                    <SkillIcon skill={r.skill} className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {SKILL_LABEL[r.skill]} ·{" "}
                      {disciplineGroup(r.discipline) === "indoor"
                        ? DISCIPLINE_LABEL.indoor
                        : DISCIPLINE_LABEL.grass}
                    </span>
                  </span>
                  {/* Shared-element morph source: this score appears to
                      travel into the breakdown's score ring when the row
                      is opened. share="morph" so it only fires on that
                      shared navigation, not on the filter crossfade. */}
                  <ViewTransition
                    name={`rep-${r.id}`}
                    share="morph"
                    default="none"
                  >
                    <span className="font-display text-sm font-bold text-gold">
                      {r.overall_score}
                    </span>
                  </ViewTransition>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0 text-chalk-dim transition-transform group-hover:translate-x-0.5"
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
