import type { Metadata } from "next";
import { ViewTransition } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { metricLabel } from "@/lib/ai/metrics";
import { pointerCue } from "@/lib/ai/pointers";
import { scoreBand } from "@/lib/ratings";
import { metricKnowledge } from "@/content/technique";
import { drillBySlug } from "@/content/drills";
import { MetricBar } from "@/components/metric-bar";
import { MetricLegend } from "@/components/metric-legend";
import { Reveal } from "@/components/motion";
import { ScoreRing } from "@/components/score-ring";
import { ShareCard } from "@/components/share-card";
import { XpToast } from "@/components/xp-toast";
import { ClipViewer } from "@/components/clip-viewer";
import { LinkPending } from "@/components/link-pending";
import { SKILL_LABEL, type Skill, type Discipline } from "@/lib/skills";
import type { AnalysisResult } from "@/lib/analysis-types";
import { lastTimeFix } from "@/lib/priority-loop";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  skill: Skill;
  discipline: Discipline;
  frame_paths: string[];
  clip_path: string | null;
  overall_score: number;
  created_at: string;
  result: AnalysisResult;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) {
    return { title: "Breakdown not found", robots: { index: false, follow: false } };
  }

  const { data } = await supabase
    .from("analyses")
    .select("skill, overall_score, result")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    return { title: "Breakdown not found", robots: { index: false, follow: false } };
  }

  const meta = data as Pick<Row, "skill" | "overall_score" | "result">;
  const label = SKILL_LABEL[meta.skill];
  const score = meta.overall_score;
  const fix = meta.result?.priority_fix?.title;
  return {
    title: `${label} breakdown, ${score}/100`,
    description: fix
      ? `Your ${label.toLowerCase()} rep scored ${score} out of 100. Priority fix: ${fix}`
      : `Your ${label.toLowerCase()} rep scored ${score} out of 100.`,
    robots: { index: false, follow: false },
  };
}

