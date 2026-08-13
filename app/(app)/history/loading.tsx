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

      {/* Drawn to the row the page actually renders (D-117): a card per rep
          with the 48px score tile leading it, not the flat divide-y line this
          skeleton kept drawing after the rows became cards. A skeleton of the
          old layout is worse than none, because the page visibly rearranges
          itself the moment data lands. */}
      <ul className="mt-6 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="card flex items-center gap-3 p-3">
            <Sk className="h-12 w-12 shrink-0 rounded-control" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <Sk className="h-4 w-32 max-w-full" />
                <Sk className="ml-auto h-3 w-12 shrink-0" />
              </div>
              <div className="mt-1.5 flex gap-1.5">
                <Sk className="h-5 w-16 rounded-full" />
                <Sk className="h-5 w-14 rounded-full" />
              </div>
            </div>
            <Sk className="h-4 w-4 shrink-0" />
          </li>
        ))}
      </ul>
    </section>
    </ViewTransition>
  );
}
