"use client";

import { useEffect, useRef, useState } from "react";

export function MetricBar({
  label,
  score,
  note,
  elite,
  delay = 0,
}: {
  label: string;
  score: number;
  note?: string;
  /** What a ~90 looks like for this metric; renders as a collapsed reference line. */
  elite?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [shown, setShown] = useState(0);

  const clamped = Math.max(0, Math.min(100, score));
  const valueNow = Math.round(clamped);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDrawn(true);
      setShown(valueNow);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        timer = setTimeout(() => {
          setDrawn(true);
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / 800);
            setShown(Math.round(clamped * (1 - Math.pow(1 - p, 3))));
            if (p < 1) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }, delay);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [clamped, valueNow, delay]);

  return (
    <div ref={ref}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm">{label}</span>
        <span className="shrink-0 font-mono text-xs text-gold">{shown}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={valueNow}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${valueNow} out of 100`}
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-gold"
          style={{
            width: drawn ? `${clamped}%` : "0%",
            transition: "width 0.8s var(--ease-court)",
          }}
        />
      </div>
      {note && <p className="mt-1 text-xs text-chalk-dim">{note}</p>}
      {elite && (
        <details className="mt-1">
          <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-wide text-teal">
            What 90 looks like
          </summary>
          <p className="mt-1 text-xs text-chalk-dim">{elite}</p>
        </details>
      )}
    </div>
  );
}
