import { z } from "zod";
import { MAX_FRAMES, MAX_STORED_FRAMES } from "./analysis-types.ts";
import { POSE_LANDMARK_COUNT } from "./pose/types.ts";
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
    source: z.enum(["video", "photos"]),
    duration_s: z.number().min(0).max(MAX_CAPTURE_SECONDS).nullable(),
    has_clip: z.boolean().optional(),
    clip_ext: z.string().trim().max(16).nullable().optional(),
    frames: z.array(frameSchema).min(2).max(MAX_FRAMES),
    measurements: z.unknown().optional(),
    frame_keypoints: z
      .array(
        z.object({
          frame_index: z.number().int().min(0).max(MAX_FRAMES - 1),
          pts: z.array(z.number()).length(POSE_LANDMARK_COUNT * 4),
        }),
      )
      .max(MAX_FRAMES)
      .optional(),
    has_keypoints: z.boolean().optional(),
    extra_frame_count: z.number().int().min(0).max(MAX_STORED_FRAMES - 2).optional(),
    focus_marker: z.boolean().optional(),
    player_selection: z
      .object({
        candidates: z.number().int().min(1).max(8),
        selected_rank: z.number().int().min(1).max(8),
        auto: z.boolean(),
      })
      .refine((selection) => selection.selected_rank <= selection.candidates)
      .optional(),
    continuity: z
      .object({
        coverage: z.number().min(0).max(1),
        lost: z.boolean(),
        absences: z
          .array(
            z.object({
              kind: z.enum(["occluded", "off_frame"]),
              edge: z.enum(["left", "right", "top", "bottom"]).optional(),
              start_s: z.number().min(0).max(MAX_CAPTURE_SECONDS),
              returned_at_s: z.number().min(0).max(MAX_CAPTURE_SECONDS).nullable(),
            }),
          )
          .max(12),
      })
      .optional(),
    ball_track: z
      .array(
        z.object({
          frame_index: z.number().int().min(0).max(MAX_FRAMES - 1),
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
          visible: z.boolean(),
        }),
      )
      .max(MAX_FRAMES)
      .optional(),
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
    body.frame_keypoints?.forEach((frame, index) => {
      if (frame.frame_index >= body.frames.length) {
        context.addIssue({
          code: "custom",
          path: ["frame_keypoints", index, "frame_index"],
          message: "Keypoints must refer to a submitted frame.",
        });
      }
    });
    body.ball_track?.forEach((mark, index) => {
      if (mark.frame_index >= body.frames.length) {
        context.addIssue({
          code: "custom",
          path: ["ball_track", index, "frame_index"],
          message: "Ball marks must refer to a submitted frame.",
        });
      }
    });
  });
