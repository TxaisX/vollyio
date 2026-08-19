import type { Metadata } from "next";
import Link from "next/link";
import { techniqueFor } from "@/content/technique";
import { DRILLS } from "@/content/drills";
import { metricLabel, metricKeys } from "@/lib/ai/metrics";
import { Reveal } from "@/components/motion";
import { TrainNav } from "@/components/section-nav";
import { LearnLibrary, type LibraryItem } from "@/components/learn-library";
import {
  SKILLS,
  SKILL_LABEL,
  ANALYZE_DISCIPLINES,
  DISCIPLINE_LABEL,
  disciplineGroup,
  isDiscipline,
  type Discipline,
} from "@/lib/skills";

export const metadata: Metadata = {
  title: "Volleyball Technique",
  description:
    "What good volleyball technique looks like for every skill: serve, pass, set, attack, block and dig. Cut for the surface you play on, indoor or grass and sand.",
  alternates: { canonical: "/learn" },
};

/**
 * TECHNIQUE. Only technique.
 *
 * This page used to carry the injury library too, behind a tab row that
 * repeated the two links already sitting in the hub strip above it. That made
 * three rows of chips before any content, and let the page contradict its own
 * URL: /learn with the Injury tab selected is a Technique address showing an
 * injury library. Injury and recovery now has its own page at /learn/rehab,
 * which is also where the hub strip points.
 *
 * The discipline switcher stays, because it is the one control here that
 * changes what the content SAYS rather than which content is shown: the same
 * skill is coached differently on sand than indoors, and the scoring already
 * splits on exactly this axis.
 */
export default async function Learn({
  searchParams,
}: {
  searchParams: Promise<{ discipline?: string }>;
}) {
  const { discipline: raw } = await searchParams;
  const discipline: Discipline = isDiscipline(raw ?? "") ? (raw as Discipline) : "indoor";
  const q = discipline === "indoor" ? "" : `?discipline=${discipline}`;
  // Grass and sand are one group to the scoring and one group to the drills.
  const surface = disciplineGroup(discipline) === "indoor" ? "indoor" : "outdoor";

  // The library flattens to one shape so the search box can serve it. The
  // `terms` haystack is built here, once per request, rather than on every
  // keystroke in the browser.
  const technique: LibraryItem[] = [
    ...SKILLS.map((skill) => {
      const t = techniqueFor(skill, discipline);
      const checkpoints = metricKeys(skill).map((k) => metricLabel(skill, k));
      return {
        id: `skill-${skill}`,
        title: SKILL_LABEL[skill],
        subtitle: t.overview,
        meta: `Skill · ${checkpoints.length} checkpoints`,
        href: `/learn/${skill}${q}`,
        terms: [SKILL_LABEL[skill], skill, t.overview, ...checkpoints]
          .join(" ")
          .toLowerCase(),
      };
    }),
    // Drills are cut to the surface too, not just the technique prose. Most
    // of the catalog carries no surface and appears for everyone; the sand
    // and grass entries teach mechanics that would actively mislead an indoor
    // player (a two-step approach, a shuffle that never crosses), so showing
    // them under Indoor was the filter quietly lying about what it filtered.
    ...DRILLS.filter((d) => !d.surface || d.surface === surface).map((d) => ({
      id: `drill-${d.slug}`,
      title: d.name,
      subtitle: d.summary,
      meta: `${SKILL_LABEL[d.skill]} drill · ${d.duration_min} min · ${d.level}`,
      href: `/drills/${d.slug}`,
      terms: [
        d.name,
        d.summary,
        SKILL_LABEL[d.skill],
        d.skill,
        d.level,
        ...d.equipment,
        ...d.focus_metrics.map((m) => metricLabel(d.skill, m)),
      ]
        .join(" ")
        .toLowerCase(),
    })),
  ];

  return (
    <section className="max-w-5xl">
      <Reveal>
        <div className="hero-band card spot p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold-ink">
            Learn
          </p>
          <h1 className="mt-1.5 font-display text-page-title">
            What good looks like 🏐
          </h1>
          <div className="mt-4 border-t border-line pt-3.5">
            <TrainNav active="technique" />
            <div className="mt-3 flex items-center gap-2">
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
          </div>
        </div>
      </Reveal>

      <Reveal delay={60}>
        <LearnLibrary
          items={technique}
          label="technique"
          blurb="What good looks like for every skill, and the drills that get you there. Start with the skill you want to fix."
          placeholder="Search technique: a skill, a checkpoint, a drill…"
          emptyHint="Try a skill name, a checkpoint like toss or platform, or the name of a drill."
        />
      </Reveal>
    </section>
  );
}
