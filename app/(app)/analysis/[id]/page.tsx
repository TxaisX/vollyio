import type { Metadata } from "next";
import { ViewTransition } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { metricLabel } from "@/lib/ai/metrics";
import { scoreBand } from "@/lib/ratings";
import { BreakdownBody } from "@/components/breakdown-body";
import { Reveal } from "@/components/motion";
import { ScoreRing } from "@/components/score-ring";
import { ShareLink } from "@/components/share-link";
import { AnalysisFeedback } from "@/components/analysis-feedback";
import { XpToast } from "@/components/xp-toast";
import { ClipViewer } from "@/components/clip-viewer";
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
  // Whether any live share link exists, for the owner's control state. RLS
  // scopes the read to the owner; anonymous readers never touch this table.
  const { data: liveLinks } = await supabase
    .from("share_links")
    .select("id")
    .eq("analysis_id", row.id)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1);
  const sharingActive = (liveLinks?.length ?? 0) > 0;

  // The player's standing decision on this breakdown (flywheel signal), if any.
  // Owner-scoped by RLS + the explicit filter; a read within the select grant.
  const { data: fb } = await supabase
    .from("analysis_feedback")
    .select("was_right, reasons, note")
    .eq("analysis_id", row.id)
    .maybeSingle();
  const initialFeedback = fb
    ? {
        wasRight: fb.was_right as boolean,
        reasons:
          (fb.reasons as ("wrong_player" | "off_read" | "not_helpful")[] | null) ?? [],
        note: (fb.note as string | null) ?? null,
      }
    : null;

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
  // One answer per path, in the order asked, and a path that could not be
  // signed comes back with an empty url rather than dropping out of the array.
  // Rebuild off frame_paths anyway so a short or absent answer still lines up:
  // frame_times, the focus and contact tags, and the strip numbering are all
  // keyed on a frame's ORIGINAL index, so compacting the list would move every
  // label onto the wrong image.
  const urls = row.frame_paths.map((_, i) => signed?.[i]?.signedUrl || "");
  const signedCount = urls.filter(Boolean).length;
  // One frame that would not sign used to hide all of them, so a single bad
  // object cost the player the whole rep. The viewer already renders a slot
  // with no url as an empty tile, so the frames that did sign are shown and the
  // gap is named underneath.
  const framesMissing = row.frame_paths.length - signedCount;

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
    url,
    // frame_times covers every sent frame on newer rows; older rows only
    // know the times the model cited (insights and the priority fix).
    time_s: result.frame_times?.[i] ?? timeByFrame.get(i) ?? null,
    highlighted: highlight.has(i),
  }));
  // Frames that exist but none of which signed, and no clip, is the only case
  // with nothing to show. A clip alone still plays, it just loses the seek
  // strip, and a rep that stored no frames keeps the viewer's own empty state.
  const nothingToShow =
    row.frame_paths.length > 0 && signedCount === 0 && !clipUrl;

  const focusIndex = result.focus?.frame_index ?? null;
  const contactIndex =
    typeof result.contact_frame_index === "number" ? result.contact_frame_index : null;
  const changes = result.changes ?? [];

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
    <section className="max-w-7xl">
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
            {/* Morph target: the row score from /history or the dashboard
                recent list lands here, appearing to travel into the ring.
                share="morph" + default="none" keeps it inert on the Suspense
                reveal and every unrelated transition. When the breakdown
                streams behind its skeleton first, this simply yields to that
                reveal, the morph is a best-effort continuity cue, never a
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

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,42rem)] lg:items-start lg:gap-8">
        {/* Player: right column on desktop, first thing on mobile */}
        <div className="lg:order-2 lg:sticky lg:top-8">
          <Reveal delay={80}>
            {nothingToShow ? (
              <div className="card p-6 text-center">
                <p className="text-sm text-chalk-dim">
                  These frames couldn&rsquo;t load right now. Your scores and
                  notes are still below.
                </p>
              </div>
            ) : (
              <>
                <ClipViewer
                  clipUrl={clipUrl}
                  frames={signedCount > 0 ? playerFrames : []}
                  focusIndex={focusIndex}
                  contactIndex={contactIndex}
                />
                {framesMissing > 0 && (
                  <p className="mt-3 text-xs text-chalk-dim">
                    {signedCount > 0
                      ? `${framesMissing} of ${row.frame_paths.length} frames couldn’t load right now.`
                      : "The frames couldn’t load right now."}{" "}
                    Your scores and notes are unaffected.
                  </p>
                )}
              </>
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
          <BreakdownBody skill={row.skill} result={result} />

          <Reveal delay={320}>
            <AnalysisFeedback analysisId={row.id} initial={initialFeedback} />
          </Reveal>

          <Reveal delay={340}>
            <div className="card mt-8 flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="min-w-0 max-w-md">
                <p className="font-display font-bold">Proud of this rep?</p>
                <p className="mt-1 text-xs text-chalk-dim">
                  Share a read-only link to this whole breakdown, with the clip.
                  Anyone can open it without an account; they can view but not
                  change it, and the raw frames are never shared.
                </p>
              </div>
              <div className="flex flex-col items-start gap-2">
                <ShareLink analysisId={row.id} active={sharingActive} />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
