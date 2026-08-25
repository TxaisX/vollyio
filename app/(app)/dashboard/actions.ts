"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { todayKey } from "@/lib/progression";
import { MAX_TARGET_DAYS } from "@/lib/training-target";
import { claimAchievements, type AchievementKey } from "@/lib/achievements";
import { SKILLS } from "@/lib/skills";
import { drillBySlug } from "@/content/drills";

// What the player reports having done. Every field is checked here AND by the
// table's own constraints (migration 036): this layer exists to give a usable
// error, not to be the guard. `felt` is a self-rating, not a score -- it never
// touches skill_ratings, because a player's opinion of a drill is not evidence
// about their technique and must never be laundered into one.
const completion = z.object({
  kind: z.enum(["drill", "study"]),
  skill: z.enum(SKILLS),
  drill_slug: z.string().min(1).max(120).nullable(),
  reps: z.coerce.number().int().min(0).max(500).nullable(),
  felt: z.enum(["easy", "right", "hard"]).nullable(),
});

export type ChallengeState = {
  ok: boolean;
  error: string | null;
  awarded: number;
  badges: AchievementKey[];
};

export async function completeChallenge(
  _prev: ChallengeState,
  formData: FormData,
): Promise<ChallengeState> {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) return { ok: false, error: "Sign in to log today's work.", awarded: 0, badges: [] };

  const parsed = completion.safeParse({
    kind: formData.get("kind"),
    skill: formData.get("skill"),
    drill_slug: emptyToNull(formData.get("drill_slug")),
    reps: emptyToNull(formData.get("reps")),
    felt: emptyToNull(formData.get("felt")),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "That didn't look right. Check the reps and try again.",
      awarded: 0,
      badges: [],
    };
  }
  const value = parsed.data;

  // A slug that is not in the catalog is a client that invented one. Reject
  // rather than store it: content/drills.ts is the only source of drills, and a
  // stored slug that resolves to nothing becomes a broken card forever.
  if (value.drill_slug && !drillBySlug(value.drill_slug)) {
    return { ok: false, error: "That drill doesn't exist.", awarded: 0, badges: [] };
  }
  if (value.kind === "drill" && !value.drill_slug) {
    return { ok: false, error: "A logged drill has to say which drill.", awarded: 0, badges: [] };
  }

  // The day key is sent, but the database checks it against its OWN clock and
  // accepts only today or yesterday (036). A client cannot backfill a streak.
  const { data, error } = await supabase.rpc("complete_daily_challenge", {
    p_day_key: todayKey(),
    p_kind: value.kind,
    p_skill: value.skill,
    p_drill_slug: value.drill_slug,
    p_reps: value.reps,
    p_felt: value.felt,
  });

  if (error) {
    console.error("[challenge] completion failed", { message: error.message });
    return { ok: false, error: "Couldn't save that just now. Try again.", awarded: 0, badges: [] };
  }

  // A logged day can tip a streak or challenge-count badge over, so the claim
  // runs while the player is still looking at the card that earned it. Fails
  // soft to [] and never blocks the completion (migration 050).
  const badges = await claimAchievements(supabase);

  revalidatePath("/dashboard");
  // Zero awarded is a success, not a failure: it means today was already
  // logged. The work is recorded either way and the card should read as done.
  return {
    ok: true,
    error: null,
    awarded: typeof data === "number" ? data : 0,
    badges,
  };
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
}

// ---------------------------------------------------------------------------
// THE SEASON TARGET (D-127).
//
// One dated event per account, which is why every write here goes through the
// archive-then-insert dance rather than a plain upsert: the partial unique
// index in migration 063 is the authority on "one active", and this code is
// what makes losing that race recoverable instead of destructive.
// ---------------------------------------------------------------------------

const TARGET_FIELDS = ["title", "event_date"] as const;
type TargetField = (typeof TARGET_FIELDS)[number];

export type TargetState =
  | {
      status: "error";
      key: number;
      errors: Partial<Record<TargetField, string>>;
      values: { title: string; event_date: string };
    }
  | { status: "success"; key: number }
  | null;

const targetSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Name the event.")
    .max(80, "Keep it under 80 characters."),
  event_date: z.iso
    .date("Pick a valid date.")
    .refine((d) => d >= todayKey(), "The date has to be today or later.")
    // A horizon longer than a season produces a strip that is one flat bar and
    // a countdown nobody plans around, so the cap is a product rule rather
    // than a storage one.
    .refine(
      (d) => d <= todayKey(-MAX_TARGET_DAYS),
      "Pick a date within the next year.",
    ),
});

export async function setTrainingTarget(
  _prev: TargetState,
  formData: FormData,
): Promise<TargetState> {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  const values = {
    title: str(formData.get("title")),
    event_date: str(formData.get("event_date")),
  };
  if (!userId) {
    return {
      status: "error",
      key: Date.now(),
      errors: { title: "Sign in to set a target." },
      values,
    };
  }

  const parsed = targetSchema.safeParse(values);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors;
    const errors: Partial<Record<TargetField, string>> = {};
    for (const field of TARGET_FIELDS) {
      const message = flat[field]?.[0];
      if (message) errors[field] = message;
    }
    return { status: "error", key: Date.now(), errors, values };
  }

  // Read the standing target before touching it, so a failed insert can put it
  // back. Replacing a target must never be able to leave an account with none.
  const { data: existing } = await supabase
    .from("training_targets")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    // Checked, because an unchecked archive is how the player silently loses a
    // target. If this fails we have not lost anything yet: say so and stop,
    // rather than carrying on to an insert the unique index will refuse anyway.
    const { error: archiveError } = await supabase
      .from("training_targets")
      .update({ status: "archived" })
      .eq("id", existing.id)
      .eq("user_id", userId);
    if (archiveError) {
      return {
        status: "error",
        key: Date.now(),
        errors: { title: "Could not replace your current target. Try again." },
        values,
      };
    }
  }

  const { error } = await supabase.from("training_targets").insert({
    user_id: userId,
    title: parsed.data.title,
    event_date: parsed.data.event_date,
  });

  if (error) {
    if (existing) {
      // If a concurrent tab already claimed the active slot this update is
      // refused by the unique index, which is the correct outcome: that tab's
      // target stands and the account still has exactly one.
      const { error: restoreError } = await supabase
        .from("training_targets")
        .update({ status: "active" })
        .eq("id", existing.id)
        .eq("user_id", userId);
      if (restoreError) {
        // The archive landed, the insert failed, and the old row could not be
        // put back. The account now has NO active target and the player is the
        // only one who knows what it said, so tell them that plainly instead of
        // "try again", which would have them retyping something they think is
        // still there. Logged because it should never happen twice quietly.
        console.error("[target] could not restore the archived target", {
          userId,
          message: restoreError.message,
        });
        revalidatePath("/dashboard");
        return {
          status: "error",
          key: Date.now(),
          errors: {
            title: "Your previous target was cleared and the new one did not save. Please set it again.",
          },
          values,
        };
      }
    }
    return {
      status: "error",
      key: Date.now(),
      errors: { title: "Could not save that target. Try again." },
      values,
    };
  }

  revalidatePath("/dashboard");
  return { status: "success", key: Date.now() };
}

export async function clearTrainingTarget() {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) return;

  await supabase
    .from("training_targets")
    .update({ status: "archived" })
    .eq("user_id", userId)
    .eq("status", "active");

  revalidatePath("/dashboard");
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}
