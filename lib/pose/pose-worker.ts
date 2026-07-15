/// <reference lib="webworker" />
// Hand-rolled worker hosting the on-device motion-tracking models. Receives
// transferred ImageBitmaps, returns every detected person as one flat
// Float32Array (count x 33 x [x, y, z, v]) in full-bitmap normalized coords.
//
// Two-stage top-down pipeline: a person detector (NMS embedded in the model)
// finds boxes, the pose model runs per box, and decoded keypoints flow
// through the 17-to-33-slot adapter. Detector runs are throttled by a box
// cache advected from each frame's keypoints, because the detector is by far
// the heavier model; cadence depends on the execution tier (GPU tiers can
// afford fresh boxes every second, the single-thread fallback cannot).
//
// A sports-ball object detector rides alongside (D-019): it runs on a
// FULL-frame bitmap (the ball leaves any player crop) and its absence or
// failure never affects the pose path.

import * as ort from "onnxruntime-web";
import { FilesetResolver, ObjectDetector } from "@mediapipe/tasks-vision";
import { createMonotonicClock, type Landmark } from "./types.ts";
import type { ModelSpec } from "./rtm/model-manifest.ts";
import { ENGINE_NAME_BASE } from "./rtm/model-manifest.ts";
import { fetchModel } from "./model-fetch.ts";
import {
  DET_INPUT_SIZE,
  DET_PAD_VALUE,
  decodeDetections,
  letterboxRatio,
  type DetBox,
} from "./rtm/yolox-decode.ts";
import {
  POSE_INPUT_H,
  POSE_INPUT_W,
  POSE_MEAN,
  POSE_STD,
  boxToCrop,
  cropPlacement,
} from "./rtm/topdown.ts";
import { decodeSimcc } from "./rtm/simcc-decode.ts";
import { cocoToLandmarks } from "./rtm/coco33.ts";

const MAX_PERSONS = 4;
// Detector cadence per execution tier; between runs the box cache follows
// each person via their own keypoints.
const DETECT_INTERVAL_GPU_MS = 1_000;
const DETECT_INTERVAL_WASM_MS = 6_000;
// A time jump this large means a seek or a new pass: cached boxes are stale.
const JUMP_BACK_MS = 1_000;
const JUMP_FORWARD_MS = 2_500;
// Cached boxes not re-confirmed by pose within this window are dropped.
const BOX_TTL_MS = 3_000;
// A person whose keypoints average below this is considered lost.
const PERSON_MIN_SCORE = 0.3;
// Padding applied when a box is rebuilt from keypoints (the keypoint hull
// misses heels, hands mid-swing, and the top of the head).
const ADVECT_PAD = 0.15;

type InitMsg = {
  type: "init";
  detectorUrls: string[];
  poseUrls: string[];
  detectorSpec: ModelSpec;
  poseSpec: ModelSpec;
  ortWasmBase: string;
  ballWasmBase: string;
  ballModel?: string;
};
type DetectMsg = {
  type: "detect";
  id: number;
  bitmap: ImageBitmap;
  tMs?: number;
  // Full-frame bitmap for ball detection when `bitmap` is a crop; omitted
  // when `bitmap` already covers the full frame.
  ballBitmap?: ImageBitmap;
  // Normalized focus point: on the single-thread tier only the nearest
  // cached box gets posed between detector runs.
  hint?: { x: number; y: number } | null;
};
type DisposeMsg = { type: "dispose" };
type InMsg = InitMsg | DetectMsg | DisposeMsg;

type CachedBox = {
  // Normalized 0..1 so bitmap dimensions may vary between calls.
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lastSeenMs: number;
};

const scope = self as unknown as DedicatedWorkerGlobalScope;

let detectorSession: ort.InferenceSession | null = null;
let poseSession: ort.InferenceSession | null = null;
let tier: "webgpu" | "wasm" = "wasm";
let ballDetector: ObjectDetector | null = null;
const ballClock = createMonotonicClock();
let fallbackMs = 0;

