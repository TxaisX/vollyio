// Main-thread facade for the motion-tracking engine. Lazy, idempotent, and
// null on any failure: callers treat a null engine as "no measurements" and
// the extraction pipeline degrades to its pre-existing behavior.
//
// The engine lives entirely in a worker (OffscreenCanvas + ImageBitmap
// transfer); browsers without worker support get a null engine. Detection is
// multi-person (up to 4): callers receive every athlete in the frame and
// choose who to follow via the track builder in kinematics.
//
// D-028: the engine is MediaPipe Pose Landmarker (Apache-2.0), vendored
// same-origin.
//
// D-032: detection is two-stage again. A whole-frame pose pass finds 5.4% of the
// people a detector finds; per-person crops find 82.7% (measured, 200 frames of
// real court footage). The worker returns every person plus the detector box it
// came from, and this file decides which one the user meant — geometrically,
// because engine confidence reports ~0.95 for a bystander and the subject
// alike.

import {
  POSE_LANDMARK_COUNT,
  type Landmark,
  type PersonFrame,
} from "./types.ts";
import { mapRegionPersons, type FocusRegion } from "./kinematics.ts";
import { POSE_MODELS, isGpuTier } from "./model-manifest.ts";
import { hintToLocal, pickSubject, torsoCenter as torsoCenterOf } from "./subject-select.ts";
import { type Box, boxNearestPoint, containsPoint } from "./two-stage.ts";

// Runtime assets for the inference sessions, vendored same-origin.
const WASM_BASE = "/pose/wasm";
// Sports-ball object detector (D-019). Additive: any load or inference
// failure leaves the pose pipeline untouched.
const BALL_MODEL = "/pose/efficientdet_lite0_f16.tflite";

// Worker boot (script + wasm runtime) must show a first sign of life within
// this window; the model download gets its own stall watchdog because its
// duration is connection-bound, not fixed.
const BOOT_TIMEOUT_MS = 20_000;
const MODEL_STALL_TIMEOUT_MS = 30_000;
const INIT_MAX_MS = 300_000;
// First inferences compile shaders on the GPU tier and the fallback tier is
// simply slow; both get generous per-detect bounds.
const DETECT_TIMEOUT_GPU_MS = 10_000;
const DETECT_TIMEOUT_CPU_MS = 30_000;
// Long edge for detection input; normalized outputs are size-invariant.
//
// Do NOT lower these on the theory that the landmarker downscales internally.
// It runs its DETECTOR on a small resized image to locate a person, then runs
// the LANDMARK model on a crop of the source at its original resolution. So the
// capture dim sets how many real pixels a body actually gets. On a wide outdoor
// court a player can be 15% of frame height: at 640 that is a ~96px body fed to
// a 256px input, which produces smeared limbs and a torso that collapses toward
// a box. Sized to match what the previous engine captured, for that reason.
const CAPTURE_DIM_CPU = 1280;
const CAPTURE_DIM_GPU = 1600;

export type PoseEngine = {
  // Which engine tier actually loaded (reported in measurements).
  modelName: string;
  // With a region, detection runs on that crop of the frame and landmarks
  // come back in full-frame coords. The hint is a normalized focus point,
  // currently unused by this engine (see pose-worker) but kept in the seam.
  detectPersonsFromVideo(
    video: HTMLVideoElement,
    timeS: number,
    region?: FocusRegion,
    hint?: { x: number; y: number } | null,
  ): Promise<PersonFrame | null>;
  dispose(): void;
};

export type ModelProgress = { loadedBytes: number; totalBytes: number };

function regionRect(
  video: HTMLVideoElement,
  region: FocusRegion,
): { sx: number; sy: number; sw: number; sh: number } {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 360;
  return {
    sx: Math.round(region.left * vw),
    sy: Math.round(region.top * vh),
    sw: Math.max(1, Math.round(region.width * vw)),
    sh: Math.max(1, Math.round(region.height * vh)),
  };
}

function remapped(frame: PersonFrame, region?: FocusRegion): PersonFrame {
  return region ? { t: frame.t, persons: mapRegionPersons(frame.persons, region) } : frame;
}

function unpack(pts: Float32Array, count: number, timeS: number): PersonFrame {
  const persons: Landmark[][] = [];
  for (let n = 0; n < count; n++) {
    const base = n * POSE_LANDMARK_COUNT * 4;
    const out: Landmark[] = new Array(POSE_LANDMARK_COUNT);
    for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
      out[i] = {
        x: pts[base + i * 4],
        y: pts[base + i * 4 + 1],
        z: pts[base + i * 4 + 2],
        v: pts[base + i * 4 + 3],
      };
    }
    persons.push(out);
  }
  return { t: Math.round(timeS * 1000) / 1000, persons };
}

