// Plain-language key for the checkpoint bubbles MetricBar renders. The bubble
// classes must stay identical to MetricBar's status mapping or the key lies.
const VERDICTS = [
  { bubble: "bg-gold", label: "Hit" },
  { bubble: "bg-gold/40", label: "Partly there" },
  { bubble: "bg-coral", label: "Missed" },
  { bubble: "border border-line bg-transparent", label: "Not visible (doesn't count)" },
] as const;

export function MetricLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-chalk-dim">
      {VERDICTS.map((v) => (
        <li key={v.label} className="flex items-center gap-2">
          <span
            aria-hidden
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${v.bubble}`}
          />
          {v.label}
        </li>
      ))}
    </ul>
  );
}
