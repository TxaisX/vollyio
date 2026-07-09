import { ViewTransition } from "react";

function Sk({ className = "" }: { className?: string }) {
  return <span className={`skeleton block rounded bg-chalk/10 ${className}`} />;
}

export default function DrillsLoading() {
  return (
    <ViewTransition exit="vt-reveal-out">
    <section className="max-w-3xl" aria-busy>
      <Sk className="h-3 w-16" />
      <Sk className="mt-2 h-9 w-48 max-w-full" />
      <Sk className="mt-3 h-4 w-72 max-w-full" />

      <div className="mt-8 space-y-10">
        {Array.from({ length: 3 }).map((_, g) => (
          <div key={g}>
            <Sk className="mb-3 h-6 w-40" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, c) => (
                <div key={c} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Sk className="h-5 w-32" />
                    <Sk className="h-4 w-16 shrink-0" />
                  </div>
                  <Sk className="mt-2 h-3 w-full" />
                  <Sk className="mt-1 h-3 w-2/3" />
                  <Sk className="mt-3 h-3 w-12" />
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
