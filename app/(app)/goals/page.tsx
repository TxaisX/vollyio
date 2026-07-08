import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SKILL_LABEL, type Skill } from "@/lib/skills";
import {
  ActiveGoalCard,
  GoalsEmptyState,
  NewGoal,
  type Goal,
} from "@/components/goals";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Goals",
  description: "Aim each training block at one number instead of vague reps.",
};

type DoneRow = { id: string; skill: Skill | null; title: string };
type RatingRow = { skill: Skill; rating: number };

export default async function Goals() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: activeData, error: activeError },
    { data: doneData, error: doneError },
    { data: ratingsData, error: ratingsError },
  ] = await Promise.all([
      supabase
        .from("goals")
        .select("id, skill, title, target_rating, deadline")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      supabase
        .from("goals")
        .select("id, skill, title")
        .eq("user_id", user!.id)
        .eq("status", "done")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("skill_ratings")
        .select("skill, rating")
        .eq("user_id", user!.id),
    ]);

  const fetchError = activeError ?? doneError ?? ratingsError;
  if (fetchError) throw fetchError;

  const active = (activeData as Goal[] | null) ?? [];
  const done = (doneData as DoneRow[] | null) ?? [];
  const ratings = Object.fromEntries(
    (ratingsData as RatingRow[] | null)?.map((r) => [r.skill, r.rating]) ?? [],
  ) as Partial<Record<Skill, number>>;

  return (
    <section className="max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-gold">
        Goals
      </p>
      <h1 className="mt-2 font-display text-2xl font-bold">Set the target</h1>
      <p className="mt-2 text-sm text-chalk-dim">
        Aim each training block at one number instead of vague reps.
      </p>

      {active.length === 0 && done.length === 0 ? (
        <div className="mt-10">
          <GoalsEmptyState />
        </div>
      ) : (
        <>
          <div className="mt-8">
            <NewGoal />
          </div>

          {active.length > 0 && (
            <div className="mt-6 space-y-4">
              {active.map((goal, i) => (
                <ActiveGoalCard
                  key={goal.id}
                  goal={goal}
                  rating={goal.skill ? (ratings[goal.skill] ?? null) : null}
                  delay={i * 60}
                />
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="mt-10">
              <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-chalk-dim">
                Completed
              </h2>
              <ul className="mt-2 divide-y divide-line">
                {done.map((goal) => (
                  <li key={goal.id} className="flex items-center gap-3 py-3">
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 shrink-0 text-teal"
                      aria-hidden="true"
                    >
                      <path d="M3 8.5l3.5 3.5L13 5" />
                    </svg>
                    <span className="flex-1 text-sm text-chalk-dim">
                      {goal.title}
                    </span>
                    {goal.skill && (
                      <span className="font-mono text-[10px] uppercase text-chalk-dim">
                        {SKILL_LABEL[goal.skill]}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
