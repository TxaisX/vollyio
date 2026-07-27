import { z } from "zod";
import { MAX_FRAMES, MAX_STORED_FRAMES } from "./analysis-types.ts";
import { DISCIPLINES, SKILLS } from "./skills.ts";
import { isJpegPayload } from "./security/request.ts";

export const MAX_FRAME_BYTES = 1_500_000;
const MAX_CAPTURE_SECONDS = 86_400;

const frameSchema = z.object({
  index: z.number().int().min(0).max(MAX_FRAMES - 1),
  time_s: z.number().min(0).max(MAX_CAPTURE_SECONDS).nullable(),
  data: z
    .string()
    .min(4)
    .max(Math.ceil(MAX_FRAME_BYTES / 3) * 4 + 4)
    .refine((data) => isJpegPayload(data, MAX_FRAME_BYTES)),
});

export const analyzeRequestSchema = z
  .object({
    skill: z.enum(SKILLS),
    discipline: z.enum(DISCIPLINES).default("indoor"),
    // Video only (D-062). A still sequence cannot carry the ring marker the
    // subject read depends on, and the mechanics live between frames. Stored
    // rows keep the older 'photos' value; nothing new may create one.
    source: z.literal("video"),
    duration_s: z.number().min(0).max(MAX_CAPTURE_SECONDS).nullable(),
    has_clip: z.boolean().optional(),
    clip_ext: z.string().trim().max(16).nullable().optional(),
    frames: z.array(frameSchema).min(2).max(MAX_FRAMES),
    extra_frame_count: z.number().int().min(0).max(MAX_STORED_FRAMES - 2).optional(),
    focus_marker: z.boolean().optional(),
    marker_frame_index: z.number().int().min(0).max(MAX_FRAMES - 1).optional(),
  })
  .superRefine((body, context) => {
    body.frames.forEach((frame, index) => {
      if (frame.index !== index) {
        context.addIssue({
          code: "custom",
          path: ["frames", index, "index"],
          message: "Frame indices must be sequential.",
        });
      }
    });
    if (
      body.marker_frame_index != null &&
      body.marker_frame_index >= body.frames.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["marker_frame_index"],
        message: "The marker must refer to a submitted frame.",
      });
    }
  });
