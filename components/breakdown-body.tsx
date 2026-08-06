import Link from "next/link";
import { metricLabel } from "@/lib/ai/metrics";
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
  isKnownCheckpoint,
  workedItems,
} from "@/components/breakdown-shape";
import type { AnalysisResult } from "@/lib/analysis-types";
import { type Skill } from "@/lib/skills";

// The written breakdown (summary, rep-by-rep, what worked beside what to
// change, the named checkpoints, metrics, timeline, drills), rendered
// identically for the owner's page and the public share page (D-049).
// linkDrills is off on the share page: /drills is auth-gated, so anonymous
// viewers get drill names instead of login redirects.
//
// SHAPE OF THE PAGE, and why it is this shape. The player asked for the old
// scorecard back but shorter: "putting the pros and cons next to each other
// just so that there's less moving or scrolling". Three things do that work
// here. The two verdict columns sit side by side once the column they live in
// is wide enough to carry them (a container query, not a viewport one, because
// this component renders inside a page that gives up to 30rem of its width to
// the clip and a viewport breakpoint would put two 220px columns on a laptop).
// The five checkpoints collapse their teaching content behind a native
// disclosure. And everything that explains HOW the read was reached moves
// behind the Basic / Advanced switch. On a phone the first two do most of the
// work, because nothing puts two columns of prose beside each other at 390px.
export function BreakdownBody({
  skill,
  result,
  linkDrills = true,
}: {
  skill: Skill;
  result: AnalysisResult;
  linkDrills?: boolean;
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
      <Reveal delay={140}>
        <p className="text-base leading-relaxed text-chalk-dim sm:text-lg">
          {result.summary}
        </p>
        <DetailSwitch />
      </Reveal>

      {repScores.length > 1 && (
        <Reveal delay={160}>
          <h2 className="mt-8 mb-3 font-display text-sm font-bold uppercase tracking-wide">
            Rep by rep
          </h2>
          {/* Basic keeps the numbers, which are the point of the section, and
              drops the per-rep note and the spread line, which are six lines of
              analysis of a thing the player can see at a glance. */}
          <div className={`card flex flex-wrap gap-2 p-4 ${BASIC_ONLY}`}>
            {repScores.map((r) => (
              <span key={r.rep_index} className="tag">
                Rep {r.rep_index + 1} · {r.overall}
              </span>
            ))}
          </div>
          <div className={`card space-y-3 p-5 ${ADVANCED_ONLY}`}>
            {repScores.map((r) => (
              <div key={r.rep_index} className="flex items-baseline gap-3">
                <span className="chip shrink-0">
                  Rep {r.rep_index + 1} · {r.overall}
                </span>
                <span className="min-w-0 text-xs text-chalk-dim">{r.note}</span>
              </div>
            ))}
            <p className="font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
              Spread:{" "}
              {Math.max(...repScores.map((r) => r.overall)) -
                Math.min(...repScores.map((r) => r.overall))}{" "}
              pts · tighter is better
            </p>
          </div>
        </Reveal>
      )}

      {/* THE TWO COLUMNS. @container rather than sm:/md:, because the width
          that decides whether two columns of prose are readable is this
          column's width, not the window's: on the analysis page the clip takes
          up to 30rem beside this, so a 1024px laptop leaves under 30rem here
          and `sm:grid-cols-2` would have split it into two unreadable strips.
          At @xl (36rem) each column still clears 16rem, which is where the fix
          titles stop wrapping every other word. */}
      <div className="@container mt-8">
        <div
          className={`grid items-start gap-4 ${sideBySide ? "@xl:grid-cols-2" : ""}`}
        >
          {worked.length > 0 && (
            <Reveal delay={180}>
              <h2
                id="strengths"
                className="mb-3 scroll-mt-24 font-display text-sm font-bold uppercase tracking-wide"
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
                  className="mb-3 scroll-mt-24 font-display text-sm font-bold uppercase tracking-wide"
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
                            {i === 0 && <span className="text-gold">Your #1 fix</span>}
                            {i === 0 && name && <span className="text-chalk-dim"> · </span>}
                            {name && <span className="text-chalk-dim">{name}</span>}
                          </p>
                        )}
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-display text-lg font-bold">{c.title}</p>
                          {/* Frame-path evidence: the points a named checkpoint
                              would rise. A video row has no scored checkpoints,
                              so it is omitted rather than shown as a guess
                              (D-097). `key` above is NOT this: it names the
                              checkpoint without promising a number. */}
                          {c.expected_gain != null && (
                            <span className="chip shrink-0 border-teal/40 text-teal">
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
                className="scroll-mt-24 rounded-card border-l-[3px] border-gold bg-navy-lighter p-5 shadow-lift"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-gold">
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

      {checkpoints.length > 0 && (
        <Reveal delay={220}>
          <h2
            id="checkpoints"
            className="mt-8 mb-1 scroll-mt-24 font-display text-sm font-bold uppercase tracking-wide"
          >
            Checkpoints
          </h2>
          {/* Names the skill by way of the page heading rather than in this
              sentence: SKILL_LABEL is a gerund ("Serving", "Attacking"), so
              every article that would fit here reads wrong for some skill. */}
          <p className="mb-3 text-sm text-chalk-dim">
            The five things a coach watches on this rep. The notes above are
            labelled with the one they are about. Open any of them for what it
            is and what 90 looks like.
          </p>
          <CheckpointList
            skill={skill}
            discipline={discipline}
            checkpoints={checkpoints}
            standing={standing}
          />
        </Reveal>
      )}

      {/* v1 only, and Advanced only. These bars and their per-cue verdicts are
          the whole account of where a v1 score came from, so they are moved,
          never dropped: a v1 row that lost them would have nothing left
          explaining its number. */}
      {metrics.length > 0 && (
        <Reveal delay={240} className={ADVANCED_ONLY}>
          <h2 className="mt-8 mb-2 font-display text-sm font-bold uppercase tracking-wide">
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
            className="mt-8 mb-3 scroll-mt-24 font-display text-sm font-bold uppercase tracking-wide"
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
          <p className="mt-8 text-sm leading-relaxed text-chalk-dim">
            <span className="font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
              Read confidence ·{" "}
            </span>
            {result.confidence}
          </p>
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
              if (!linkDrills) {
                return (
                  <div key={slug} className="card p-4">
                    <div className="font-display font-bold">{drill.name}</div>
                    <div className="mt-1 text-xs text-chalk-dim">{drill.summary}</div>
                    <div className="mt-2 font-mono text-[10px] uppercase text-chalk-dim">
                      {drill.duration_min} min · {drill.level}
                    </div>
                  </div>
                );
              }
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
    </div>
  );
}
