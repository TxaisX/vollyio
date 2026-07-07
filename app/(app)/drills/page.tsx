import Link from "next/link";
import { drillsForSkill } from "@/content/drills";
import { Reveal } from "@/components/motion";
import { SkillIcon } from "@/components/skill-icons";
import { SKILLS, SKILL_LABEL } from "@/lib/skills";
import type { Level } from "@/lib/skills";

const LEVEL_ORDER: Record<Level, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  elite: 3,
};

const LEVEL_CLASS: Record<Level, string> = {
  beginner: "bg-teal/15 text-teal",
  intermediate: "bg-chalk/10 text-chalk",
  advanced: "bg-gold/15 text-gold",
  elite: "bg-gold text-navy",
};

export default function Drills() {
  return (
    <section className="max-w-3xl">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
          Drills
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          The library
        </h1>
        <p className="mt-2 text-sm text-chalk-dim">
          Step-by-step work for every skill, beginner to elite.
        </p>
      </Reveal>

      <div className="mt-8 space-y-10">
        {SKILLS.map((skill, si) => {
          const drills = [...drillsForSkill(skill)].sort(
            (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level],
          );
          if (drills.length === 0) return null;
          return (
            <Reveal key={skill} delay={Math.min(si, 2) * 70}>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                <span className="text-gold">
                  <SkillIcon skill={skill} className="h-5 w-5" />
                </span>
                {SKILL_LABEL[skill]}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {drills.map((d) => (
                  <Link
                    key={d.slug}
                    href={`/drills/${d.slug}`}
                    className="card card-lift p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display font-bold">{d.name}</span>
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 font-mono text-[10px] uppercase ${LEVEL_CLASS[d.level]}`}
                      >
                        {d.level}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-chalk-dim">{d.summary}</p>
                    <p className="mt-2 font-mono text-[10px] text-chalk-dim">
                      {d.duration_min} min
                    </p>
                  </Link>
                ))}
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
