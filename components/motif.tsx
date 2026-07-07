export function SeamArcs({
  className = "",
  opacity = 0.1,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 600"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      style={{ opacity }}
    >
      <path
        d="M-80 520 C 240 140, 720 100, 1280 300"
        stroke="var(--color-gold)"
        strokeWidth="1.5"
      />
      <path
        d="M-80 590 C 260 230, 760 190, 1280 380"
        stroke="var(--color-chalk)"
        strokeWidth="1"
      />
      <path
        d="M-80 450 C 220 60, 680 20, 1280 220"
        stroke="var(--color-chalk)"
        strokeWidth="1"
        strokeDasharray="2 8"
      />
    </svg>
  );
}
