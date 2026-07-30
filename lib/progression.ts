import type { SupabaseClient } from "@supabase/supabase-js";

// These amounts are DISPLAY ONLY. The authority is `public.award_xp` (migration
// 036), which derives the amount from the reason server-side; a number here can
// promise a reward the database will not pay, never grant one. Keep the two in
// step: lib/progression.test.ts pins them together.
export const XP_AWARDS = {
  analysis: 50,
  challenge: 75,
  goal: 150,
} as const;

const cumulativeXp = (level: number) => 125 * (level - 1) * level;

export function levelFromXp(xp: number) {
  let level = 1;
  while (cumulativeXp(level + 1) <= xp) level++;
  const floor = cumulativeXp(level);
  return { level, into: xp - floor, span: cumulativeXp(level + 1) - floor };
}

// Calendar days pinned to Pacific time: the user base is US/CA and a fixed
// zone means a streak can never reset because a server moved regions.
const STREAK_TZ = "America/Los_Angeles";

/**
 * Step a `YYYY-MM-DD` key back by whole CALENDAR days.
 *
 * This replaces subtracting `offsetDays * 86_400_000` from the clock, which is
 * wrong twice a year because a Pacific day is 23 hours long when the clocks go
 * forward and 25 when they go back. Just after local midnight on the day after
 * spring-forward, a fixed 24-hour step lands before the previous midnight and
 * skips a whole day, so a live streak snaps back. Late on the evening the
 * clocks go back, the same step returns today's key again, so one day of work
 * counts twice. A date key carries no offset, so shifting it in UTC is
 * arithmetic on the calendar instead of on elapsed time, and both cases go away.
 */
export function shiftDayKey(dayKey: string, offsetDays: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - offsetDays))
    .toISOString()
    .slice(0, 10);
}

export function todayKey(offsetDays = 0, nowMs = Date.now()) {
  const today = new Date(nowMs).toLocaleDateString("en-CA", {
    timeZone: STREAK_TZ,
  });
  return offsetDays === 0 ? today : shiftDayKey(today, offsetDays);
}

export function streakFromDates(dates: Set<string>, nowMs = Date.now()) {
  // One clock read for the whole walk: re-reading it per step lets a request
  // that straddles local midnight compare two different "today"s.
  const today = todayKey(0, nowMs);
  let streak = 0;
  const offset = dates.has(today) ? 0 : 1;
  while (dates.has(shiftDayKey(today, offset + streak))) streak++;
  return streak;
}

export type Progress = {
  xp: number;
  level: number;
  into: number;
  span: number;
  streak: number;
  challengeDone: boolean;
};

export async function getProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<Progress> {
  const { data: events } = await supabase
    .from("xp_events")
    .select("amount, reason, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  // One instant for both derived answers, so today's challenge and today's
  // streak can never disagree about which day it is.
  const now = Date.now();
  const xp = (events ?? []).reduce((sum, e) => sum + e.amount, 0);
  const dates = new Set(
    (events ?? []).map((e) =>
      new Date(e.created_at).toLocaleDateString("en-CA", {
        timeZone: STREAK_TZ,
      }),
    ),
  );
  const challengeDone = (events ?? []).some(
    (e) => e.reason === challengeReason(todayKey(0, now)),
  );

  return {
    xp,
    ...levelFromXp(xp),
    streak: streakFromDates(dates, now),
    challengeDone,
  };
}

/**
 * Award XP for work already done. Returns the amount awarded, or 0.
 *
 * The AMOUNT is not passed. `public.award_xp` (migration 036) decides it from
 * the reason and then verifies the work behind that reason exists and belongs
 * to the caller, because a client that can name a price is a client that can
 * mint XP (D-071). It is also idempotent per reason, so a retry returns 0
 * rather than paying twice, and `userId` is no longer an argument because the
 * function reads `auth.uid()` instead of trusting one.
 */
export async function awardXp(
  supabase: SupabaseClient,
  reason: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("award_xp", { p_reason: reason });
  if (error) {
    // Never fail the action that earned it: the goal is still completed and the
    // analysis is still saved. A missing award is an operator problem.
    console.error("[xp] award failed", { reason, message: error.message });
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

export const challengeReason = (dateKey: string) => `challenge:${dateKey}`;

// What today's work actually IS now lives in lib/daily-assignment.ts, which
// picks against the player's own weakest checkpoint instead of hashing the
// whole catalog. This file is XP and streak arithmetic only.
