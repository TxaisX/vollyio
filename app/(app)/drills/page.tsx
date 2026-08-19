import type { Metadata } from "next";
import { ViewTransition } from "react";
import Link from "next/link";
import { drillsForSkill } from "@/content/drills";
import { LinkPending } from "@/components/link-pending";
import { Reveal } from "@/components/motion";
import { TrainNav } from "@/components/section-nav";
import { SkillIcon } from "@/components/skill-icons";
import { SKILLS, SKILL_LABEL } from "@/lib/skills";
import type { Level } from "@/lib/skills";

export const metadata: Metadata = {
  title: "Drills",
  description:
    "Step-by-step drills for every volleyball skill, beginner to pro.",
  alternates: { canonical: "/drills" },
  robots: { index: true, follow: true },
};

const LEVEL_ORDER: Record<Level, number> = {
  beginner: 0,
  intermediate: 1,
  expert: 2,
  pro: 3,
};

const LEVEL_CLASS: Record<Level, string> = {
  beginner: "bg-teal/15 text-teal-ink",
  intermediate: "bg-chalk/10 text-chalk",
  expert: "bg-gold/15 text-gold-ink",
  pro: "bg-gold text-deep",
};

export default function Drills() {
  return (
    <section className="max-w-5xl">
      {/* THE OPENING BAND (D-117), the same block the rest of the app opens
          with. Kicker, title, the one line of orientation copy, then the hub
          strip below a rule - which is exactly where the dashboard puts its
          discipline chips. */}
      <Reveal>
        <div className="hero-band card spot p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold-ink">
            Drills
          </p>
          <h1 className="mt-1.5 font-display text-page-title">The library</h1>
          <p className="mt-2 max-w-prose text-body text-chalk-dim">
            Step-by-step work for every skill, beginner to elite.
          </p>
          <div className="mt-4 border-t border-line pt-3.5">
            <TrainNav active="drills" />
          </div>
        </div>
      </Reveal>

      <div className="mt-6 space-y-6">
        {SKILLS.map((skill, si) => {
          const drills = [...drillsForSkill(skill)].sort(
            (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level],
          );
          if (drills.length === 0) return null;
          return (
            <Reveal key={skill} delay={Math.min(si, 2) * 70}>
              {/* A group label, not a headline. Six of these at text-lg bold
                  were shouting as loudly as the thirty drill names underneath
                  them, which is what made the page feel like it arrived all at
                  once.

                  This is now `.section-head` (D-117) rather than the
                  `font-display text-sm font-bold uppercase tracking-wide` it
                  used to retype: the same label the dashboard and the breakdown
                  put over their sections, so all six share one left edge with
                  every other section in the app. The skill icon stays beside
                  the bar, because on this page the label IS the skill and the
                  glyph is the fastest way to find the one you came for. */}
              <h2 className="section-head mb-2">
                <span className="text-gold-ink">
                  <SkillIcon skill={skill} className="h-4 w-4" />
                </span>
                {SKILL_LABEL[skill]}
              </h2>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {drills.map((d) => (
                  <Link
                    key={d.slug}
                    href={`/drills/${d.slug}`}
                    transitionTypes={["nav-forward"]}
                    className="card card-lift relative p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      {/* Morph source: the drill name travels into the detail
                          heading, so opening a card reads as the same drill
                          expanding, not a new page. */}
                      <ViewTransition
                        name={`drill-${d.slug}`}
                        share="morph"
                        default="none"
                      >
                        <span className="font-display text-sm font-bold">
                          {d.name}
                        </span>
                      </ViewTransition>
                      {/* Length sits beside the level instead of claiming its
                          own row. Thirty cards stack up on a phone and a whole
                          line per card was being spent on one number; both are
                          the same kind of fact about the drill, so they read
                          fine as one cluster. */}
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-[10px] text-chalk-dim">
                          {d.duration_min} min
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase ${LEVEL_CLASS[d.level]}`}
                        >
                          {d.level}
                        </span>
                      </span>
                    </div>
                    {/* Clamped, not cut. Two columns of cards each size to the
                        tallest in their row, so one four-line summary set the
                        height of the card beside it as well; the clamp puts a
                        ceiling on that without shortening a single drill's
                        text on the page it opens. */}
                    <p className="mt-1 line-clamp-2 text-xs text-chalk-dim">
                      {d.summary}
                    </p>
                    {/* /drills/[slug] has no loading.tsx (it is static), so a
                        cold navigation gets this pending hint. */}
                    <LinkPending />
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
