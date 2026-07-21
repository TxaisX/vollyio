import { ViewTransition } from "react";

function Sk({ className = "" }: { className?: string }) {
  return <span className={`skeleton block rounded bg-chalk/10 ${className}`} />;
}

export default function LearnLoading() {
  return (
    <ViewTransition exit="vt-reveal-out">
      <section className="max-w-5xl" aria-busy>
        <Sk className="h-3 w-12" />
        <Sk className="mt-2 h-9 w-64 max-w-full" />
        <Sk className="mt-3 h-4 w-80 max-w-full" />
        <div className="mt-5 flex gap-2">
          <Sk className="h-11 w-20" />
          <Sk className="h-11 w-20" />
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5">
              <div className="flex items-center gap-2">
                <Sk className="h-5 w-5 rounded-full" />
                <Sk className="h-5 w-28" />
              </div>
              <Sk className="mt-3 h-3 w-full" />
              <Sk className="mt-1 h-3 w-2/3" />
            </div>
          ))}
        </div>
      </section>
    </ViewTransition>
  );
}
