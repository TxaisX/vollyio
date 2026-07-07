import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ScoreRing } from "@/components/score-ring";
import { Radar } from "@/components/radar";
import { Sparkline } from "@/components/sparkline";
import { SkillIcon } from "@/components/skill-icons";
import { Reveal } from "@/components/motion";
import { SeamArcs } from "@/components/motif";
import { overallScore } from "@/lib/ratings";
import { SKILLS, SKILL_LABEL, type Skill, type Level } from "@/lib/skills";
import {
  getProgress,
  dailyChallenge,
  todayKey,
  XP_AWARDS,
} from "@/lib/progression";
import { completeChallenge } from "./actions";

export const dynamic = "force-dynamic";

type RatingRow = { skill: Skill; rating: number };
type AnalysisRow = { id: string; skill: Skill; overall_score: number; created_at: string };
type GoalRow = {
  id: string;
  title: string;
  skill: Skill | null;
  target_rating: number | null;
};

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: profile },
    { data: ratingsData },
    { data: analysesData },
    { data: goalsData },
    progress,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, level")
      .eq("id", user!.id)
      .single(),
    supabase.from("skill_ratings").select("skill, rating").eq("user_id", user!.id),
    supabase
      .from("analyses")
      .select("id, skill, overall_score, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("goals")
      .select("id, title, skill, target_rating")
      .eq("user_id", user!.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(3),
    getProgress(supabase, user!.id),
  ]);

  const ratings = Object.fromEntries(
    (ratingsData as RatingRow[] | null)?.map((r) => [r.skill, r.rating]) ?? [],
  ) as Partial<Record<Skill, number>>;
  const analyses = (analysesData as AnalysisRow[] | null) ?? [];
  const goals = (goalsData as GoalRow[] | null) ?? [];

  const overall = overallScore(SKILLS.map((s) => ratings[s] ?? null));
  const weekAgo = Date.now() - 7 * 86_400_000;
  const weekCount = analyses.filter(
    (a) => new Date(a.created_at).getTime() > weekAgo,
  ).length;

  const firstName = profile?.display_name?.split(" ")[0];
  const challenge = dailyChallenge(
    user!.id,
    (profile?.level ?? "beginner") as Level,
    todayKey(),
  );

  const seriesFor = (skill: Skill) =>
    analyses
      .filter((a) => a.skill === skill)
      .slice(0, 10)
      .reverse()
      .map((a) => a.overall_score);

  return (
    <section className="max-w-4xl">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
              Dashboard
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
              {firstName ? `Back on the court, ${firstName}.` : "Back on the court."}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-4 w-4 ${progress.streak > 0 ? "text-gold" : "text-chalk-dim"}`}
                aria-hidden
              >
                <path d="M12 3c.5 3-1.5 4.5-2.5 6C8.5 10.5 8 12 8 13.5A4.4 4.4 0 0 0 12.5 18a4.6 4.6 0 0 0 4.5-4.75c0-2.25-1.25-3.5-2-5.25-.5 1-1.5 1.5-1.5 3C12 8.5 12.5 5.5 12 3Z" />
              </svg>
              <span className="font-mono text-xs text-chalk">
                {progress.streak} day{progress.streak === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-2.5 rounded-full border border-line px-3.5 py-1.5">
              <span className="font-mono text-xs text-gold">
                LV {progress.level}
              </span>
              <span
                className="block h-1 w-16 overflow-hidden rounded-full bg-line/60"
                role="progressbar"
                aria-valuenow={progress.into}
                aria-valuemax={progress.span}
                aria-label="XP to next level"
              >
                <span
                  className="block h-full rounded-full bg-gold transition-all duration-700"
                  style={{ width: `${Math.round((progress.into / progress.span) * 100)}%` }}
                />
              </span>
              <span className="font-mono text-[10px] text-chalk-dim">
                {progress.into}/{progress.span}
              </span>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="mt-6 grid gap-4 md:grid-cols-5">
        <Reveal delay={60} className="md:col-span-3">
          <div className="card flex h-full flex-wrap items-center justify-center gap-6 p-6">
            <ScoreRing score={overall} label="Overall" />
            <div className="min-w-0">
              <Radar ratings={ratings} size={220} />
            </div>
          </div>
        </Reveal>

        <div className="flex flex-col gap-4 md:col-span-2">
          <Reveal delay={120}>
            <div className="card card-lift p-5">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold">
                  Daily challenge
                </p>
                <span className="font-mono text-[11px] text-chalk-dim">
                  +{XP_AWARDS.challenge} XP
                </span>
              </div>
              <Link
                href={`/drills/${challenge.slug}`}
                className="mt-2 block font-display text-lg font-bold leading-snug transition-colors hover:text-gold"
              >
                {challenge.name}
              </Link>
              <p className="mt-1 font-mono text-[11px] uppercase text-chalk-dim">
                {SKILL_LABEL[challenge.skill]} · {challenge.duration_min} min
              </p>
              {progress.challengeDone ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-teal">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                    aria-hidden
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  Done for today
                </p>
              ) : (
                <form action={completeChallenge} className="mt-3">
                  <button type="submit" className="btn-primary w-full py-2.5 text-sm">
                    Mark complete
                  </button>
                </form>
              )}
            </div>
          </Reveal>

          <Reveal delay={180}>
            <div className="card card-lift p-5">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold">
                  Goals
                </p>
                <Link
                  href="/goals"
                  className="font-mono text-[11px] text-chalk-dim transition-colors hover:text-chalk"
                >
                  View all
                </Link>
              </div>
              {goals.length === 0 ? (
                <p className="mt-2 text-sm text-chalk-dim">
                  Nothing on the board.{" "}
                  <Link href="/goals" className="text-gold">
                    Set a target.
                  </Link>
                </p>
              ) : (
                <ul className="mt-2 space-y-2.5">
                  {goals.map((g) => {
                    const current = g.skill ? ratings[g.skill] : null;
                    const pct =
                      g.target_rating && current != null
                        ? Math.min(100, Math.round((current / g.target_rating) * 100))
                        : null;
                    return (
                      <li key={g.id}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm text-chalk">{g.title}</span>
                          {pct != null && (
                            <span className="font-mono text-[10px] text-chalk-dim">
                              {Math.round(current!)}/{g.target_rating}
                            </span>
                          )}
                        </div>
                        {pct != null && (
                          <div className="mt-1 h-1 rounded-full bg-line/60">
                            <div
                              className="h-full rounded-full bg-gold"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Reveal>
        </div>
      </div>

      <Reveal delay={140}>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SKILLS.map((skill) => {
            const rating = ratings[skill];
            const series = seriesFor(skill);
            return (
              <Link
                key={skill}
                href={`/history?skill=${skill}`}
                className="card card-lift group p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-display text-sm font-bold">
                    <span className="text-chalk-dim transition-colors group-hover:text-gold">
                      <SkillIcon skill={skill} className="h-4.5 w-4.5" />
                    </span>
                    {SKILL_LABEL[skill]}
                  </span>
                  <span className="font-display text-xl font-bold text-gold">
                    {rating != null ? Math.round(rating) : "—"}
                  </span>
                </div>
                <div className="mt-3">
                  <Sparkline values={series} />
                </div>
              </Link>
            );
          })}
        </div>
      </Reveal>

      <Reveal delay={200}>
        <div className="mt-8 flex items-baseline justify-between">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide">
            Recent
          </h2>
          {analyses.length > 0 && (
            <div className="flex items-center gap-4">
              <span className="font-mono text-[11px] text-chalk-dim">
                {weekCount} this week
              </span>
              <Link
                href="/history"
                className="font-mono text-[11px] text-chalk-dim transition-colors hover:text-chalk"
              >
                View all
              </Link>
            </div>
          )}
        </div>
        {analyses.length === 0 ? (
          <div className="card relative mt-3 overflow-hidden p-8 text-center">
            <SeamArcs className="absolute inset-0 h-full w-full" opacity={0.08} />
            <div className="relative">
              <p className="font-display text-lg font-bold">
                No film yet.
              </p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-chalk-dim">
                Your rating starts with one rep. Forty-five seconds, any skill.
              </p>
              <Link href="/analyze" className="btn-primary mt-5 inline-flex text-sm">
                Film your first rep
              </Link>
            </div>
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {analyses.slice(0, 8).map((a) => (
              <li key={a.id}>
                <Link
                  href={`/analysis/${a.id}`}
                  className="group flex items-center gap-4 py-3 text-sm"
                >
                  <span className="font-mono text-xs text-chalk-dim">
                    {new Date(a.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="flex flex-1 items-center gap-2 font-display">
                    <span className="text-chalk-dim">
                      <SkillIcon skill={a.skill} className="h-4 w-4" />
                    </span>
                    {SKILL_LABEL[a.skill]}
                  </span>
                  <span className="font-display font-bold text-gold">
                    {a.overall_score}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 text-chalk-dim transition-transform group-hover:translate-x-0.5 group-hover:text-chalk"
                    aria-hidden
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </section>
  );
}
