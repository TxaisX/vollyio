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
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;

  const [drawn, setDrawn] = useState(false);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDrawn(true);
      setShown(score ?? 0);
      return;
    }
    const raf = requestAnimationFrame(() => setDrawn(true));
    if (score == null) return () => cancelAnimationFrame(raf);
    let counter = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setShown(Math.round(score * (1 - Math.pow(1 - t, 3))));
      if (t < 1) counter = requestAnimationFrame(tick);
    };
    counter = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(counter);
    };
  }, [score]);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
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
            filter: "drop-shadow(0 0 6px rgb(232 185 59 / 0.35))",
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          className="font-display font-bold"
          style={{ fontSize: size * 0.26 }}
        >
          {score == null ? "—" : shown}
        </span>
        {label && (
          <span className="font-mono text-[10px] uppercase text-chalk-dim">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
