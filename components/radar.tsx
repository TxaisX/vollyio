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
  const rMax = size * 0.36;
  const n = SKILLS.length;

  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
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

  const filled = SKILLS.map((s, i) => {
    const v = ratings[s];
    return point(i, rMax * ((v ?? 0) / 100)).join(",");
  }).join(" ");

  const summary = SKILLS.filter((s) => ratings[s] != null)
    .map((s) => `${SKILL_LABEL[s]} ${Math.round(ratings[s]!)}`)
    .join(", ");

  return (
    <svg
      width={size}
      height={size}
      className="overflow-visible"
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
        {SKILLS.map((s, i) => {
          const v = ratings[s];
          if (v == null) return null;
          const [x, y] = point(i, rMax * (v / 100));
          return <circle key={s} cx={x} cy={y} r={3} fill="var(--color-gold)" />;
        })}
      </g>
      {SKILLS.map((s, i) => {
        const [x, y] = point(i, rMax * 1.18);
        const rated = ratings[s] != null;
        return (
          <text
            key={s}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="font-mono text-[10px]"
            fill={rated ? "var(--color-chalk)" : "var(--color-chalk-dim)"}
          >
            {SKILL_LABEL[s]}
          </text>
        );
      })}
    </svg>
  );
}
