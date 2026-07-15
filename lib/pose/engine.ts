// Main-thread facade for the motion-tracking engine. Lazy, idempotent, and
// null on any failure: callers treat a null engine as "no measurements" and
// the extraction pipeline degrades to its pre-existing behavior.
//
// The engine lives entirely in a worker (OffscreenCanvas + ImageBitmap
// transfer); browsers without worker support get a null engine. Detection is
// multi-person (up to 4): callers receive every athlete in the frame and
// choose who to follow via the track builder in kinematics.

import {
  POSE_LANDMARK_COUNT,
  type Landmark,
  type PersonFrame,
} from "./types.ts";
import { mapRegionPersons, type FocusRegion } from "./kinematics.ts";
import {
  DETECTOR_MODEL,
  POSE_MODEL,
  ENGINE_NAME_BASE,
  modelChunkUrls,
} from "./rtm/model-manifest.ts";

// Runtime assets for the inference sessions, vendored same-origin.
const ORT_WASM_BASE = "/pose/ort/";
// Sports-ball object detector (D-019). Additive: any load or inference
// failure leaves the pose pipeline untouched.
const BALL_WASM_BASE = "/pose/wasm";
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
const DETECT_TIMEOUT_WASM_MS = 30_000;
// Long edge for detection input; normalized outputs are size-invariant.
// Sized so a distant player still spans enough pixels for the pose crop
// (this replaces the old region-zoom machinery).
const CAPTURE_DIM = 1280;

export type PoseEngine = {
  // Which engine tier actually loaded (reported in measurements).
  modelName: string;
  // With a region, detection runs on that crop of the frame and landmarks
  // come back in full-frame coords. The hint is a normalized focus point:
  // low-power tiers prioritize the person nearest it between detector runs.
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

function detectSize(video: HTMLVideoElement): { resizeWidth: number; resizeHeight: number } {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 360;
  const scale = Math.min(1, CAPTURE_DIM / Math.max(w, h));
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
    let detectTimeoutMs = DETECT_TIMEOUT_WASM_MS;

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
        detectTimeoutMs = engine.modelName.endsWith("/webgpu")
          ? DETECT_TIMEOUT_GPU_MS
          : DETECT_TIMEOUT_WASM_MS;
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
            ball:
              msg.ball && typeof msg.ball.x === "number"
                ? { x: msg.ball.x, y: msg.ball.y, score: msg.ball.score }
                : null,
          });
        }
      }
    };

    const engine: PoseEngine = {
      modelName: `${ENGINE_NAME_BASE}/wasm`,
      async detectPersonsFromVideo(video, timeS, region, hint) {
        let bitmap: ImageBitmap;
        let ballBitmap: ImageBitmap | undefined;
        try {
          if (region) {
            const { sx, sy, sw, sh } = regionRect(video, region);
            const scale = Math.min(1, CAPTURE_DIM / Math.max(sw, sh));
            bitmap = await createImageBitmap(video, sx, sy, sw, sh, {
              resizeWidth: Math.max(1, Math.round(sw * scale)),
              resizeHeight: Math.max(1, Math.round(sh * scale)),
            });
            // The ball flies outside any player crop; give the detector the
            // full frame. Non-fatal: without it the crop is searched instead.
            try {
              ballBitmap = await createImageBitmap(video, detectSize(video));
            } catch {
              ballBitmap = undefined;
            }
          } else {
            bitmap = await createImageBitmap(video, detectSize(video));
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
          { count: 0, pts: null },
        );
        pending.delete(id);
        const ball = result.ball
          ? { ...result.ball, t: Math.round(timeS * 1000) / 1000 }
          : null;
        if (result.pts && result.count > 0) {
          const frame = remapped(unpack(result.pts, result.count, timeS), region);
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
      detectorUrls: modelChunkUrls(DETECTOR_MODEL),
      poseUrls: modelChunkUrls(POSE_MODEL),
      detectorSpec: DETECTOR_MODEL,
      poseSpec: POSE_MODEL,
      ortWasmBase: ORT_WASM_BASE,
      ballWasmBase: BALL_WASM_BASE,
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
