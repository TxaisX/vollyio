/// <reference lib="webworker" />
// Hand-rolled worker hosting the WASM pose landmarker. Receives transferred
// ImageBitmaps, returns every detected person as one flat Float32Array
// (count x 33 x [x, y, z, v]) in full-bitmap normalized coords. The landmarker
// requires monotonically increasing timestamps; real clip times feed a
// rebasing monotonic clock so the temporal filter sees true inter-frame
// spacing instead of a fixed synthetic tick.
//
// D-028: the engine is MediaPipe PoseLandmarker, which emits the 33-landmark
// layout the rest of the pipeline already consumes, so the 17-to-33 adapter is
// gone.
//
// D-032: detect-then-crop is BACK, and the claim that once stood here — "one
// inference returns every person in the frame" — was wrong. Measured over 200
// frames of real court footage, running the landmarker on a whole frame finds
// 5.4% of the people a detector finds, because it is built around a single
// prominent subject. Per-person crops find 82.7%. The detector is the
// EfficientDet model already vendored for the ball, which is COCO-trained and
// so returns `person` too: no new dependency, no new licence exposure.
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
import { type Box, cropForBox, usableBoxes } from "./two-stage.ts";

const MAX_PERSONS = 4;
// Pose input is small; a crop larger than this wastes time on a resize the
// model undoes immediately.
const CROP_RENDER_MAX = 512;

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
  // Which athlete the user tapped. Selection happens on the main thread, which
  // has the region geometry, so the worker returns every person it found along
  // with the box each came from.
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

// One detector serves both jobs. It is the same COCO-trained network either
// way, so allowing both classes costs one model load instead of two and the
// results are split by category afterwards.
async function createObjectDetector(wasmBase: string, modelPath: string, delegate: "GPU" | "CPU") {
  const fileset = await FilesetResolver.forVisionTasks(wasmBase);
  return ObjectDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelPath, delegate },
    runningMode: "VIDEO",
    categoryAllowlist: ["person", "sports ball"],
    scoreThreshold: 0.2,
    maxResults: 16,
  });
}

// Stage one: every person in the frame, normalized to the bitmap.
function detectPeople(bitmap: ImageBitmap, stamp: number): Box[] {
  if (!ballDetector) return [];
  try {
    const result = ballDetector.detectForVideo(bitmap, stamp);
    const boxes: Box[] = [];
    for (const d of result.detections ?? []) {
      const category = d.categories?.[0]?.categoryName;
      const box = d.boundingBox;
      if (category !== "person" || !box) continue;
      if (!(bitmap.width > 0) || !(bitmap.height > 0)) continue;
      boxes.push({
        x: box.originX / bitmap.width,
        y: box.originY / bitmap.height,
        w: box.width / bitmap.width,
        h: box.height / bitmap.height,
        score: d.categories?.[0]?.score ?? 0,
      });
    }
    return usableBoxes(boxes, { max: MAX_PERSONS });
  } catch {
    return [];
  }
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
      // The detector now also returns people, who routinely outscore a small
      // fast ball. Without this the "best" detection would almost always be a
      // player and ball tracking would silently stop working.
      if (d.categories?.[0]?.categoryName !== "sports ball") continue;
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
          ballDetector = await createObjectDetector(msg.wasmBase, msg.ballModel, "GPU");
        } catch {
          ballDetector = await createObjectDetector(msg.wasmBase, msg.ballModel, "CPU");
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
    // Source detector box per person, so the main thread can check that a pose
    // describes the body its crop was built around (D-032 fidelity check).
    let boxes: Float32Array | null = null;
    let count = 0;
    let ball: { x: number; y: number; score: number } | null = null;
    try {
      if (landmarker) {
        fallbackMs += 33.34;
        const stamp = clock(typeof tMs === "number" && Number.isFinite(tMs) ? tMs : fallbackMs);

        // Two-stage (D-032). Running the landmarker on the whole frame finds
        // 5.4% of the people a detector finds, because it is built around a
        // single prominent subject; per-person crops find 82.7%. Measured over
        // 200 frames of real court footage.
        const people = detectPeople(bitmap, stamp);
        const collected: { person: number[][]; box: Box }[] = [];

        for (const box of people) {
          const crop = cropForBox(box);
          const sw = Math.max(1, Math.round(crop.w * bitmap.width));
          const sh = Math.max(1, Math.round(crop.h * bitmap.height));
          const renderW = Math.min(CROP_RENDER_MAX, sw);
          const renderH = Math.max(1, Math.round((sh / sw) * renderW));
          try {
            const surface = new OffscreenCanvas(renderW, renderH);
            const cropCtx = surface.getContext("2d");
            if (!cropCtx) continue;
            cropCtx.imageSmoothingEnabled = true;
            cropCtx.imageSmoothingQuality = "high";
            cropCtx.drawImage(
              bitmap,
              Math.round(crop.x * bitmap.width),
              Math.round(crop.y * bitmap.height),
              sw,
              sh,
              0,
              0,
              renderW,
              renderH,
            );
            const found = (landmarker.detect(surface).landmarks ?? []).filter(
              (p) => p.length === POSE_LANDMARK_COUNT,
            );
            if (found.length === 0) continue;
            // Crop-local coordinates back into full-bitmap space.
            const mapped = found[0].map((p) => [
              crop.x + p.x * crop.w,
              crop.y + p.y * crop.h,
              p.z ?? 0,
              p.visibility ?? 0,
            ]);
            collected.push({ person: mapped, box });
          } catch {
            // A crop that cannot be rendered is skipped; the rest still run.
          }
        }

        count = Math.min(collected.length, MAX_PERSONS);
        if (count > 0) {
          pts = new Float32Array(count * POSE_LANDMARK_COUNT * 4);
          boxes = new Float32Array(count * 4);
          for (let n = 0; n < count; n++) {
            const { person, box } = collected[n];
            const base = n * POSE_LANDMARK_COUNT * 4;
            for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
              pts[base + i * 4] = person[i][0];
              pts[base + i * 4 + 1] = person[i][1];
              pts[base + i * 4 + 2] = person[i][2];
              pts[base + i * 4 + 3] = person[i][3];
            }
            boxes[n * 4] = box.x;
            boxes[n * 4 + 1] = box.y;
            boxes[n * 4 + 2] = box.w;
            boxes[n * 4 + 3] = box.h;
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
      const transfer: Transferable[] = [pts.buffer];
      if (boxes) transfer.push(boxes.buffer);
      scope.postMessage({ type: "result", id, count, pts, boxes, ball }, transfer);
    } else {
      scope.postMessage({ type: "result", id, count: 0, pts: null, boxes: null, ball });
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
