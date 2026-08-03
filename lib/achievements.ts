import type { SupabaseClient } from "@supabase/supabase-js";

// The badge catalog. Names and descriptions live here; the PRICES and the
// earning criteria live in SQL (`claim_achievements`, migration 050), because
// the database is the thing that actually pays. `lib/achievements.test.ts`
// pins the two together the same way lib/plans.test.ts pins the allowance:
// a badge this file promises at one price and the database pays at another is
// a lie with a number on it.
//
// Every badge is derivable from rows the player already owns (analyses, goals,
// challenge_completions, xp_events), which is what keeps the claim function in
// the award_xp mold (D-071): the client asks, the server re-derives, nothing a
// request names can mint a badge or choose what it pays.
export type AchievementDef = {
  key: string;
  name: string;
  description: string;
  xp: number;
};

export const ACHIEVEMENTS = [
  {
    key: "first_read",
    name: "First Read",
    description: "Your first rep, filmed and scored.",
    xp: 100,
  },
  {
    key: "ten_reps",
    name: "Ten Reps",
    description: "Ten analyses on the record.",
    xp: 100,
  },
  {
    key: "film_junkie",
    name: "Film Junkie",
    description: "Twenty-five analyses on the record.",
    xp: 200,
  },
  {
    key: "all_six",
    name: "All Six",
    description: "Every skill read at least once.",
    xp: 150,
  },
  {
    key: "eighty_club",
    name: "Eighty Club",
    description: "A personal best reaches 80.",
    xp: 150,
  },
  {
    key: "ninety_club",
    name: "Ninety Club",
    description: "A personal best reaches 90.",
    xp: 250,
  },
  {
    key: "finisher",
    name: "Finisher",
    description: "Your first goal, set and completed.",
    xp: 100,
  },
  {
    key: "hat_trick",
    name: "Hat Trick",
    description: "Three goals completed.",
    xp: 150,
  },
  {
    key: "ahead_of_schedule",
    name: "Ahead of Schedule",
    description: "A goal finished before its deadline.",
    xp: 100,
  },
  {
    key: "ten_challenges",
    name: "Ten Challenges",
    description: "Ten daily challenges logged.",
    xp: 100,
  },
  {
    key: "full_week",
    name: "Full Week",
    description: "A seven-day streak.",
    xp: 150,
  },
  {
    key: "habit",
    name: "Habit",
    description: "A thirty-day streak.",
    xp: 300,
  },
] as const satisfies readonly AchievementDef[];

export type AchievementKey = (typeof ACHIEVEMENTS)[number]["key"];

export const ACHIEVEMENT_BY_KEY: Record<AchievementKey, AchievementDef> =
  Object.fromEntries(ACHIEVEMENTS.map((a) => [a.key, a])) as Record<
    AchievementKey,
    AchievementDef
  >;

export function isAchievementKey(value: unknown): value is AchievementKey {
  return (
    typeof value === "string" &&
    (ACHIEVEMENTS as readonly AchievementDef[]).some((a) => a.key === value)
  );
}

export type EarnedAchievement = { key: AchievementKey; earned_at: string };

/**
 * Ask the database to award anything newly earned. Returns the fresh keys so
 * the caller can celebrate them; returns [] on any failure, because a badge is
 * never worth failing the action that earned it, and a deployment where
 * migration 050 has not landed yet must degrade to "no badges" rather than to
 * an error page.
 */
export async function claimAchievements(
  supabase: SupabaseClient,
): Promise<AchievementKey[]> {
  const { data, error } = await supabase.rpc("claim_achievements");
  if (error) {
    console.error("[achievements] claim failed", { message: error.message });
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((row: { key?: unknown }) => row?.key)
    .filter((key): key is AchievementKey => isAchievementKey(key));
}

/** The player's earned badges, newest first. Fails soft to [] like the claim. */
export async function readAchievements(
  supabase: SupabaseClient,
): Promise<EarnedAchievement[]> {
  const { data, error } = await supabase
    .from("achievements")
    .select("key, earned_at")
    .order("earned_at", { ascending: false });
  if (error) {
    console.error("[achievements] read failed", { message: error.message });
    return [];
  }
  return ((data as { key: unknown; earned_at: string }[] | null) ?? []).filter(
    (row): row is EarnedAchievement => isAchievementKey(row.key),
  );
}
