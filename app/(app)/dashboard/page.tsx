import type { Metadata } from "next";
import { ViewTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { LinkPending } from "@/components/link-pending";
import { ScoreRing } from "@/components/score-ring";
import { Radar } from "@/components/radar";
import { Sparkline } from "@/components/sparkline";
import { SkillIcon } from "@/components/skill-icons";
import { Reveal } from "@/components/motion";
import { SeamArcs } from "@/components/motif";
import { LimitNotice } from "@/components/limit-notice";
import { overallScore } from "@/lib/ratings";
import { shouldEnforceFreeTier, UPGRADE_URL } from "@/lib/billing";
import {
  allowanceLine,
  allowanceTone,
  readAllowance,
  resetDate,
} from "@/lib/allowance";
import {
  SKILLS,
  SKILL_LABEL,
  ANALYZE_DISCIPLINES,
  GROUP_DISCIPLINES,
  disciplineGroup,
  DISCIPLINE_LABEL,
  isDiscipline,
  type Skill,
  type Level,
  type Discipline,
} from "@/lib/skills";
import {
  getProgress,
  dailyChallenge,
  todayKey,
  XP_AWARDS,
  type Progress,
} from "@/lib/progression";
import { completeChallenge } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your rolling skill rating, daily challenge, goals, and recent breakdowns.",
};

type RatingRow = { skill: Skill; rating: number };
type AnalysisRow = {
  id: string;
  skill: Skill;
  overall_score: number;
  created_at: string;
  fix: string | null;
};
type GoalRow = {
  id: string;
  title: string;
  skill: Skill | null;
  target_rating: number | null;
};

type Challenge = ReturnType<typeof dailyChallenge>;

// The focus, challenge and goals cards render twice: beside the score stage
// below xl, in the right rail at xl. One implementation, two responsive slots.
function ChallengeCard({
  challenge,
  challengeDone,
}: {
  challenge: Challenge;
  challengeDone: boolean;
}) {
  return (
    <div className="challenge-card card card-lift spot p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold">
          Daily challenge
        </h2>
        <span className="font-mono text-[11px] text-chalk-dim">
          +{XP_AWARDS.challenge} XP
        </span>
      </div>
      <Link
        href={`/drills/${challenge.slug}`}
        transitionTypes={["nav-forward"]}
        className="relative mt-2 block font-display text-lg font-bold leading-snug transition-colors hover:text-gold"
      >
        {challenge.name}
        <LinkPending />
      </Link>
      <p className="mt-1 font-mono text-[11px] uppercase text-chalk-dim">
        {SKILL_LABEL[challenge.skill]} · {challenge.duration_min} min
      </p>
      {challengeDone ? (
        <p className="reward-earned mt-3 flex items-center gap-2 text-sm text-teal">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="reward-check h-4 w-4"
            aria-hidden
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          Done for today
        </p>
      ) : (
        <form action={completeChallenge} className="mt-3">
          {/* Ghost, not primary: the page's one gold button starts a rep, and
              two of them above the fold made filming and ticking a drill off
              read as the same size of decision. */}
          <button type="submit" className="btn-ghost w-full min-h-11 py-2.5 text-sm">
            Mark complete
          </button>
        </form>
      )}
    </div>
  );
}

