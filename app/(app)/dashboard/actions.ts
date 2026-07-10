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

export async function setTrainingConsent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const allow = formData.get("allow") === "true";
  await supabase
    .from("profiles")
    .update({
      training_consent: allow,
      training_consent_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  revalidatePath("/dashboard");
}
