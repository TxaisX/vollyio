import type { Metadata } from "next";
import { ViewTransition } from "react";
import Link from "next/link";
import { techniqueFor } from "@/content/technique";
import { Reveal } from "@/components/motion";
import { SkillIcon } from "@/components/skill-icons";
import {
  SKILLS,
  SKILL_LABEL,
  ANALYZE_DISCIPLINES,
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
    <section className="max-w-5xl">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
          Learn
        </p>
        <h1 className="mt-2 font-display text-page-title">
          What good looks like
        </h1>
        <p className="mt-2 text-body text-chalk-dim">
          The whole game, broken down: the cues, the phases, and how the score
          reads each skill.
        </p>
        <div className="mt-5 flex items-center gap-2">
          {ANALYZE_DISCIPLINES.map((d) => (
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

      <ViewTransition
        key={discipline}
        name="learn-grid"
        share="auto"
        default="none"
      >
        <div className="mt-8 grid items-stretch gap-3 sm:grid-cols-2">
          {SKILLS.map((skill, si) => {
            const t = techniqueFor(skill, discipline);
            return (
              <Reveal
                key={skill}
                delay={Math.min(si, 3) * 60}
                className="h-full"
              >
                <Link
                  href={`/learn/${skill}${q}`}
                  transitionTypes={["nav-forward"]}
                  className="learn-card card card-lift spot group relative block h-full min-h-44 p-5"
                >
                  <div className="flex items-center gap-2 pr-8">
                    <span className="learn-card-icon text-gold">
                      <SkillIcon skill={skill} className="h-5 w-5" />
                    </span>
                    <ViewTransition
                      name={`learn-${skill}`}
                      share="morph"
                      default="none"
                    >
                      <span className="font-display text-lg font-bold">
                        {SKILL_LABEL[skill]}
                      </span>
                    </ViewTransition>
                  </div>
                  <p className="mt-2 text-body leading-relaxed text-chalk-dim">
                    {t.overview}
                  </p>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="learn-card-arrow absolute right-4 top-5 h-5 w-5 text-gold"
                    aria-hidden
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </ViewTransition>
    </section>
  );
}
