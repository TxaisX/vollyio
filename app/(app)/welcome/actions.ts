"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { SKILLS, SKILL_LABEL } from "@/lib/skills";

const LEVELS = ["beginner", "intermediate", "advanced", "elite"] as const;

const onboardingSchema = z.object({
  level: z.enum(LEVELS),
  skill: z.enum(SKILLS),
  target_rating: z.coerce.number().int().min(1).max(100).optional(),
});

export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) redirect("/login");

  const parsed = onboardingSchema.safeParse({
    level: formData.get("level"),
    skill: formData.get("skill"),
    target_rating: formData.get("target_rating") || undefined,
  });
  // A malformed submit still lands the player somewhere useful.
  if (!parsed.success) redirect("/analyze");
  const { level, skill, target_rating } = parsed.data;

  await supabase.from("profiles").update({ level }).eq("id", userId);

  if (target_rating) {
    const deadline = new Date(Date.now() + 90 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    await supabase.from("goals").insert({
      user_id: userId,
      title: `${SKILL_LABEL[skill]} to ${target_rating}`,
      skill,
      target_rating,
      deadline,
    });
  }

  redirect(`/analyze?skill=${skill}`);
}
