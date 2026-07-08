"use client";

import { useEffect, useState } from "react";

export function ScoreRing({
  score,
  size = 128,
  label,
}: {
  score: number | null;
  size?: number;
  label?: string;
}) {
  const stroke = size * 0.09;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = score == null ? null : Math.max(0, Math.min(100, score));
  const display = clamped == null ? null : Math.round(clamped);
  const pct = clamped == null ? 0 : clamped / 100;

  const [drawn, setDrawn] = useState(false);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDrawn(true);
      setShown(display ?? 0);
      return;
    }
    const raf = requestAnimationFrame(() => setDrawn(true));
    if (clamped == null) return () => cancelAnimationFrame(raf);
    let counter = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setShown(Math.round(clamped * (1 - Math.pow(1 - t, 3))));
      if (t < 1) counter = requestAnimationFrame(tick);
    };
    counter = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(counter);
    };
  }, [clamped, display]);

  const ariaLabel = label
    ? display == null
      ? `${label}: not rated yet`
      : `${label}: ${display} out of 100`
    : display == null
      ? "No score yet"
      : `Score ${display} out of 100`;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, maxWidth: "100%", aspectRatio: "1 / 1" }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-full w-full -rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={drawn ? c * (1 - pct) : c}
          style={{
            transition: "stroke-dashoffset 0.9s var(--ease-court)",
            filter:
              "drop-shadow(0 0 6px color-mix(in oklab, var(--color-gold) 35%, transparent))",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display font-bold"
          style={{ fontSize: size * 0.26 }}
        >
          {display == null ? "—" : shown}
        </span>
        {label && (
          <span
            className="font-mono uppercase text-chalk-dim"
            style={{ fontSize: size * 0.09 }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
