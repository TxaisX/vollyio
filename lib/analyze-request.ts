import { z } from "zod";
import { DISCIPLINES, SKILLS } from "./skills.ts";

const MAX_CAPTURE_SECONDS = 86_400;

export const analyzeRequestSchema = z.object({
  skill: z.enum(SKILLS),
  discipline: z.enum(DISCIPLINES).default("indoor"),
  // Video only (D-062). A still sequence cannot carry the ring marker the
  // subject read depends on, and the mechanics live between frames. Stored
  // rows keep the older 'photos' value; nothing new may create one.
  source: z.literal("video"),
  duration_s: z.number().min(0).max(MAX_CAPTURE_SECONDS).nullable(),
  // Required, not optional (D-097). The read IS the clip: there is no frame
  // sequence left to fall back to, so a request without one has nothing to
  // score and must be refused before it reserves anything.
  pending_clip_id: z.uuid(),
  clip_ext: z.enum(["mp4", "webm", "mov"]),
  // Where the player tapped the athlete: normalized 0..1, at a time measured
  // from the start of the trimmed clip. Bounded so a malformed tap degrades
  // into "no marker" rather than into prompt text the player composed.
  focus_point: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      t_s: z.number().min(0).max(MAX_CAPTURE_SECONDS),
    })
    .optional(),
});
