"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { profileUpdateFromForm } from "@/lib/profile-update";

// The dashboard greeting reads display_name, so profile writes revalidate
// both surfaces.
function revalidateProfileSurfaces() {
  revalidatePath("/settings");
  revalidatePath("/dashboard");
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
