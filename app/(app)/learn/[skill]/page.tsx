import Link from "next/link";
import { notFound } from "next/navigation";
import { techniqueFor, drillsForMetric } from "@/content/technique";
import { METRICS, metricLabel } from "@/lib/ai/metrics";
import { Reveal } from "@/components/motion";
import { SkillIcon } from "@/components/skill-icons";
import {
  SKILLS,
  SKILL_LABEL,
  DISCIPLINES,
  DISCIPLINE_LABEL,
  isSkill,
  isDiscipline,
  type Skill,
  type Discipline,
} from "@/lib/skills";

export function generateStaticParams() {
  return SKILLS.map((skill) => ({ skill }));
}

const ANCHOR_BANDS = [
  ["Developing", "developing"],
  ["Solid", "solid"],
  ["Advanced", "advanced"],
] as const;

export default async function LearnSkill({
  params,
  searchParams,
}: {
  params: Promise<{ skill: string }>;
  searchParams: Promise<{ discipline?: string }>;
}) {
  const { skill: rawSkill } = await params;
  if (!isSkill(rawSkill)) notFound();
  const skill: Skill = rawSkill;

  const { discipline: rawD } = await searchParams;
  const discipline: Discipline = isDiscipline(rawD ?? "")
    ? (rawD as Discipline)
    : "indoor";
  const q = discipline === "indoor" ? "" : `?discipline=${discipline}`;

  const t = techniqueFor(skill, discipline);

  return (
    <section className="max-w-2xl">
      <Reveal>
        <Link
          href={`/learn${q}`}
          className="inline-flex items-center gap-1 font-mono text-xs text-chalk-dim transition-colors hover:text-gold"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Learn
        </Link>
        <p className="mt-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-gold">
          <SkillIcon skill={skill} className="h-4 w-4" />
          {SKILL_LABEL[skill]}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          What makes a good {skill}
        </h1>
        <p className="mt-3 leading-relaxed text-chalk-dim">{t.overview}</p>

        <div className="mt-5 flex items-center gap-2">
          {DISCIPLINES.map((d) => (
            <Link
              key={d}
              href={`/learn/${skill}${d === "indoor" ? "" : `?discipline=${d}`}`}
              aria-current={discipline === d ? "page" : undefined}
              className={`chip ${discipline === d ? "chip-active" : ""}`}
            >
              {DISCIPLINE_LABEL[d]}
            </Link>
          ))}
        </div>
      </Reveal>

      <Reveal delay={80}>
        <div className="card mt-6 border-l-2 border-teal p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-teal">
            Highest leverage · {metricLabel(skill, t.highest_leverage_metric)}
          </p>
          <p className="mt-1 text-sm leading-relaxed">{t.highest_leverage_note}</p>
        </div>
      </Reveal>

      <Reveal delay={140}>
        <h2 className="mt-8 mb-4 font-display text-sm font-bold uppercase tracking-wide">
          The phases
        </h2>
        <ol className="space-y-4">
          {t.phases.map((p, i) => (
            <li key={p.name} className="flex gap-4 text-sm">
              <span className="font-display text-2xl font-bold leading-none text-gold/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="pt-1 leading-relaxed">
                <span className="font-bold text-chalk">{p.name}.</span>{" "}
                <span className="text-chalk-dim">{p.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal delay={200}>
        <h2 className="mt-8 mb-4 font-display text-sm font-bold uppercase tracking-wide">
          The five metrics
        </h2>
        <div className="space-y-4">
          {METRICS[skill].map((m) => {
            const k = t.metrics[m.key];
            const drills = drillsForMetric(skill, m.key);
            return (
              <div key={m.key} className="card p-5">
                <h3 className="font-display text-lg font-bold">{m.label}</h3>
                <p className="mt-1 text-sm text-chalk-dim">
                  {k.what} {k.why}
                </p>

                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-teal">
                  Elite marker
                </p>
                <p className="mt-1 text-sm leading-relaxed">{k.elite_marker}</p>
                {k.exemplars && k.exemplars.length > 0 && (
                  <p className="mt-1 font-mono text-[11px] text-chalk-dim">
                    Watch: {k.exemplars.join(", ")}
                  </p>
                )}

                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-coral">
                  Common faults
                </p>
                <ul className="mt-1 space-y-1">
                  {k.common_faults.map((f, i) => (
                    <li key={i} className="flex gap-2 text-sm text-chalk-dim">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 grid gap-2">
                  {ANCHOR_BANDS.map(([label, band]) => (
                    <div key={band} className="rounded-md border border-line p-3">
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-chalk-dim">
                        {label}
                      </span>
                      <p className="mt-0.5 text-sm leading-relaxed">
                        {k.anchors[band]}
                      </p>
                    </div>
                  ))}
                </div>

                {drills.length > 0 && (
                  <div className="mt-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-chalk-dim">
                      Drills that fix this
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {drills.map((d) => (
                        <Link key={d.slug} href={`/drills/${d.slug}`} className="chip">
                          {d.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Reveal>
    </section>
  );
}
