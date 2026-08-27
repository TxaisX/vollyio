import Link from "next/link";
import { StickyClip } from "@/components/sticky-clip";
import { metricLabel } from "@/lib/ai/metrics";
import { displayScore, MEANINGFUL_SCORE_DELTA } from "@/lib/score-precision";
import { pointerCue } from "@/lib/ai/pointers";
import { metricKnowledge } from "@/content/technique";
import { drillBySlug } from "@/content/drills";
import { MetricBar } from "@/components/metric-bar";
import { MetricLegend } from "@/components/metric-legend";
import { Reveal } from "@/components/motion";
import { LinkPending } from "@/components/link-pending";
import {
  ADVANCED_ONLY,
  BASIC_ONLY,
  DETAIL_SCOPE,
  DetailSwitch,
} from "@/components/detail-level";
import { CheckpointList } from "@/components/checkpoint-list";
import {
  checkpointStanding,
  checkpointRank,
  isKnownCheckpoint,
  workedItems,
} from "@/components/breakdown-shape";
import type { AnalysisResult } from "@/lib/analysis-types";
import { type Skill } from "@/lib/skills";

// The written breakdown (summary, rep-by-rep, what worked beside what to
// change, the named checkpoints, metrics, timeline, drills), rendered
// identically for the owner's page and the public share page (D-049).
// Drills LINK everywhere, the share page included. They used to render as inert
// names there, because /drills was auth-gated and a link would have sent an
// anonymous viewer to /login. That gate is gone: /drills is not in
// route-guard's PROTECTED list and serves 200 to a stranger, so the share page
// was withholding a working link on a stale premise.
//
// It matters more than it looks. A share link is the one channel that has ever
// brought this product visitors - a single one accounted for 74 of the first
// 219 - and every one of them landed on a breakdown whose recommended drills
// were dead text, with nothing to click and nowhere to go next.
//
// SHAPE OF THE PAGE, and why it is this shape. The player asked for the old
// scorecard back but shorter: "putting the pros and cons next to each other
// just so that there's less moving or scrolling". Two things do that work
// here. The two verdict columns sit side by side once the column they live in
// is wide enough to carry them (a container query, not a viewport one, because
// this component renders inside a page that gives up to 30rem of its width to
// the clip and a viewport breakpoint would put two 220px columns on a laptop).
// And everything that is not the change to make tonight sits behind the Basic /
// Advanced switch: the per-rep notes, the metrics, the timeline, the
// confidence, and since 2026-08-06 the five named checkpoints as well.
//
// The checkpoints moved because they are the same five rows on every rep
// whatever the clip showed, so on a phone they were five cards of standing
// teaching content wedged between the fixes and the drills, which is the
// scrolling this layout exists to remove. Basic is now the summary, the two
// columns and the drills, and nothing else. On a phone the switch does nearly
// all of the work, because nothing puts two columns of prose beside each other
// at 390px.
export function BreakdownBody({
  skill,
  result,
  clipUrl = null,
  clipLabel,
}: {
  skill: Skill;
  result: AnalysisResult;
  /** The rep itself. Rendered as a looping centre cut pinned above everything
   *  else, so the clip a fix is about stays on screen while the fix is read.
   *  Null on a row whose clip never stored, which simply renders no player. */
  clipUrl?: string | null;
  /** Which rep and when, pinned with the clip. */
  clipLabel?: string;
}) {
  const changes = result.changes ?? [];
  // Absent on a video-path row (D-097), which has no per-checkpoint evidence
  // and no resolvable instants. Each section below simply does not render
  // rather than showing an empty shell; a v1 row is unaffected because it
  // carries all three.
  const metrics = result.metrics ?? [];
  const insights = result.insights ?? [];
  // Present only on a v2 row written after D-099. A v2 row from before it, and
  // there are such rows in production, renders every section except this one.
  const checkpoints = result.checkpoints ?? [];
  const repScores = result.rep_scores ?? [];
  // Resolved once, in rank order, so the "Recommended training" section at the
  // foot of this file can lead with the model's first choice and know it will
  // render. A slug the catalog no longer carries drops out here rather than
  // producing an empty card (D-115).
  const drills = result.drill_slugs
    .map(drillBySlug)
    .filter((d): d is NonNullable<typeof d> => d != null);
  const discipline = result.discipline ?? "indoor";
  const difficultyLabel: Record<string, string> = {
    quick: "Quick win",
    moderate: "Moderate",
    "long-term": "Long-term",
  };

  // One shape for the left column whichever engine wrote the row, and one map
  // tying both columns back to the checkpoints section. Both live in
  // components/breakdown-shape.ts so the v1-versus-v2 branch is testable
  // against a real stored row instead of only against this file's source.
  const worked = workedItems(result);
  const standing = checkpointStanding(skill, result);
  const checkpointName = (key?: string) =>
    isKnownCheckpoint(skill, key) ? metricLabel(skill, key) : null;

  // Three strengths against two changes is the deliberate, permanent shape of a
  // v2 row (D-099), and either count comes back lower when the clip did not
  // show enough of the rep. So the columns are two independent stacks in a
  // grid, each as tall as its own content: nothing is padded to match, nothing
  // is stretched to match, and a column with nothing in it renders no heading.
  const sideBySide = worked.length > 0;

  return (
    // The scope the Basic / Advanced switch resolves against. It has to wrap
    // both the control and everything the control governs.
    <div className={DETAIL_SCOPE}>
      {/* The rep first, then the control that decides how much is said about
          it, then the words. The switch sits directly under the clip because
          the two are the page's controls and splitting them put a paragraph
          between a player and the thing that changes what the player reads. */}
      {clipUrl && <StickyClip src={clipUrl} label={clipLabel} />}
      <Reveal delay={140}>
        <div className={clipUrl ? "mt-3" : ""}>
          <DetailSwitch />
        </div>
        <p className="mt-4 text-base leading-relaxed text-chalk-dim sm:text-lg">
          {result.summary}
        </p>
      </Reveal>

      {repScores.length > 1 && (
        <Reveal delay={160}>
          <h2 className="mt-6 mb-2 font-display text-sm font-bold uppercase tracking-wide">
            Rep by rep
          </h2>
          {/* Basic keeps the numbers, which are the point of the section, and
              drops the per-rep note and the spread line, which are six lines of
              analysis of a thing the player can see at a glance. */}
          <div className={`card flex flex-wrap gap-2 p-3.5 ${BASIC_ONLY}`}>
            {repScores.map((r) => (
              <span key={r.rep_index} className="tag">
                Rep {r.rep_index + 1} · {r.overall}
              </span>
            ))}
          </div>
          <div className={`card space-y-2.5 p-4 ${ADVANCED_ONLY}`}>
            {repScores.map((r) => (
              <div key={r.rep_index} className="flex items-baseline gap-3">
                <span className="chip shrink-0">
                  Rep {r.rep_index + 1} · {displayScore(r.overall)}
                </span>
                <span className="min-w-0 text-xs text-chalk-dim">{r.note}</span>
              </div>
            ))}
            {/* Spread across the reps, quoted from the DISPLAYED numbers so it
                agrees with the chips above it. A raw spread of 4 between reps
                that both render as 80 reads as inconsistency the player cannot
                see and the read cannot resolve, and anything inside the noise
                floor is not a spread at all. */}
            {(() => {
              const shownReps = repScores.map((r) => displayScore(r.overall));
              const spread = Math.max(...shownReps) - Math.min(...shownReps);
              return (
                <p className="font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
                  {spread < MEANINGFUL_SCORE_DELTA
                    ? "Every rep read the same · that is consistency"
                    : `Spread: ${spread} pts · tighter is better`}
                </p>
              );
            })()}
          </div>
        </Reveal>
      )}

      {/* THE TWO COLUMNS, side by side at every width, because the comparison
          IS the point: what worked beside what to change is the shape the owner
          asked for and the reason the section is two stacks rather than one
          list. They used to stack below @xl (36rem) on the reasoning that two
          columns of prose under 16rem wrap every other word. That is still
          true, so the narrow case pays for the pairing with tighter type rather
          than by breaking it: gap and text step down under @xl instead of the
          grid collapsing.

          @container rather than sm:/md: is still right, because the width that
          decides this is this column's, not the window's. On the analysis page the clip
          takes up to 30rem beside it, so a 1024px laptop leaves under 30rem
          here and `sm:` would read the wrong number. */}
      <div className="@container mt-6">
        <div
          className={`grid items-start gap-2.5 @xl:gap-4 ${sideBySide ? "grid-cols-2" : ""}`}
        >
          {worked.length > 0 && (
            <Reveal delay={180}>
              <h2
                id="strengths"
                className="mb-3 scroll-mt-[calc(var(--clip-top)+var(--clip-lane)+1rem)] font-display text-sm font-bold uppercase tracking-wide"
              >
                What worked
              </h2>
              <div className="space-y-3">
                {worked.map((w, i) => {
                  const name = checkpointName(w.key);
                  return (
                    <div
                      key={i}
                      className="rounded-card border-l-[3px] border-teal bg-navy-lighter p-4"
                    >
                      {name && (
                        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-chalk-dim">
                          {name}
                        </p>
                      )}
                      <p className="font-display font-bold">{w.title}</p>
                      {w.detail && (
                        <p className="mt-1 text-body leading-relaxed text-chalk-dim">
                          {w.detail}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Reveal>
          )}

          <Reveal delay={200}>
            {changes.length > 0 ? (
              <>
                <h2
                  id="changes"
                  className="mb-3 scroll-mt-[calc(var(--clip-top)+var(--clip-lane)+1rem)] font-display text-sm font-bold uppercase tracking-wide"
                >
                  What to change
                </h2>
                <div className="space-y-3">
                  {changes.map((c, i) => {
                    const name = checkpointName(c.key);
                    return (
                      <div
                        key={i}
                        className={`rounded-card border-l-[3px] bg-navy-lighter p-4 ${
                          i === 0 ? "border-gold shadow-lift" : "border-line"
                        }`}
                      >
                        {/* One line carries both the rank and the checkpoint,
                            rather than stacking two labels above every card. */}
                        {(i === 0 || name) && (
                          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em]">
                            {i === 0 && <span className="text-gold-ink">Your #1 fix</span>}
                            {i === 0 && name && <span className="text-chalk-dim"> · </span>}
                            {name && <span className="text-chalk-dim">{name}</span>}
                          </p>
                        )}
                        <div className="flex items-start justify-between gap-3">
                          {/* Base size, matching the "what worked" titles
                              opposite. At text-lg a two-clause fix title ran
                              three lines on a 390px phone and read as the
                              loudest thing on the page; the gold edge, the
                              lift and the "Your #1 fix" label already carry
                              which one to do first, so the size was saying it
                              a fourth time. */}
                          <p className="font-display font-bold">{c.title}</p>
                          {/* Frame-path evidence: the points a named checkpoint
                              would rise. A video row has no scored checkpoints,
                              so it is omitted rather than shown as a guess
                              (D-097). `key` above is NOT this: it names the
                              checkpoint without promising a number. */}
                          {c.expected_gain != null && (
                            <span className="chip shrink-0 border-teal/40 text-teal-ink">
                              +{c.expected_gain} pts
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-body leading-relaxed text-chalk-dim">
                          {c.detail}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
                          {c.target_metric && (
                            <span className="chip">
                              {metricLabel(skill, c.target_metric)}
                            </span>
                          )}
                          <span>{difficultyLabel[c.difficulty] ?? c.difficulty}</span>
                          <span>·</span>
                          <span>{c.timeframe}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              // No changes at all is a row whose only stated fix is the one
              // derived from it, and both paths always carry that. Keeps its
              // own label rather than borrowing the column heading, because
              // "what to change" implies a list and this is one card.
              <div
                id="changes"
                className="scroll-mt-[calc(var(--clip-top)+var(--clip-lane)+1rem)] rounded-card border-l-[3px] border-gold bg-navy-lighter p-5 shadow-lift"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-gold-ink">
                  Priority fix
                </p>
                <p className="mt-1 font-display text-lg font-bold">
                  {result.priority_fix.title}
                </p>
                <p className="mt-1 text-body leading-relaxed text-chalk-dim">
                  {result.priority_fix.detail}
                </p>
              </div>
            )}
          </Reveal>
        </div>
      </div>

      {/* v2 only, and Advanced only. Every rep renders all five rows from the
          catalog whatever the clip showed, so at Basic this was a fixed five
          cards of teaching content between the fixes and the drills on every
          single rep. It is reference material, not tonight's change, so it
          moves rather than shrinks: a player who wants the five things a coach
          watches opens Advanced and finds all of them, unchanged. */}
      {checkpoints.length > 0 && (
        <Reveal delay={220} className={ADVANCED_ONLY}>
          <h2
            id="checkpoints"
            className="mt-6 mb-1 scroll-mt-[calc(var(--clip-top)+var(--clip-lane)+1rem)] font-display text-sm font-bold uppercase tracking-wide"
          >
            Checkpoints
          </h2>
          {/* Names the skill by way of the page heading rather than in this
              sentence: SKILL_LABEL is a gerund ("Serving", "Attacking"), so
              every article that would fit here reads wrong for some skill. */}
          {/* Says what the number is NOT, because that is the question this
              section actually gets asked: a player reads 87, counts five
              checkpoints, and assumes one is the total of the other. It is not.
              `overall_score` is a single judgement about the whole rep and
              nothing here feeds it (lib/ai/simple-rubric.ts). Scoring these
              rows to imply the sum is what ceiling-pegged the frame path at a
              median of 97 (D-094), so the ORDER is offered instead: D-099
              measured ordering as the reliable signal while absolute level was
              not. */}
          <p className="mb-3 text-sm text-chalk-dim">
            The five things a coach watches on this rep, strongest first. The
            notes above are labelled with the one they are about. Open any of
            them for what it is and what 90 looks like.
          </p>
          <p className="mb-3 text-sm text-chalk-dim">
            The score above is one judgement about the whole rep, not a total of
            these five. They are what was watched, in the order this rep did
            them best to worst.
          </p>
          <CheckpointList
            skill={skill}
            discipline={discipline}
            checkpoints={checkpoints}
            standing={standing}
            order={checkpointRank(skill, result)}
          />
        </Reveal>
      )}

      {/* v1 only, and Advanced only. These bars and their per-cue verdicts are
          the whole account of where a v1 score came from, so they are moved,
          never dropped: a v1 row that lost them would have nothing left
          explaining its number. */}
      {metrics.length > 0 && (
        <Reveal delay={240} className={ADVANCED_ONLY}>
          <h2 className="mt-6 mb-2 font-display text-sm font-bold uppercase tracking-wide">
            Metrics
          </h2>
          <div className="mb-3">
            <MetricLegend />
          </div>
          <div className="card space-y-4 p-5">
            {metrics.map((m, i) => (
              <MetricBar
                key={m.key}
                label={metricLabel(skill, m.key)}
                score={m.score}
                note={m.note}
                observed={m.observed !== false}
                weight={m.weight}
                pointers={m.pointers
                  ?.map((p) => ({
                    cue: pointerCue(skill, m.key, p.key),
                    status: p.status,
                  }))
                  .filter((p): p is { cue: string; status: string } => p.cue != null)}
                elite={metricKnowledge(skill, discipline, m.key)?.elite_marker}
                delay={i * 90}
              />
            ))}
          </div>
        </Reveal>
      )}

      {insights.length > 0 && (
        <Reveal delay={260} className={ADVANCED_ONLY}>
          <h2
            id="timeline"
            className="mt-6 mb-2 scroll-mt-[calc(var(--clip-top)+var(--clip-lane)+1rem)] font-display text-sm font-bold uppercase tracking-wide"
          >
            Timeline
          </h2>
          <ul className="space-y-1">
            {insights.map((ins, i) => (
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
      )}

      {/* v2 only. The read's own account of how sure it was, free-form, which
          is Advanced by definition: it qualifies the number rather than telling
          anyone what to do about it. */}
      {result.confidence && (
        <Reveal delay={280} className={ADVANCED_ONLY}>
          <p className="mt-6 text-sm leading-relaxed text-chalk-dim">
            <span className="font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
              Read confidence ·{" "}
            </span>
            {result.confidence}
          </p>
        </Reveal>
      )}

      {/* RECOMMENDED TRAINING CLOSES THE BREAKDOWN (D-116).
          The leading card here is the drill that used to open the analysis page
          under a "Start here" heading, above the clip and above the score. It
          kept its eyebrow, its equipment line and its primary button; what it
          gave up is the top of the page, because a player who has just filmed a
          rep has already started and wants the read before the homework.

          The model ranks `drill_slugs`, so the first slug that RESOLVES against
          the catalog is the drill for the priority fix. Resolving first and
          rendering second matters: a retired slug must not take the lead card
          and render an empty one (D-115), and it must not leave the section
          headed by nothing either. */}
      {drills.length > 0 && (
        <Reveal delay={300}>
          <h2
            id="drills"
            className="mt-6 mb-2 scroll-mt-[calc(var(--clip-top)+var(--clip-lane)+1rem)] font-display text-sm font-bold uppercase tracking-wide"
          >
            Recommended training
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {drills.map((drill, i) =>
              i === 0 ? (
                <Link
                  key={drill.slug}
                  href={`/drills/${drill.slug}`}
                  transitionTypes={["nav-forward"]}
                  className="card card-lift relative flex flex-wrap items-center justify-between gap-4 p-5 sm:col-span-2"
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-gold-ink">
                      Start here
                    </span>
                    <span className="mt-1 block font-display text-lg font-bold">
                      {drill.name}
                    </span>
                    <span className="mt-1 block max-w-prose text-body leading-relaxed text-chalk-dim">
                      {drill.summary}
                    </span>
                    <span className="mt-1.5 block font-mono text-[11px] uppercase text-chalk-dim">
                      {drill.duration_min} min · {drill.equipment.join(", ")}
                    </span>
                  </span>
                  {/* Not a nested <a>: the whole card is already the link, so
                      this is the button's look on a span. */}
                  <span className="btn-primary shrink-0 text-sm">
                    Open the drill
                  </span>
                  <LinkPending />
                </Link>
              ) : (
                <Link
                  key={drill.slug}
                  href={`/drills/${drill.slug}`}
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
              ),
            )}
          </div>
        </Reveal>
      )}
    </div>
  );
}
