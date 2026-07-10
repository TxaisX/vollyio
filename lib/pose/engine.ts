// Main-thread facade for the motion-tracking engine. Lazy, idempotent, and
// null on any failure: callers treat a null engine as "no measurements" and
// the extraction pipeline degrades to its pre-existing behavior.

import { POSE_LANDMARK_COUNT, type Landmark, type LandmarkFrame } from "./types.ts";

const WASM_BASE = "/pose/wasm";
const MODEL_PATH = "/pose/pose_landmarker_lite.task";
const INIT_TIMEOUT_MS = 12_000;
const DETECT_TIMEOUT_MS = 4_000;
// Long edge for detection input; normalized outputs are size-invariant.
const DETECT_DIM = 512;

export type PoseEngine = {
  detectFromVideo(video: HTMLVideoElement, timeS: number): Promise<LandmarkFrame | null>;
  dispose(): void;
};

function toFrame(pts: Float32Array, timeS: number): LandmarkFrame {
  const out: Landmark[] = new Array(POSE_LANDMARK_COUNT);
  for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
    out[i] = {
      x: pts[i * 4],
      y: pts[i * 4 + 1],
      z: pts[i * 4 + 2],
      v: pts[i * 4 + 3],
    };
  }
  return { t: Math.round(timeS * 1000) / 1000, pts: out };
}

function detectSize(video: HTMLVideoElement): { resizeWidth: number; resizeHeight: number } {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 360;
  const scale = Math.min(1, DETECT_DIM / Math.max(w, h));
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
    const pending = new Map<number, (pts: Float32Array | null) => void>();
    let settledInit = false;

    const initTimer = setTimeout(() => {
      if (!settledInit) {
        settledInit = true;
        worker.terminate();
        resolve(null);
      }
    }, INIT_TIMEOUT_MS);

    worker.onerror = () => {
      if (!settledInit) {
        settledInit = true;
        clearTimeout(initTimer);
        worker.terminate();
        resolve(null);
      }
    };

    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === "ready" && !settledInit) {
        settledInit = true;
        clearTimeout(initTimer);
        resolve(engine);
        return;
      }
      if (msg?.type === "init-error" && !settledInit) {
        settledInit = true;
        clearTimeout(initTimer);
        worker.terminate();
        resolve(null);
        return;
      }
      if (msg?.type === "result") {
        const settle = pending.get(msg.id);
        if (settle) {
          pending.delete(msg.id);
          settle(msg.pts instanceof Float32Array ? msg.pts : null);
        }
      }
    };

    const engine: PoseEngine = {
      async detectFromVideo(video, timeS) {
        let bitmap: ImageBitmap;
        try {
          bitmap = await createImageBitmap(video, detectSize(video));
        } catch {
          return null;
        }
        const id = nextId++;
        const pts = await withTimeout(
          new Promise<Float32Array | null>((settle) => {
            pending.set(id, settle);
            worker.postMessage({ type: "detect", id, bitmap }, [bitmap]);
          }),
          DETECT_TIMEOUT_MS,
          null,
        );
        pending.delete(id);
        return pts ? toFrame(pts, timeS) : null;
      },
      dispose() {
        pending.clear();
        worker.postMessage({ type: "dispose" });
      },
    };

    worker.postMessage({ type: "init", wasmBase: WASM_BASE, modelPath: MODEL_PATH });
  });
}

// Main-thread fallback for browsers without OffscreenCanvas in workers. Loads
// the vision bundle into the page chunk lazily; only the analyze flow pays.
async function createMainThreadEngine(): Promise<PoseEngine | null> {
  try {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    let landmarker;
    try {
      landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    } catch {
      landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    }
    let clockMs = 0;
    return {
      async detectFromVideo(video, timeS) {
        try {
          clockMs += 33.34;
          const result = landmarker.detectForVideo(video, clockMs);
          const person = result.landmarks?.[0];
          if (!person || person.length !== POSE_LANDMARK_COUNT) return null;
          const pts = new Float32Array(POSE_LANDMARK_COUNT * 4);
          for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
            const p = person[i];
            pts[i * 4] = p.x;
            pts[i * 4 + 1] = p.y;
            pts[i * 4 + 2] = p.z ?? 0;
            pts[i * 4 + 3] = p.visibility ?? 0;
          }
          return toFrame(pts, timeS);
        } catch {
          return null;
        }
      },
      dispose() {
        landmarker.close();
      },
    };
  } catch {
    return null;
  }
}

let enginePromise: Promise<PoseEngine | null> | null = null;

// Resolves to null when the device, browser, or asset load cannot support
// tracking. Callers must handle null by proceeding without measurements.
export function loadPoseEngine(): Promise<PoseEngine | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!enginePromise) {
    enginePromise = withTimeout(
      supportsWorkerPath() ? createWorkerEngine() : createMainThreadEngine(),
      INIT_TIMEOUT_MS + 2_000,
      null,
    );
  }
  return enginePromise;
}
