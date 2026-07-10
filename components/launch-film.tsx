"use client";

import Image from "next/image";
import Link from "next/link";
import { useReducedMotion } from "@/components/motion";

function MiniBars() {
  return (
    <div className="space-y-3">
      {[
        ["Toss path", 84],
        ["Contact height", 86],
        ["Arm speed", 79],
      ].map(([label, score], index) => (
        <div key={label as string}>
          <div className="flex justify-between font-mono text-xs uppercase tracking-[0.12em] text-chalk-dim">
            <span>{label}</span>
            <span className="text-chalk">{score}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line/60">
            <div
              className="launch-bar h-full origin-left rounded-full bg-gold"
              style={{ width: `${score}%`, animationDelay: `${7.9 + index * 0.18}s` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LaunchFilm({ capture = false }: { capture?: boolean }) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return (
      <main className="launch-canvas launch-final-frame">
        <div className="relative z-10 text-center">
          <p className="font-mono text-sm uppercase tracking-[0.28em] text-gold">
            Your film · your fix · your next level
          </p>
          <h1 className="mt-5 font-display text-8xl font-bold tracking-tight">Sideout</h1>
          <p className="mx-auto mt-5 max-w-2xl font-display text-4xl font-bold leading-tight">
            See what changed. Know what to do next.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="launch-canvas" aria-label="Sideout launch film">
      <Image
        src="/volleyball-hero.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="launch-photo object-cover"
      />
      <div className="launch-shade absolute inset-0" />
      <div className="launch-court-line absolute inset-x-0 top-[72%] h-px bg-gold/40" />

      <section className="launch-scene launch-scene-one" aria-label="Every rep is data">
        <p className="font-mono text-sm uppercase tracking-[0.28em] text-gold">Every rep leaves a signal</p>
        <h1 className="mt-5 max-w-4xl font-display text-7xl font-bold leading-[0.98] tracking-tight">
          Your game is already telling you what comes next.
        </h1>
      </section>

      <section className="launch-scene launch-scene-two" aria-label="Film becomes analysis">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.28em] text-gold">Film becomes evidence</p>
          <h2 className="mt-4 max-w-xl font-display text-6xl font-bold leading-none">
            See the moment everything changes.
          </h2>
        </div>
        <div className="launch-analysis-card">
          <div className="flex items-end justify-between border-b border-line pb-5">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-chalk-dim">Serve score</p>
              <p className="stat-num mt-2 text-7xl text-gold">82</p>
            </div>
            <div className="text-right">
              <p className="font-display text-3xl font-bold text-teal">+14</p>
              <p className="font-mono text-[10px] uppercase text-chalk-dim">since baseline</p>
            </div>
          </div>
          <div className="mt-6">
            <MiniBars />
          </div>
        </div>
      </section>

      <section className="launch-scene launch-scene-three" aria-label="One priority fix">
        <div className="launch-frame-badge">FRAME 15 · 0:01.5</div>
        <p className="mt-6 font-mono text-sm uppercase tracking-[0.28em] text-teal">One priority fix</p>
        <h2 className="mt-5 max-w-4xl font-display text-7xl font-bold leading-[1.02]">
          Bank this serve. Hold your finish through landing.
        </h2>
        <p className="mt-6 max-w-2xl text-2xl text-chalk-dim">
          A clear next move beats a dashboard full of noise.
        </p>
      </section>

      <section className="launch-scene launch-scene-four" aria-label="Progress builds">
        <p className="font-mono text-sm uppercase tracking-[0.28em] text-gold">Rep by rep</p>
        <div className="mt-7 flex items-end gap-5">
          {[68, 76, 82].map((score, index) => (
            <div key={score} className="launch-score-step" style={{ animationDelay: `${12.4 + index * 0.32}s` }}>
              <span className="font-mono text-xs uppercase tracking-[0.12em] text-chalk-dim">
                {index === 0 ? "Baseline" : index === 1 ? "Focus rep" : "Latest"}
              </span>
              <span className="stat-num mt-3 block text-7xl text-gold">{score}</span>
            </div>
          ))}
        </div>
        <h2 className="mt-8 font-display text-6xl font-bold">Progress you can feel.</h2>
      </section>

      <section className="launch-scene launch-scene-five" aria-label="Sideout">
        <p className="font-mono text-sm uppercase tracking-[0.28em] text-gold">
          Your film · your fix · your next level
        </p>
        <h2 className="mt-5 font-display text-9xl font-bold tracking-tight">Sideout</h2>
        <p className="mt-5 font-display text-4xl font-bold">Get better on purpose.</p>
      </section>

      {!capture && (
        <div className="fixed right-5 top-5 z-50 flex gap-2">
          <Link href="/" className="btn-ghost bg-navy/70 backdrop-blur-md">
            Back to site
          </Link>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Replay film
          </button>
        </div>
      )}
    </main>
  );
}
