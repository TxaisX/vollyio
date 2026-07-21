import { ViewTransition } from "react";

function Sk({ className = "" }: { className?: string }) {
  return (
    <span
      className={`skeleton block rounded bg-chalk/10 ${className}`}
    />
  );
}

export default function DashboardLoading() {
  return (
    <ViewTransition exit="vt-reveal-out">
      <section className="max-w-6xl" aria-busy>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Sk className="h-3 w-24" />
          <Sk className="mt-3 h-8 w-72 max-w-full" />
        </div>
        <div className="flex items-center gap-3 xl:hidden">
          <Sk className="h-8 w-24 rounded-full" />
          <Sk className="h-8 w-36 rounded-full" />
        </div>
      </div>

      <div className="mt-6 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-6">
        <div className="min-w-0">
          <div className="grid gap-4 md:grid-cols-5 xl:block">
            <div className="card flex h-full flex-wrap items-center justify-center gap-6 p-6 md:col-span-3">
              <Sk className="h-36 w-36 rounded-full" />
              <Sk className="h-52 w-52 rounded-full" />
            </div>
            <div className="flex flex-col gap-4 md:col-span-2 xl:hidden">
              {[0, 1].map((i) => (
                <div key={i} className="card p-5">
                  <Sk className="h-3 w-28" />
                  <Sk className="mt-3 h-5 w-40" />
                  <Sk className="mt-4 h-9 w-full" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-4">
                <div className="flex items-center justify-between">
                  <Sk className="h-4 w-20" />
                  <Sk className="h-6 w-8" />
                </div>
                <Sk className="mt-4 h-6 w-full" />
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Sk className="h-4 w-24" />
            <ul className="mt-3 divide-y divide-line">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex items-center gap-4 py-3">
                  <Sk className="h-3 w-12" />
                  <Sk className="h-4 flex-1" />
                  <Sk className="h-4 w-8" />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="hidden xl:flex xl:flex-col xl:gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-5">
              <Sk className="h-3 w-28" />
              <Sk className="mt-3 h-5 w-40" />
              <Sk className="mt-4 h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
      </section>
    </ViewTransition>
  );
}
