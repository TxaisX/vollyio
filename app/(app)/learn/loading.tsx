import { ViewTransition } from "react";

function Sk({ className = "" }: { className?: string }) {
  return <span className={`skeleton block rounded bg-chalk/10 ${className}`} />;
}

/**
 * Redrawn to the band and the tightened library cards (D-117).
 *
 * The two chip rows inside the band are the hub strip and the discipline
 * switch; the pair below it are the library tabs and the search box, which
 * stay out on the page because they are controls over the content rather than
 * chrome about where you are.
 */
export default function LearnLoading() {
  return (
    <ViewTransition exit="vt-reveal-out">
      <section className="max-w-5xl" aria-busy>
        <div className="hero-band card spot p-5 sm:p-6">
          <Sk className="h-3 w-12" />
          <Sk className="mt-2 h-9 w-64 max-w-full" />
          <div className="mt-4 border-t border-line pt-3.5">
            <div className="flex gap-2">
              <Sk className="h-9 w-24 rounded-full" />
              <Sk className="h-9 w-24 rounded-full" />
            </div>
            <div className="mt-3 flex gap-2">
              <Sk className="h-11 w-24 rounded-full" />
              <Sk className="h-11 w-24 rounded-full" />
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Sk className="h-11 w-28 rounded-full" />
          <Sk className="h-11 w-36 rounded-full" />
        </div>
        <Sk className="mt-3 h-4 w-full max-w-prose" />
        <Sk className="mt-3 h-11 w-full rounded-control" />
        <Sk className="mt-2 h-3 w-32" />

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-3.5 sm:p-4">
              <Sk className="h-5 w-40 max-w-full" />
              <Sk className="mt-1 h-3 w-28" />
              <Sk className="mt-2 h-3.5 w-full" />
              <Sk className="mt-1 h-3.5 w-2/3" />
            </div>
          ))}
        </div>
      </section>
    </ViewTransition>
  );
}
