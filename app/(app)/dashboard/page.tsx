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
import { GoalsBoard, type Goal } from "@/components/goals";
import { BadgeShelf } from "@/components/achievements";
import { claimAchievements, readAchievements } from "@/lib/achievements";
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
import { getProgress, todayKey, XP_AWARDS, type Progress } from "@/lib/progression";
import { assignmentFor, type WeakPoint } from "@/lib/daily-assignment";
import { DailyAssignmentCard } from "@/components/daily-assignment-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your rolling skill rating, daily challenge, goals, and recent breakdowns.",
};

type RatingRow = { skill: Skill; rating: number };
type BestRow = { skill: Skill; discipline: string; best: number };
type AnalysisRow = {
  id: string;
  skill: Skill;
  discipline: Discipline;
  overall_score: number;
  created_at: string;
  fix: string | null;
  metric: string | null;
};
// The goals board itself is components/goals.tsx (GoalsBoard): create,
// complete and abandon all happen here on the dashboard now (D-088), so the
// old read-only three-goal card is gone with the /goals page it linked to.

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
  const userId = await getAuthUserId(supabase);

  // The profile leads the waterfall because the view depends on it: with no
  // ?discipline in the URL the page opens on the player's own environment
  // rather than flipping a beach player to indoor on every visit. The chips
  // below always write the parameter explicitly, so a choice still overrides.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, level, discipline")
    .eq("id", userId!)
    .single();
  if (profileError) throw profileError;

  const profileDefault: Discipline = isDiscipline(profile?.discipline ?? "")
    ? (profile!.discipline as Discipline)
    : "indoor";
  const discipline: Discipline = isDiscipline(rawDiscipline ?? "")
    ? (rawDiscipline as Discipline)
    : profileDefault;

  const [
    { data: ratingsData, error: ratingsError },
    { data: analysesData, error: analysesError },
    { data: goalsData, error: goalsError },
    { count: doneCountData },
    { data: bestsData },
    earnedAchievements,
    progress,
    allowance,
  ] = await Promise.all([
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
      //
      // metric: the checkpoint that fix targets, which is what today's
      // assignment is chosen against. Read from changes[0], NOT from
      // priority_fix.target_metric -- that field is null on every stored row,
      // so selecting it would silently target nothing forever.
      .select(
        "id, skill, discipline, overall_score, created_at, fix:result->priority_fix->>title, metric:result->changes->0->>target_metric",
      )
      .eq("user_id", userId!)
      .in("discipline", [...GROUP_DISCIPLINES[disciplineGroup(discipline)]])
      .order("created_at", { ascending: false })
      .limit(40),
    // Every active goal, newest first. The board owns the folding (it shows
    // four and says how many more), so nothing is silently dropped the way
    // the old limit(3) card dropped a fourth goal. The 50 cap is a guard
    // against a pathological account, not a display rule.
    supabase
      .from("goals")
      .select("id, title, skill, target_rating, deadline")
      .eq("user_id", userId!)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("goals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId!)
      .eq("status", "done"),
    // All-time high-water marks (D-079, migration 043): MAX over the caller's
    // own analyses, derived on read so it can never drift from the reps. Not
    // in fetchError below on purpose: a failed read renders no "best" line
    // rather than failing the dashboard, the same posture as the allowance.
    supabase.rpc("personal_bests"),
    // Quiet catch-up, then read: anything earned away from a celebration
    // moment (an old account's back catalog, a streak that crossed seven
    // overnight) lands on the shelf without a toast. Both calls fail soft, so
    // a database without migration 050 renders no shelf and nothing else
    // changes (D-089).
    claimAchievements(supabase).then(() => readAchievements(supabase)),
    getProgress(supabase, userId!),
    // Only ask when the cap is actually enforced, so the counter cannot appear
    // in a build where nothing is metered. In the same round trip as the rest:
    // this is one line of text and must not add latency to the dashboard.
    shouldEnforceFreeTier() ? readAllowance(supabase) : null,
  ]);

  const fetchError = ratingsError ?? analysesError ?? goalsError;
  if (fetchError) throw fetchError;

  const ratings = Object.fromEntries(
    (ratingsData as RatingRow[] | null)?.map((r) => [r.skill, r.rating]) ?? [],
  ) as Partial<Record<Skill, number>>;
  const analyses = (analysesData as AnalysisRow[] | null) ?? [];
  const goals = (goalsData as Goal[] | null) ?? [];
  const goalsDone = doneCountData ?? 0;

  // Per-skill personal best within the discipline group being shown, so the
  // best sits on the same axis as the rating beside it.
  const groupSet = new Set<string>(GROUP_DISCIPLINES[disciplineGroup(discipline)]);
  const bests: Partial<Record<Skill, number>> = {};
  for (const b of (bestsData as BestRow[] | null) ?? []) {
    if (!groupSet.has(b.discipline)) continue;
    bests[b.skill] = Math.max(bests[b.skill] ?? 0, b.best);
  }

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

  // Today's work, chosen against the player's own state rather than hashed out
  // of the whole catalog. Both variants are computed because they are pure
  // functions of data already in hand: offering the court-free alternative
  // costs nothing and saves a round trip when the player taps for it.
  const weak: WeakPoint | null = newestFix
    ? { skill: newestFix.skill, metricKey: newestFix.metric }
    : null;
  const assignmentArgs = {
    userId: userId!,
    dayKey: todayKey(),
    level: (profile?.level ?? "beginner") as Level,
    ratings,
    weak,
  };
  const assignment = assignmentFor(assignmentArgs);
  const courtFreeAssignment = assignmentFor({ ...assignmentArgs, courtFree: true });

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
              Home
            </p>
            <h1 className="mt-2 font-display text-page-title">
              {firstName ? `Back on the court, ${firstName}.` : "Back on the court."}
            </h1>
            <div className="mt-3 flex items-center gap-2">
              {/* Explicit on both chips, because the bare route now falls back
                  to the PROFILE default rather than to indoor: an indoor link
                  that dropped the parameter would read as "no choice" and send
                  a beach player straight back to the sand. Active state
                  compares by group so the legacy beach value lights the
                  combined chip (D-035). */}
              {ANALYZE_DISCIPLINES.map((d) => (
                <Link
                  key={d}
                  href={`/dashboard?discipline=${d}`}
                  aria-current={
                    disciplineGroup(discipline) === disciplineGroup(d)
                      ? "page"
                      : undefined
                  }
                  className={`chip min-h-11 ${
                    disciplineGroup(discipline) === disciplineGroup(d)
                      ? "chip-active"
                      : ""
                  }`}
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
            {/* Deep-linked to the last rep's skill and environment when there
                is one: the daily loop is "same skill, better number", and the
                flow already reads both parameters (it is how onboarding hands
                off). A first-timer still gets the bare picker. */}
            {!spent && (
              <Link
                href={
                  analyses[0]
                    ? `/analyze?skill=${analyses[0].skill}&discipline=${analyses[0].discipline}`
                    : "/analyze"
                }
                className="btn-primary text-sm"
              >
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
          {/* Today leads, at every width. The rating is evidence of what has
              happened; the assignment is the only thing on this page a player
              can act on right now, and a development product that opens on a
              score is still an analytics product wearing a different word. */}
          <div className="grid gap-4 md:grid-cols-2">
            <Reveal delay={60}>
              <DailyAssignmentCard
                assignment={assignment}
                courtFree={courtFreeAssignment}
                done={progress.challengeDone}
                xpAward={XP_AWARDS.challenge}
              />
            </Reveal>
            {newestFix && (
              <Reveal delay={120}>
                <FocusNowCard analysis={newestFix} />
              </Reveal>
            )}
          </div>

          <Reveal delay={140}>
            <p className="mt-3">
              <Link
                href="/plan"
                className="relative font-mono text-[11px] uppercase tracking-[0.08em] text-chalk-dim transition-colors hover:text-gold"
              >
                See this week&rsquo;s plan
                <LinkPending />
              </Link>
            </p>
          </Reveal>

          <Reveal delay={160}>
            <div className="score-stage card spot mt-4 flex flex-wrap items-center justify-center gap-6 p-6">
              <ScoreRing score={overall} size={150} label="Overall" />
              <div className="min-w-0">
                <Radar ratings={ratings} size={196} />
              </div>
            </div>
          </Reveal>

          {/* The board renders once, in the main column at every width: it
              carries a form and mutating actions now, and two live copies of
              one form is how duplicate-id bugs are born. The xl rail keeps the
              glanceable cards instead. */}
          <div className="mt-4">
            <Reveal delay={240}>
              <GoalsBoard goals={goals} ratings={ratings} doneCount={goalsDone} />
            </Reveal>
          </div>

          <div className="mt-4 xl:hidden">
            <Reveal delay={280}>
              <BadgeShelf earned={earnedAchievements} />
            </Reveal>
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
                      <span className="text-right">
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
                        {/* The high-water mark never disappears under a rough
                            patch (D-079): the rating says where the form is,
                            this says what it has reached. */}
                        {bests[skill] != null && rating != null && (
                          <span className="block font-mono text-[10px] text-chalk-dim">
                            best {bests[skill]}
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

        {/* The rail no longer repeats today's work: the assignment and the fix
            lead the main column at every width now, so duplicating them here
            would give the same card two live copies of one form. */}
        <aside className="hidden xl:flex xl:flex-col xl:gap-4">
          <Reveal delay={240}>
            <ThisWeekCard progress={progress} weekCount={weekCount} />
          </Reveal>
          <Reveal delay={300}>
            <BadgeShelf earned={earnedAchievements} />
          </Reveal>
        </aside>
      </div>
    </section>
  );
}
