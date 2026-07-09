import { ViewTransition } from "react";

function Sk({ className = "" }: { className?: string }) {
  return <span className={`skeleton block rounded bg-chalk/10 ${className}`} />;
}

export default function AnalysisLoading() {
  return (
    <ViewTransition exit="vt-reveal-out">
    <section className="max-w-6xl" aria-busy>
      {/* Score header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Sk className="h-3 w-40" />
          <Sk className="mt-2 h-9 w-44" />
        </div>
        <div className="flex items-center gap-4">
          <Sk className="h-11 w-28 rounded-control" />
          <Sk className="h-[84px] w-[84px] shrink-0 rounded-full" />
        </div>
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-start lg:gap-8">
        {/* Player column */}
        <div className="lg:order-2">
          <Sk className="mb-3 h-3 w-12" />
          <Sk className="aspect-video w-full rounded-lg" />
          <div className="mt-4 flex gap-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <Sk key={i} className="h-14 w-20 shrink-0 rounded-md" />
            ))}
          </div>
        </div>

        {/* Metrics / timeline column */}
        <div className="mt-8 min-w-0 lg:order-1 lg:mt-0">
          <Sk className="h-4 w-full" />
          <Sk className="mt-2 h-4 w-5/6" />

          <Sk className="mt-8 h-4 w-24" />
          <div className="card mt-3 space-y-4 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="flex items-center justify-between">
                  <Sk className="h-3 w-28" />
                  <Sk className="h-3 w-8" />
                </div>
                <Sk className="mt-2 h-2 w-full rounded-full" />
              </div>
            ))}
          </div>

          <Sk className="mt-8 h-4 w-24" />
          <ul className="mt-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex gap-3">
                <Sk className="h-3 w-10 shrink-0" />
                <Sk className="h-4 flex-1" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
    </ViewTransition>
  );
}
