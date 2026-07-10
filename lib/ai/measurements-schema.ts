import { z } from "zod";
import type { MeasurementsBlock } from "@/lib/pose/types";

// Server-side validation for the client-computed measurements block. This is
// telemetry, not user content: a block that fails validation is dropped and
// the request proceeds as a no-measurements analysis. It must never 400.

const measurementValueSchema = z.union([
  z.number().finite(),
  z.array(z.number().finite()).max(24),
  z.string().max(40),
  z.boolean(),
]);

const measurementSchema = z.object({
  value: measurementValueSchema,
  unit: z.string().max(40),
  confidence: z.number().min(0).max(1),
});

const repSchema = z
  .object({
    start_s: z.number().min(0).max(600),
    contact_s: z.number().min(0).max(600).nullable(),
    end_s: z.number().min(0).max(600),
    detector: z.enum(["swing", "jump", "platform"]),
    metrics: z.record(z.string().max(48), measurementSchema),
  })
  .refine((rep) => Object.keys(rep.metrics).length <= 16, {
    message: "too many metrics",
  });

export const measurementsSchema = z
  .object({
    version: z.literal(1),
    capture: z.object({
      dense_fps: z.number().min(0).max(240).nullable(),
      coverage: z.enum(["windows", "probes"]),
      engine: z.string().max(60),
    }),
    units: z.string().max(240),
    reps: z.array(repSchema).min(1).max(8),
    session: z.record(z.string().max(48), z.number().finite()),
    omitted_below_confidence: z.array(z.string().max(48)).max(40),
  })
  .refine((block) => Object.keys(block.session).length <= 16, {
    message: "too many session stats",
  });

// Returns the validated block or null; never throws.
export function sanitizeMeasurements(input: unknown): MeasurementsBlock | null {
  if (input == null) return null;
  const parsed = measurementsSchema.safeParse(input);
  return parsed.success ? (parsed.data as MeasurementsBlock) : null;
}
