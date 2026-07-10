"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { awardXp, todayKey, XP_AWARDS } from "@/lib/progression";
import { SKILLS } from "@/lib/skills";

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

  revalidatePath("/goals");
  return { status: "success", key: Date.now() };
}

export async function completeGoal(id: string) {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) redirect("/login");
  if (!z.uuid().safeParse(id).success) return;

  const { data } = await supabase
    .from("goals")
    .update({ status: "done" })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (data) {
    await awardXp(supabase, userId, XP_AWARDS.goal, `goal:${id}`);
  }
  revalidatePath("/goals");
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

  revalidatePath("/goals");
}
