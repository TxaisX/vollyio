function Sk({ className = "" }: { className?: string }) {
  return <span className={`skeleton block rounded bg-chalk/10 ${className}`} />;
}

export default function SettingsLoading() {
  return (
    <section className="max-w-2xl" aria-busy>
      <Sk className="h-3 w-16" />
      <Sk className="mt-2 h-7 w-52" />

      <div className="card mt-8 space-y-4 p-5">
        <Sk className="h-5 w-24" />
        <Sk className="h-11 w-full rounded-control" />
        <div className="flex items-center justify-between">
          <Sk className="h-3 w-40" />
          <Sk className="h-11 w-24 rounded-control" />
        </div>
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card mt-4 space-y-3 p-5">
          <Sk className="h-5 w-32" />
          <Sk className="h-3 w-64 max-w-full" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <Sk key={j} className="h-11 w-28 rounded-full" />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
