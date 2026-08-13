function Sk({ className = "" }: { className?: string }) {
  return <span className={`skeleton block rounded bg-chalk/10 ${className}`} />;
}

/**
 * Redrawn to the new chrome (D-117): the opening `.hero-band` rather than a
 * bare kicker and title on the page ground, the step-01 environment chips it
 * used to skip entirely, and skill tiles at the height the tightened picker
 * actually renders.
 */
export default function AnalyzeLoading() {
  return (
    <section className="max-w-xl lg:max-w-none" aria-busy>
      <div className="hero-band card spot p-5 sm:p-6">
        <Sk className="h-3 w-16" />
        <Sk className="mt-2 h-9 w-48 max-w-full" />
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
        {/* Controls */}
        <div className="min-w-0">
          <Sk className="mb-3 h-5 w-44" />
          <div className="flex flex-wrap gap-2">
            <Sk className="h-11 w-24 rounded-full" />
            <Sk className="h-11 w-24 rounded-full" />
          </div>

          <div className="mt-8">
            <Sk className="mb-3 h-5 w-32" />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Sk key={i} className="h-[6.75rem] rounded-card" />
              ))}
            </div>
          </div>

          <div className="mt-8">
            <Sk className="mb-3 h-5 w-48" />
            <Sk className="h-56 w-full rounded-card" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Sk className="h-11 w-40 rounded-full" />
              <Sk className="h-11 w-36 rounded-full" />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-8 min-w-0 lg:mt-0">
          <Sk className="mb-3 h-3 w-16" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Sk key={i} className="aspect-video rounded-md" />
            ))}
          </div>
          <Sk className="mt-4 h-11 w-full rounded-control" />
        </div>
      </div>
    </section>
  );
}
