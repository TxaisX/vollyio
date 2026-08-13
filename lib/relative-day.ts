/**
 * "3d ago", not "Aug 10".
 *
 * A list of reps is read for recency, and a date makes the reader do the
 * subtraction. Past about a month the arithmetic stops being useful and the
 * date is the more informative answer, so it comes back.
 *
 * THREE COPIES OF THIS EXISTED before D-117: one on the dashboard, one on
 * /history in the shape of a bare `toLocaleDateString`, and `dayLabel` in
 * components/coach-sessions.tsx. The dashboard's and the coach's disagreed
 * about the same instant. The dashboard divided elapsed milliseconds by a day,
 * so a rep filmed at 11pm last night read "Today" until 11pm tonight; the
 * coach's compared calendar days, which is what a person means by "yesterday".
 * The coach's boundary won and the dashboard's vocabulary won: a row in a
 * compact list has room for "3d ago" and not for "3 days ago".
 *
 * Computed on the server, which every caller already is, so there is no clock
 * to disagree with the client's. That also means the boundary is the server's
 * midnight rather than the viewer's, which is pre-existing behaviour and not
 * something this module changed.
 */
export function relativeDay(iso: string, nowMs: number = Date.now()): string {
  const then = new Date(iso);
  const now = new Date(nowMs);
  const days = Math.round(
    (startOfDay(now).getTime() - startOfDay(then).getTime()) / 86_400_000,
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 35) return `${Math.floor(days / 7)}w ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
