// The week's plan: what to do on each day, generated ONCE and stored.
//
// The expensive mistake this file exists to prevent is generating a plan on
// page view. A plan that regenerates every time the page is opened turns a
// $0.02 weekly cost into a per-visit one, and it also means the plan silently
// changes under a player who is following it. So: one row per player per week,
// keyed on the Monday, written once and read forever after.
//
// The pure parts (week keys, staleness, day labels) live here and are unit
// tested. Relative imports with the extension for the same reason as
// lib/progression.ts, which this borrows the calendar arithmetic from.
import { shiftDayKey } from "./progression.ts";
import type { Skill } from "@/lib/skills";

/** The seven day labels, Monday first, matching how a training week reads. */
export const PLAN_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type PlanDay = {
  /** One of PLAN_DAYS. */
  day: string;
  /** The skill this day serves, or "recovery" for a rest/mobility day. */
  focus: string;
  /** What to actually do, in one or two sentences. */
  detail: string;
  /** A slug from content/drills.ts, or null for rest and film days. */
  drill_slug: string | null;
  minutes: number;
};

export type WeeklyPlan = {
  headline: string;
  /** Why this shape of week, tied to the player's own numbers. */
  why: string;
  days: PlanDay[];
};

export type StoredPlan = {
  week_start: string;
  plan: WeeklyPlan;
  generated_at: string;
};

/**
 * The Monday of the week a day key falls in, as a day key.
 *
 * Calendar arithmetic on the key rather than subtraction on a timestamp, for
 * the reason spelled out in lib/progression.ts: a Pacific day is 23 or 25 hours
 * long twice a year, so stepping back by milliseconds lands on the wrong day
 * around the changeover and would move a player's week under them.
 */
export function weekStartKey(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  // UTC because the key already carries the calendar we mean; constructing in
  // local time would reintroduce the offset the key exists to remove.
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  // getUTCDay is 0 for Sunday. Shift so Monday is 0, which is where a training
  // week starts.
  return shiftDayKey(dayKey, (dow + 6) % 7);
}

/** Is the stored plan the one for the week `dayKey` falls in? */
export function planIsCurrent(stored: StoredPlan | null, dayKey: string): boolean {
  return stored != null && stored.week_start === weekStartKey(dayKey);
}

/** How far through the plan the player is, for the progress line. Counts days
 *  strictly before today, so today is "still to do" rather than already past. */
export function planDayIndex(dayKey: string): number {
  const [year, month, day] = dayKey.split("-").map(Number);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (dow + 6) % 7;
}

/** The seed a plan is generated from. Everything here is already stored, so
 *  building it costs nothing; only the generation call itself spends. */
export type PlanSeed = {
  position: string | null;
  level: string;
  playFrequency: string | null;
  ratings: { skill: Skill; rating: number }[];
  lastFix: { skill: Skill; title: string; metricKey: string | null } | null;
  /** Slugs the plan is allowed to reference. A plan that invents a drill slug
   *  renders as a dead card, so the choice is constrained to the catalog. */
  allowedSlugs: string[];
};

export function planPrompt(seed: PlanSeed): string {
  const ratings =
    seed.ratings.length > 0
      ? seed.ratings
          .map((r) => `${r.skill} ${Math.round(r.rating)}`)
          .sort()
          .join(", ")
      : "no skills rated yet";

  const fix = seed.lastFix
    ? `Their last breakdown was on ${seed.lastFix.skill} and told them to work on: "${seed.lastFix.title}"${
        seed.lastFix.metricKey ? ` (checkpoint: ${seed.lastFix.metricKey})` : ""
      }.`
    : "They have not had a breakdown yet, so do not claim to know their technique.";

  return [
    "Write one week of volleyball training for a single player. Monday through Sunday, one entry per day.",
    "",
    `Player: ${seed.position ?? "position not set"}, self-described level ${seed.level}, plays ${seed.playFrequency ?? "an unknown amount"}.`,
    `Current skill ratings out of 100: ${ratings}.`,
    fix,
    "",
    "RULES",
    "- Build the week around the checkpoint their last breakdown named, if there is one. That is the whole point of the plan.",
    "- Include at least one full rest or mobility day, and never schedule hard jump-loading on consecutive days. Jumper's knee and Achilles tendinopathy are the two injuries this sport hands out for ignoring that.",
    "- Do not give calorie targets, macro targets, weight targets, or supplement advice of any kind. If nutrition is relevant to a day, keep it to timing of ordinary meals and water.",
    "- Do not prescribe a one-rep max or any lift the player would need a spotter and a coach to attempt safely. Bodyweight, medicine ball, band, and plyometric progressions, with form cues, are always the right register here.",
    "- Each day's `detail` must be something they can actually do without a coach present.",
    "- `minutes` is realistic for someone with a job or school: 20 to 60 on training days, 10 to 20 on recovery days.",
    "- `drill_slug` must be one of the slugs listed below, or null for rest, film review, and match days. Never invent a slug.",
    "- `why` must reference their actual numbers. If nothing has been measured, say that plainly instead of inventing a rationale.",
    "",
    `ALLOWED DRILL SLUGS: ${seed.allowedSlugs.join(", ")}`,
  ].join("\n");
}
