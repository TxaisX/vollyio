import type { Metadata } from "next";
import Link from "next/link";
import { techniqueFor } from "@/content/technique";
import { Reveal } from "@/components/motion";
import { SkillIcon } from "@/components/skill-icons";
import {
  SKILLS,
  SKILL_LABEL,
  DISCIPLINES,
  DISCIPLINE_LABEL,
  isDiscipline,
  type Discipline,
} from "@/lib/skills";

export const metadata: Metadata = {
  title: "Learn",
  description:
    "See what good looks like for every skill: the cues, the phases, and what each score rewards.",
};

export default async function Learn({
  searchParams,
}: {
  searchParams: Promise<{ discipline?: string }>;
}) {
  const { discipline: raw } = await searchParams;
  const discipline: Discipline = isDiscipline(raw ?? "")
    ? (raw as Discipline)
    : "indoor";
  const q = discipline === "indoor" ? "" : `?discipline=${discipline}`;

  return (
    <section className="max-w-3xl">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
          Learn
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          What good looks like
        </h1>
        <p className="mt-2 text-sm text-chalk-dim">
          The whole game, broken down: the cues, the phases, and how the score
          reads each skill.
        </p>
        <div className="mt-5 flex items-center gap-2">
          {DISCIPLINES.map((d) => (
            <Link
              key={d}
              href={d === "indoor" ? "/learn" : `/learn?discipline=${d}`}
              aria-current={discipline === d ? "page" : undefined}
              className={`chip min-h-11 ${discipline === d ? "chip-active" : ""}`}
            >
              {DISCIPLINE_LABEL[d]}
            </Link>
          ))}
        </div>
      </Reveal>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {SKILLS.map((skill, si) => {
          const t = techniqueFor(skill, discipline);
          return (
            <Reveal key={skill} delay={Math.min(si, 3) * 60}>
              <Link href={`/learn/${skill}${q}`} className="card card-lift h-full p-5">
                <div className="flex items-center gap-2">
                  <span className="text-gold">
                    <SkillIcon skill={skill} className="h-5 w-5" />
                  </span>
                  <span className="font-display text-lg font-bold">
                    {SKILL_LABEL[skill]}
                  </span>
                </div>
                <p className="mt-2 text-sm text-chalk-dim">{t.overview}</p>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
