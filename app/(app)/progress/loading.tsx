import { ViewTransition } from "react";

function Sk({ className = "" }: { className?: string }) {
  return <span className={`skeleton block rounded bg-chalk/10 ${className}`} />;
}

/**
 * /progress had NO loading file before D-117, so the route fell back to the
 * group's own app/(app)/loading.tsx and the page arrived as a jump rather than
 * as a fill. This one draws the shape the page actually renders: the opening
 * band, one section head, and chart cards at the height the SVG occupies.
 */
export default function ProgressLoading() {
  return (
    <ViewTransition exit="vt-reveal-out">
      <section className="max-w-4xl" aria-busy>
        <div className="hero-band card spot p-5 sm:p-6">
          <Sk className="h-3 w-20" />
          <Sk className="mt-2 h-9 w-72 max-w-full" />
          <Sk className="mt-3 h-4 w-full max-w-prose" />
          <Sk className="mt-1.5 h-4 w-2/3 max-w-prose" />
          <div className="mt-3 flex gap-2">
            <Sk className="h-6 w-20 rounded-full" />
            <Sk className="h-6 w-20 rounded-full" />
          </div>
          <div className="mt-4 flex gap-2 border-t border-line pt-3.5">
            <Sk className="h-9 w-24 rounded-full" />
            <Sk className="h-9 w-24 rounded-full" />
            <Sk className="h-9 w-24 rounded-full" />
          </div>
        </div>

        <Sk className="mt-6 h-5 w-28" />
        <div className="mt-3 space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card p-5">
              <Sk className="h-6 w-40 max-w-full" />
              <Sk className="mt-2 h-4 w-56 max-w-full" />
              {/* The chart is a fixed 560x180 viewBox scaled to the column, so
                  the skeleton reserves the aspect rather than a guessed pixel
                  height and the card does not resize when the SVG lands. */}
              <Sk className="mt-4 aspect-[560/180] w-full" />
              <Sk className="mt-3 h-4 w-24" />
            </div>
          ))}
        </div>
      </section>
    </ViewTransition>
  );
}
