"use client";

import { useEffect, useState } from "react";
import { SKILLS, SKILL_LABEL, type Skill } from "@/lib/skills";

export function Radar({
  ratings,
  size = 240,
}: {
  ratings: Partial<Record<Skill, number | null>>;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const rMax = size * 0.34;
  const n = SKILLS.length;

  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDrawn(true);
      return;
    }
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const point = (i: number, radius: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)] as const;
  };

  const grid = [0.25, 0.5, 0.75, 1].map((f) =>
    SKILLS.map((_, i) => point(i, rMax * f).join(",")).join(" "),
  );

  const rated = SKILLS.map((s, i) => ({ s, i, v: ratings[s] })).filter(
    (o): o is { s: Skill; i: number; v: number } => o.v != null,
  );
  const hasData = rated.length > 0;

  const filled = rated
    .map((o) =>
      point(o.i, rMax * (Math.max(0, Math.min(100, o.v)) / 100)).join(","),
    )
    .join(" ");

  const summary = rated
    .map((o) => `${SKILL_LABEL[o.s]} ${Math.round(Math.max(0, Math.min(100, o.v)))}`)
    .join(", ");

  return (
    <svg
      width={size}
      height={size}
      className="overflow-hidden"
      role="img"
      aria-label={
        summary
          ? `Skill ratings out of 100: ${summary}`
          : "Skill ratings, no reps yet"
      }
    >
      {grid.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="var(--color-line)" />
      ))}
      {SKILLS.map((_, i) => {
        const [x, y] = point(i, rMax);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-line)" />;
      })}
      {hasData ? (
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transform: drawn ? "scale(1)" : "scale(0.2)",
            opacity: drawn ? 1 : 0,
            transition:
              "transform 0.8s var(--ease-court), opacity 0.5s var(--ease-court)",
          }}
        >
          <polygon
            points={filled}
            fill="var(--color-gold)"
            fillOpacity={0.25}
            stroke="var(--color-gold)"
            strokeWidth={2}
          />
          {rated.map((o) => {
            const [x, y] = point(o.i, rMax * (Math.max(0, Math.min(100, o.v)) / 100));
            return <circle key={o.s} cx={x} cy={y} r={3} fill="var(--color-gold)" />;
          })}
        </g>
      ) : (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-mono"
          style={{ fontSize: size * 0.055 }}
          fill="var(--color-chalk-dim)"
        >
          No reps yet
        </text>
      )}
      {SKILLS.map((s, i) => {
        const [x, y] = point(i, rMax * 1.16);
        const isRated = ratings[s] != null;
        return (
          <text
            key={s}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="font-mono"
            style={{ fontSize: size * 0.052 }}
            fill={isRated ? "var(--color-chalk)" : "var(--color-chalk-dim)"}
          >
            {SKILL_LABEL[s]}
          </text>
        );
      })}
    </svg>
  );
}
