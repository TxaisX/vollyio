// Pinned on-device pose models (D-028).
//
// These are MediaPipe Pose Landmarker bundles, Apache-2.0, vendored
// same-origin under public/pose/. That licence is the reason they are here:
// the previous engine's weights (RTMPose trained on the body7 dataset mix)
// carry non-commercial terms, so the product could never have charged for
// analysis built on them. See decisions.md D-028.
//
// Vendoring also removes the old two-stage pipeline's 155 MB chunked download
// from Supabase storage and its sha256 reassembly step: 15 MB of static assets
// ship with the app, work offline, and need no integrity check because they
// are served same-origin from our own build.

export type ModelSpec = {
  // Same-origin path served from public/.
  path: string;
  // Reported in `analyses.model` and used to pick per-tier behavior.
  name: string;
  // Byte size, used as the progress denominator when a response omits
  // Content-Length. Not an integrity check.
  bytes: number;
};

// Ordered preference. Full tracks fast volleyball motion better than lite
// (same 33 landmarks, same licence, bigger net); a device that cannot load
// full drops to lite rather than losing measurements entirely.
export const POSE_MODELS: readonly ModelSpec[] = [
  { path: "/pose/pose_landmarker_full.task", name: "mp-pose-full", bytes: 9_398_198 },
  { path: "/pose/pose_landmarker_lite.task", name: "mp-pose-lite", bytes: 5_777_746 },
];

// Which landmark slots this engine actually produces. MediaPipe fills all 33.
//
// This is load-bearing, not documentation. `visibilityMean` averages over every
// landmark a metric declares — dead slots contribute 0 to the numerator but
// still count in the denominator — so declaring a landmark the engine never
// emits silently halves that metric's confidence and can push it under the
// abstain floor. That is exactly what happened under the previous 17-keypoint
// engine: serve.contact_height and attack.jump_height declared heels, which
// were never emitted, and both metrics were suppressed on every clip with no
// error anywhere. A test asserts every metric's landmarks are a subset of this.
export const EMITTED_LANDMARKS: readonly number[] = Array.from({ length: 33 }, (_, i) => i);

// Engine strings are `${name}/${tier}` where tier is gpu or cpu, e.g.
// "mp-pose-full/gpu". Callers that branch on tier must use this helper rather
// than matching a literal, so a renamed tier cannot silently disable the
// branch (the D-021 -> D-028 swap broke exactly that kind of implicit coupling
// in the confidence gate).
export function isGpuTier(modelName: string): boolean {
  return modelName.endsWith("/gpu");
}
