"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import {
  awardXp,
  XP_AWARDS,
  challengeReason,
  todayKey,
} from "@/lib/progression";

export async function completeChallenge() {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) return;

  await awardXp(
    supabase,
    userId,
    XP_AWARDS.challenge,
    challengeReason(todayKey()),
  );
  revalidatePath("/dashboard");
}
