import Link from "next/link";
import { deleteCoachSession } from "@/app/(app)/coach/actions";
import { CoachDrawer } from "@/components/coach-chat";
import { relativeDay } from "@/lib/relative-day";

export type CoachSession = {
  id: string;
  title: string;
  updated_at: string;
};

function DeleteButton({ session }: { session: CoachSession }) {
  return (
    <form action={deleteCoachSession} className="shrink-0">
      <input type="hidden" name="id" value={session.id} />
      {/* .icon-btn rather than the h-8 w-8 box this used to be: 32px was under
          the 44px floor every other control on the surface holds to, and it was
          the only control in the list that missed it. The glyph stays small; the
          thing you have to hit is what grew. */}
      <button
        type="submit"
        aria-label={`Delete session: ${session.title}`}
        className="icon-btn transition-colors hover:text-coral-ink"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="h-3.5 w-3.5"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </form>
  );
}

/**
 * The list itself, rendered once and placed twice: in the desktop rail and in
 * the phone drawer. One element, so the two can never drift apart, and it stays
 * a server component in both places, so the session rows never ship to the
 * browser even though the drawer around them is interactive.
 *
 * It follows the transcript down a size. This is a list of conversations you are
 * NOT currently reading, so it has no business being the loudest type in view;
 * nothing here gives up its tap target for that, min-h-11 below holds it.
 */
function SessionList({
  sessions,
  activeId,
}: {
  sessions: CoachSession[];
  activeId: string | null;
}) {
  return (
    <>
      <Link
        href="/coach?s=new"
        aria-current={activeId == null ? "true" : undefined}
        className={`btn-ghost mb-2 min-h-11 shrink-0 justify-center py-2 text-xs ${
          activeId == null ? "border-gold text-gold-ink" : ""
        }`}
      >
        New chat
      </Link>
      <p className="mb-1 shrink-0 px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-chalk-dim">
        Sessions
      </p>
      {/* ONE DIVIDED LIST, not thirty rounded blocks (D-117). Each row used to
          be its own `rounded-control` hover target with a 4px gap under it, so
          a full rail spent about 120px on gutter and read as thirty small
          objects rather than as one list. The card border and `divide-y` are
          the same treatment the dashboard's skill meters use, which is what a
          compact row list looks like everywhere else in the app now.

          NO `.row-tile` here, deliberately. The glyph holder is the language's
          row lead everywhere else, but a session has nothing to put in one:
          the same chat icon repeated thirty times is chrome carrying no
          information, and 36px of it per row in a 15rem column is the width
          the title needs. The rows keep their own left edge instead.

          The label above stays mono at 10px rather than becoming a
          `.section-head`. The rail follows the transcript DOWN a size on
          purpose - this is a list of conversations you are not currently
          reading - and a 15px bold display heading with an accent bar would
          make the quietest column on the page the loudest thing in it. */}
      <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        {sessions.length === 0 && (
          <p className="px-3.5 py-2.5 text-xs text-chalk-dim">
            Your conversations show up here.
          </p>
        )}
        <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain">
          {sessions.map((session) => {
            const isActive = session.id === activeId;
            return (
              <div
                key={session.id}
                className={`flex items-center gap-1 pr-1 transition-colors ${
                  isActive ? "bg-navy-lighter" : "hover:bg-navy-lighter/45"
                }`}
              >
                <Link
                  href={`/coach?s=${session.id}`}
                  aria-current={isActive ? "true" : undefined}
                  title={session.title}
                  className="flex min-h-11 min-w-0 flex-1 flex-col justify-center px-3.5 py-2.5"
                >
                  <span
                    className={`block truncate text-xs ${
                      isActive ? "text-chalk" : "text-chalk-dim"
                    }`}
                  >
                    {session.title}
                  </span>
                  <span className="block font-mono text-[10px] text-chalk-dim">
                    {relativeDay(session.updated_at)}
                  </span>
                </Link>
                {isActive && <DeleteButton session={session} />}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** The persistent rail, from lg up. A phone hides the list because there is no
 *  room for it; a desktop has the room, and making someone open a panel to see
 *  conversations that would otherwise just be sitting there is worse, not more
 *  consistent. So the rail stays, and the drawer below is the phone's answer to
 *  the same problem rather than a replacement for this one. */
export function CoachSessionsRail({
  sessions,
  activeId,
}: {
  sessions: CoachSession[];
  activeId: string | null;
}) {
  return (
    <nav
      aria-label="Conversations"
      className="hidden lg:sticky lg:top-8 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:flex lg:max-h-[calc(100dvh-6rem)] lg:flex-col lg:gap-1"
    >
      <SessionList sessions={sessions} activeId={activeId} />
    </nav>
  );
}

/** The same list as an off-canvas panel, phone only. The trigger renders inline
 *  wherever this is placed, which is the top left of the coach surface; the
 *  panel itself goes to the browser's top layer and overlays the conversation
 *  rather than pushing it around, so the pinned, non-scrolling structure of the
 *  page underneath is untouched. See CoachDrawer for how that is held. */
export function CoachSessionsDrawer({
  sessions,
  activeId,
}: {
  sessions: CoachSession[];
  activeId: string | null;
}) {
  return (
    <CoachDrawer>
      <nav aria-label="Conversations" className="flex min-h-0 flex-1 flex-col gap-1">
        <SessionList sessions={sessions} activeId={activeId} />
      </nav>
    </CoachDrawer>
  );
}
