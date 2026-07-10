"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";

export async function deleteCoachSession(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return;

  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) redirect("/login");

  // Messages cascade with the session row.
  await supabase.from("coach_sessions").delete().eq("id", id).eq("user_id", userId!);
  revalidatePath("/coach");
  redirect("/coach");
}