let boxCache: CachedBox[] = [];
let lastDetectorMs = Number.NEGATIVE_INFINITY;
let lastFrameMs = Number.NEGATIVE_INFINITY;

let detCanvas: OffscreenCanvas | null = null;
let poseCanvas: OffscreenCanvas | null = null;
// Serializes detect handling: session.run must not overlap on one session.
let queue: Promise<void> = Promise.resolve();

async function createSessions(detBytes: Uint8Array, poseBytes: Uint8Array): Promise<void> {
  const create = (bytes: Uint8Array, ep: "webgpu" | "wasm") =>
    ort.InferenceSession.create(bytes, {
      executionProviders: [ep],
      graphOptimizationLevel: "all",
    });
  try {
    detectorSession = await create(detBytes, "webgpu");
    poseSession = await create(poseBytes, "webgpu");
    tier = "webgpu";
    return;
  } catch {
    try {
      await detectorSession?.release();
    } catch {
      // a half-created session may not be releasable; wasm path replaces it
    }
    detectorSession = await create(detBytes, "wasm");
    poseSession = await create(poseBytes, "wasm");
    tier = "wasm";
  }
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

// Letterboxed BGR CHW tensor for the detector; no normalization, matching
// the validated reference preprocess.
function detectorTensor(bitmap: ImageBitmap): { tensor: ort.Tensor; ratio: number } | null {
  detCanvas ??= new OffscreenCanvas(DET_INPUT_SIZE, DET_INPUT_SIZE);
  const ctx = detCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const ratio = letterboxRatio(bitmap.width, bitmap.height);
  ctx.fillStyle = `rgb(${DET_PAD_VALUE},${DET_PAD_VALUE},${DET_PAD_VALUE})`;
  ctx.fillRect(0, 0, DET_INPUT_SIZE, DET_INPUT_SIZE);
  ctx.drawImage(
    bitmap,
    0,
    0,
    Math.max(1, Math.round(bitmap.width * ratio)),
    Math.max(1, Math.round(bitmap.height * ratio)),
  );
  const { data } = ctx.getImageData(0, 0, DET_INPUT_SIZE, DET_INPUT_SIZE);
  const plane = DET_INPUT_SIZE * DET_INPUT_SIZE;
  const chw = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    const o = i * 4;
    // Channel order B,G,R to match the reference exactly.
    chw[i] = data[o + 2];
    chw[plane + i] = data[o + 1];
    chw[2 * plane + i] = data[o];
  }
  return {
    tensor: new ort.Tensor("float32", chw, [1, 3, DET_INPUT_SIZE, DET_INPUT_SIZE]),
    ratio,
  };
}

// Cropped, normalized BGR CHW tensor for the pose model.
function poseTensor(bitmap: ImageBitmap, box: DetBox): { tensor: ort.Tensor; crop: ReturnType<typeof boxToCrop> } | null {
  poseCanvas ??= new OffscreenCanvas(POSE_INPUT_W, POSE_INPUT_H);
  const ctx = poseCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const crop = boxToCrop(box);
  ctx.fillStyle = "rgb(0,0,0)";
  ctx.fillRect(0, 0, POSE_INPUT_W, POSE_INPUT_H);
  const placed = cropPlacement(crop, bitmap.width, bitmap.height);
  if (!placed) return null;
  ctx.drawImage(bitmap, placed.sx, placed.sy, placed.sw, placed.sh, placed.dx, placed.dy, placed.dw, placed.dh);
  const { data } = ctx.getImageData(0, 0, POSE_INPUT_W, POSE_INPUT_H);
  const plane = POSE_INPUT_W * POSE_INPUT_H;
  const chw = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    const o = i * 4;
    chw[i] = (data[o + 2] - POSE_MEAN[0]) / POSE_STD[0];
    chw[plane + i] = (data[o + 1] - POSE_MEAN[1]) / POSE_STD[1];
    chw[2 * plane + i] = (data[o] - POSE_MEAN[2]) / POSE_STD[2];
  }
  return {
    tensor: new ort.Tensor("float32", chw, [1, 3, POSE_INPUT_H, POSE_INPUT_W]),
    crop,
  };
}

