import type { SupabaseClient } from "@supabase/supabase-js";
import { DRILLS } from "@/content/drills";
import type { Drill } from "@/content/drills-types";
import type { Level } from "@/lib/skills";

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

export function todayKey(offsetDays = 0) {
  const d = new Date(Date.now() - offsetDays * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: STREAK_TZ });
}

export function streakFromDates(dates: Set<string>) {
  let streak = 0;
  let offset = dates.has(todayKey()) ? 0 : 1;
  while (dates.has(todayKey(offset + streak))) streak++;
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

  const xp = (events ?? []).reduce((sum, e) => sum + e.amount, 0);
  const dates = new Set(
    (events ?? []).map((e) =>
      new Date(e.created_at).toLocaleDateString("en-CA", {
        timeZone: STREAK_TZ,
      }),
    ),
  );
  const challengeDone = (events ?? []).some(
    (e) => e.reason === challengeReason(todayKey()),
  );

  return {
    xp,
    ...levelFromXp(xp),
    streak: streakFromDates(dates),
    challengeDone,
  };
}

export async function awardXp(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
  reason: string,
): Promise<boolean> {
  const { data: existing } = await supabase
    .from("xp_events")
    .select("id")
    .eq("user_id", userId)
    .eq("reason", reason)
    .maybeSingle();
  if (existing) return false;

  const { error } = await supabase
    .from("xp_events")
    .insert({ user_id: userId, amount, reason });
  if (error) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("xp")
    .eq("id", userId)
    .single();
  if (profile) {
    await supabase
      .from("profiles")
      .update({ xp: profile.xp + amount })
      .eq("id", userId);
  }
  return true;
}

export const challengeReason = (dateKey: string) => `challenge:${dateKey}`;

const CHALLENGE_POOL: Record<Level, Level[]> = {
  beginner: ["beginner"],
  intermediate: ["beginner", "intermediate"],
  advanced: ["intermediate", "advanced"],
  elite: ["advanced", "elite"],
};

function fnv1a(input: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function dailyChallenge(
  userId: string,
  level: Level,
  dateKey: string,
): Drill {
  const allowed = CHALLENGE_POOL[level] ?? CHALLENGE_POOL.beginner;
  const pool = DRILLS.filter((d) => allowed.includes(d.level));
  return pool[fnv1a(`${userId}:${dateKey}`) % pool.length];
}
