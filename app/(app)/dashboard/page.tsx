import type { Metadata } from "next";
import { ViewTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { LinkPending } from "@/components/link-pending";
import { ScoreRing } from "@/components/score-ring";
import { SkillMeters } from "@/components/skill-meters";
import { InstallApp } from "@/components/install-app";
import { Reveal } from "@/components/motion";
import { SeamArcs } from "@/components/motif";
import { LimitNotice } from "@/components/limit-notice";
import { GoalsBoard, type Goal } from "@/components/goals";
import { BadgeShelf } from "@/components/achievements";
import { claimAchievements, readAchievements } from "@/lib/achievements";
import { overallScore, scoreBand } from "@/lib/ratings";
import { relativeDay } from "@/lib/relative-day";
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
import { getProgress, todayKey, XP_AWARDS } from "@/lib/progression";
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

// The two cards that sit above the fold and answer "what do I do right now".
// Both were a text link or a small button before (D-116); a card the width of
// the column is what the phone layout actually had room to make obvious.
function ActionCard({
  href,
  title,
  detail,
  icon,
  primary = false,
}: {
  href: string;
  title: string;
  detail: string;
  icon: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`card card-lift group relative flex items-center gap-3.5 p-4 ${
        primary ? "action-card" : ""
      }`}
    >
      <span
        className={`row-tile ${primary ? "h-11 w-11 border-gold/35 text-gold" : ""}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-base font-bold">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-sm text-chalk-dim">
          {detail}
        </span>
      </span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-4.5 w-4.5 shrink-0 transition-transform group-hover:translate-x-0.5 ${
          primary ? "text-gold" : "text-chalk-dim"
        }`}
        aria-hidden
      >
        <path d="M5 12h13M12 6l6 6-6 6" />
      </svg>
      <LinkPending />
    </Link>
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
      .select("id, title, skill, target_rating, deadline, note")
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
  const thisWeek = analyses.filter(
    (a) => new Date(a.created_at).getTime() > weekAgo,
  );
  const weekCount = thisWeek.length;

  // The seven-day window of the skill meters, and deliberately NOT the rolling
  // rating restricted to a date range: this is the plain mean of the reps
  // actually filmed this week, which is what a player is asking for when they
  // flip the switch after a week of work on one fix. The rating beside it under
  // "All time" is the estimator (lib/ratings.ts) and is the slower, truer
  // number. Both are labelled, so neither is passed off as the other.
  const weekSums = new Map<Skill, { total: number; n: number }>();
  for (const a of thisWeek) {
    const acc = weekSums.get(a.skill) ?? { total: 0, n: 0 };
    acc.total += a.overall_score;
    acc.n += 1;
    weekSums.set(a.skill, acc);
  }
  const weekRatings: Partial<Record<Skill, number>> = {};
  for (const [skill, acc] of weekSums) weekRatings[skill] = acc.total / acc.n;

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


  const analyzeHref = analyses[0]
    ? `/analyze?skill=${analyses[0].skill}&discipline=${analyses[0].discipline}`
    : "/analyze";

  return (
    <section className="max-w-7xl">
      {/* THE OPENING BAND (D-116). Title, play state and the overall ring on one
          line. Before this the same three things were a heading block, a row of
          pills and an 18rem card holding a ring beside a radar, which between
          them owned the entire first screen of a phone and said nothing a
          player could act on. The ring stayed because it is the one number that
          answers "how am I doing" at a glance; the radar retired because the
          six meters below say the same thing on an axis you can read down. */}
      <Reveal>
        <div className="hero-band card spot p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
                Home
              </p>
              <h1 className="mt-1.5 font-display text-page-title">
                {firstName ? `Back on the court, ${firstName}.` : "Back on the court."}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="tag">
                  <span className="text-chalk">{weekCount}</span> this week
                </span>
                <span className="tag">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-3.5 w-3.5 ${progress.streak > 0 ? "text-gold" : "text-chalk-dim"}`}
                    aria-hidden
                  >
                    <path d="M12 3c.5 3-1.5 4.5-2.5 6C8.5 10.5 8 12 8 13.5A4.4 4.4 0 0 0 12.5 18a4.6 4.6 0 0 0 4.5-4.75c0-2.25-1.25-3.5-2-5.25-.5 1-1.5 1.5-1.5 3C12 8.5 12.5 5.5 12 3Z" />
                  </svg>
                  {/* The flame is decorative, so the word has to be in the text
                      or this pill reads as a bare "3 days" with no subject. */}
                  <span className="sr-only">Streak: </span>
                  <span className="text-chalk">{progress.streak}</span> day
                  {progress.streak === 1 ? "" : "s"}
                </span>
                <span className="tag">
                  <span className="text-gold">
                    <span className="sr-only">Level </span>
                    <span aria-hidden="true">LV</span> {progress.level}
                  </span>
                  {/* aria-valuetext, because a bare progressbar is announced as
                      a percentage and "50 percent" is not what the numbers
                      beside it say. */}
                  <span
                    className="block h-1 w-12 overflow-hidden rounded-full bg-line/60"
                    role="progressbar"
                    aria-valuenow={progress.into}
                    aria-valuemin={0}
                    aria-valuemax={progress.span}
                    aria-valuetext={`${progress.into} of ${progress.span} XP`}
                    aria-label="XP to next level"
                  >
                    <span
                      className="block h-full rounded-full bg-gold transition-all duration-700"
                      style={{
                        width: `${Math.round((progress.into / progress.span) * 100)}%`,
                      }}
                    />
                  </span>
                  <span aria-hidden="true" className="text-[10px]">
                    {progress.into}/{progress.span}
                  </span>
                </span>
              </div>
            </div>
            {/* The band name, not a second score. `scoreBand` is the app's own
                rubric wording (lib/ratings.ts), which is what keeps a 62 reading
                as real progress against an elite standard rather than as a bad
                grade. */}
            <div className="shrink-0 text-center">
              <ScoreRing score={overall} size={92} />
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-chalk-dim">
                {overall != null ? scoreBand(overall) : "Unrated"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
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
                  disciplineGroup(discipline) === disciplineGroup(d) ? "page" : undefined
                }
                className={`chip min-h-11 ${
                  disciplineGroup(discipline) === disciplineGroup(d) ? "chip-active" : ""
                }`}
              >
                {DISCIPLINE_LABEL[d]}
              </Link>
            ))}
            {/* Before the drive to /analyze, not after the upload. A player who
                films, marks and waits only to meet a paywall has done 90
                seconds of work for nothing (docs/billing.md 4.6). Quiet while
                there is room; the last one is called out in gold, and once they
                are out the offer below takes over from the line entirely. */}
            {allowance && allowanceTone(allowance) !== "out" && (
              <p
                className={`ml-auto font-mono text-[11px] ${
                  allowanceTone(allowance) === "last" ? "text-gold" : "text-chalk-dim"
                }`}
              >
                {allowanceLine(allowance)}
              </p>
            )}
          </div>
        </div>
      </Reveal>

      {/* The one distribution surface that needs nobody's permission. A player
          who installs comes back to an icon instead of remembering a URL, and
          this page is where they already are. It renders nothing on a browser
          that cannot install and nothing once installed, so a signed-in regular
          sees it once and never again. */}
      <InstallApp className="mt-4" />

      {/* Out of analyses: the same offer the 402 shows, in the place a player
          lands before they walk to /analyze and find out the hard way. Above
          the fold and above the rest of the dashboard, because it is the only
          thing on this page they can act on. */}
      {allowance && allowanceTone(allowance) === "out" && (
        <Reveal delay={40} className="mt-4">
          <LimitNotice
            className="max-w-xl"
            plan={allowance.plan}
            allowance={allowance.allowance}
            resetsOn={resetDate(allowance)}
            canBuy={UPGRADE_URL !== null}
          />
        </Reveal>
      )}

      {/* The two standing actions, as cards rather than as a button in the
          heading and a nav tab. Deep-linked to the last rep's skill and
          environment when there is one: the daily loop is "same skill, better
          number", and the flow already reads both parameters (it is how
          onboarding hands off). A first-timer still gets the bare picker.

          A spent month drops the filming card entirely rather than greying it,
          because the notice above already carries the only action left and a
          gold card whose whole job is to walk the player into a 402 is worse
          than no card. */}
      <Reveal delay={60}>
        <div
          className={`mt-4 grid gap-3 ${
            spent ? "" : "sm:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"
          }`}
        >
          {!spent && (
            <ActionCard
              primary
              href={analyzeHref}
              title="Film a rep"
              detail="Ten seconds, one skill, scored against the checklist."
              icon={
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden
                >
                  <rect x="3" y="6.5" width="12" height="11" rx="2" />
                  <path d="M15 11l6-3.5v9L15 13" />
                </svg>
              }
            />
          )}
          <ActionCard
            href="/learn"
            title="Learn"
            detail="Technique library"
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4.5 w-4.5"
                aria-hidden
              >
                <path d="M3 9.25 12 5l9 4.25-9 4.25-9-4.25Z" />
                <path d="M7 11.4V16c0 1.38 2.24 2.5 5 2.5s5-1.12 5-2.5v-4.6" />
              </svg>
            }
          />
        </div>
      </Reveal>

      <div className="mt-4 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-6">
        <div className="min-w-0">
          {/* Today leads, at every width. The rating is evidence of what has
              happened; the assignment is the only thing on this page a player
              can act on right now, and a development product that opens on a
              score is still an analytics product wearing a different word. */}
          <div className="grid gap-3 md:grid-cols-2">
            <Reveal delay={100}>
              <DailyAssignmentCard
                assignment={assignment}
                courtFree={courtFreeAssignment}
                done={progress.challengeDone}
                xpAward={XP_AWARDS.challenge}
              />
            </Reveal>
            {newestFix && (
              <Reveal delay={140}>
                <FocusNowCard analysis={newestFix} />
              </Reveal>
            )}
          </div>

          {/* The "See this week's plan" link is hidden as of 2026-08-05, with
              the rest of the weekly plan's entry points: it was built as a
              training plan and is wanted as a dietary check-in instead. See
              components/section-nav.tsx for what restoring it takes. */}

          <Reveal delay={180}>
            <div className="mt-6">
              <SkillMeters
                ratings={ratings}
                recent={weekRatings}
                bests={bests}
                latestFix={latestFix}
              />
            </div>
          </Reveal>

          <Reveal delay={220}>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <h2 className="section-head section-head-teal">Recent activity</h2>
              {analyses.length > 0 && (
                // Padded for a 44px tap target, negative-margined so the row
                // keeps the height it reads best at.
                <Link
                  href="/history"
                  className="-my-3.5 py-3.5 font-mono text-[11px] text-chalk-dim transition-colors hover:text-chalk"
                >
                  View all
                </Link>
              )}
            </div>
            {analyses.length === 0 ? (
              <div className="card relative mt-3 overflow-hidden p-8 text-center">
                <SeamArcs className="absolute inset-0 h-full w-full" opacity={0.08} />
                <div className="relative">
                  <p className="font-display text-lg font-bold">No film yet.</p>
                  <p className="mx-auto mt-1 max-w-xs text-body text-chalk-dim">
                    Your rating starts with one rep. Ten seconds, any skill.
                  </p>
                  <Link href="/analyze" className="btn-ghost mt-5 inline-flex text-sm">
                    Film your first rep
                  </Link>
                </div>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {analyses.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/analysis/${a.id}`}
                      className="card card-lift group relative flex items-center gap-3 p-3"
                    >
                      {/* Morph source: this score travels into the breakdown's
                          score ring when the row is opened (matches the row on
                          /history). share="morph" + default="none" keeps it
                          inert on every other transition. */}
                      <ViewTransition name={`rep-${a.id}`} share="morph" default="none">
                        <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-control border border-gold/30 bg-gold/10">
                          <span className="stat-num text-lg text-gold">
                            {a.overall_score}
                          </span>
                          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-chalk-dim">
                            pts
                          </span>
                        </span>
                      </ViewTransition>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="min-w-0 flex-1 truncate font-display text-sm font-bold">
                            {SKILL_LABEL[a.skill]} breakdown
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-chalk-dim">
                            {relativeDay(a.created_at)}
                          </span>
                        </span>
                        {a.fix && (
                          <span className="mt-0.5 block truncate text-xs text-chalk-dim">
                            <span className="text-gold">Fix:</span> {a.fix}
                          </span>
                        )}
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="tag">{scoreBand(a.overall_score)}</span>
                          <span className="tag">{DISCIPLINE_LABEL[a.discipline]}</span>
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
                      <LinkPending />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>

          {/* The board renders once, in the main column at every width: it
              carries a form and mutating actions now, and two live copies of
              one form is how duplicate-id bugs are born. The xl rail keeps the
              glanceable shelf instead. */}
          <div className="mt-6">
            <Reveal delay={260}>
              <GoalsBoard goals={goals} ratings={ratings} doneCount={goalsDone} />
            </Reveal>
          </div>

          <div className="mt-4 xl:hidden">
            <Reveal delay={300}>
              <BadgeShelf earned={earnedAchievements} />
            </Reveal>
          </div>
        </div>

        {/* The rail no longer repeats today's work, and no longer repeats the
            week either: the assignment and the fix lead the main column at
            every width, and the reps / streak / level counts the old "This
            week" card carried now sit in the opening band above (D-116). */}
        <aside className="hidden xl:flex xl:flex-col xl:gap-4">
          <Reveal delay={300}>
            <BadgeShelf earned={earnedAchievements} />
          </Reveal>
        </aside>
      </div>
    </section>
  );
}
