import type { Metadata } from "next";
import { ViewTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { Reveal } from "@/components/motion";
import { ProgressNav } from "@/components/section-nav";
import { ProgressChart } from "@/components/progress-chart";
import { SkillIcon } from "@/components/skill-icons";
import {
  buildSeries,
  isChartable,
  type ProgressSeries,
  type ProgressRep,
} from "@/lib/progress-series";
import { relativeDay } from "@/lib/relative-day";
import { SKILL_LABEL, type Skill } from "@/lib/skills";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Progress",
  description:
    "Every skill you have filmed, scored over time, against the target you set.",
};

type GoalRow = { skill: Skill | null; target_rating: number | null };

/**
 * A series with one rep, as a row (D-117).
 *
 * This was a `.card` holding a 120px box with a border around one line of
 * text: "62 on Aug 10". One number and one label inside 120px of framed
 * emptiness, which is the dashboard's own failure repeated once per skill, and
 * on this page it is the COMMON case rather than the edge case - the corpus is
 * three to six reps over about a week, so most skills land here.
 *
 * Both facts the box carried survive: the score and when it was filmed.
 */
function SparseRow({ series }: { series: ProgressSeries }) {
  const label = SKILL_LABEL[series.skill as Skill] ?? series.skill;
  const point = series.points[0];
  return (
    <li>
      <Link
        href={`/history?skill=${series.skill}`}
        className="group flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-navy-lighter/45 sm:px-4"
      >
        <span className="row-tile">
          <SkillIcon skill={series.skill as Skill} className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate font-display text-sm font-bold">{label}</span>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
              {series.discipline}
            </span>
          </span>
          <span className="mt-0.5 block font-mono text-[10px] text-chalk-dim">
            {point ? relativeDay(new Date(point.at).toISOString()) : "--"} · one rep
            so far
          </span>
        </span>
        <span className="stat-num shrink-0 text-lg text-gold">
          {point?.score ?? "--"}
        </span>
      </Link>
    </li>
  );
}

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

  // Split rather than sort: a chart and a one-rep row are different shapes, and
  // interleaving them makes a stack that cannot be scanned down. buildSeries
  // already orders most-reps-first, so this preserves that order within each
  // half and the charted skills stay above the sparse ones either way.
  const charted = series.filter(isChartable);
  const sparse = series.filter((s) => !isChartable(s));

  return (
    <ViewTransition enter="vt-reveal-in" default="none">
      <section className="max-w-4xl">
        {/* THE OPENING BAND (D-117). Kicker, question, the two counts as chips
            and the hub strip on one block, the same shape the dashboard opens
            with. The counts were a bare mono line floating between the header
            and the first chart; they are what the band spec calls inline stat
            chips, and they belong beside the question they answer. */}
        <Reveal>
          <div className="hero-band card spot p-5 sm:p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
              Progress
            </p>
            <h1 className="mt-1.5 font-display text-page-title">
              Are you getting better?
            </h1>
            <p className="mt-2 max-w-prose text-body text-chalk-dim">
              Every skill you have filmed, scored over time. The line only claims a
              direction once there are enough reps across enough days to mean one.
            </p>
            {series.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="tag">
                  <span className="text-chalk">{totalReps}</span> rep
                  {totalReps === 1 ? "" : "s"}
                </span>
                <span className="tag">
                  <span className="text-chalk">{series.length}</span> skill
                  {series.length === 1 ? "" : "s"}
                </span>
              </div>
            )}
            <div className="mt-4 border-t border-line pt-3.5">
              <ProgressNav active="trends" />
            </div>
          </div>
        </Reveal>

        {series.length === 0 ? (
          <Reveal delay={60}>
            <div className="card mt-4 p-6 text-center">
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
            {/* THE CHART STAYS, and this is the one place in this pass where
                the dashboard's verdict does not carry over. A tall chart above
                the fold was wrong on Home because nobody had asked its
                question; here it IS the question, asked by a player who
                navigated to Trends to ask it. buildSeries already sorts
                most-reps-first, so the chart that opens the page is the skill
                they have worked hardest rather than whichever one sorted
                alphabetically. */}
            {charted.length > 0 && (
              <>
                <Reveal delay={60}>
                  <h2 className="section-head mt-6">Trends</h2>
                </Reveal>
                <div className="mt-3 space-y-4">
                  {charted.map((s, i) => (
                    <Reveal key={`${s.skill}-${s.discipline}`} delay={80 + i * 60}>
                      <ProgressChart series={s} target={targets.get(s.skill) ?? null} />
                    </Reveal>
                  ))}
                </div>
              </>
            )}

            {sparse.length > 0 && (
              <Reveal delay={100}>
                <h2 className="section-head section-head-teal mt-6">
                  Not enough yet
                </h2>
                <div className="card mt-3 overflow-hidden">
                  <ul className="divide-y divide-line">
                    {sparse.map((s) => (
                      <SparseRow key={`${s.skill}-${s.discipline}`} series={s} />
                    ))}
                  </ul>
                  <p className="border-t border-line px-4 py-3 font-mono text-[11px] text-chalk-dim">
                    One rep is a dot, not a line. Film another on any of these and
                    it moves up.
                  </p>
                </div>
              </Reveal>
            )}

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
