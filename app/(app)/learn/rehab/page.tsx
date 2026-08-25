import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { REHAB } from "@/content/rehab";
import { REGION_LABEL, TRIAGE_LABEL, type RehabEntry } from "@/content/rehab-types";
import { Reveal } from "@/components/motion";
import { TrainNav } from "@/components/section-nav";
import { LearnLibrary, type LibraryItem } from "@/components/learn-library";

export const metadata: Metadata = {
  title: "Volleyball Injuries & Recovery",
  description:
    "Volleyball injuries explained: jumper's knee, rolled ankles, shoulder pain and more. How the sport causes them, what recovery usually looks like, and the signs that mean stop and get seen. Education, not a diagnosis.",
  // Overrides the (app) group's noindex, same reason as /learn. This index and
  // its 39 entries are the pages app/sitemap.ts calls the highest-intent on the
  // site, and every one of them was serving noindex.
  robots: { index: true, follow: true },
  alternates: { canonical: "/learn/rehab" },
};

const TONE: Record<string, LibraryItem["tone"]> = {
  urgent: "urgent",
  get_assessed: "assess",
  self_manage: "self",
};

/**
 * INJURY AND RECOVERY, and nothing else.
 *
 * This library used to be the second tab of /learn, which meant a Technique
 * URL could be showing an injury list, and the page carried three chip rows
 * before any content. It is its own address now. The hub strip points here,
 * every entry's back link already said "Injury & recovery", and the
 * discipline switcher deliberately does NOT appear: a rolled ankle is a
 * rolled ankle on sand and indoors, so a filter that changed nothing would
 * only imply the content was cut for it.
 */
export default async function InjuryAndRecovery() {
  // The injury library lives in the table so it can be corrected without a
  // deploy (D-074). content/rehab.ts is the authored source and the seed
  // reconciles the two; if the read fails we fall back to the module rather
  // than showing an empty library, because this is public reference content
  // and an outage should not make it disappear.
  const supabase = await createClient();
  const { data } = await supabase
    .from("rehab_entries")
    .select("slug, name, also_called, region, triage, summary")
    .order("region");
  const rehabRows =
    (data as
      | Pick<RehabEntry, "slug" | "name" | "also_called" | "region" | "triage" | "summary">[]
      | null) ?? REHAB;

  const rehab: LibraryItem[] = rehabRows.map((e) => ({
    id: `rehab-${e.slug}`,
    title: e.name,
    subtitle: e.summary,
    meta: `${REGION_LABEL[e.region]} · ${TRIAGE_LABEL[e.triage]}`,
    href: `/learn/rehab/${e.slug}`,
    tone: TONE[e.triage],
    // also_called is the load-bearing part: nobody searches "patellar
    // tendinopathy", they search "jumper's knee".
    terms: [e.name, e.summary, REGION_LABEL[e.region], ...e.also_called].join(" ").toLowerCase(),
  }));

  return (
    <section className="max-w-5xl">
      <Reveal>
        <div className="hero-band card spot p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold-ink">
            Learn
          </p>
          <h1 className="mt-1.5 font-display text-page-title">
            Stay on the court 🩹
          </h1>
          <div className="mt-4 border-t border-line pt-3.5">
            <TrainNav active="recovery" />
          </div>
        </div>
      </Reveal>

      <Reveal delay={60}>
        <LearnLibrary
          items={rehab}
          label="injury & recovery"
          blurb="What common volleyball injuries are, how this sport causes them, what recovery usually looks like, and the signs that mean stop and get seen. Education, not a diagnosis."
          placeholder="Search injuries: jumper's knee, rolled ankle, sore shoulder…"
          emptyHint="Try where it hurts, like knee, shoulder or ankle, or what you call it, like jumper's knee."
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
