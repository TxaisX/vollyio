import { ViewTransition } from "react";

function Sk({ className = "" }: { className?: string }) {
  return <span className={`skeleton block rounded bg-chalk/10 ${className}`} />;
}

/** Redrawn to the band and the tightened cards (D-117). */
export default function DrillsLoading() {
  return (
    <ViewTransition exit="vt-reveal-out">
    <section className="max-w-5xl" aria-busy>
      <div className="hero-band card spot p-5 sm:p-6">
        <Sk className="h-3 w-16" />
        <Sk className="mt-2 h-9 w-48 max-w-full" />
        <Sk className="mt-3 h-4 w-72 max-w-full" />
        <div className="mt-4 flex gap-2 border-t border-line pt-3.5">
          <Sk className="h-9 w-24 rounded-full" />
          <Sk className="h-9 w-24 rounded-full" />
          <Sk className="h-9 w-24 rounded-full" />
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {Array.from({ length: 3 }).map((_, g) => (
          <div key={g}>
            <Sk className="mb-2 h-5 w-40" />
            <div className="grid gap-2.5 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, c) => (
                <div key={c} className="card p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <Sk className="h-4 w-32" />
                    <Sk className="h-4 w-16 shrink-0" />
                  </div>
                  <Sk className="mt-2 h-3 w-full" />
                  <Sk className="mt-1 h-3 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
    </ViewTransition>
  );
}
