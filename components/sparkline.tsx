"use client";

import { useEffect, useState } from "react";

export function Sparkline({
  values,
  width = 96,
  height = 28,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (values.length < 2) {
    return <div style={{ width, height }} className="rounded bg-line/40" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${i * step},${height - ((v - min) / span) * (height - 4) - 2}`)
    .join(" ");
  return (
    <svg width={width} height={height}>
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