async function runDetector(bitmap: ImageBitmap): Promise<DetBox[]> {
  if (!detectorSession) return [];
  const input = detectorTensor(bitmap);
  if (!input) return [];
  const feeds: Record<string, ort.Tensor> = {
    [detectorSession.inputNames[0]]: input.tensor,
  };
  const outputs = await detectorSession.run(feeds);
  const raw = outputs[detectorSession.outputNames[0]];
  const boxes = decodeDetections(raw.data as Float32Array, input.ratio);
  boxes.sort((a, b) => b.score - a.score);
  return boxes.slice(0, MAX_PERSONS);
}

async function runPose(bitmap: ImageBitmap, box: DetBox): Promise<Landmark[] | null> {
  if (!poseSession) return null;
  const input = poseTensor(bitmap, box);
  if (!input) return null;
  const feeds: Record<string, ort.Tensor> = {
    [poseSession.inputNames[0]]: input.tensor,
  };
  const outputs = await poseSession.run(feeds);
  const simccX = outputs[poseSession.outputNames[0]].data as Float32Array;
  const simccY = outputs[poseSession.outputNames[1]].data as Float32Array;
  const points = decodeSimcc(simccX, simccY, input.crop);
  let scoreSum = 0;
  for (const p of points) scoreSum += p.score;
  if (scoreSum / points.length < PERSON_MIN_SCORE) return null;
  return cocoToLandmarks(points, bitmap.width, bitmap.height);
}

function boxFromLandmarks(pts: Landmark[]): CachedBox | null {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  let seen = 0;
  for (const p of pts) {
    if (p.v < PERSON_MIN_SCORE) continue;
    seen++;
    if (p.x < x1) x1 = p.x;
    if (p.y < y1) y1 = p.y;
    if (p.x > x2) x2 = p.x;
    if (p.y > y2) y2 = p.y;
  }
  if (seen < 6) return null;
  const padX = (x2 - x1) * ADVECT_PAD;
  const padY = (y2 - y1) * ADVECT_PAD;
  return {
    x1: x1 - padX,
    y1: y1 - padY,
    x2: x2 + padX,
    y2: y2 + padY,
    lastSeenMs: 0,
  };
}

function shouldRunDetector(tMs: number): boolean {
  if (boxCache.length === 0) return true;
  if (tMs < lastFrameMs - JUMP_BACK_MS) return true;
  if (tMs > lastFrameMs + JUMP_FORWARD_MS && Number.isFinite(lastFrameMs)) return true;
  const interval = tier === "webgpu" ? DETECT_INTERVAL_GPU_MS : DETECT_INTERVAL_WASM_MS;
  return tMs - lastDetectorMs >= interval;
}

