"use client";

import { useEffect, useState } from "react";
import { SKILL_LABEL, type Skill } from "@/lib/skills";

export function Sparkline({
  values,
  width = 96,
  height = 28,
  skill,
}: {
  values: number[];
  width?: number;
  height?: number;
  skill?: Skill;
}) {
  const clean = values.filter((v) => Number.isFinite(v));
  const enough = clean.length >= 2;

  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!enough) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDrawn(true);
      return;
    }
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, [enough]);

  if (!enough) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center"
        role="img"
        aria-label="Not enough reps to chart yet."
      >
        <span
          aria-hidden
          className="h-px w-full border-t border-dashed border-line"
        />
      </div>
    );
  }

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const flat = max === min;
  const span = max - min || 1;
  const step = width / (clean.length - 1);
  const points = clean
    .map(
      (v, i) =>
        `${i * step},${flat ? height / 2 : height - ((v - min) / span) * (height - 4) - 2}`,
    )
    .join(" ");

  const label = skill
    ? `${SKILL_LABEL[skill]} rating trend over your last ${clean.length} reps.`
    : `Rating trend over your last ${clean.length} reps.`;

  return (
    <svg width={width} height={height} role="img" aria-label={label}>
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-teal)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={drawn ? 0 : 1}
        style={{ transition: "stroke-dashoffset 1s var(--ease-court)" }}
      />
    </svg>
  );
}
