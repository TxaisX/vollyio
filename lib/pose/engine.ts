// Main-thread facade for the motion-tracking engine. Lazy, idempotent, and
// null on any failure: callers treat a null engine as "no measurements" and
// the extraction pipeline degrades to its pre-existing behavior.
//
// Detection is multi-person (up to 4): callers receive every athlete in the
// frame and choose who to follow via the track builder in kinematics.

import { POSE_LANDMARK_COUNT, type Landmark, type PersonFrame } from "./types.ts";

const WASM_BASE = "/pose/wasm";
const MODEL_PATH = "/pose/pose_landmarker_lite.task";
const INIT_TIMEOUT_MS = 12_000;
const DETECT_TIMEOUT_MS = 4_000;
const MAX_PERSONS = 4;
// Long edge for detection input; normalized outputs are size-invariant.
const DETECT_DIM = 512;

export type PoseEngine = {
  detectPersonsFromVideo(video: HTMLVideoElement, timeS: number): Promise<PersonFrame | null>;
  dispose(): void;
};

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

type WorkerResult = { count: number; pts: Float32Array | null };

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
          settle({
            count: typeof msg.count === "number" ? msg.count : 0,
            pts: msg.pts instanceof Float32Array ? msg.pts : null,
          });
        }
      }
    };

    const engine: PoseEngine = {
      async detectPersonsFromVideo(video, timeS) {
        let bitmap: ImageBitmap;
        try {
          bitmap = await createImageBitmap(video, detectSize(video));
        } catch {
          return null;
        }
        const id = nextId++;
        const result = await withTimeout(
          new Promise<WorkerResult>((settle) => {
            pending.set(id, settle);
            worker.postMessage({ type: "detect", id, bitmap }, [bitmap]);
          }),
          DETECT_TIMEOUT_MS,
          { count: 0, pts: null },
        );
        pending.delete(id);
        return result.pts && result.count > 0
          ? unpack(result.pts, result.count, timeS)
          : null;
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
    const options = (delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      runningMode: "VIDEO" as const,
      numPoses: MAX_PERSONS,
    });
    let landmarker;
    try {
      landmarker = await PoseLandmarker.createFromOptions(fileset, options("GPU"));
    } catch {
      landmarker = await PoseLandmarker.createFromOptions(fileset, options("CPU"));
    }
    let clockMs = 0;
    return {
      async detectPersonsFromVideo(video, timeS) {
        try {
          clockMs += 33.34;
          const result = landmarker.detectForVideo(video, clockMs);
          const persons = (result.landmarks ?? []).filter(
            (p) => p.length === POSE_LANDMARK_COUNT,
          );
          if (persons.length === 0) return null;
          return {
            t: Math.round(timeS * 1000) / 1000,
            persons: persons.slice(0, MAX_PERSONS).map((person) =>
              person.map((p) => ({
                x: p.x,
                y: p.y,
                z: p.z ?? 0,
                v: p.visibility ?? 0,
              })),
            ),
          };
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
