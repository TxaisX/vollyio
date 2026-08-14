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
import { ReportContent } from "@/components/report-content";
import { RepToasts } from "@/components/xp-toast";
import { claimAchievements } from "@/lib/achievements";
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

  // The rep this page shows may be the one that tipped a badge over (first
  // read, all six, a new best), and the celebration belongs at the moment of
  // pride rather than on the next Home visit. Idempotent, fails soft to [],
  // and inert against a database without migration 050 (D-089).
  const newBadges = await claimAchievements(supabase);

  // Two waves, not six awaits: everything keyed on the route param rides with
  // the main row, and everything keyed on the row's own fields follows in one
  // more round trip. Sequential, these five independent reads each added a
  // full region round trip to TTFB. Every read is still owner-scoped by RLS
  // plus its explicit filter; nothing about the security surface changes.
  const [{ data }, { data: liveLinks }, { data: fb }] = await Promise.all([
    supabase
      .from("analyses")
      .select(
        "id, skill, discipline, frame_paths, clip_path, overall_score, created_at, result",
      )
      .eq("id", id)
      .eq("user_id", userId!)
      .maybeSingle(),
    // Whether any live share link exists, for the owner's control state. RLS
    // scopes the read to the owner; anonymous readers never touch this table.
    supabase
      .from("share_links")
      .select("id")
      .eq("analysis_id", id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1),
    // The player's standing decision on this breakdown (flywheel signal), if
    // any. Owner-scoped by RLS + the explicit filter.
    supabase
      .from("analysis_feedback")
      .select("was_right, reasons, note")
      .eq("analysis_id", id)
      .maybeSingle(),
  ]);

  if (!data) notFound();
  const row = data as Row;
  const result = row.result;

  // Wave two: the previous rep for the priority-fix loop (D-044) plus both
  // storage signings, all keyed on the row just read and independent of one
  // another. The prev read is RLS plus the explicit owner filter, a read
  // within the existing select grant, so no security surface changes.
  const [{ data: prevRow }, { data: signed }, signedClip, { data: ratingRow }, { data: bestRows }] =
    await Promise.all([
      supabase
        .from("analyses")
        .select("result")
        .eq("user_id", userId!)
        .eq("skill", row.skill)
        .eq("discipline", row.discipline)
        .lt("created_at", row.created_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.storage.from("frames").createSignedUrls(row.frame_paths, 3600),
      row.clip_path
        ? supabase.storage.from("clips").createSignedUrl(row.clip_path, 3600)
        : Promise.resolve(null),
      // The rolling rating and the high-water mark, for the framing line under
      // the score (D-079): a rough rep renders beside where the form stands
      // and what it has reached, so one number never reads as a demotion.
      // Either read failing renders no line rather than a wrong one.
      supabase
        .from("skill_ratings")
        .select("rating")
        .eq("user_id", userId!)
        .eq("skill", row.skill)
        .eq("discipline", row.discipline)
        .maybeSingle(),
      supabase.rpc("personal_bests"),
    ]);
  const lastTime = lastTimeFix(
    (prevRow?.result as AnalysisResult | undefined) ?? null,
    result,
  );
  const sharingActive = (liveLinks?.length ?? 0) > 0;

  const formRating = (ratingRow as { rating: number } | null)?.rating ?? null;
  const personalBest =
    (
      (bestRows as { skill: string; discipline: string; best: number }[] | null) ?? []
    ).find((b) => b.skill === row.skill && b.discipline === row.discipline)?.best ??
    null;
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

  const clipUrl: string | null = signedClip?.data?.signedUrl ?? null;

  // A video-path row (D-097) cites no frames and stores none, so nothing is
  // highlighted and the strip is empty. Both fields are absent there rather
  // than empty, which is why every read below goes through a default.
  const timeByFrame = new Map<number, number | null>();
  for (const i of result.insights ?? []) timeByFrame.set(i.frame_index, i.time_s);
  if (result.priority_fix.frame_index != null)
    timeByFrame.set(result.priority_fix.frame_index, result.priority_fix.time_s ?? null);
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
  // The frame path reports strengths as timeline insights; the video path names
  // them directly (D-097). Count whichever this row actually has.
  const strengthCount =
    (result.insights ?? []).filter((i) => i.type === "strength").length +
    (result.strengths?.length ?? 0);
  const fixCount = changes.length > 0 ? changes.length : 1;
  const drillCount = result.drill_slugs.length;
  const valueChips = [
    {
      count: strengthCount,
      label: strengthCount === 1 ? "strength" : "strengths",
      // One anchor for both shapes now: the breakdown reads a v1 row's
      // strength insights into the same "What worked" column a video row
      // fills directly, so #strengths exists whenever this count is above
      // zero. It used to point at #timeline for a v1 row, which would now
      // scroll to nothing at all: the timeline moved behind the breakdown's
      // Advanced switch and is display:none until someone asks for it.
      href: "#strengths",
    },
    { count: fixCount, label: fixCount === 1 ? "fix" : "fixes", href: "#changes" },
    { count: drillCount, label: drillCount === 1 ? "drill" : "drills", href: "#drills" },
  ].filter((c) => c.count > 0);

  return (
    <section className="max-w-7xl">
      {/* Reading progress for the long breakdown scroll; pure CSS, hidden
          where scroll timelines aren't supported. */}
      <div aria-hidden="true" className="scroll-progress" />
      {(xp || newBadges.length > 0) && (
        <RepToasts amount={Number(xp) || 0} badges={newBadges} />
      )}

      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            {/* Only here when there is no clip to pin it to. With a clip, this
                same line rides inside the sticky block (StickyClip's `label`)
                so it stays on screen naming the rep being read about, rather
                than scrolling away in the first swipe. */}
            {!clipUrl && (
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
                {SKILL_LABEL[row.skill]} breakdown · {dateLabel}
              </p>
            )}
            {/* The page leads with the fix, not the word "Breakdown". The
                scorecard is the evidence; the one thing to change is the
                product, and burying it under a heading that named the document
                type was the analytics-tool posture written as a headline. */}
            <h1 className="mt-2 max-w-[22ch] text-balance font-display text-page-title">
              {result.priority_fix.title}
            </h1>
            <p className="mt-2 max-w-prose text-body leading-relaxed text-chalk-dim">
              {result.priority_fix.detail}
            </p>
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
          <div className="flex items-center gap-3">
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
                <ScoreRing score={row.overall_score} size={72} />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
                  {scoreBand(row.overall_score)}
                </span>
              </div>
            </ViewTransition>
            {/* BESIDE the ring, not under the header. These two lines are what
                the number MEANS - the ladder it was scored against and how much
                of the rep was gradable - and they were stacked full-width below
                everything while the space immediately right of an 84px ring sat
                empty on every phone. Reading them here also stops the scale
                from being three more lines to scroll past before the fix. */}
            <div className="min-w-0 border-l border-line pl-3">
              <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.08em] text-chalk-dim">
                40 developing
                <br />
                70 solid
                <br />
                90 advanced
              </p>
              {typeof result.coverage_pct === "number" && (
                <p
                  className={`mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] ${
                    result.low_confidence ? "text-coral" : "text-chalk-dim"
                  }`}
                >
                  {result.coverage_pct}% graded
                </p>
              )}
            </div>
          </div>
        </div>
        {/* Naming the gap without naming the remedy leaves the player to
            conclude the product is broken rather than the framing was (D-081).
            The first cold signup scored 0% coverage on their first rep. */}
        {result.low_confidence && (
          <p className="mt-2 max-w-prose text-body text-chalk-dim">
            Most of this rep was out of frame or too far away to judge. Next
            clip, fill the frame with the athlete and keep the whole motion in
            the shot, and the checklist has something to score.
          </p>
        )}
        {/* One rep is one rep (D-079): the line under a rough score says where
            the form STANDS, so the rep number never reads as a demotion, and a
            best rep gets named as one. */}
        {formRating != null && personalBest != null && (
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-chalk-dim">
            {row.overall_score >= personalBest
              ? `Your best ${SKILL_LABEL[row.skill].toLowerCase()} rep yet`
              : `Your ${SKILL_LABEL[row.skill].toLowerCase()} form: ${Math.round(formRating)} · best ${personalBest}`}
          </p>
        )}
      </Reveal>

      {/* THE RECOMMENDED DRILL IS NOT THE FIRST THING ON THIS PAGE (D-116).
          It stood here, above the clip and the whole breakdown, under a "Start
          here" label. That was the wrong instruction at the wrong moment: a
          player who has just finished a rep has already started, and the first
          screen after a read has to answer "how did that go" before it hands
          out homework. The drill did not disappear -- it is the leading card of
          the "Recommended training" section that now closes the breakdown, and
          it keeps the "Start here" eyebrow and the primary button it had here,
          so nothing about the emphasis was lost, only its position. The section
          nav's drill count still jumps straight to it. */}

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

      {/* ONE COLUMN. The clip used to live in a capped right-hand column with
          three numbers (22rem, 26rem, the breakdown's own 36rem container
          query) that had to move together or the verdict columns silently
          stopped splitting. That whole coupling is gone: the clip is now a
          looping centre cut pinned to the top of the breakdown itself
          (components/sticky-clip.tsx), which is what was actually wanted -
          "make the video sticky so that people can replay the video that they
          highlighted" - and it hands the full row width back to the breakdown,
          so the two verdict columns split everywhere instead of only above
          1280px. The frame strip below is the no-clip fallback only. */}
      <div className="mt-5 min-w-0">
        {!clipUrl && (
          <Reveal delay={80}>
            {nothingToShow ? (
              <div className="card p-5 text-center">
                <p className="text-body text-chalk-dim">
                  These frames couldn&rsquo;t load right now. Your scores and
                  notes are still below.
                </p>
              </div>
            ) : (
              <>
                <ClipViewer
                  clipUrl={null}
                  frames={signedCount > 0 ? playerFrames : []}
                  focusIndex={focusIndex}
                  contactIndex={contactIndex}
                />
                {framesMissing > 0 && (
                  <p className="mt-2 text-xs text-chalk-dim">
                    {signedCount > 0
                      ? `${framesMissing} of ${row.frame_paths.length} frames couldn’t load right now.`
                      : "The frames couldn’t load right now."}{" "}
                    Your scores and notes are unaffected.
                  </p>
                )}
              </>
            )}
          </Reveal>
        )}

        <div className="min-w-0">
          {result.focus && (
            <Reveal delay={90}>
              <div className="mb-4 rounded-card border-l-[3px] border-teal bg-navy-lighter p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-teal">
                  Focus · {result.focus.label}
                </p>
                <p className="mt-1 text-body leading-relaxed text-chalk-dim">
                  {result.focus.why}
                </p>
              </div>
            </Reveal>
          )}
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
          <BreakdownBody
            skill={row.skill}
            result={result}
            clipUrl={clipUrl}
            clipLabel={`${SKILL_LABEL[row.skill]} breakdown · ${dateLabel}`}
          />

          <Reveal delay={320}>
            <AnalysisFeedback analysisId={row.id} initial={initialFeedback} />
            {/* Separate from the feedback card above it on purpose. That one
                asks whether the coaching was useful; this one is the safety
                report Play's AI-Generated Content policy requires the model's
                output to have, and folding a harm report into a helpfulness
                widget would leave the app with neither a clean eval signal nor
                a reporting mechanism. */}
            <div className="mt-3 flex justify-end">
              <ReportContent
                target={{ surface: "analysis", analysisId: row.id }}
                label="Report this breakdown"
              />
            </div>
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
