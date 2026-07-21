import { z } from "zod";
import { ANALYZE_DISCIPLINES } from "./skills.ts";
import { FREQUENCIES, POSITIONS } from "./funnel.ts";

// One settings submit carries one field (each chip row and the name form post
// independently), so every field is optional and only provided keys reach the
// update. Discipline writes are limited to the values capture offers; legacy
// 'beach' rows stay readable but are never re-written by settings.
export const profileUpdateSchema = z
  .object({
    display_name: z.string().trim().min(1).max(40).optional(),
    position: z.enum(POSITIONS).optional(),
    play_frequency: z.enum(FREQUENCIES).optional(),
    discipline: z.enum(ANALYZE_DISCIPLINES).optional(),
  })
  .refine((fields) => Object.values(fields).some((v) => v !== undefined), {
    message: "empty update",
  });

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export function profileUpdateFromForm(formData: FormData): ProfileUpdate | null {
  const raw: Record<string, string> = {};
  for (const key of ["display_name", "position", "play_frequency", "discipline"]) {
    const value = formData.get(key);
    if (typeof value === "string" && value !== "") raw[key] = value;
  }
  const parsed = profileUpdateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
