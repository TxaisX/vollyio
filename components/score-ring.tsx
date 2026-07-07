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

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
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
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-2xl font-bold">
          {score == null ? "—" : score}
        </span>
        {label && <span className="font-mono text-[10px] uppercase text-chalk-dim">{label}</span>}
      </div>
    </div>
  );
}
