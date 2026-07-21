"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { profileUpdateFromForm } from "@/lib/profile-update";

const LEVELS = ["beginner", "intermediate", "expert", "pro"] as const;

// The dashboard greeting reads display_name and level, so profile writes
// revalidate both surfaces.
function revalidateProfileSurfaces() {
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function setLevel(formData: FormData) {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) return;

  const level = String(formData.get("level") ?? "");
  if (!(LEVELS as readonly string[]).includes(level)) return;
  await supabase.from("profiles").update({ level }).eq("id", userId);
  revalidateProfileSurfaces();
}

export async function setTrainingConsent(formData: FormData) {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) return;

  const allow = formData.get("allow") === "true";
  await supabase
    .from("profiles")
    .update({
      training_consent: allow,
      training_consent_at: new Date().toISOString(),
    })
    .eq("id", userId);
  revalidateProfileSurfaces();
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) return;

  const update = profileUpdateFromForm(formData);
  if (!update) return;
  await supabase.from("profiles").update(update).eq("id", userId);
  revalidateProfileSurfaces();
}