async function handleDetect(msg: DetectMsg): Promise<void> {
  const { id, bitmap, ballBitmap, hint } = msg;
  const tMs = typeof msg.tMs === "number" && Number.isFinite(msg.tMs)
    ? msg.tMs
    : (fallbackMs += 33.34);
  let pts: Float32Array | null = null;
  let count = 0;
  let ball: { x: number; y: number; score: number } | null = null;
  try {
    const bw = bitmap.width;
    const bh = bitmap.height;
    let boxes: DetBox[];
    if (shouldRunDetector(tMs)) {
      boxes = await runDetector(bitmap);
      lastDetectorMs = tMs;
      boxCache = boxes.map((b) => ({
        x1: b.x1 / bw,
        y1: b.y1 / bh,
        x2: b.x2 / bw,
        y2: b.y2 / bh,
        lastSeenMs: tMs,
      }));
    } else {
      boxes = boxCache.map((b) => ({
        x1: b.x1 * bw,
        y1: b.y1 * bh,
        x2: b.x2 * bw,
        y2: b.y2 * bh,
        score: 1,
      }));
    }

    // On the single-thread tier, between detector runs, pose only the box
    // nearest the focus hint; GPU tiers can afford everyone every frame.
    let poseTargets = boxes.map((box, i) => ({ box, i }));
    if (tier === "wasm" && hint && boxes.length > 1 && tMs !== lastDetectorMs) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < boxes.length; i++) {
        const cx = (boxes[i].x1 + boxes[i].x2) / 2 / bw;
        const cy = (boxes[i].y1 + boxes[i].y2) / 2 / bh;
        const d = Math.hypot(cx - hint.x, cy - hint.y);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      poseTargets = [{ box: boxes[bestIdx], i: bestIdx }];
    }

    const persons: Landmark[][] = [];
    for (const target of poseTargets) {
      const landmarks = await runPose(bitmap, target.box);
      if (!landmarks) continue;
      persons.push(landmarks);
      const advected = boxFromLandmarks(landmarks);
      if (advected && boxCache[target.i]) {
        boxCache[target.i] = { ...advected, lastSeenMs: tMs };
      }
    }
    boxCache = boxCache.filter((b) => tMs - b.lastSeenMs <= BOX_TTL_MS);

    count = persons.length;
    if (count > 0) {
      pts = new Float32Array(count * 33 * 4);
      for (let n = 0; n < count; n++) {
        const person = persons[n];
        const base = n * 33 * 4;
        for (let i = 0; i < 33; i++) {
          const p = person[i];
          pts[base + i * 4] = p.x;
          pts[base + i * 4 + 1] = p.y;
          pts[base + i * 4 + 2] = p.z;
          pts[base + i * 4 + 3] = p.v;
        }
      }
    }
    if (ballDetector) {
      ball = detectBall(ballBitmap ?? bitmap, ballClock(tMs));
    }
    lastFrameMs = tMs;
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
}

scope.onmessage = (event: MessageEvent<InMsg>) => {
  const msg = event.data;

  if (msg.type === "init") {
    queue = queue.then(async () => {
      try {
        ort.env.wasm.wasmPaths = msg.ortWasmBase.endsWith("/")
          ? msg.ortWasmBase
          : `${msg.ortWasmBase}/`;
        ort.env.wasm.numThreads = 1;
        const total = msg.detectorSpec.bytes + msg.poseSpec.bytes;
        const detBytes = await fetchModel(msg.detectorUrls, msg.detectorSpec, (loaded) => {
          scope.postMessage({ type: "model-progress", loaded, total });
        });
        const poseBytes = await fetchModel(msg.poseUrls, msg.poseSpec, (loaded) => {
          scope.postMessage({ type: "model-progress", loaded: msg.detectorSpec.bytes + loaded, total });
        });
        await createSessions(detBytes, poseBytes);
      } catch (error) {
        scope.postMessage({
          type: "init-error",
          message: error instanceof Error ? error.message : "pose init failed",
        });
        return;
      }
      // The ball detector is strictly additive: failure to load leaves the
      // pose pipeline exactly as it was.
      if (msg.ballModel) {
        try {
          try {
            ballDetector = await createBallDetector(msg.ballWasmBase, msg.ballModel, "GPU");
          } catch {
            ballDetector = await createBallDetector(msg.ballWasmBase, msg.ballModel, "CPU");
          }
        } catch {
          ballDetector = null;
        }
      }
      scope.postMessage({
        type: "ready",
        model: `${ENGINE_NAME_BASE}/${tier}`,
        ball: ballDetector != null,
      });
    });
    return;
  }

  if (msg.type === "detect") {
    // A rejected step must never break the chain: every later detect would
    // silently queue forever behind it.
    queue = queue.then(
      () => handleDetect(msg),
      () => handleDetect(msg),
    );
    return;
  }

  if (msg.type === "dispose") {
    queue = queue.then(async () => {
      try {
        await detectorSession?.release();
        await poseSession?.release();
      } catch {
        // releasing on teardown is best-effort
      }
      detectorSession = null;
      poseSession = null;
      ballDetector?.close();
      ballDetector = null;
      scope.close();
    });
  }
};
