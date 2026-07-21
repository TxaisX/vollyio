import { ViewTransition } from "react";

function Sk({ className = "" }: { className?: string }) {
  return <span className={`skeleton block rounded bg-chalk/10 ${className}`} />;
}

const CHIP_W = ["w-14", "w-24", "w-24", "w-20", "w-28", "w-28", "w-24"];

export default function HistoryLoading() {
  return (
    <ViewTransition exit="vt-reveal-out">
    <section className="max-w-4xl" aria-busy>
      <Sk className="h-3 w-20" />
      <Sk className="mt-2 h-9 w-56 max-w-full" />

      <div className="mt-5 flex flex-wrap gap-2">
        {CHIP_W.map((w, i) => (
          <Sk key={i} className={`h-11 ${w} rounded-full`} />
        ))}
      </div>

      <ul className="mt-6 divide-y divide-line">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-start gap-3 p-3">
            <Sk className="h-3 w-12 shrink-0" />
            <div className="flex-1">
              <Sk className="h-4 w-40 max-w-full" />
              <Sk className="mt-2 h-4 w-3/4" />
            </div>
            <Sk className="mt-1 h-4 w-4 shrink-0" />
          </li>
        ))}
      </ul>
    </section>
    </ViewTransition>
  );
}
