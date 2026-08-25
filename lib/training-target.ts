// The season's one date, and the shape of the runway to it.
//
// THE HONESTY RULE THIS FILE EXISTS TO HOLD. A countdown is a commitment
// device, not a readiness forecast. Nothing this product measures predicts how
// a player performs at a tournament, so nothing here returns a percentage, a
// projected rating, or a verdict on whether somebody is ready. Weeks remaining
// and the phase those weeks fall in are both simply true, which is the whole
// reason they can be shown beside a rating without lying about it.
//
// Everything is PURE and calendar-based. The band renders on the server and
// hydrates on the client, so both sides have to reach the same answer from the
// same two day keys; anything reading a clock of its own would disagree across
// that boundary and flip the phase under the player mid-render.
//
// Relative import with the extension, and no "@/" alias on anything that
// survives to runtime, for the same reason as lib/daily-assignment.ts: this is
// exercised under `node --test`, which resolves imports itself and knows
// nothing about the bundler's path mapping.

/** How far out a target may be set. A date three years away produces a strip
 *  that is 90% one flat bar and a countdown nobody acts on, which is the
 *  opposite of a commitment device. A year is the longest horizon a season
 *  actually has. */
export const MAX_TARGET_DAYS = 365;

export type TargetPhase = "base" | "build" | "sharpen" | "compete";

/**
 * The four phases, in the order they are lived, with the WEEKS each one owns
 * at the end of the runway.
 *
 * Read backwards from the date: the last week is the event's own week, the two
 * before it are for cleaning up what already exists, the five before those are
 * where load actually goes in, and everything earlier is base. A target set
 * six weeks out therefore has no base phase at all, and the strip shows three
 * segments rather than inventing a fourth, because a phase with no weeks in it
 * is not a phase the player gets.
 *
 * `weeks: null` means "whatever is left over", which is only ever base.
 */
export const TARGET_PHASES: {
  phase: TargetPhase;
  label: string;
  weeks: number | null;
  /** One line naming what this phase is for. Never a claim about outcome. */
  blurb: string;
}[] = [
  {
    phase: "base",
    label: "Base",
    weeks: null,
    blurb: "Volume and habit. Film often and chase the checkpoint, not the number.",
  },
  {
    phase: "build",
    label: "Build",
    weeks: 5,
    blurb: "Load your weakest skill. This is the stretch where a rating actually moves.",
  },
  {
    phase: "sharpen",
    label: "Sharpen",
    weeks: 2,
    blurb: "Nothing new. Clean reps of what you already know, and rest between them.",
  },
  {
    phase: "compete",
    label: "Compete",
    weeks: 1,
    blurb: "The week itself. Play, and keep training light enough to arrive fresh.",
  },
];

/** Whole calendar days from one `YYYY-MM-DD` key to another. Negative once the
 *  date has passed.
 *
 *  Built in UTC on the parsed parts rather than by subtracting timestamps, for
 *  the reason lib/progression.ts spells out: a Pacific day is 23 or 25 hours
 *  long twice a year, so dividing elapsed milliseconds by 86,400,000 is off by
 *  one for a fortnight after every changeover. A date key carries no offset, so
 *  differencing it in UTC is arithmetic on the calendar itself. */
export function daysUntil(todayKey: string, eventKey: string): number {
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const [ey, em, ed] = eventKey.split("-").map(Number);
  const today = Date.UTC(ty, tm - 1, td);
  const event = Date.UTC(ey, em - 1, ed);
  return Math.round((event - today) / 86_400_000);
}

/**
 * Training weeks left, counting the part-week the player is standing in as a
 * whole one.
 *
 * Ceiling rather than floor on purpose: five days out is one week of work
 * left, not zero, and a countdown that reads "0 weeks" while there is still a
 * Saturday to train on is telling a player their runway is gone when it is not.
 */
export function weeksUntil(days: number): number {
  return days <= 0 ? 0 : Math.ceil(days / 7);
}

export type PhaseSegment = {
  phase: TargetPhase;
  label: string;
  blurb: string;
  weeks: number;
};