function detectSize(
  video: HTMLVideoElement,
  captureDim: number,
): { resizeWidth: number; resizeHeight: number } {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 360;
  const scale = Math.min(1, captureDim / Math.max(w, h));
  return {
    resizeWidth: Math.max(1, Math.round(w * scale)),
    resizeHeight: Math.max(1, Math.round(h * scale)),
  };
}

function supportsWorkerPath(): boolean {
  return (
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap !== "undefined"
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

type WorkerResult = {
  count: number;
  pts: Float32Array | null;
  // Detector box each pose came from, so a pose can be checked against the body
  // its crop was built around (D-032).
  boxes: Float32Array | null;
  ball?: { x: number; y: number; score: number } | null;
};

const progressListeners = new Set<(p: ModelProgress) => void>();
let lastProgress: ModelProgress | null = null;

function emitProgress(p: ModelProgress): void {
  lastProgress = p;
  for (const listener of progressListeners) listener(p);
}

function createWorkerEngine(): Promise<PoseEngine | null> {
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./pose-worker", import.meta.url));
    } catch {
      resolve(null);
      return;
    }

    let nextId = 1;
    const pending = new Map<number, (result: WorkerResult) => void>();
    let settledInit = false;
    let detectTimeoutMs = DETECT_TIMEOUT_CPU_MS;

    const failInit = () => {
      if (!settledInit) {
        settledInit = true;
        clearTimeout(watchdog);
        clearTimeout(maxTimer);
        worker.terminate();
        resolve(null);
      }
    };

    // Boot watchdog, re-armed by model download progress so a slow network
    // is not mistaken for a dead worker.
    let watchdog = setTimeout(failInit, BOOT_TIMEOUT_MS);
    const maxTimer = setTimeout(failInit, INIT_MAX_MS);

    worker.onerror = failInit;

    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === "model-progress" && !settledInit) {
        clearTimeout(watchdog);
        watchdog = setTimeout(failInit, MODEL_STALL_TIMEOUT_MS);
        if (typeof msg.loaded === "number" && typeof msg.total === "number") {
          emitProgress({ loadedBytes: msg.loaded, totalBytes: msg.total });
        }
        return;
      }
      if (msg?.type === "ready" && !settledInit) {
        settledInit = true;
        clearTimeout(watchdog);
        clearTimeout(maxTimer);
        if (typeof msg.model === "string" && msg.model) {
          engine.modelName = msg.model;
        }
        detectTimeoutMs = isGpuTier(engine.modelName)
          ? DETECT_TIMEOUT_GPU_MS
          : DETECT_TIMEOUT_CPU_MS;
        resolve(engine);
        return;
      }
      if (msg?.type === "init-error" && !settledInit) {
        failInit();
        return;
      }
      if (msg?.type === "result") {
        const settle = pending.get(msg.id);
        if (settle) {
          pending.delete(msg.id);
          settle({
            count: typeof msg.count === "number" ? msg.count : 0,
            pts: msg.pts instanceof Float32Array ? msg.pts : null,
            boxes: msg.boxes instanceof Float32Array ? msg.boxes : null,
            ball:
              msg.ball && typeof msg.ball.x === "number"
                ? { x: msg.ball.x, y: msg.ball.y, score: msg.ball.score }
                : null,
          });
        }
      }
    };

    const engine: PoseEngine = {
      // Conservative until the worker reports what actually loaded.
      modelName: `${POSE_MODELS[POSE_MODELS.length - 1].name}/cpu`,
      async detectPersonsFromVideo(video, timeS, region, hint) {
        // The GPU tier can afford a sharper capture; CPU stays at the base dim.
        const captureDim = isGpuTier(engine.modelName) ? CAPTURE_DIM_GPU : CAPTURE_DIM_CPU;
        let bitmap: ImageBitmap;
        let ballBitmap: ImageBitmap | undefined;
        try {
          if (region) {
            const { sx, sy, sw, sh } = regionRect(video, region);
            const scale = Math.min(1, captureDim / Math.max(sw, sh));
            bitmap = await createImageBitmap(video, sx, sy, sw, sh, {
              resizeWidth: Math.max(1, Math.round(sw * scale)),
              resizeHeight: Math.max(1, Math.round(sh * scale)),
            });
            // The ball flies outside any player crop; give the detector the
            // full frame. Non-fatal: without it the crop is searched instead.
            try {
              ballBitmap = await createImageBitmap(video, detectSize(video, captureDim));
            } catch {
              ballBitmap = undefined;
            }
          } else {
            bitmap = await createImageBitmap(video, detectSize(video, captureDim));
          }
        } catch {
          return null;
        }
        const id = nextId++;
        const transfers = ballBitmap ? [bitmap, ballBitmap] : [bitmap];
        const result = await withTimeout(
          new Promise<WorkerResult>((settle) => {
            pending.set(id, settle);
            worker.postMessage(
              { type: "detect", id, bitmap, tMs: timeS * 1000, ballBitmap, hint: hint ?? null },
              transfers,
            );
          }),
          detectTimeoutMs,
          { count: 0, pts: null, boxes: null },
        );
        pending.delete(id);
        const ball = result.ball
          ? { ...result.ball, t: Math.round(timeS * 1000) / 1000 }
          : null;
        if (result.pts && result.count > 0) {
          const local = unpack(result.pts, result.count, timeS);

          // Confidence cannot choose between the tapped athlete and a bystander:
          // the engine reports the same ~0.95 for both. Selection is geometric,
          // and now has real detector boxes to work with (D-032). Detections are
          // in crop space, so the hint moves into it too.
          const localHint = hint
            ? region
              ? hintToLocal(hint, region)
              : hint
            : null;

          const boxes: Box[] = [];
          if (result.boxes) {
            for (let n = 0; n < result.count; n++) {
              boxes.push({
                x: result.boxes[n * 4],
                y: result.boxes[n * 4 + 1],
                w: result.boxes[n * 4 + 2],
                h: result.boxes[n * 4 + 3],
                score: 1,
              });
            }
          }

          // Drop any pose whose torso did not land inside the body its own crop
          // was built around. Measured at 17.6% of poses on real footage, and
          // undetectable by any confidence signal the engine provides.
          const faithful: number[] = [];
          for (let n = 0; n < local.persons.length; n++) {
            const box = boxes[n];
            if (!box) {
              faithful.push(n);
              continue;
            }
            const centre = torsoCenterOf(local.persons[n]);
            if (!centre || containsPoint(box, centre)) faithful.push(n);
          }

          // With boxes available the tap picks a BODY, which is more reliable
          // than picking among poses: a box is what the user actually aimed at.
          let chosenIndex: number | null = null;
          if (localHint && boxes.length > 0) {
            const near = boxNearestPoint(
              faithful.map((n) => boxes[n]),
              localHint,
            );
            if (near) chosenIndex = faithful[near.index];
          }
          if (chosenIndex === null) {
            const choice = pickSubject(
              faithful.map((n) => local.persons[n]),
              localHint,
            );
            chosenIndex = choice.index === null ? null : faithful[choice.index];
          }

          // An implausible detection is dropped rather than passed on: the
          // pipeline already degrades safely without measurements, and drawing a
          // skeleton on the wrong athlete is a confident false claim.
          const chosen =
            chosenIndex === null ? [] : [local.persons[chosenIndex]];
          const frame = remapped({ t: local.t, persons: chosen }, region);
          return { ...frame, ball };
        }
        // No athlete this instant, but the ball may still be in flight.
        return ball ? { t: Math.round(timeS * 1000) / 1000, persons: [], ball } : null;
      },
      dispose() {
        pending.clear();
        worker.postMessage({ type: "dispose" });
      },
    };

    worker.postMessage({
      type: "init",
      wasmBase: WASM_BASE,
      models: POSE_MODELS,
      ballModel: BALL_MODEL,
    });
  });
}

let enginePromise: Promise<PoseEngine | null> | null = null;

// Resolves to null when the device, browser, or asset load cannot support
// tracking. Callers must handle null by proceeding without measurements.
// onProgress reports model download progress (a one-time cost per device).
export function loadPoseEngine(opts?: {
  onProgress?: (p: ModelProgress) => void;
}): Promise<PoseEngine | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (opts?.onProgress) {
    progressListeners.add(opts.onProgress);
    if (lastProgress) opts.onProgress(lastProgress);
  }
  if (!enginePromise) {
    enginePromise = supportsWorkerPath() ? createWorkerEngine() : Promise.resolve(null);
  }
  return enginePromise;
}
