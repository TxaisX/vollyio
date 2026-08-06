import { z } from "zod";
import { DISCIPLINES, SKILLS } from "./skills.ts";

const MAX_CAPTURE_SECONDS = 86_400;

// The longest description of an athlete this route will carry into a prompt.
// Matched to the label cap /api/players enforces on what it writes, so the two
// ends of the round trip agree and a truncated label can never arrive here as a
// half sentence that the model then has to guess the rest of.
export const FOCUS_LABEL_MAX_CHARS = 80;

// Everything that could open a structure inside the prompt or the JSON around
// it. A real description ("player in the red kit, back left") contains none of
// these, so rejecting them costs nothing and closes the only shape of this
// field that is not simply words.
const MARKUP_CHARS = /[<>{}[\]|\\`]/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

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
  // Who the player picked when there was no picture to tap (D-100). A browser
  // that cannot decode the clip cannot show a poster either, so the athlete is
  // chosen from a list of descriptions the server read off the clip itself and
  // the chosen one travels back here as text.
  //
  // THIS STRING IS INTERPOLATED INTO A PROMPT, so it is bounded as tightly as a
  // coordinate is. It originates from /api/players, which caps a label and is
  // told never to write a name, but it round-trips through the player's own
  // device on the way here and is therefore caller-controlled: treat it as
  // untrusted, and let a malformed one degrade into "no marker" rather than
  // into prompt text somebody else composed.
  focus_label: z
    .string()
    .min(3)
    .max(FOCUS_LABEL_MAX_CHARS)
    // Counted in REAL characters, because a label of three spaces clears
    // min(3) and identifies nobody.
    .refine((s) => (s.match(/\S/g)?.length ?? 0) >= 3)
    .refine((s) => !MARKUP_CHARS.test(s))
    .refine((s) => !CONTROL_CHARS.test(s))
    .optional(),
});
