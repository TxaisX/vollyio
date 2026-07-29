function Sk({ className = "" }: { className?: string }) {
  return <span className={`skeleton block rounded bg-chalk/10 ${className}`} />;
}

export default function GoalsLoading() {
  return (
    <section className="max-w-4xl" aria-busy>
      <Sk className="h-3 w-16" />
      <Sk className="mt-2 h-9 w-44" />
      <Sk className="mt-3 h-4 w-80 max-w-full" />

      <div className="card mt-8 space-y-4 p-5">
        <div>
          <Sk className="h-2.5 w-12" />
          <Sk className="mt-1.5 h-11 w-full rounded-control" />
        </div>
        <div>
          <Sk className="h-2.5 w-12" />
          <div className="mt-1.5 flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Sk key={i} className="h-11 w-24 rounded-full" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Sk className="h-11 w-full rounded-control" />
          <Sk className="h-11 w-full rounded-control" />
        </div>
        <Sk className="h-11 w-full rounded-control" />
      </div>

      <div className="mt-6 space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <Sk className="h-5 w-2/3" />
              <Sk className="h-4 w-16 shrink-0" />
            </div>
            <Sk className="mt-4 h-2 w-full rounded-full" />
            <div className="mt-3 flex items-center justify-between">
              <Sk className="h-3 w-24" />
              <Sk className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
