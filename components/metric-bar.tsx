"use client";

import { useEffect, useRef, useState } from "react";

export function MetricBar({
  label,
  score,
  note,
  elite,
  observed = true,
  pointers,
  weight,
  delay = 0,
}: {
  label: string;
  score: number;
  note?: string;
  /** What a ~90 looks like for this metric; renders as a collapsed reference line. */
  elite?: string;
  /** False when this checkpoint was not visible in the footage; it renders as
   *  informational only and is excluded from the overall score. */
  observed?: boolean;
  /** The checklist the score was computed from: cue text plus its verdict. */
  pointers?: { cue: string; status: string }[];
  /** The metric's share of the overall (weights sum to 100 per skill). */
  weight?: number;
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
        <span className="min-w-0 truncate text-base font-medium">
          {label}
          {weight != null && (
            <span className="ml-1.5 font-mono text-[11px] text-chalk-dim/70">{weight}%</span>
          )}
        </span>
        {observed ? (
          <span className="shrink-0 font-mono text-lg font-semibold text-gold-ink">{shown}</span>
        ) : (
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
            Not visible
          </span>
        )}
      </div>
      {observed ? (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuenow={valueNow}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${valueNow} out of 100`}
          className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-line"
        >
          <div
            className="h-full rounded-full bg-gold"
            style={{
              width: drawn ? `${clamped}%` : "0%",
              transition: "width 0.8s var(--ease-court)",
            }}
          />
        </div>
      ) : (
        <div aria-hidden className="mt-1 h-1.5 rounded-full border border-dashed border-line" />
      )}
      {pointers && pointers.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {pointers.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span
                aria-hidden
                className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                  p.status === "met"
                    ? "bg-gold"
                    : p.status === "partial"
                      ? "bg-gold/40"
                      : p.status === "missed"
                        ? "bg-coral"
                        : "border border-line bg-transparent"
                }`}
              />
              {/* EVERY STATUS CARRIES A WORD, because the dot above is
                  `aria-hidden` and gold-vs-coral was the only thing separating
                  "you hit this cue" from "you missed it". A screen reader got
                  the same sentence for both, and so did anyone reading a 2mm
                  dot in sun at the side of a court, which is the actual place
                  this scorecard is read.

                  `met` takes the word silently: the gold dot already reads as
                  fine and appending "· met" to every satisfied cue is noise for
                  the sighted majority. `missed` says it out loud, because it is
                  the one the player has to act on. */}
              <span className={p.status === "not_visible" ? "text-chalk-dim" : "text-chalk-dim"}>
                {p.cue}
                {p.status === "met" && <span className="sr-only"> · met</span>}
                {p.status === "missed" && (
                  <span className="text-coral-ink"> · missed</span>
                )}
                {p.status === "partial" && <span className="text-chalk-dim"> · partial</span>}
                {p.status === "not_visible" && <span> · not visible</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="mt-1 text-sm text-chalk-dim">{note}</p>}
      {elite && (
        <details className="mt-1">
          <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-wide text-teal-ink">
            What 90 looks like
          </summary>
          <p className="mt-1 text-xs text-chalk-dim">{elite}</p>
        </details>
      )}
    </div>
  );
}
