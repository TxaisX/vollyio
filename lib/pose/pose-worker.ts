/// <reference lib="webworker" />
// Hand-rolled worker hosting the WASM pose landmarker. Receives transferred
// ImageBitmaps, returns every detected person as one flat Float32Array
// (count x 33 x [x, y, z, v]) in full-bitmap normalized coords. The landmarker
// requires monotonically increasing timestamps; real clip times feed a
// rebasing monotonic clock so the temporal filter sees true inter-frame
// spacing instead of a fixed synthetic tick.
//
// D-028: the engine is MediaPipe PoseLandmarker, which emits the 33-landmark
// layout the rest of the pipeline already consumes — so the two-stage
// detect-then-crop pipeline, its per-tier detector cadence, and the 17-to-33
// adapter are all gone. One inference returns every person in the frame.
//
// Models are streamed here rather than handed to MediaPipe as a URL, so the
// download reports real progress to the analyze screen; the bytes go in via
// `modelAssetBuffer`.
//
// A sports-ball object detector rides alongside (D-019): it runs on a
// FULL-frame bitmap (the ball leaves any player crop) and its absence or
// failure never affects the pose path.

import { FilesetResolver, ObjectDetector, PoseLandmarker } from "@mediapipe/tasks-vision";
import { POSE_LANDMARK_COUNT, createMonotonicClock } from "./types.ts";
import type { ModelSpec } from "./model-manifest.ts";

const MAX_PERSONS = 4;

type InitMsg = {
  type: "init";
  wasmBase: string;
  models: ModelSpec[];
  ballModel?: string;
};
type DetectMsg = {
  type: "detect";
  id: number;
  bitmap: ImageBitmap;
  tMs?: number;
  // Full-frame bitmap for ball detection when `bitmap` is a player crop;
  // omitted when `bitmap` already covers the full frame.
  ballBitmap?: ImageBitmap;
  // Accepted for call-site compatibility and deliberately unused: MediaPipe
  // returns every person from a single inference, so there is no per-person
  // work to prioritize. The seam stays so a future engine can use it again.
  hint?: { x: number; y: number } | null;
};
type DisposeMsg = { type: "dispose" };
type InMsg = InitMsg | DetectMsg | DisposeMsg;

const scope = self as unknown as DedicatedWorkerGlobalScope;

let landmarker: PoseLandmarker | null = null;
let ballDetector: ObjectDetector | null = null;
const clock = createMonotonicClock();
const ballClock = createMonotonicClock();
let fallbackMs = 0;

// Streams a model into memory, reporting progress as it goes. `expected` is
// the manifest size, used as the denominator only when the response omits
// Content-Length so the progress bar still has something to divide by.
async function fetchModelBytes(url: string, expected: number): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`model fetch failed: ${response.status}`);
  const declared = Number(response.headers.get("content-length") ?? "");
  const total = Number.isFinite(declared) && declared > 0 ? declared : expected;

  // Without a readable body there is nothing to report against; take the whole
  // buffer rather than failing the load over a missing progress signal.
  if (!response.body) {
    const whole = new Uint8Array(await response.arrayBuffer());
    scope.postMessage({ type: "model-progress", loaded: whole.byteLength, total });
    return whole;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      scope.postMessage({ type: "model-progress", loaded, total });
    }
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function createLandmarker(
  wasmBase: string,
  modelBuffer: Uint8Array,
  delegate: "GPU" | "CPU",
) {
  const fileset = await FilesetResolver.forVisionTasks(wasmBase);
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetBuffer: modelBuffer, delegate },
    runningMode: "VIDEO",
    numPoses: MAX_PERSONS,
  });
}

async function createBallDetector(wasmBase: string, modelPath: string, delegate: "GPU" | "CPU") {
  const fileset = await FilesetResolver.forVisionTasks(wasmBase);
  return ObjectDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelPath, delegate },
    runningMode: "VIDEO",
    categoryAllowlist: ["sports ball"],
    scoreThreshold: 0.2,
    maxResults: 3,
  });
}

