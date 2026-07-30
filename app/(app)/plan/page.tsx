import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { Reveal } from "@/components/motion";
import { SeamArcs } from "@/components/motif";
import { LinkPending } from "@/components/link-pending";
import { PlanGenerate } from "@/components/plan-generate";
import { todayKey } from "@/lib/progression";
import {
  PLAN_DAYS,
  planDayIndex,
  planIsCurrent,
  weekStartKey,
  type StoredPlan,
  type WeeklyPlan,
} from "@/lib/weekly-plan";
import { drillBySlug } from "@/content/drills";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "This week",
  description: "Your training week, built from your own ratings and your last breakdown.",
  robots: { index: false, follow: false },
};

export default async function PlanPage() {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);

  const today = todayKey();
  const weekStart = weekStartKey(today);

  const { data } = await supabase
    .from("weekly_plans")
    .select("week_start, plan, generated_at")
    .eq("user_id", userId!)
    .eq("week_start", weekStart)
    .maybeSingle();

  const stored = (data as StoredPlan | null) ?? null;
  // A reserved-but-unfilled row has a null plan: a generation is in flight or
  // it failed. Treat it as "nothing yet" rather than rendering an empty week.
  const plan: WeeklyPlan | null =
    stored && stored.plan && planIsCurrent(stored, today) ? stored.plan : null;
  const todayIndex = planDayIndex(today);

  const weekLabel = new Date(`${weekStart}T12:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });

  return (
    <section className="max-w-4xl">
      <Reveal>
        <div className="border-b border-line pb-5">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
            Week of {weekLabel}
          </p>
          <h1 className="mt-2 font-display text-page-title">This week</h1>
          {plan ? (
            <>
              <p className="mt-3 max-w-prose font-display text-lg font-bold leading-snug">
                {plan.headline}
              </p>
              <p className="mt-2 max-w-prose text-body leading-relaxed text-chalk-dim">
                {plan.why}
              </p>
            </>
          ) : (
            <p className="mt-3 max-w-prose text-body leading-relaxed text-chalk-dim">
              Seven days built from your ratings and the checkpoint your last
              breakdown named. Built once a week, so it stays put while you
              follow it.
            </p>
          )}
        </div>
      </Reveal>

      {plan ? (
        <ol className="mt-6 space-y-3">
          {PLAN_DAYS.map((label, i) => {
            const day = plan.days.find((d) => d.day === label);
            if (!day) return null;
            const drill = day.drill_slug ? drillBySlug(day.drill_slug) : undefined;
            const isToday = i === todayIndex;
            const isPast = i < todayIndex;
            return (
              <Reveal key={label} delay={60 + i * 30}>
                <li
                  className={`card p-5 ${isToday ? "border-gold shadow-lift" : ""} ${
                    isPast ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold">
                      {label}
                      {isToday && <span className="ml-2 text-chalk">Today</span>}
                    </p>
                    <p className="font-mono text-[11px] uppercase text-chalk-dim">
                      {day.focus} · {day.minutes} min
                    </p>
                  </div>
                  <p className="mt-2 text-body leading-relaxed text-chalk">
                    {day.detail}
                  </p>
                  {drill && (
                    <Link
                      href={`/drills/${drill.slug}`}
                      transitionTypes={["nav-forward"]}
                      className="relative mt-3 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-gold transition-colors hover:text-chalk"
                    >
                      {drill.name}
                      <LinkPending />
                    </Link>
                  )}
                </li>
              </Reveal>
            );
          })}
        </ol>
      ) : (
        <Reveal delay={60}>
          <div className="card relative mt-6 overflow-hidden p-8 text-center">
            <SeamArcs className="absolute inset-0 h-full w-full" opacity={0.08} />
            <div className="relative">
              <p className="font-display text-lg font-bold">No plan for this week yet.</p>
              <p className="mx-auto mt-1 max-w-sm text-body text-chalk-dim">
                It takes about a minute to build, and it is yours for the whole
                week.
              </p>
              <div className="mt-5 flex justify-center">
                <PlanGenerate label="Build this week's plan" />
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {plan && (
        <Reveal delay={340}>
          <p className="mt-6 text-xs text-chalk-dim">
            Built once for the week of {weekLabel}. A new one is available next
            Monday. This is training guidance, not medical or nutritional
            advice: if something hurts, stop, and talk to a coach or a doctor.
          </p>
        </Reveal>
      )}
    </section>
  );
}
