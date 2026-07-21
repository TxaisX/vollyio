import { ViewTransition } from "react";

function Sk({ className = "" }: { className?: string }) {
  return <span className={`skeleton block rounded bg-chalk/10 ${className}`} />;
}

export default function LearnSkillLoading() {
  return (
    <ViewTransition exit="vt-reveal-out">
      <section className="max-w-5xl" aria-busy>
        <Sk className="h-3 w-16" />
        <Sk className="mt-4 h-3 w-20" />
        <Sk className="mt-2 h-9 w-64 max-w-full" />
        <Sk className="mt-3 h-4 w-full max-w-full" />
        <div className="mt-5 flex gap-2">
          <Sk className="h-11 w-20" />
          <Sk className="h-11 w-20" />
        </div>
        <div className="card mt-6 border-l-2 border-teal p-4">
          <Sk className="h-3 w-40" />
          <Sk className="mt-2 h-4 w-full" />
        </div>
        <Sk className="mt-8 h-4 w-24" />
        <div className="mt-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Sk className="h-7 w-7 shrink-0" />
              <Sk className="h-4 w-full" />
            </div>
          ))}
        </div>
        <Sk className="mt-8 h-4 w-28" />
        <div className="mt-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5">
              <Sk className="h-5 w-32" />
              <Sk className="mt-2 h-3 w-full" />
              <Sk className="mt-1 h-3 w-2/3" />
            </div>
          ))}
        </div>
      </section>
    </ViewTransition>
  );
}
