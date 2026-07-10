"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";

const payloadSchema = z.object({
  team_a: z.string().trim().min(1).max(30),
  team_b: z.string().trim().min(1).max(30),
  best_of: z.union([z.literal(3), z.literal(5)]),
  sets: z
    .array(z.object({ a: z.number().int().min(0), b: z.number().int().min(0) }))
    .min(1)
    .max(5),
  winner: z.enum(["a", "b"]),
  started_at: z.iso.datetime(),
  duration_s: z.number().int().min(0),
});

export type SaveGamePayload = z.infer<typeof payloadSchema>;

export async function saveGame(
  payload: SaveGamePayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Invalid match data." };
  }

  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) {
    redirect("/login");
  }

  const d = parsed.data;
  const { error } = await supabase.from("games").insert({
    user_id: userId,
    team_a: d.team_a,
    team_b: d.team_b,
    best_of: d.best_of,
    sets: d.sets,
    winner: d.winner,
    started_at: d.started_at,
    ended_at: new Date(new Date(d.started_at).getTime() + d.duration_s * 1000).toISOString(),
    duration_s: d.duration_s,
  });

  if (error) {
    return { ok: false, error: "Could not save match." };
  }

  revalidatePath("/scoreboard");
  return { ok: true };
}
