"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  awardXp,
  XP_AWARDS,
  challengeReason,
  todayKey,
} from "@/lib/progression";

export async function completeChallenge() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await awardXp(
    supabase,
    user.id,
    XP_AWARDS.challenge,
    challengeReason(todayKey()),
  );
  revalidatePath("/dashboard");
}
