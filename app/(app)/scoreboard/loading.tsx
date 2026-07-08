function Sk({ className = "" }: { className?: string }) {
  return <span className={`skeleton block rounded bg-chalk/10 ${className}`} />;
}

export default function ScoreboardLoading() {
  return (
    <section className="max-w-2xl" aria-busy>
      <Sk className="h-3 w-24" />
      <Sk className="mt-1 h-7 w-40" />

      <div className="mt-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="card skeleton min-h-[38vh] md:min-h-[320px]" />
          <div className="card skeleton min-h-[38vh] md:min-h-[320px]" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Sk key={i} className="h-11 rounded-control border border-line" />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Sk className="h-2 w-12 rounded-full" />
          <Sk className="h-3 w-24" />
          <Sk className="h-2 w-12 rounded-full" />
        </div>
      </div>

      <div className="mt-10">
        <Sk className="h-4 w-32" />
        <ul className="mt-3 divide-y divide-line">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="py-3">
              <div className="flex items-baseline gap-3">
                <Sk className="h-3 w-14 shrink-0" />
                <Sk className="h-4 w-48 max-w-full" />
              </div>
              <Sk className="mt-2 ml-[4.25rem] h-3 w-32" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
