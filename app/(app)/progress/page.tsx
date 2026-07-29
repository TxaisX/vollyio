import type { Metadata } from "next";
import { ViewTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { Reveal } from "@/components/motion";
import { ProgressChart } from "@/components/progress-chart";
import { buildSeries, type ProgressRep } from "@/lib/progress-series";
import type { Skill } from "@/lib/skills";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Progress",
  description:
    "Every skill you have filmed, scored over time, against the target you set.",
};

type GoalRow = { skill: Skill | null; target_rating: number | null };

export default async function Progress() {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);

  // Ascending, because the series are read oldest-first and sorting once in SQL
  // beats re-sorting per group. The 400 cap is generous against the real usage
  // curve and keeps one heavy account from making this page unbounded.
  const [{ data: repData, error: repError }, { data: goalData, error: goalError }] =
    await Promise.all([
      supabase
        .from("analyses")
        .select("skill, discipline, overall_score, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: true })
        .limit(400),
      supabase
        .from("goals")
        .select("skill, target_rating")
        .eq("user_id", userId!)
        .eq("status", "active"),
    ]);

  const failure = repError ?? goalError;
  if (failure) throw failure;

  const series = buildSeries((repData as ProgressRep[] | null) ?? []);

  // One target per skill. A player with two active goals on one skill gets the
  // higher line, because the lower one is already the easier of the two.
  const targets = new Map<string, number>();
  for (const g of (goalData as GoalRow[] | null) ?? []) {
    if (!g.skill || typeof g.target_rating !== "number") continue;
    const prev = targets.get(g.skill);
    if (prev === undefined || g.target_rating > prev) targets.set(g.skill, g.target_rating);
  }

  const totalReps = series.reduce((n, s) => n + s.reps, 0);

  return (
    <ViewTransition enter="vt-reveal-in" default="none">
      <section className="max-w-4xl">
        <Reveal>
          <div className="border-b border-line pb-5">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-gold">
              Progress
            </p>
            <h1 className="mt-2 font-display text-page-title">Are you getting better?</h1>
            <p className="mt-2 text-body text-chalk-dim">
              Every skill you have filmed, scored over time. The line only claims a
              direction once there are enough reps across enough days to mean one.
            </p>
          </div>
        </Reveal>

        {series.length === 0 ? (
          <Reveal delay={60}>
            <div className="card mt-8 p-6 text-center">
              <p className="text-body text-chalk-dim">
                Nothing to chart yet. Film one rep and this fills in.
              </p>
              <Link href="/analyze" className="btn-primary mt-4 inline-flex text-sm">
                Analyze a rep
              </Link>
            </div>
          </Reveal>
        ) : (
          <>
            <Reveal delay={60}>
              <p className="mt-6 font-mono text-xs uppercase tracking-wide text-chalk-dim">
                {totalReps} rep{totalReps === 1 ? "" : "s"} across {series.length}{" "}
                skill{series.length === 1 ? "" : "s"}
              </p>
            </Reveal>
            <div className="mt-4 space-y-5">
              {series.map((s, i) => (
                <Reveal key={`${s.skill}-${s.discipline}`} delay={80 + i * 60}>
                  <ProgressChart series={s} target={targets.get(s.skill) ?? null} />
                </Reveal>
              ))}
            </div>
            <Reveal delay={140}>
              <p className="mt-6 text-body text-chalk-dim">
                Want a line to aim at? Set a target in{" "}
                <Link
                  href="/goals"
                  className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold"
                >
                  Goals
                </Link>
                {targets.size > 0 ? " and it shows up on the chart." : "."}
              </p>
            </Reveal>
          </>
        )}
      </section>
    </ViewTransition>
  );
}
