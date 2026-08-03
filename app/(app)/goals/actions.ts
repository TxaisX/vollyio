"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { awardXp, todayKey } from "@/lib/progression";
import { claimAchievements, type AchievementKey } from "@/lib/achievements";
import { SKILLS } from "@/lib/skills";

// The goals surface is the dashboard board (D-088), and the archive renders
// under Progress. Both re-read after every write; /goals itself is a redirect
// and needs nothing.
function revalidateGoalSurfaces() {
  revalidatePath("/dashboard");
  revalidatePath("/progress/milestones");
}

const FIELDS = ["title", "skill", "target_rating", "deadline"] as const;
type Field = (typeof FIELDS)[number];

export type CreateGoalState =
  | {
      status: "error";
      key: number;
      errors: Partial<Record<Field, string>>;
      values: { title: string; target_rating: string; deadline: string };
    }
  | { status: "success"; key: number }
  | null;

const createGoalSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the goal a name.")
    .max(80, "Keep it under 80 characters."),
  skill: z.enum(SKILLS, "Pick one of the six skills.").optional(),
  target_rating: z.coerce
    .number("Enter a number.")
    .int("Whole numbers only.")
    .min(1, "Target is 1 to 100.")
    .max(100, "Target is 1 to 100.")
    .optional(),
  deadline: z.iso
    .date("Pick a valid date.")
    .refine((d) => d >= todayKey(), "Deadline must be today or later.")
    .optional(),
});

const opt = (v: string) => (v === "" ? undefined : v);
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function createGoal(
  _prev: CreateGoalState,
  formData: FormData,
): Promise<CreateGoalState> {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) redirect("/login");

  const values = {
    title: str(formData.get("title")),
    target_rating: str(formData.get("target_rating")),
    deadline: str(formData.get("deadline")),
  };

  const parsed = createGoalSchema.safeParse({
    title: values.title,
    skill: opt(str(formData.get("skill"))),
    target_rating: opt(values.target_rating),
    deadline: opt(values.deadline),
  });

  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors;
    const errors: Partial<Record<Field, string>> = {};
    for (const field of FIELDS) {
      const message = flat[field]?.[0];
      if (message) errors[field] = message;
    }
    return { status: "error", key: Date.now(), errors, values };
  }

  const { error } = await supabase.from("goals").insert({
    user_id: userId,
    title: parsed.data.title,
    skill: parsed.data.skill ?? null,
    target_rating: parsed.data.target_rating ?? null,
    deadline: parsed.data.deadline ?? null,
  });
  if (error) {
    return {
      status: "error",
      key: Date.now(),
      errors: { title: "Could not save the goal. Try again." },
      values,
    };
  }

  revalidateGoalSurfaces();
  return { status: "success", key: Date.now() };
}

// What the board needs back to celebrate honestly: whether the update landed,
// what the ledger actually paid (0 on a replay), and any badge the completion
// tipped over. The amounts come from the database, never from here (D-071).
export type CompleteGoalResult = {
  completed: boolean;
  awarded: number;
  badges: AchievementKey[];
};

export async function completeGoal(id: string): Promise<CompleteGoalResult> {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) redirect("/login");
  if (!z.uuid().safeParse(id).success) {
    return { completed: false, awarded: 0, badges: [] };
  }

  const { data } = await supabase
    .from("goals")
    // completed_at is advisory (migration 050): it feeds the deadline badge
    // and nothing that decides authorization, billing or scoring.
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (!data) {
    revalidateGoalSurfaces();
    return { completed: false, awarded: 0, badges: [] };
  }

  // The status is already 'done' above, which is exactly what award_xp
  // re-checks before paying: the goal has to be finished and owned by the
  // caller, so a bare reason string cannot buy 150 XP (D-071).
  const awarded = await awardXp(supabase, `goal:${id}`);
  // Same pattern one level up: the claim re-derives every criterion from the
  // caller's own rows, so completing a goal is simply the moment a goal badge
  // can first come back. Fails soft to [] and never blocks the completion.
  const badges = await claimAchievements(supabase);

  revalidateGoalSurfaces();
  return { completed: true, awarded, badges };
}

export async function abandonGoal(id: string) {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) redirect("/login");
  if (!z.uuid().safeParse(id).success) return;

  await supabase
    .from("goals")
    .update({ status: "abandoned" })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "active");

  revalidateGoalSurfaces();
}
