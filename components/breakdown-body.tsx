import Link from "next/link";
import { metricLabel } from "@/lib/ai/metrics";
import { pointerCue } from "@/lib/ai/pointers";
import { metricKnowledge } from "@/content/technique";
import { drillBySlug } from "@/content/drills";
import { MetricBar } from "@/components/metric-bar";
import { MetricLegend } from "@/components/metric-legend";
import { Reveal } from "@/components/motion";
import { LinkPending } from "@/components/link-pending";
import type { AnalysisResult } from "@/lib/analysis-types";
import { type Skill } from "@/lib/skills";

// The written breakdown (summary, rep-by-rep, metrics, timeline, fixes,
// drills), rendered identically for the owner's page and the public share
// page (D-049). linkDrills is off on the share page: /drills is auth-gated,
// so anonymous viewers get drill names instead of login redirects.
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
  const difficultyLabel: Record<string, string> = {
    quick: "Quick win",
    moderate: "Moderate",
    "long-term": "Long-term",
  };

  return (
    <>
      <Reveal delay={140}>
        <p className="text-base leading-relaxed text-chalk-dim sm:text-lg">
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
              elite={
                metricKnowledge(
                  skill,
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
                  <span className="chip">{metricLabel(skill, c.target_metric)}</span>
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
    </>
  );
}
