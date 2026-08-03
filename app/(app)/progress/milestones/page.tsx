import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { Reveal } from "@/components/motion";
import { ProgressNav } from "@/components/section-nav";
import { BadgeGrid } from "@/components/achievements";
import { SkillIcon } from "@/components/skill-icons";
import { claimAchievements, readAchievements } from "@/lib/achievements";
import { SKILLS, SKILL_LABEL, type Skill } from "@/lib/skills";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Milestones",
  description: "Badges earned, personal bests, and every goal you have finished.",
};

type BestRow = { skill: Skill; discipline: string; best: number };
type DoneGoalRow = {
  id: string;
  title: string;
  skill: Skill | null;
  completed_at: string | null;
};

export default async function Milestones() {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);

  // Catch up quietly, then read. Same posture as the dashboard: a database
  // without migration 050 yields an empty grid, never an error page (D-089).
  const earned = await claimAchievements(supabase).then(() =>
    readAchievements(supabase),
  );

  const [{ data: bestsData }, doneGoals] = await Promise.all([
    supabase.rpc("personal_bests"),
    readDoneGoals(),
  ]);

  async function readDoneGoals(): Promise<DoneGoalRow[]> {
    const { data, error } = await supabase
      .from("goals")
      .select("id, title, skill, completed_at")
      .eq("user_id", userId!)
      .eq("status", "done")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(50);
    if (!error) return (data as DoneGoalRow[] | null) ?? [];
    // Pre-050 database: the column is not there yet. The archive still
    // renders, just without dates, because "your finished goals disappeared"
    // is not an acceptable failure mode for a schema lag.
    const fallback = await supabase
      .from("goals")
      .select("id, title, skill")
      .eq("user_id", userId!)
      .eq("status", "done")
      .limit(50);
    return (
      (fallback.data as Omit<DoneGoalRow, "completed_at">[] | null) ?? []
    ).map((g) => ({ ...g, completed_at: null }));
  }

  // The high-water mark per skill, whichever environment it landed in. The
  // per-discipline split lives on the Trends charts; this page is the record
  // shelf, and a shelf lists one number per event.
  const bests: Partial<Record<Skill, number>> = {};
  for (const b of (bestsData as BestRow[] | null) ?? []) {
    bests[b.skill] = Math.max(bests[b.skill] ?? 0, b.best);
  }
  const hasBests = SKILLS.some((s) => bests[s] != null);

  return (
    <section className="max-w-4xl">
      <Reveal>
        <div className="border-b border-line pb-5">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-gold">
            Progress
          </p>
          <h1 className="mt-2 font-display text-page-title">The trophy case</h1>
          <p className="mt-2 text-body text-chalk-dim">
            What the work has added up to: badges, personal bests, and the
            goals you actually finished.
          </p>
          <ProgressNav active="milestones" />
        </div>
      </Reveal>

      <Reveal delay={60}>
        <h2 className="mt-8 font-display text-sm font-bold uppercase tracking-wide">
          Badges
        </h2>
        <div className="mt-3">
          <BadgeGrid earned={earned} />
        </div>
      </Reveal>

      <Reveal delay={120}>
        <h2 className="mt-10 font-display text-sm font-bold uppercase tracking-wide">
          Personal bests
        </h2>
        {hasBests ? (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SKILLS.map((skill) => (
              <li key={skill} className="card flex items-center justify-between gap-2 p-4">
                <span className="flex min-w-0 items-center gap-2 font-display text-sm font-bold">
                  <span className="text-chalk-dim">
                    <SkillIcon skill={skill} className="h-4.5 w-4.5" />
                  </span>
                  <span className="truncate">{SKILL_LABEL[skill]}</span>
                </span>
                <span className="font-display text-xl font-bold text-gold">
                  {bests[skill] ?? (
                    <span className="text-chalk-dim">
                      <span className="sr-only">No best yet</span>
                      <span aria-hidden="true">·</span>
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-body text-chalk-dim">
            Bests appear after your first scored rep.{" "}
            <Link href="/analyze" className="text-gold">
              Film one.
            </Link>
          </p>
        )}
      </Reveal>

      <Reveal delay={180}>
        <h2 className="mt-10 font-display text-sm font-bold uppercase tracking-wide">
          Completed goals
        </h2>
        {doneGoals.length === 0 ? (
          <p className="mt-3 text-body text-chalk-dim">
            Nothing finished yet. Goals live on your{" "}
            <Link href="/dashboard#goals" className="text-gold">
              home board
            </Link>
            ; what you complete there is recorded here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {doneGoals.map((g) => (
              <li key={g.id} className="flex items-center gap-3 py-3 text-sm">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 shrink-0 text-teal"
                  aria-hidden
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                <span className="min-w-0 flex-1 truncate text-chalk">{g.title}</span>
                {g.skill && (
                  <span className="rounded bg-navy-light px-1.5 py-0.5 font-mono text-[10px] uppercase text-chalk-dim">
                    {SKILL_LABEL[g.skill]}
                  </span>
                )}
                {g.completed_at && (
                  <span className="font-mono text-xs text-chalk-dim">
                    {new Date(g.completed_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </section>
  );
}