export default async function AnalysisDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ xp?: string }>;
}) {
  const { id } = await params;
  const { xp } = await searchParams;
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);

  const { data } = await supabase
    .from("analyses")
    .select(
      "id, skill, discipline, frame_paths, clip_path, overall_score, created_at, result",
    )
    .eq("id", id)
    .eq("user_id", userId!)
    .maybeSingle();

  if (!data) notFound();
  const row = data as Row;
  const result = row.result;

  // Priority-fix loop (D-044): the previous rep of this same skill and
  // discipline, if any, so the breakdown opens with what the player was told to
  // work on and whether the checkpoint behind it moved. RLS plus the explicit
  // owner filter scope this to the player; it is a read within the existing
  // select grant, so no security surface changes.
  const { data: prevRow } = await supabase
    .from("analyses")
    .select("result")
    .eq("user_id", userId!)
    .eq("skill", row.skill)
    .eq("discipline", row.discipline)
    .lt("created_at", row.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastTime = lastTimeFix(
    (prevRow?.result as AnalysisResult | undefined) ?? null,
    result,
  );
  const lastTimeLabel = lastTime ? metricLabel(row.skill, lastTime.metricKey) : null;
  const lastTimeCopy =
    lastTime && lastTimeLabel
      ? lastTime.movement === "up"
        ? `${lastTimeLabel}: ${lastTime.then} up to ${lastTime.now}.`
        : lastTime.movement === "down"
          ? `${lastTimeLabel}: ${lastTime.then} down to ${lastTime.now}.`
          : lastTime.movement === "same"
            ? `${lastTimeLabel}: held at ${lastTime.now}.`
            : lastTime.movement === "baseline"
              ? `${lastTimeLabel}: ${lastTime.now} this rep.`
              : `${lastTimeLabel}: not visible in this rep.`
      : null;

  const { data: signed } = await supabase.storage
    .from("frames")
    .createSignedUrls(row.frame_paths, 3600);
  const urls = signed?.map((s) => s.signedUrl) ?? [];
  // Signed-URL failure: any frame that could not be signed counts. Show a
  // message instead of blank/broken images; scores and notes still render
  // below. Guarding on a partial failure (not just an all-fail) avoids passing
  // an empty-string img src to ClipViewer.
  const framesFailed =
    row.frame_paths.length > 0 &&
    urls.filter(Boolean).length < row.frame_paths.length;

  let clipUrl: string | null = null;
  if (row.clip_path) {
    const { data: signedClip } = await supabase.storage
      .from("clips")
      .createSignedUrl(row.clip_path, 3600);
    clipUrl = signedClip?.signedUrl ?? null;
  }

  const timeByFrame = new Map<number, number | null>();
  for (const i of result.insights) timeByFrame.set(i.frame_index, i.time_s);
  timeByFrame.set(result.priority_fix.frame_index, result.priority_fix.time_s);
  const highlight = new Set(timeByFrame.keys());
  if (result.focus) highlight.add(result.focus.frame_index);
  if (typeof result.contact_frame_index === "number")
    highlight.add(result.contact_frame_index);

  const playerFrames = urls.map((url, i) => ({
    url: url ?? "",
    // frame_times covers every sent frame on newer rows; older rows only
    // know the times the model cited (insights and the priority fix).
    time_s: result.frame_times?.[i] ?? timeByFrame.get(i) ?? null,
    highlighted: highlight.has(i),
  }));

  const focusIndex = result.focus?.frame_index ?? null;
  const contactIndex =
    typeof result.contact_frame_index === "number" ? result.contact_frame_index : null;
  const changes = result.changes ?? [];
  const difficultyLabel: Record<string, string> = {
    quick: "Quick win",
    moderate: "Moderate",
    "long-term": "Long-term",
  };

  const dateLabel = new Date(row.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Everything the breakdown computed, counted up front so the player sees
  // the full value of the rep before scrolling.
  const strengthCount = result.insights.filter((i) => i.type === "strength").length;
  const fixCount = changes.length > 0 ? changes.length : 1;
  const drillCount = result.drill_slugs.length;
  const valueChips = [
    { count: strengthCount, label: strengthCount === 1 ? "strength" : "strengths", href: "#timeline" },
    { count: fixCount, label: fixCount === 1 ? "fix" : "fixes", href: "#changes" },
    { count: drillCount, label: drillCount === 1 ? "drill" : "drills", href: "#drills" },
  ].filter((c) => c.count > 0);

  return (
    <section className="max-w-6xl">
      {/* Reading progress for the long breakdown scroll; pure CSS, hidden
          where scroll timelines aren't supported. */}
      <div aria-hidden="true" className="scroll-progress" />
      {xp && <XpToast amount={Number(xp) || 0} />}

      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
              {SKILL_LABEL[row.skill]} · {dateLabel}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
              Breakdown
            </h1>
            {valueChips.length > 0 && (
              <p className="mt-3 flex flex-wrap gap-2">
                {valueChips.map((c) => (
                  <a key={c.label} href={c.href} className="chip">
                    {c.count} {c.label}
                  </a>
                ))}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <ShareCard
              skillLabel={SKILL_LABEL[row.skill]}
              score={row.overall_score}
              fixTitle={result.priority_fix.title}
              date={dateLabel}
            />
            {/* Morph target: the row score from /history or the dashboard
                recent list lands here, appearing to travel into the ring.
                share="morph" + default="none" keeps it inert on the Suspense
                reveal and every unrelated transition. When the breakdown
                streams behind its skeleton first, this simply yields to that
                reveal — the morph is a best-effort continuity cue, never a
                dependency. */}
            <ViewTransition
              name={`rep-${row.id}`}
              share="morph"
              default="none"
            >
              <div className="flex flex-col items-center gap-1">
                <ScoreRing score={row.overall_score} size={84} />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
                  {scoreBand(row.overall_score)}
                </span>
              </div>
            </ViewTransition>
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.08em] text-chalk-dim">
          Scored like a coach · 40 developing · 70 solid · 90 advanced
        </p>
        {typeof result.coverage_pct === "number" && (
          <p
            className={`mt-1 font-mono text-[11px] uppercase tracking-[0.08em] ${
              result.low_confidence ? "text-coral" : "text-chalk-dim"
            }`}
          >
            {result.low_confidence
              ? `Graded on ${result.coverage_pct}% of the checklist; the rest wasn't visible`
              : `Graded on ${result.coverage_pct}% of the checklist`}
          </p>
        )}
      </Reveal>

      {lastTime && lastTimeCopy && (
        <Reveal delay={90}>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border-l-[3px] border-teal bg-navy-lighter p-3.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-teal">
              Last time
            </span>
            <span className="min-w-0 text-sm text-chalk">
              You worked on{" "}
              <span className="font-semibold">{lastTime.fixTitle}</span>.
            </span>
            <span
              className={`font-mono text-xs ${
                lastTime.movement === "up"
                  ? "text-teal"
                  : lastTime.movement === "down"
                    ? "text-coral"
                    : "text-chalk-dim"
              }`}
            >
              {lastTimeCopy}
            </span>
          </div>
        </Reveal>
      )}

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-start lg:gap-8">
        {/* Player: right column on desktop, first thing on mobile */}
        <div className="lg:order-2 lg:sticky lg:top-8">
          <Reveal delay={80}>
            {framesFailed ? (
              <div className="card p-6 text-center">
                <p className="text-sm text-chalk-dim">
                  These frames couldn&rsquo;t load right now. Your scores and
                  notes are still below.
                </p>
              </div>
            ) : (
              <ClipViewer
                clipUrl={clipUrl}
                frames={playerFrames}
                focusIndex={focusIndex}
                contactIndex={contactIndex}
              />
            )}
            {result.focus && (
              <div className="mt-3 rounded-card border-l-[3px] border-teal bg-navy-lighter p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-teal">
                  Focus · {result.focus.label}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-chalk-dim">
                  {result.focus.why}
                </p>
              </div>
            )}
          </Reveal>
        </div>

        {/* Breakdown: left column on desktop */}
        <div className="mt-8 min-w-0 lg:order-1 lg:mt-0">
          {result.subject_check && (
            <Reveal delay={100}>
              <p
                className={`mb-3 text-xs ${
                  result.subject_check.marker_match.toLowerCase() === "mismatch"
                    ? "text-coral"
                    : "text-chalk-dim"
                }`}
              >
                {result.subject_check.marker_match.toLowerCase() === "mismatch"
                  ? "Heads up: this is not the player you marked. Analyzed "
                  : "Analyzed "}
                {result.subject_check.analyzed}
              </p>
            </Reveal>
          )}
          <Reveal delay={140}>
            <p className="text-sm leading-relaxed text-chalk-dim">
              {result.summary}
            </p>
          </Reveal>

          {(result.rep_scores?.length ?? 0) > 1 && (
            <Reveal delay={160}>
              <h2 className="mt-8 mb-3 font-display text-sm font-bold uppercase tracking-wide">
                Rep by rep
              </h2>
              <div className="card space-y-3 p-5">
                {result.rep_scores!.map((r) => (
                  <div key={r.rep_index} className="flex items-baseline gap-3">
                    <span className="chip shrink-0">
                      Rep {r.rep_index + 1} · {r.overall}
                    </span>
                    <span className="min-w-0 text-xs text-chalk-dim">{r.note}</span>
                  </div>
                ))}
                <p className="font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
                  Spread:{" "}
                  {Math.max(...result.rep_scores!.map((r) => r.overall)) -
                    Math.min(...result.rep_scores!.map((r) => r.overall))}{" "}
                  pts · tighter is better
                </p>
              </div>
            </Reveal>
          )}

          <Reveal delay={180}>
            <h2 className="mt-8 mb-2 font-display text-sm font-bold uppercase tracking-wide">
              Metrics
            </h2>
            <div className="mb-3">
              <MetricLegend />
            </div>
            <div className="card space-y-4 p-5">
              {result.metrics.map((m, i) => (
                <MetricBar
                  key={m.key}
                  label={metricLabel(row.skill, m.key)}
                  score={m.score}
                  note={m.note}
                  observed={m.observed !== false}
                  weight={m.weight}
                  pointers={m.pointers
                    ?.map((p) => ({
                      cue: pointerCue(row.skill, m.key, p.key),
                      status: p.status,
                    }))
                    .filter((p): p is { cue: string; status: string } => p.cue != null)}
                  elite={
                    metricKnowledge(
                      row.skill,
                      result.discipline ?? "indoor",
                      m.key,
                    )?.elite_marker
                  }
                  delay={i * 90}
                />
              ))}
            </div>
          </Reveal>

          <Reveal delay={220}>
            <h2
              id="timeline"
              className="mt-8 mb-3 scroll-mt-24 font-display text-sm font-bold uppercase tracking-wide"
            >
              Timeline
            </h2>
            <ul className="space-y-1">
              {result.insights.map((ins, i) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-control p-2 text-sm transition-colors hover:bg-navy-light"
                >
                  <span className="w-12 shrink-0 pt-0.5 font-mono text-xs text-chalk-dim">
                    {ins.time_s != null ? `${ins.time_s}s` : `#${ins.frame_index + 1}`}
                  </span>
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      ins.type === "strength" ? "bg-teal" : "bg-coral"
                    }`}
                  />
                  <span className="flex-1">{ins.observation}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          {changes.length > 0 ? (
            <Reveal delay={260}>
              <h2
                id="changes"
                className="mt-8 mb-3 scroll-mt-24 font-display text-sm font-bold uppercase tracking-wide"
              >
                What to change
              </h2>
              <div className="space-y-3">
                {changes.map((c, i) => (
                  <div
                    key={i}
                    className={`rounded-card border-l-[3px] bg-navy-lighter p-5 ${
                      i === 0 ? "border-gold shadow-lift" : "border-line"
                    }`}
                  >
                    {i === 0 && (
                      <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-gold">
                        Your #1 fix
                      </p>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-display text-lg font-bold">{c.title}</p>
                      <span className="chip shrink-0 border-teal/40 text-teal">
                        +{c.expected_gain} pts
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-chalk-dim">
                      {c.detail}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
                      <span className="chip">{metricLabel(row.skill, c.target_metric)}</span>
                      <span>{difficultyLabel[c.difficulty] ?? c.difficulty}</span>
                      <span>·</span>
                      <span>{c.timeframe}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          ) : (
            <Reveal delay={260}>
              <div className="mt-8 rounded-card border-l-[3px] border-gold bg-navy-lighter p-5 shadow-lift">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-gold">
                  Priority fix
                </p>
                <p className="mt-1 font-display text-lg font-bold">
                  {result.priority_fix.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-chalk-dim">
                  {result.priority_fix.detail}
                </p>
              </div>
            </Reveal>
          )}

          {result.drill_slugs.length > 0 && (
            <Reveal delay={300}>
              <h2
                id="drills"
                className="mt-8 mb-3 scroll-mt-24 font-display text-sm font-bold uppercase tracking-wide"
              >
                Drills for this
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {result.drill_slugs.map((slug) => {
                  const drill = drillBySlug(slug);
                  if (!drill) return null;
                  return (
                    <Link
                      key={slug}
                      href={`/drills/${slug}`}
                      transitionTypes={["nav-forward"]}
                      className="card card-lift relative p-4"
                    >
                      <div className="font-display font-bold">{drill.name}</div>
                      <div className="mt-1 text-xs text-chalk-dim">{drill.summary}</div>
                      <div className="mt-2 font-mono text-[10px] uppercase text-chalk-dim">
                        {drill.duration_min} min · {drill.level}
                      </div>
                      <LinkPending />
                    </Link>
                  );
                })}
              </div>
            </Reveal>
          )}

          <Reveal delay={340}>
            <div className="card mt-8 flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="font-display font-bold">Proud of this rep?</p>
                <p className="mt-1 text-xs text-chalk-dim">
                  Send the score card to your team.
                </p>
              </div>
              <ShareCard
                skillLabel={SKILL_LABEL[row.skill]}
                score={row.overall_score}
                fixTitle={result.priority_fix.title}
                date={dateLabel}
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
