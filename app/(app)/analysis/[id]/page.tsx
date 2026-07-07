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
import { SKILL_LABEL, type Skill } from "@/lib/skills";
import type { AnalysisResult } from "@/lib/analysis-types";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  skill: Skill;
  frame_paths: string[];
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
    .select("id, skill, frame_paths, overall_score, created_at, result")
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

  const timeByFrame = new Map<number, number | null>();
  for (const i of result.insights) timeByFrame.set(i.frame_index, i.time_s);
  timeByFrame.set(result.priority_fix.frame_index, result.priority_fix.time_s);
  const highlight = new Set(timeByFrame.keys());

  const dateLabel = new Date(row.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <section className="max-w-2xl">
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

      <Reveal delay={80}>
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {urls.map((url, i) => {
            const on = highlight.has(i);
            const t = timeByFrame.get(i);
            return (
              <div
                key={i}
                className={`relative w-24 shrink-0 overflow-hidden rounded-md border-2 transition-transform hover:scale-[1.03] ${
                  on ? "border-gold" : "border-transparent"
                }`}
              >
                {url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={`Frame ${i + 1}`}
                    className="block w-full object-cover"
                    style={{ height: 72 }}
                  />
                )}
                <span
                  className={`absolute left-1 top-1 rounded px-1.5 py-px font-mono text-[10px] ${
                    on ? "bg-gold text-navy" : "bg-navy/85 text-chalk"
                  }`}
                >
                  {t != null ? `${t}s` : i + 1}
                </span>
              </div>
            );
          })}
        </div>
      </Reveal>

      <Reveal delay={140}>
        <p className="mt-6 text-sm leading-relaxed text-chalk-dim">
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
    </section>
  );
}
