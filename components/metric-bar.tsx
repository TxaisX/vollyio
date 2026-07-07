"use client";

import { useEffect, useRef, useState } from "react";

export function MetricBar({
  label,
  score,
  note,
  delay = 0,
}: {
  label: string;
  score: number;
  note?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDrawn(true);
      setShown(score);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const t = setTimeout(() => {
          setDrawn(true);
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / 800);
            setShown(Math.round(score * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }, delay);
        return () => clearTimeout(t);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [score, delay]);

  return (
    <div ref={ref}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm">{label}</span>
        <span className="font-mono text-xs text-gold">{shown}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-line">
        <div
          className="h-full rounded-full bg-gold"
          style={{
            width: drawn ? `${score}%` : "0%",
            transition: "width 0.8s var(--ease-court)",
          }}
        />
      </div>
      {note && <p className="mt-1 text-xs text-chalk-dim">{note}</p>}
    </div>
  );
}
