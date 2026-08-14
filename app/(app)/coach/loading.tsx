import { ViewTransition } from "react";

function Sk({ className = "" }: { className?: string }) {
  return <span className={`skeleton block rounded bg-chalk/10 ${className}`} />;
}

const BUBBLES = [
  { me: false, h: "h-16", w: "w-4/5" },
  { me: true, h: "h-8", w: "w-1/2" },
  { me: false, h: "h-20", w: "w-3/4" },
  { me: true, h: "h-8", w: "w-2/5" },
  { me: false, h: "h-12", w: "w-2/3" },
];

/**
 * THIS SKELETON WAS DRAWING CHROME THE PAGE NO LONGER HAS (fixed D-117).
 *
 * It opened with a 3px eyebrow over a 36px title block, which is the gold
 * mono kicker and the `text-page-title` h1 reading "Ask your coach" that the
 * page deleted: roughly 4rem at the top of a surface where the conversation IS
 * the content. The page has been one row of controls for a while, so every
 * visit to /coach drew a title, then threw it away and slid the whole
 * transcript up when the data landed.
 *
 * It now mirrors the page: the same pinned non-scrolling height, the same
 * control row, and the session rail from lg. The height and the negative
 * bottom margin are copied from the page deliberately and are pinned together
 * with the layout's padding by lib/nav-contract.test.ts.
 */
export default function CoachLoading() {
  return (
    <ViewTransition exit="vt-reveal-out">
      <section
        className="mx-auto flex h-[calc(100dvh-5.75rem)] w-full max-w-5xl flex-col overflow-hidden -mb-28 md:-mb-12 md:h-[calc(100dvh-2rem)] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-x-8 xl:max-w-6xl xl:grid-cols-[15rem_minmax(0,1fr)_15rem]"
        aria-busy
      >
        {/* The control row, not a title block: drawer trigger, the label-sized
            heading, and the new-chat button. All three vanish at lg, where the
            rail beside this carries them. */}
        <div className="flex shrink-0 items-center gap-2 lg:col-start-2 lg:pb-2">
          <Sk className="h-11 w-11 shrink-0 rounded-control lg:hidden" />
          <Sk className="h-3 w-14" />
          <Sk className="ml-auto h-11 w-11 shrink-0 rounded-control lg:hidden" />
        </div>

        <div className="hidden lg:sticky lg:top-8 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:flex lg:max-h-[calc(100dvh-6rem)] lg:flex-col">
          <Sk className="h-11 w-full rounded-control" />
          <Sk className="mt-3 mb-1 ml-2 h-2.5 w-16" />
          <div className="card mt-1 divide-y divide-line overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-3.5 py-2.5">
                <Sk className="h-3.5 w-4/5" />
                <Sk className="mt-1.5 h-2.5 w-12" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 w-full max-w-2xl flex-1 flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0 lg:col-start-2 lg:mx-auto">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden py-6">
            {BUBBLES.map((b, i) => (
              <div
                key={i}
                className={`flex flex-col ${b.me ? "items-end" : "items-start"}`}
              >
                <Sk
                  className={`${b.h} ${b.w} max-w-[85%] rounded-2xl ${
                    b.me ? "rounded-br-md" : "rounded-bl-md"
                  }`}
                />
                <Sk className="mt-1 h-2.5 w-10" />
              </div>
            ))}
          </div>

          <div className="mt-auto flex items-end gap-2 pb-1 pt-2">
            <Sk className="h-11 flex-1 rounded-control" />
            <Sk className="h-11 w-11 shrink-0 rounded-control" />
          </div>
        </div>
      </section>
    </ViewTransition>
  );
}
