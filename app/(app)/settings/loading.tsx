function Sk({ className = "" }: { className?: string }) {
  return <span className={`skeleton block rounded bg-chalk/10 ${className}`} />;
}

/**
 * Redrawn to the new shape (D-117). Two things were wrong beyond the header:
 * it drew four stacked cards where the page has been a two-column grid from
 * `lg`, and it drew each chip group as a label over its chips, which is the
 * stack the player-profile card just stopped being.
 */
export default function SettingsLoading() {
  return (
    <section className="max-w-5xl" aria-busy>
      <div className="hero-band card spot p-5 sm:p-6">
        <Sk className="h-3 w-16" />
        <Sk className="mt-2 h-9 w-52 max-w-full" />
      </div>

      <div className="mt-6 space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        {/* Account */}
        <div className="card space-y-4 p-4 sm:p-5">
          <Sk className="h-5 w-24" />
          <Sk className="h-11 w-full rounded-control" />
          <div className="flex items-center justify-between">
            <Sk className="h-3 w-40" />
            <Sk className="h-11 w-24 rounded-control" />
          </div>
        </div>

        {/* Plan */}
        <div className="card space-y-3 p-4 sm:p-5">
          <Sk className="h-5 w-20" />
          <Sk className="h-3 w-56 max-w-full" />
          <Sk className="h-11 w-32 rounded-control" />
        </div>

        {/* Player profile: four label-beside-chips rows, divided. */}
        <div className="card p-4 sm:p-5">
          <Sk className="h-5 w-32" />
          <Sk className="mt-2 h-3 w-64 max-w-full" />
          <div className="mt-4 divide-y divide-line">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="py-3 first:pt-0 last:pb-0 sm:grid sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center sm:gap-3"
              >
                <Sk className="h-3 w-20" />
                <div className="mt-2 flex flex-wrap gap-2 sm:mt-0">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Sk key={j} className="h-11 w-24 rounded-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Consent: title and blurb on the left, one control on the right. */}
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0 max-w-md flex-1">
            <Sk className="h-5 w-44 max-w-full" />
            <Sk className="mt-2 h-3 w-full" />
            <Sk className="mt-1 h-3 w-2/3" />
          </div>
          <Sk className="h-11 w-28 shrink-0 rounded-full" />
        </div>
      </div>
    </section>
  );
}