// Best sports-ball detection center, normalized to the detected image.
function detectBall(
  bitmap: ImageBitmap,
  stamp: number,
): { x: number; y: number; score: number } | null {
  if (!ballDetector) return null;
  try {
    const result = ballDetector.detectForVideo(bitmap, stamp);
    let best: { x: number; y: number; score: number } | null = null;
    for (const d of result.detections ?? []) {
      const score = d.categories?.[0]?.score ?? 0;
      const box = d.boundingBox;
      if (!box || !(bitmap.width > 0) || !(bitmap.height > 0)) continue;
      if (!best || score > best.score) {
        best = {
          x: (box.originX + box.width / 2) / bitmap.width,
          y: (box.originY + box.height / 2) / bitmap.height,
          score,
        };
      }
    }
    return best;
  } catch {
    return null;
  }
}

scope.onmessage = async (event: MessageEvent<InMsg>) => {
  const msg = event.data;

  if (msg.type === "init") {
    let loadedName: string | null = null;
    let lastError: unknown = null;
    // Ordered preference: the full landmarker tracks fast volleyball motion
    // better than lite (same 33 landmarks, same licence, bigger net). A device
    // that cannot load it drops to lite rather than losing measurements.
    for (const model of msg.models) {
      try {
        const bytes = await fetchModelBytes(model.path, model.bytes);
        let tier: "gpu" | "cpu" = "gpu";
        try {
          landmarker = await createLandmarker(msg.wasmBase, bytes, "GPU");
        } catch {
          // The failed attempt may have consumed the buffer; hand the retry
          // its own copy rather than an empty view.
          landmarker = await createLandmarker(msg.wasmBase, bytes.slice(), "CPU");
          tier = "cpu";
        }
        loadedName = `${model.name}/${tier}`;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    // The ball detector is strictly additive: failure to load leaves the
    // pose pipeline exactly as it was.
    if (loadedName && msg.ballModel) {
      try {
        try {
          ballDetector = await createBallDetector(msg.wasmBase, msg.ballModel, "GPU");
        } catch {
          ballDetector = await createBallDetector(msg.wasmBase, msg.ballModel, "CPU");
        }
      } catch {
        ballDetector = null;
      }
    }
    if (loadedName) {
      scope.postMessage({ type: "ready", model: loadedName, ball: ballDetector != null });
    } else {
      scope.postMessage({
        type: "init-error",
        message: lastError instanceof Error ? lastError.message : "pose init failed",
      });
    }
    return;
  }

  if (msg.type === "detect") {
    const { id, bitmap, tMs, ballBitmap } = msg;
    let pts: Float32Array | null = null;
    let count = 0;
    let ball: { x: number; y: number; score: number } | null = null;
    try {
      if (landmarker) {
        fallbackMs += 33.34;
        const stamp = clock(typeof tMs === "number" && Number.isFinite(tMs) ? tMs : fallbackMs);
        const result = landmarker.detectForVideo(bitmap, stamp);
        const persons = (result.landmarks ?? []).filter(
          (p) => p.length === POSE_LANDMARK_COUNT,
        );
        count = Math.min(persons.length, MAX_PERSONS);
        if (count > 0) {
          pts = new Float32Array(count * POSE_LANDMARK_COUNT * 4);
          for (let n = 0; n < count; n++) {
            const person = persons[n];
            const base = n * POSE_LANDMARK_COUNT * 4;
            for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
              const p = person[i];
              pts[base + i * 4] = p.x;
              pts[base + i * 4 + 1] = p.y;
              pts[base + i * 4 + 2] = p.z ?? 0;
              pts[base + i * 4 + 3] = p.visibility ?? 0;
            }
          }
        }
      }
      if (ballDetector) {
        const ballStamp = ballClock(
          typeof tMs === "number" && Number.isFinite(tMs) ? tMs : fallbackMs,
        );
        ball = detectBall(ballBitmap ?? bitmap, ballStamp);
      }
    } catch {
      pts = null;
      count = 0;
    } finally {
      bitmap.close();
      ballBitmap?.close();
    }
    if (pts) {
      scope.postMessage({ type: "result", id, count, pts, ball }, [pts.buffer]);
    } else {
      scope.postMessage({ type: "result", id, count: 0, pts: null, ball });
    }
    return;
  }

  if (msg.type === "dispose") {
    landmarker?.close();
    landmarker = null;
    ballDetector?.close();
    ballDetector = null;
    scope.close();
  }
};
