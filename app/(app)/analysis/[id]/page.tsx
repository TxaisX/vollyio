import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { metricLabel } from "@/lib/ai/metrics";
import { drillBySlug } from "@/content/drills";
import { MetricBar } from "@/components/metric-bar";
import { Reveal } from "@/components/motion";
import { ScoreRing } from "@/components/score-ring";
import { ShareCard } from "@/components/share-card";
import { XpToast } from "@/components/xp-toast";
import { ClipViewer } from "@/components/clip-viewer";
import { SKILL_LABEL, type Skill } from "@/lib/skills";
import type { AnalysisResult } from "@/lib/analysis-types";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  skill: Skill;
  frame_paths: string[];
  clip_path: string | null;
  overall_score: number;
  created_at: string;
  result: AnalysisResult;
};

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("analyses")
    .select("id, skill, frame_paths, clip_path, overall_score, created_at, result")
    .eq("id", id)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!data) notFound();
  const row = data as Row;
  const result = row.result;

  const { data: signed } = await supabase.storage
    .from("frames")
    .createSignedUrls(row.frame_paths, 3600);
  const urls = signed?.map((s) => s.signedUrl) ?? [];

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
    time_s: timeByFrame.get(i) ?? null,
    highlighted: highlight.has(i),
  }));

  const ball = new Map<number, { x: number; y: number; visible: boolean }>();
  for (const b of result.ball_track ?? [])
    ball.set(b.frame_index, { x: b.x, y: b.y, visible: b.visible });

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

  return (
    <section className="max-w-6xl">
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
          </div>
          <div className="flex items-center gap-4">
            <ShareCard
              skillLabel={SKILL_LABEL[row.skill]}
              score={row.overall_score}
              fixTitle={result.priority_fix.title}
              date={dateLabel}
            />
            <ScoreRing score={row.overall_score} size={84} />
          </div>
        </div>
      </Reveal>

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-start lg:gap-8">
        {/* Player — right column on desktop, first thing on mobile */}
        <div className="lg:order-2 lg:sticky lg:top-8">
          <Reveal delay={80}>
            <ClipViewer
              clipUrl={clipUrl}
              frames={playerFrames}
              ball={ball}
              focusIndex={focusIndex}
              contactIndex={contactIndex}
            />
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

        {/* Breakdown — left column on desktop */}
        <div className="mt-8 min-w-0 lg:order-1 lg:mt-0">
          <Reveal delay={140}>
            <p className="text-sm leading-relaxed text-chalk-dim">
              {result.summary}
            </p>
          </Reveal>

          <Reveal delay={180}>
            <h2 className="mt-8 mb-3 font-display text-sm font-bold uppercase tracking-wide">
              Metrics
            </h2>
            <div className="card space-y-4 p-5">
              {result.metrics.map((m, i) => (
                <MetricBar
                  key={m.key}
                  label={metricLabel(row.skill, m.key)}
                  score={m.score}
                  note={m.note}
                  delay={i * 90}
                />
              ))}
            </div>
          </Reveal>

          <Reveal delay={220}>
            <h2 className="mt-8 mb-3 font-display text-sm font-bold uppercase tracking-wide">
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
              <h2 className="mt-8 mb-3 font-display text-sm font-bold uppercase tracking-wide">
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
              <h2 className="mt-8 mb-3 font-display text-sm font-bold uppercase tracking-wide">
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
                      className="card card-lift p-4"
                    >
                      <div className="font-display font-bold">{drill.name}</div>
                      <div className="mt-1 text-xs text-chalk-dim">{drill.summary}</div>
                      <div className="mt-2 font-mono text-[10px] uppercase text-chalk-dim">
                        {drill.duration_min} min · {drill.level}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
