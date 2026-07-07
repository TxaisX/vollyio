import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { metricLabel } from "@/lib/ai/metrics";
import { drillBySlug } from "@/content/drills";
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  return (
    <section className="max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-gold">
            {SKILL_LABEL[row.skill]}
          </p>
          <h1 className="font-display text-2xl font-bold">Breakdown</h1>
        </div>
        <span className="font-display text-3xl font-bold text-gold">{row.overall_score}</span>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {urls.map((url, i) => {
          const on = highlight.has(i);
          const t = timeByFrame.get(i);
          return (
            <div
              key={i}
              className={`relative w-24 shrink-0 overflow-hidden rounded-md border-2 ${
                on ? "border-gold" : "border-transparent"
              }`}
            >
              {url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={`Frame ${i + 1}`} className="block w-full object-cover" style={{ height: 72 }} />
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

      <p className="mt-5 text-sm leading-relaxed text-chalk-dim">{result.summary}</p>

      <h2 className="mt-8 mb-3 font-display text-sm font-bold">Metrics</h2>
      <div className="space-y-3">
        {result.metrics.map((m) => (
          <div key={m.key}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm">{metricLabel(row.skill, m.key)}</span>
              <span className="font-mono text-xs text-gold">{m.score}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-line">
              <div className="h-full rounded-full bg-gold" style={{ width: `${m.score}%` }} />
            </div>
            <p className="mt-1 text-xs text-chalk-dim">{m.note}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-3 font-display text-sm font-bold">Timeline</h2>
      <ul className="space-y-2">
        {result.insights.map((ins, i) => (
          <li key={i} className="flex gap-3 text-sm">
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

      <div className="mt-8 rounded-lg border-l-[3px] border-gold bg-navy-lighter p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-gold">Priority fix</p>
        <p className="mt-1 font-display font-bold">{result.priority_fix.title}</p>
        <p className="mt-1 text-sm text-chalk-dim">{result.priority_fix.detail}</p>
      </div>

      {result.drill_slugs.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 font-display text-sm font-bold">Drills for this</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {result.drill_slugs.map((slug) => {
              const drill = drillBySlug(slug);
              if (!drill) return null;
              return (
                <Link
                  key={slug}
                  href={`/drills/${slug}`}
                  className="rounded-lg border border-line bg-navy-light p-4 transition hover:border-gold/50"
                >
                  <div className="font-display font-bold">{drill.name}</div>
                  <div className="mt-1 text-xs text-chalk-dim">{drill.summary}</div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