/**
 * The remaining runway cut into phases, earliest first, empty phases dropped.
 *
 * The weeks are allocated from the END backwards, so a short runway loses base
 * before it loses build and loses build before it loses the event's own week.
 * The segments always sum to exactly `weeksLeft`: every number on the strip is
 * a real week, and the strip adds up to the headline, which is what stops the
 * band contradicting itself the way a rounded-per-segment split would.
 */
export function phaseSegments(weeksLeft: number): PhaseSegment[] {
  if (weeksLeft <= 0) return [];

  // Walk backwards through the fixed-length phases, taking what is left.
  const tail = [...TARGET_PHASES].reverse();
  let remaining = weeksLeft;
  const taken = new Map<TargetPhase, number>();
  for (const p of tail) {
    if (p.weeks == null) continue;
    const weeks = Math.min(p.weeks, remaining);
    if (weeks > 0) taken.set(p.phase, weeks);
    remaining -= weeks;
  }
  // Anything still unspent is base, which is the only open-ended phase.
  if (remaining > 0) taken.set("base", remaining);

  return TARGET_PHASES.filter((p) => (taken.get(p.phase) ?? 0) > 0).map((p) => ({
    phase: p.phase,
    label: p.label,
    blurb: p.blurb,
    weeks: taken.get(p.phase)!,
  }));
}

/** The phase this week falls in: the first one with weeks still in it. */
export function currentPhase(weeksLeft: number): PhaseSegment | null {
  return phaseSegments(weeksLeft)[0] ?? null;
}

export type TargetRunway =
  | { state: "ahead"; days: number; weeks: number; segments: PhaseSegment[]; phase: PhaseSegment }
  | { state: "today"; days: 0 }
  | { state: "past"; days: number };

/**
 * Everything the band renders, from the two day keys and nothing else.
 *
 * A passed date is a state rather than a hidden row: the target stays on the
 * page saying it has been and gone, because the alternative is a band that
 * silently empties on the morning of the tournament, which is the one day the
 * player is most likely to open the app.
 */
export function targetRunway(todayKey: string, eventKey: string): TargetRunway {
  const days = daysUntil(todayKey, eventKey);
  if (days < 0) return { state: "past", days };
  if (days === 0) return { state: "today", days: 0 };
  const weeks = weeksUntil(days);
  const segments = phaseSegments(weeks);
  return { state: "ahead", days, weeks, segments, phase: segments[0] };
}

/** "14 weeks out", "6 days out", "Today". The unit switches inside a fortnight
 *  because "2 weeks" and "8 days" are the same runway and only one of them is
 *  a number somebody plans around. */
export function runwayLine(runway: TargetRunway): string {
  if (runway.state === "today") return "Today";
  if (runway.state === "past") {
    const ago = -runway.days;
    return ago === 1 ? "Was yesterday" : `Was ${ago} days ago`;
  }
  if (runway.days <= 13) {
    return runway.days === 1 ? "Tomorrow" : `${runway.days} days out`;
  }
  return `${runway.weeks} weeks out`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * "Sat 6 Dec", built from tables rather than from `toLocaleDateString`.
 *
 * The band renders on the server and again in the browser, and those two run
 * different ICU builds under different default locales, so a formatter would
 * hand back "6 Dec" on one side and "Dec 6" on the other and React would tear
 * the node down as a hydration mismatch. A lookup table cannot disagree with
 * itself. Parsed in UTC for the same reason the differencing is.
 */
export function formatEventDate(eventKey: string): string {
  const [year, month, day] = eventKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${WEEKDAYS[date.getUTCDay()]} ${day} ${MONTHS[month - 1]}`;
}

/**
 * The one big number the band prints, and its unit.
 *
 * Split out of `runwayLine` because the band shows the count large and the
 * sentence small, and a component that re-derived "is this a weeks read or a
 * days read" from the string would be a second copy of the fortnight rule
 * waiting to disagree with the first.
 */
export function runwayCount(
  runway: TargetRunway,
): { value: number; unit: string } | null {
  if (runway.state !== "ahead") return null;
  if (runway.days <= 13) {
    return { value: runway.days, unit: runway.days === 1 ? "day out" : "days out" };
  }
  return { value: runway.weeks, unit: runway.weeks === 1 ? "week out" : "weeks out" };
}
