import Link from "next/link";
import { deleteCoachSession } from "@/app/(app)/coach/actions";

export type CoachSession = {
  id: string;
  title: string;
  updated_at: string;
};

function dayLabel(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round(
    (startOfDay(now).getTime() - startOfDay(then).getTime()) / 86_400_000,
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function DeleteButton({ session }: { session: CoachSession }) {
  return (
    <form action={deleteCoachSession} className="shrink-0">
      <input type="hidden" name="id" value={session.id} />
      <button
        type="submit"
        aria-label={`Delete session: ${session.title}`}
        className="flex h-8 w-8 items-center justify-center rounded-control text-chalk-dim transition-colors hover:text-coral"
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

/** Session list: a left rail on desktop, a horizontal strip on small screens. */
export function CoachSessions({
  sessions,
  activeId,
}: {
  sessions: CoachSession[];
  activeId: string | null;
}) {
  return (
    <>
      {/* Desktop rail */}
      <nav
        aria-label="Coach sessions"
        className="hidden lg:sticky lg:top-8 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:flex lg:max-h-[calc(100dvh-6rem)] lg:flex-col lg:gap-1"
      >
        <Link
          href="/coach?s=new"
          aria-current={activeId == null ? "true" : undefined}
          className={`btn-ghost mb-3 justify-center text-sm ${
            activeId == null ? "border-gold text-gold" : ""
          }`}
        >
          New chat
        </Link>
        <p className="mb-1 px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-chalk-dim">
          Sessions
        </p>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-2">
          {sessions.length === 0 && (
            <p className="px-2 py-1 text-xs text-chalk-dim">
              Your conversations show up here.
            </p>
          )}
          {sessions.map((session) => {
            const isActive = session.id === activeId;
            return (
              <div
                key={session.id}
                className={`flex items-center gap-1 rounded-control pr-1 transition-colors ${
                  isActive ? "bg-navy-lighter" : "hover:bg-navy-light"
                }`}
              >
                <Link
                  href={`/coach?s=${session.id}`}
                  aria-current={isActive ? "true" : undefined}
                  title={session.title}
                  className="min-w-0 flex-1 px-2 py-2"
                >
                  <span
                    className={`block truncate text-sm ${
                      isActive ? "text-chalk" : "text-chalk-dim"
                    }`}
                  >
                    {session.title}
                  </span>
                  <span className="block font-mono text-[10px] text-chalk-dim">
                    {dayLabel(session.updated_at)}
                  </span>
                </Link>
                {isActive && <DeleteButton session={session} />}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Small-screen strip */}
      <nav aria-label="Coach sessions" className="mt-4 flex items-center gap-2 lg:hidden">
        <Link
          href="/coach?s=new"
          aria-current={activeId == null ? "true" : undefined}
          className={`chip min-h-11 shrink-0 ${activeId == null ? "chip-active" : ""}`}
        >
          + New chat
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
          {sessions.map((session) => {
            const isActive = session.id === activeId;
            return (
              <span key={session.id} className="flex shrink-0 items-center gap-1">
                <Link
                  href={`/coach?s=${session.id}`}
                  aria-current={isActive ? "true" : undefined}
                  title={session.title}
                  className={`chip min-h-11 max-w-48 truncate ${isActive ? "chip-active" : ""}`}
                >
                  {session.title}
                </Link>
                {isActive && (
                  <form action={deleteCoachSession}>
                    <input type="hidden" name="id" value={session.id} />
                    <button
                      type="submit"
                      aria-label={`Delete session: ${session.title}`}
                      className="chip min-h-11 px-3 text-chalk-dim hover:text-coral"
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
                )}
              </span>
            );
          })}
        </div>
      </nav>
    </>
  );
}