function GoalsCard({
  goals,
  ratings,
}: {
  goals: GoalRow[];
  ratings: Partial<Record<Skill, number>>;
}) {
  return (
    <div className="card card-lift p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold">
          Goals
        </h2>
        {/* The padding buys a 44px tap target and the matching negative margin
            gives it back to the layout, so an 11px label is still reachable
            with a thumb without the card growing a fat header row. */}
        <Link
          href="/goals"
          className="-my-4 py-4 font-mono text-[11px] text-chalk-dim transition-colors hover:text-chalk"
        >
          View all
        </Link>
      </div>
      {goals.length === 0 ? (
        <p className="mt-2 text-body text-chalk-dim">
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
  );
}

// xl only: the heading pills collapse into this rail card so the wide layout
// reads as one column of play state instead of a crowded header.
function ThisWeekCard({
  progress,
  weekCount,
}: {
  progress: Progress;
  weekCount: number;
}) {
  return (
    <div className="card p-5">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold">
        This week
      </h2>
      <dl className="mt-2 space-y-2 text-sm">
        <div className="flex items-baseline justify-between">
          <dt className="text-chalk-dim">Reps analyzed</dt>
          <dd className="font-display font-bold text-chalk">{weekCount}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-chalk-dim">Streak</dt>
          <dd className="font-display font-bold text-chalk">
            {progress.streak} day{progress.streak === 1 ? "" : "s"}
          </dd>
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <dt className="text-chalk-dim">Level {progress.level}</dt>
            <dd className="font-mono text-[10px] text-chalk-dim">
              {progress.into}/{progress.span} XP
            </dd>
          </div>
          {/* aria-valuetext, because a bare progressbar is announced as a
              percentage and "50 percent" is not what the number beside it
              says. */}
          <div
            className="mt-1.5 h-1 overflow-hidden rounded-full bg-line/60"
            role="progressbar"
            aria-valuenow={progress.into}
            aria-valuemin={0}
            aria-valuemax={progress.span}
            aria-valuetext={`${progress.into} of ${progress.span} XP`}
            aria-label="XP to next level"
          >
            <div
              className="h-full rounded-full bg-gold"
              style={{ width: `${Math.round((progress.into / progress.span) * 100)}%` }}
            />
          </div>
        </div>
      </dl>
    </div>
  );
}

function FocusNowCard({ analysis }: { analysis: AnalysisRow }) {
  return (
    <div className="card card-lift p-5">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold">
        Focus now
      </h2>
      <Link
        href={`/analysis/${analysis.id}`}
        className="relative mt-2 block text-sm leading-snug text-chalk transition-colors hover:text-gold"
      >
        {analysis.fix}
        <LinkPending />
      </Link>
      <p className="mt-1 font-mono text-[11px] uppercase text-chalk-dim">
        {SKILL_LABEL[analysis.skill]} · from your latest rep
      </p>
    </div>
  );
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ discipline?: string }>;
}) {
  const supabase = await createClient();
  const { discipline: rawDiscipline } = await searchParams;
  const discipline: Discipline = isDiscipline(rawDiscipline ?? "")
    ? (rawDiscipline as Discipline)
    : "indoor";
  const userId = await getAuthUserId(supabase);

  const [
    { data: profile, error: profileError },
    { data: ratingsData, error: ratingsError },
    { data: analysesData, error: analysesError },
    { data: goalsData, error: goalsError },
    progress,
    allowance,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, level")
      .eq("id", userId!)
      .single(),
    supabase
      .from("skill_ratings")
      .select("skill, rating")
      .eq("user_id", userId!)
      .in("discipline", [...GROUP_DISCIPLINES[disciplineGroup(discipline)]]),
    supabase
      .from("analyses")
      // fix: the priority-fix title lifted straight from the stored result JSON
      // (D-044), so the skill card can show a one-line fix history without
      // pulling every full result blob.
      .select("id, skill, overall_score, created_at, fix:result->priority_fix->>title")
      .eq("user_id", userId!)
      .in("discipline", [...GROUP_DISCIPLINES[disciplineGroup(discipline)]])
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("goals")
      .select("id, title, skill, target_rating")
      .eq("user_id", userId!)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(3),
    getProgress(supabase, userId!),
    // Only ask when the cap is actually enforced, so the counter cannot appear
    // in a build where nothing is metered. In the same round trip as the rest:
    // this is one line of text and must not add latency to the dashboard.
    shouldEnforceFreeTier() ? readAllowance(supabase) : null,
  ]);

  const fetchError =
    profileError ?? ratingsError ?? analysesError ?? goalsError;
  if (fetchError) throw fetchError;

  const ratings = Object.fromEntries(
    (ratingsData as RatingRow[] | null)?.map((r) => [r.skill, r.rating]) ?? [],
  ) as Partial<Record<Skill, number>>;
  const analyses = (analysesData as AnalysisRow[] | null) ?? [];
  const goals = (goalsData as GoalRow[] | null) ?? [];

  // Latest priority fix per skill for the card's one-line fix history (D-044).
  // analyses is ordered newest-first, so the first hit per skill is the latest.
  const latestFix: Partial<Record<Skill, string>> = {};
  for (const a of analyses) {
    if (a.fix && !(a.skill in latestFix)) latestFix[a.skill] = a.fix;
  }
  const newestFix = analyses.find((a) => a.fix) ?? null;

  // A spent month replaces the invitation rather than sitting under it: the
  // notice below carries the only action left, and a gold "Film a rep" above it
  // would be a button whose whole job is to walk the player into a 402.
  const spent = allowance != null && allowanceTone(allowance) === "out";

  const overall = overallScore(SKILLS.map((s) => ratings[s] ?? null));
  const weekAgo = Date.now() - 7 * 86_400_000;
  const weekCount = analyses.filter(
    (a) => new Date(a.created_at).getTime() > weekAgo,
  ).length;

  const firstName = profile?.display_name?.split(" ")[0];
  const challenge = dailyChallenge(
    userId!,
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
    <section className="max-w-7xl">
      <Reveal>
        <div className="dashboard-heading relative flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
              Dashboard
            </p>
            <h1 className="mt-2 font-display text-page-title">
              {firstName ? `Back on the court, ${firstName}.` : "Back on the court."}
            </h1>
            <div className="mt-3 flex items-center gap-2">
              {ANALYZE_DISCIPLINES.map((d) => (
                <Link
                  key={d}
                  href={d === "indoor" ? "/dashboard" : `/dashboard?discipline=${d}`}
                  aria-current={discipline === d ? "page" : undefined}
                  className={`chip min-h-11 ${discipline === d ? "chip-active" : ""}`}
                >
                  {DISCIPLINE_LABEL[d]}
                </Link>
              ))}
            </div>
            {/* Before the drive to /analyze, not after the upload. A player who
                films, marks and waits only to meet a paywall has done 90
                seconds of work for nothing (docs/billing.md 4.6). Quiet while
                there is room; the last one is called out in gold, and once they
                are out the offer below takes over from the line entirely. */}
            {allowance && allowanceTone(allowance) !== "out" && (
              <p
                className={`mt-3 font-mono text-[11px] ${
                  allowanceTone(allowance) === "last"
                    ? "text-gold"
                    : "text-chalk-dim"
                }`}
              >
                {allowanceLine(allowance)}
              </p>
            )}
          </div>
          {/* The dashboard has to answer "what do I do next" before anything is
              scrolled, and the answer is always another rep. Without this the
              only route to /analyze from here was the nav. */}
          <div className="flex flex-wrap items-center gap-3">
            {!spent && (
              <Link href="/analyze" className="btn-primary text-sm">
                Film a rep
              </Link>
            )}
            <div className="flex items-center gap-3 xl:hidden">
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
                {/* The flame is decorative, so the word has to be in the text
                    or this pill reads as a bare "3 days" with no subject. */}
                <span className="font-mono text-xs text-chalk">
                  <span className="sr-only">Streak: </span>
                  {progress.streak} day{progress.streak === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center gap-2.5 rounded-full border border-line px-3.5 py-1.5">
                <span className="font-mono text-xs text-gold">
                  <span className="sr-only">Level </span>
                  <span aria-hidden="true">LV</span> {progress.level}
                </span>
                <span
                  className="block h-1 w-16 overflow-hidden rounded-full bg-line/60"
                  role="progressbar"
                  aria-valuenow={progress.into}
                  aria-valuemin={0}
                  aria-valuemax={progress.span}
                  aria-valuetext={`${progress.into} of ${progress.span} XP`}
                  aria-label="XP to next level"
                >
                  <span
                    className="block h-full rounded-full bg-gold transition-all duration-700"
                    style={{ width: `${Math.round((progress.into / progress.span) * 100)}%` }}
                  />
                </span>
                {/* The bar above already announces the same two numbers. */}
                <span aria-hidden="true" className="font-mono text-[10px] text-chalk-dim">
                  {progress.into}/{progress.span}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Out of analyses: the same offer the 402 shows, in the place a player
          lands before they walk to /analyze and find out the hard way. Above
          the fold and above the rest of the dashboard, because it is the only
          thing on this page they can act on. */}
      {allowance && allowanceTone(allowance) === "out" && (
        <Reveal delay={40} className="mt-6">
          <LimitNotice
            className="max-w-xl"
            plan={allowance.plan}
            allowance={allowance.allowance}
            resetsOn={resetDate(allowance)}
            canBuy={UPGRADE_URL !== null}
          />
        </Reveal>
      )}

      <div className="mt-6 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-6">
        <div className="min-w-0">
          <div className="grid gap-4 md:grid-cols-5 xl:block">
            <Reveal delay={60} className="md:col-span-3">
              <div className="score-stage card spot flex h-full flex-wrap items-center justify-center gap-6 p-6">
                <ScoreRing score={overall} size={150} label="Overall" />
                <div className="min-w-0">
                  <Radar ratings={ratings} size={196} />
                </div>
              </div>
            </Reveal>

            <div className="flex flex-col gap-4 md:col-span-2 xl:hidden">
              {/* The priority fix from the last rep is the most actionable
                  thing on the page, and it used to be visible only at xl,
                  which is the width this product is least often used at. */}
              {newestFix && (
                <Reveal delay={120}>
                  <FocusNowCard analysis={newestFix} />
                </Reveal>
              )}
              <Reveal delay={180}>
                <ChallengeCard
                  challenge={challenge}
                  challengeDone={progress.challengeDone}
                />
              </Reveal>
              <Reveal delay={240}>
                <GoalsCard goals={goals} ratings={ratings} />
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
                    className="skill-momentum-card card card-lift group p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-display text-sm font-bold">
                        <span className="text-chalk-dim transition-colors group-hover:text-gold">
                          <SkillIcon skill={skill} className="h-4.5 w-4.5" />
                        </span>
                        {SKILL_LABEL[skill]}
                      </span>
                      <span className="font-display text-xl font-bold text-gold">
                        {rating != null ? (
                          Math.round(rating)
                        ) : (
                          <span className="text-chalk-dim">
                            <span className="sr-only">Not rated yet</span>
                            <span aria-hidden="true">·</span>
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="mt-3">
                      <Sparkline values={series} skill={skill} />
                    </div>
                    {latestFix[skill] && (
                      <p className="mt-2.5 truncate font-mono text-[10px] text-chalk-dim">
                        <span className="text-gold">Focus:</span> {latestFix[skill]}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="mt-8 flex items-baseline justify-between gap-4">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide">
                Recent
              </h2>
              {analyses.length > 0 && (
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[11px] text-chalk-dim">
                    {weekCount} this week
                  </span>
                  {/* Padded for a 44px tap target, negative-margined so the
                      row keeps the height it reads best at. */}
                  <Link
                    href="/history"
                    className="-my-4 py-4 font-mono text-[11px] text-chalk-dim transition-colors hover:text-chalk"
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
                  <p className="mx-auto mt-1 max-w-xs text-body text-chalk-dim">
                    Your rating starts with one rep. Ten seconds, any skill.
                  </p>
                  {/* The gold button on this page lives in the heading, where
                      it is above the fold on a phone; this repeats the same
                      action for anyone who read their way down to it. */}
                  <Link href="/analyze" className="btn-ghost mt-5 inline-flex text-sm">
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
                      {/* Morph source: this score travels into the breakdown's
                          score ring when the row is opened (matches the row on
                          /history). share="morph" + default="none" keeps it inert
                          on every other transition. */}
                      <ViewTransition
                        name={`rep-${a.id}`}
                        share="morph"
                        default="none"
                      >
                        <span className="font-display font-bold text-gold">
                          {a.overall_score}
                        </span>
                      </ViewTransition>
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
        </div>

        <aside className="hidden xl:flex xl:flex-col xl:gap-4">
          {/* Same order as the stacked layout above: the fix to work on leads,
              the standing state of play follows it. */}
          {newestFix && (
            <Reveal delay={120}>
              <FocusNowCard analysis={newestFix} />
            </Reveal>
          )}
          <Reveal delay={180}>
            <ChallengeCard
              challenge={challenge}
              challengeDone={progress.challengeDone}
            />
          </Reveal>
          <Reveal delay={240}>
            <GoalsCard goals={goals} ratings={ratings} />
          </Reveal>
          <Reveal delay={300}>
            <ThisWeekCard progress={progress} weekCount={weekCount} />
          </Reveal>
        </aside>
      </div>
    </section>
  );
}
