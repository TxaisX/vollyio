import type { Metadata } from "next";
import Link from "next/link";
import { scoreBand } from "@/lib/ratings";
import { ScoreRing } from "@/components/score-ring";
import { SkillIcon } from "@/components/skill-icons";
import { Reveal } from "@/components/motion";

export const metadata: Metadata = {
  title: "Sample breakdowns",
  description:
    "Three real, unedited Vollyio breakdowns: browse the full checklist, scores, and priority fixes before you sign up.",
  alternates: { canonical: "/samples" },
  robots: { index: true, follow: true },
};

// Real analyses shared through the same revocable share links players mint,
// with the expiry pushed out so the samples do not rot (D-080). Deliberately
// static content: the share page does the rendering, this page only has to be
// an honest storefront. The score spread is the point. All three are real
// reps with a full checklist read, not showcase footage: a stranger should
// see what a middling number looks like before spending a signup.
const SAMPLES = [
  {
    skill: "pass" as const,
    label: "Passing",
    score: 87,
    href: "/share/P1MGu6JNAU6HdCp38XCFjkufe2meRRKUFKVQqqLmAhk",
    note: "A clean platform with one late shuffle. Shows what met cues look like, and the one that still cost points.",
  },
  {
    skill: "set" as const,
    label: "Setting",
    score: 77,
    href: "/share/xd7_CYo_Mi99GQ4js4zuVUzLr2ztxo3lVbJIdCdf99g",
    note: "Solid hands, drifting footwork. The checklist shows exactly which checkpoint drags the number down.",
  },
  {
    skill: "attack" as const,
    label: "Attacking",
    score: 63,
    href: "/share/-SIKP_V_TUk6dXC597-d7FjoG6k4agGyV_FMVOJt24I",
    note: "A rep with real faults, read bluntly. This is what honest feedback looks like when the mechanics aren't there yet.",
  },
];

export default function SamplesPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between border-b border-line pb-5">
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-wide text-gold-ink"
        >
          Vollyio
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
          Sample breakdowns
        </span>
      </div>

      <Reveal>
        <h1 className="mt-10 max-w-[24ch] text-balance font-display text-page-title">
          See exactly what you get, before you sign up.
        </h1>
        <p className="mt-3 max-w-prose text-body leading-relaxed text-chalk-dim">
          Three real breakdowns, unedited. Each one scores the rep and says
          what was seen at each of the five checkpoints a coach watches, so you
          can play the clip back against it and disagree. One of these reps
          scored 63, because the product tells the truth, and that is the part
          worth checking. These three were read by an earlier version of the
          engine, so they show a per-checkpoint checklist your own breakdowns
          will not.
        </p>
      </Reveal>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {SAMPLES.map((s, i) => (
          <Reveal key={s.skill} delay={i * 80}>
            <Link href={s.href} className="card card-lift group flex h-full flex-col p-5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-display text-sm font-bold">
                  <span className="text-chalk-dim transition-colors group-hover:text-gold-ink">
                    <SkillIcon skill={s.skill} className="h-4.5 w-4.5" />
                  </span>
                  {s.label}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold-ink">
                  {scoreBand(s.score)}
                </span>
              </div>
              <div className="mt-4 flex justify-center">
                <ScoreRing score={s.score} size={84} label={s.label} />
              </div>
              <p className="mt-4 grow text-sm leading-relaxed text-chalk-dim">{s.note}</p>
              <span className="mt-4 font-mono text-[11px] uppercase tracking-[0.08em] text-gold-ink">
                Open the full breakdown
              </span>
            </Link>
          </Reveal>
        ))}
      </div>

      <Reveal delay={240}>
        <div className="card spot mt-10 flex flex-wrap items-center justify-between gap-4 p-6">
          <p className="max-w-prose text-body text-chalk-dim">
            Ready to see your own? Film one rep and get it scored the same
            way.
          </p>
          <Link href="/signup" className="btn-primary min-h-11 px-5 py-2.5 text-sm">
            Analyze my rep
          </Link>
        </div>
      </Reveal>
    </main>
  );
}
