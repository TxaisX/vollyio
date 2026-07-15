// Pinned manifest for the on-device motion-tracking models. Both files are
// hosted in the app's own storage bucket and hash-verified before a session
// is created (see model-fetch.ts); the pins below are the source of truth
// recorded in docs/decisions.md D-021.

export type ModelSpec = {
  file: string;
  bytes: number;
  sha256: string;
  // Hosted as fixed 40 MiB parts named `<file>.<n>` (storage caps single
  // objects below the larger model's size); fetched sequentially and
  // reassembled before the whole-file hash check.
  chunks: number;
};

export const MODEL_CHUNK_BYTES = 41_943_040;

export const DETECTOR_MODEL: ModelSpec = {
  file: "yolox_m_8xb8-300e_humanart-c2c7a14a.onnx",
  bytes: 101_400_344,
  sha256: "3dea6513388889f0fff4b77bf7a26013600321b9eb9ceb0e9a400a82572f5f23",
  chunks: 3,
};

export const POSE_MODEL: ModelSpec = {
  file: "rtmpose-m_simcc-body7_pt-body7_420e-256x192-e48f03d0_20230504.onnx",
  bytes: 54_330_655,
  sha256: "5c0a4bf67953e6d2ac43ce15e77dc9d5d354ae18430a47d2c5963a7bc5683e3c",
  chunks: 2,
};

export const ENGINE_NAME_BASE = "rtm-body7-m";

// Resolved on the main thread (NEXT_PUBLIC_* inlining is only guaranteed
// there) and passed to the worker in its init message.
export function modelBaseUrl(): string {
  const override = process.env.NEXT_PUBLIC_POSE_MODEL_BASE;
  if (override) return override.replace(/\/$/, "");
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${supabase.replace(/\/$/, "")}/storage/v1/object/public/models`;
}

export function modelChunkUrls(spec: ModelSpec): string[] {
  const base = modelBaseUrl();
  return Array.from({ length: spec.chunks }, (_, i) => `${base}/${spec.file}.${i}`);
}
