import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { techniqueFor } from "@/content/technique";
import { DRILLS } from "@/content/drills";
import { REHAB } from "@/content/rehab";
import { REGION_LABEL, TRIAGE_LABEL, type RehabEntry } from "@/content/rehab-types";
import { metricLabel, metricKeys } from "@/lib/ai/metrics";
import { Reveal } from "@/components/motion";
import { LearnLibrary, type LibraryItem } from "@/components/learn-library";
import {
  SKILLS,
  SKILL_LABEL,
  ANALYZE_DISCIPLINES,
  DISCIPLINE_LABEL,
  isDiscipline,
  type Discipline,
} from "@/lib/skills";

export const metadata: Metadata = {
  title: "Learn",
  description:
    "Two libraries: what good technique looks like for every skill, and what volleyball's common injuries are, how the sport causes them, and what recovery looks like.",
};

const TONE: Record<string, LibraryItem["tone"]> = {
  urgent: "urgent",
  get_assessed: "assess",
  self_manage: "self",
};

export default async function Learn({
  searchParams,
}: {
  searchParams: Promise<{ discipline?: string; tab?: string }>;
}) {
  const { discipline: raw, tab } = await searchParams;
  const discipline: Discipline = isDiscipline(raw ?? "")
    ? (raw as Discipline)
    : "indoor";
  const q = discipline === "indoor" ? "" : `?discipline=${discipline}`;

  // The injury library lives in the table so it can be corrected without a
  // deploy (D-074). content/rehab.ts is the authored source and the seed
  // reconciles the two; if the read fails we fall back to the module rather
  // than showing an empty library, because this is public reference content and
  // an outage should not make it disappear.
  const supabase = await createClient();
  const { data } = await supabase
    .from("rehab_entries")
    .select("slug, name, also_called, region, triage, summary")
    .order("region");
  const rehabRows =
    (data as Pick<
      RehabEntry,
      "slug" | "name" | "also_called" | "region" | "triage" | "summary"
    >[] | null) ?? REHAB;

  // Both libraries flatten to one shape so a single search box can serve them.
  // The `terms` haystack is built here, once per request, rather than on every
  // keystroke in the browser.
  const training: LibraryItem[] = [
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
    ...DRILLS.map((d) => ({
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

  const rehab: LibraryItem[] = rehabRows.map((e) => ({
    id: `rehab-${e.slug}`,
    title: e.name,
    subtitle: e.summary,
    meta: `${REGION_LABEL[e.region]} · ${TRIAGE_LABEL[e.triage]}`,
    href: `/learn/rehab/${e.slug}`,
    tone: TONE[e.triage],
    // also_called is the load-bearing part: nobody searches "patellar
    // tendinopathy", they search "jumper's knee".
    terms: [e.name, e.summary, REGION_LABEL[e.region], ...e.also_called]
      .join(" ")
      .toLowerCase(),
  }));

  return (
    <section className="max-w-5xl">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
          Learn
        </p>
        <h1 className="mt-2 font-display text-page-title">
          Get better, and stay on the court
        </h1>
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

      <Reveal delay={60}>
        <LearnLibrary
          training={training}
          rehab={rehab}
          initialTab={tab === "rehab" ? "rehab" : "training"}
        />
      </Reveal>

      <Reveal delay={140}>
        <p className="mt-8 max-w-prose border-t border-line pt-5 text-xs leading-relaxed text-chalk-dim">
          The injury library is general education about how volleyball hurts
          people and what recovery usually looks like. It is not a diagnosis and
          it is not treatment. Vollyio cannot examine you, and two injuries that
          feel identical are often not. If something is not settling, or any of
          the warning signs on an entry apply to you, see a clinician.
        </p>
      </Reveal>
    </section>
  );
}
