"use client";

import { useEffect, useState } from "react";
import { CountUp, useInView, useReducedMotion } from "@/components/motion";

const REPS = [
  {
    label: "Baseline",
    short: "Base",
    score: 68,
    delta: 0,
    frame: 8,
    time: "0:00.8",
    insight: "The last two approach steps stay even instead of accelerating.",
    fix: "Make the penultimate step long and the final step fast.",
    metrics: [
      ["Approach footwork", 61],
      ["Jump timing", 72],
      ["Arm swing", 70],
    ],
    trace: "M4 74 C36 72 48 65 78 63 S122 60 145 51 S185 22 219 29 S258 56 292 42",
  },
  {
    label: "Focus rep",
    short: "Focus",
    score: 76,
    delta: 8,
    frame: 12,
    time: "0:01.2",
    insight: "The faster close puts contact higher and farther forward.",
    fix: "Keep the same approach tempo. Reach through the top of the ball.",
    metrics: [
      ["Approach footwork", 78],
      ["Jump timing", 81],
      ["Arm swing", 72],
    ],
    trace: "M4 74 C32 72 51 67 79 62 S118 58 145 43 S183 14 220 22 S260 48 292 35",
  },
  {
    label: "Latest",
    short: "Latest",
    score: 82,
    delta: 14,
    frame: 15,
    time: "0:01.5",
    insight: "Your full-reach contact window is becoming repeatable.",
    fix: "Bank this swing. Next, finish across your body through landing.",
    metrics: [
      ["Approach footwork", 84],
      ["Jump timing", 86],
      ["Arm swing", 79],
    ],
    trace: "M4 74 C34 72 48 65 77 60 S115 52 145 37 S180 10 220 18 S260 40 292 30",
  },
] as const;

export function AnalyticsShowcase() {
  const [active, setActive] = useState(1);
  const reducedMotion = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>("-15%");
  const rep = REPS[active];

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % REPS.length),
      4400,
    );
    return () => window.clearInterval(timer);
  }, [inView, reducedMotion]);

  return (
    <div ref={ref} className="analytics-stage">
      <div className="flex flex-col gap-6 border-b border-line p-5 md:flex-row md:items-end md:justify-between md:p-7">
        <div>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-teal-ink">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-teal" />
            Rep intelligence · example attack session
          </div>
          <h3 className="mt-2 font-display text-2xl font-bold md:text-3xl">
            See the change, not just the number.
          </h3>
        </div>
        <div className="flex gap-2" role="group" aria-label="Example attack reps">
          {REPS.map((item, index) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setActive(index)}
              aria-pressed={active === index}
              className={`analytics-rep-tab ${active === index ? "analytics-rep-tab-active" : ""}`}
            >
              <span className="hidden sm:inline">{item.label}</span>
              <span className="sm:hidden">{item.short}</span>
            </button>
          ))}
        </div>
      </div>

      <div key={rep.label} className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)]">
        <div className="relative overflow-hidden border-b border-line p-5 lg:border-b-0 lg:border-r lg:p-7">
          <div aria-hidden="true" className="analytics-grid absolute inset-0" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
                Attack path · load to contact
              </p>
              <p className="mt-1 text-sm text-chalk-dim">
                The trace lifts as your timing locks in.
              </p>
            </div>
            <span className="tag border-teal/40 text-teal-ink">{rep.time}</span>
          </div>

          <svg
            role="img"
            aria-label={`${rep.label} motion trace. ${rep.insight}`}
            viewBox="0 0 296 96"
            className="relative mt-7 h-44 w-full overflow-visible md:h-56"
          >
            <path d="M4 78 H292" stroke="var(--color-line)" strokeWidth="1" />
            <path d="M4 52 H292" stroke="var(--color-line)" strokeWidth="1" strokeDasharray="3 5" />
            <path d="M4 26 H292" stroke="var(--color-line)" strokeWidth="1" strokeDasharray="3 5" />
            <path
              d={rep.trace}
              fill="none"
              stroke="var(--color-gold)"
              strokeWidth="3"
              strokeLinecap="round"
              className="analytics-trace"
              pathLength="1"
            />
            {[49, 97, 145, 193, 241].map((x, index) => (
              <circle
                key={x}
                cx={x}
                cy={[66, 59, 42, 20, 30][index]}
                r={index === 3 ? 4 : 2.5}
                fill={index === 3 ? "var(--color-gold)" : "var(--color-teal)"}
                className="analytics-point"
                style={{ animationDelay: `${280 + index * 80}ms` }}
              />
            ))}
            <line
              x1="193"
              x2="193"
              y1="12"
              y2="84"
              stroke="var(--color-gold)"
              strokeWidth="1"
              strokeDasharray="2 4"
              className="analytics-playhead"
            />
          </svg>

          <div className="relative grid grid-cols-3 gap-2 border-t border-line pt-4">
            {["LOAD", "LIFT", "CONTACT"].map((phase, index) => (
              <div key={phase}>
                <p className={`font-mono text-[11px] tracking-[0.14em] ${index === 2 ? "text-gold-ink" : "text-chalk-dim"}`}>
                  0{index + 1} · {phase}
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-line/60">
                  <div
                    className={`h-full rounded-full ${index === 2 ? "bg-gold" : "bg-teal"}`}
                    style={{ width: `${[72, 86, 100][index]}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col p-5 md:p-7">
          <div className="flex items-end justify-between border-b border-line pb-5">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
                Spike score
              </p>
              <p className="stat-num mt-2 text-6xl text-gold-ink md:text-7xl">
                <CountUp to={rep.score} duration={620} />
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-xl font-bold text-teal-ink">
                {rep.delta > 0 ? `+${rep.delta}` : "Start"}
              </p>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-chalk-dim">
                vs baseline
              </p>
            </div>
          </div>

          <div className="my-5 space-y-4">
            {rep.metrics.map(([label, score], index) => (
              <div key={label}>
                <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.1em]">
                  <span className="text-chalk-dim">{label}</span>
                  <span className="text-chalk">{score}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/60">
                  <div
                    className="analytics-metric-fill h-full origin-left rounded-full bg-gold"
                    style={{ width: `${score}%`, animationDelay: `${180 + index * 90}ms` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto rounded-control border-l-2 border-gold bg-navy/55 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold-ink">
              Frame {rep.frame} · next best move
            </p>
            <p className="mt-2 text-sm font-medium text-chalk">{rep.fix}</p>
            <p className="mt-2 text-xs leading-relaxed text-chalk-dim">{rep.insight}</p>
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Showing {rep.label}: score {rep.score}. {rep.insight} Next best move: {rep.fix}
      </p>
    </div>
  );
}
