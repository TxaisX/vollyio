import Link from "next/link";
import { notFound } from "next/navigation";
import { DRILLS, drillBySlug } from "@/content/drills";
import { metricLabel } from "@/lib/ai/metrics";
import { SKILL_LABEL } from "@/lib/skills";

export function generateStaticParams() {
  return DRILLS.map((d) => ({ slug: d.slug }));
}

export default async function DrillDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const drill = drillBySlug(slug);
  if (!drill) notFound();

  return (
    <section className="max-w-xl">
      <Link href="/drills" className="font-mono text-xs text-chalk-dim hover:text-gold">
        ← Drills
      </Link>
      <p className="mt-3 font-mono text-xs uppercase tracking-[0.1em] text-gold">
        {SKILL_LABEL[drill.skill]} · {drill.level}
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold">{drill.name}</h1>
      <p className="mt-2 text-sm text-chalk-dim">{drill.summary}</p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-chalk-dim">
        <span>{drill.duration_min} min</span>
        <span>{drill.equipment.length ? drill.equipment.join(", ") : "No equipment"}</span>
      </div>

      <h2 className="mt-8 mb-3 font-display text-sm font-bold">Steps</h2>
      <ol className="space-y-2">
        {drill.steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="font-mono text-xs text-gold">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <h2 className="mt-8 mb-3 font-display text-sm font-bold">Common mistakes</h2>
      <ul className="space-y-2">
        {drill.common_mistakes.map((m, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-coral" />
            <span>{m}</span>
          </li>
        ))}
      </ul>

      {drill.focus_metrics.length > 0 && (
        <div className="mt-8 rounded-lg border border-line bg-navy-light p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-chalk-dim">
            Improves
          </p>
          <p className="mt-1 text-sm">
            {drill.focus_metrics.map((k) => metricLabel(drill.skill, k)).join(" · ")}
          </p>
        </div>
      )}
    </section>
  );
}
