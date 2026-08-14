import { ViewTransition } from "react";

function Sk({ className = "" }: { className?: string }) {
  return (
    <span
      className={`skeleton block rounded bg-chalk/10 ${className}`}
    />
  );
}

// Mirrors the real page's shape (D-116): opening band, the two action cards,
// today's pair, the skill meters, then recent activity. A skeleton that draws
// the OLD layout is worse than none, because the page visibly rearranges itself
// the moment the data lands.
export default function DashboardLoading() {
  return (
    <ViewTransition exit="vt-reveal-out">
      <section className="max-w-7xl" aria-busy>
        <div className="hero-band card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Sk className="h-3 w-16" />
              <Sk className="mt-3 h-7 w-64 max-w-full" />
              <div className="mt-4 flex flex-wrap gap-2">
                <Sk className="h-6 w-24 rounded-full" />
                <Sk className="h-6 w-24 rounded-full" />
                <Sk className="h-6 w-32 rounded-full" />
              </div>
            </div>
            <Sk className="h-[92px] w-[92px] shrink-0 rounded-full" />
          </div>
          <div className="mt-4 flex gap-2 border-t border-line pt-3.5">
            <Sk className="h-10 w-24 rounded-full" />
            <Sk className="h-10 w-32 rounded-full" />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          {[0, 1].map((i) => (
            <div key={i} className="card flex items-center gap-3.5 p-4">
              <Sk className="h-11 w-11 shrink-0 rounded-[0.6rem]" />
              <div className="min-w-0 flex-1">
                <Sk className="h-4 w-28" />
                <Sk className="mt-2 h-3 w-40 max-w-full" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-6">
          <div className="min-w-0">
            <div className="grid gap-3 md:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="card p-5">
                  <Sk className="h-3 w-28" />
                  <Sk className="mt-3 h-5 w-40" />
                  <Sk className="mt-4 h-9 w-full" />
                </div>
              ))}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <Sk className="h-4 w-32" />
                <Sk className="h-11 w-44 rounded-full" />
              </div>
              <div className="card mt-3 divide-y divide-line">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <Sk className="h-9 w-9 shrink-0 rounded-[0.6rem]" />
                    <div className="min-w-0 flex-1">
                      <Sk className="h-3.5 w-20" />
                      <Sk className="mt-2 h-1.5 w-full rounded-full" />
                    </div>
                    <Sk className="h-5 w-7 shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <Sk className="h-4 w-36" />
              <ul className="mt-3 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="card flex items-center gap-3 p-3">
                    <Sk className="h-12 w-12 shrink-0 rounded-control" />
                    <div className="min-w-0 flex-1">
                      <Sk className="h-3.5 w-40 max-w-full" />
                      <Sk className="mt-2 h-3 w-56 max-w-full" />
                      <Sk className="mt-2 h-5 w-32 rounded-full" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="hidden xl:flex xl:flex-col xl:gap-4">
            <div className="card p-5">
              <Sk className="h-3 w-28" />
              <Sk className="mt-3 h-5 w-40" />
              <Sk className="mt-4 h-9 w-full" />
            </div>
          </div>
        </div>
      </section>
    </ViewTransition>
  );
}
