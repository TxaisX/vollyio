function Sk({ className = "" }: { className?: string }) {
  return (
    <span
      className={`skeleton block rounded bg-chalk/10 ${className}`}
    />
  );
}

export default function AppLoading() {
  return (
    <section className="max-w-6xl" aria-busy>
      <Sk className="h-3 w-24" />
      <Sk className="mt-3 h-8 w-64 max-w-full" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5">
            <Sk className="h-4 w-32" />
            <Sk className="mt-4 h-5 w-full" />
            <Sk className="mt-2 h-5 w-2/3" />
          </div>
        ))}
      </div>
    </section>
  );
}
