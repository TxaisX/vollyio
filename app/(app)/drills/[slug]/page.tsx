import type { Metadata } from "next";
import { ViewTransition } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DRILLS, drillBySlug } from "@/content/drills";
import { metricLabel } from "@/lib/ai/metrics";
import { Reveal } from "@/components/motion";
import { SkillIcon } from "@/components/skill-icons";
import { SKILL_LABEL } from "@/lib/skills";

export function generateStaticParams() {
  return DRILLS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const drill = drillBySlug(slug);
  if (!drill) {
    return { title: "Drill not found", robots: { index: false } };
  }
  return {
    title: drill.name,
    description: drill.summary,
    alternates: { canonical: `/drills/${slug}` },
    openGraph: { title: `${drill.name} · Vollyio`, description: drill.summary },
    robots: { index: true, follow: true },
  };
}

export default async function DrillDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const drill = drillBySlug(slug);
  if (!drill) notFound();

  // A drill IS a HowTo: a named outcome, a duration, equipment and ordered
  // steps. Saying so in the vocabulary search and answer engines already parse
  // is the difference between this page being a line in an index and being the
  // answer to "beach volleyball drills to do by yourself", which is a query
  // people actually type. Nothing is authored twice: every field reads the
  // same content module the page renders, so the markup cannot drift from the
  // visible text the way a hand-kept copy would.
  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: drill.name,
    description: drill.summary,
    // ISO 8601 duration; the catalog stores whole minutes.
    totalTime: `PT${drill.duration_min}M`,
    supply: drill.equipment.map((item) => ({ "@type": "HowToSupply", name: item })),
    step: drill.steps.map((text, i) => ({ "@type": "HowToStep", position: i + 1, text })),
    about: { "@type": "Thing", name: `${SKILL_LABEL[drill.skill]} (volleyball)` },
  };

  return (
    // Directional slide: arriving from the drills list (tagged nav-forward)
    // slides this content in from the right; the back link below (nav-back)
    // slides it out to the right on return. Untyped arrivals (a drill link
    // elsewhere) fall to default="none" and just swap. The app header and nav
    // are anchored in globals.css, so only this content moves. The drill title
    // inside carries its own morph name, so it lifts out of the slide and
    // travels from the card instead.
    <ViewTransition
      enter={{
        "nav-forward": "vt-nav-forward",
        "nav-back": "vt-nav-back",
        default: "none",
      }}
      exit={{
        "nav-forward": "vt-nav-forward",
        "nav-back": "vt-nav-back",
        default: "none",
      }}
      default="none"
    >
      <section className="max-w-4xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(howTo).replace(/</g, "\\u003c"),
        }}
      />
      <Reveal>
        <Link
          href="/drills"
          transitionTypes={["nav-back"]}
          className="inline-flex items-center gap-1 font-mono text-xs text-chalk-dim transition-colors hover:text-gold-ink"
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
          Drills
        </Link>
        <p className="mt-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-gold-ink">
          <SkillIcon skill={drill.skill} className="h-4 w-4" />
          {SKILL_LABEL[drill.skill]} · {drill.level}
        </p>
        <ViewTransition name={`drill-${slug}`} share="morph" default="none">
          <h1 className="mt-2 font-display text-page-title">
            {drill.name}
          </h1>
        </ViewTransition>
        <p className="mt-2 text-body text-chalk-dim">{drill.summary}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-line px-3 py-1 font-mono text-[11px] text-chalk-dim">
            {drill.duration_min} min
          </span>
          <span className="rounded-full border border-line px-3 py-1 font-mono text-[11px] text-chalk-dim">
            {drill.equipment.length ? drill.equipment.join(", ") : "No equipment"}
          </span>
        </div>
      </Reveal>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10">
        <Reveal delay={100}>
          <h2 className="mt-8 mb-4 font-display text-sm font-bold uppercase tracking-wide">
            Steps
          </h2>
          <ol className="space-y-4">
            {drill.steps.map((step, i) => (
              <li key={i} className="flex gap-4 text-sm">
                <span className="font-display text-2xl font-bold leading-none text-gold-ink/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="pt-1 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal delay={160}>
          <h2 className="mt-8 mb-3 font-display text-sm font-bold uppercase tracking-wide">
            Common mistakes
          </h2>
          <ul className="space-y-2">
            {drill.common_mistakes.map((m, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-coral" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      {drill.focus_metrics.length > 0 && (
        <Reveal delay={220}>
          <div className="card mt-8 p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-chalk-dim">
              Improves
            </p>
            <p className="mt-1 text-body">
              {drill.focus_metrics
                .map((k) => metricLabel(drill.skill, k))
                .join(" · ")}
            </p>
          </div>
        </Reveal>
      )}
      </section>
    </ViewTransition>
  );
}
