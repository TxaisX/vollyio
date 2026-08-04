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

  // The name lives in two places and only one of them was ever written here.
  // Auth email (confirm, reset, magic link) is rendered by the send-email hook,
  // which only sees auth metadata, so a player who set or changed their name in
  // settings kept getting addressed by whatever they typed at signup, or by
  // nothing at all if they skipped the field. Mirroring it keeps every email
  // using the name the player last chose. Best effort: a failure here must not
  // cost them the profile write that already succeeded.
  if (update.display_name) {
    await supabase.auth.updateUser({ data: { display_name: update.display_name } });
  }
  revalidateProfileSurfaces();
}
