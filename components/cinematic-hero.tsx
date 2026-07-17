import Link from "next/link";
import { CourtFilm } from "@/components/court-film";
import { Reveal } from "@/components/motion";
import { SeamArcs } from "@/components/motif";

const READOUT = [
  { value: "Locked", label: "Hitter acquired", accent: true },
  { value: "Frame 12", label: "Contact point", accent: false },
  { value: "158°", label: "Elbow at contact", accent: false },
  { value: "82", label: "Spike score", accent: false },
] as const;

export function CinematicHero() {
  return (
    <section className="landing-hero cinematic-hero relative flex min-h-[100svh] items-end overflow-hidden md:items-center">
      <CourtFilm
        src="/sideout-hero-loop.mp4"
        srcWebm="/sideout-hero-loop.webm"
        poster="/sideout-hero-loop-poster.webp"
        className="absolute inset-0"
        autoPlay={false}
        controlCorner="right-4 top-24 md:bottom-[6.75rem] md:right-8 md:top-auto"
        objectPosition="72% 50%"
      />
      <div aria-hidden="true" className="hero-film-shade pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="cinematic-hero-aperture pointer-events-none absolute" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0">
          <SeamArcs opacity={0.08} />
        </div>
      </div>

      <div className="pointer-events-none relative z-10 mx-auto w-full max-w-6xl px-5 pb-40 pt-32 md:px-8 md:pb-32 md:pt-28">
        <div className="pointer-events-auto max-w-3xl">
          <Reveal immediate>
            <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-gold md:text-xs">
              <span aria-hidden="true" className="hero-live-mark" />
              Your film <span aria-hidden="true">·</span> your fix
              <span className="hidden sm:inline" aria-hidden="true">·</span>
              <span className="hidden sm:inline">your next level</span>
            </p>
          </Reveal>
          <h1 className="mt-5 max-w-3xl font-display text-[clamp(2.75rem,8vw,5.5rem)] font-bold leading-[0.96] tracking-[-0.045em] text-chalk">
            Fix the <span className="hero-title-focus">one thing</span>
            <span className="block">holding your game back.</span>
          </h1>
          <Reveal delay={160} immediate>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-chalk-dim md:text-lg">
              Record a rep. Get the exact frame, the score, and the one
              correction that buys the most across every volleyball skill.
            </p>
          </Reveal>
          <Reveal delay={240} immediate>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                id="hero-cta"
                href="/start"
                className="btn-primary min-h-12 text-base"
              >
                Analyze your first rep
              </Link>
              <a href="#film" className="btn-ghost min-h-12 text-base">
                Enter the film room
              </a>
            </div>
          </Reveal>
        </div>
      </div>

      <div aria-hidden="true" className="hero-analysis-rail">
        <div className="hero-analysis-rail-inner">
          {READOUT.map((item, index) => (
            <div key={item.label} className="hero-analysis-cell">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-chalk-dim">
                0{index + 1}
              </span>
              <span className={`hero-analysis-value ${item.accent ? "text-teal" : "text-chalk"}`}>
                {item.value}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-chalk-dim">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
