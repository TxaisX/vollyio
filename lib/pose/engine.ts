// Main-thread facade for the motion-tracking engine. Lazy, idempotent, and
// null on any failure: callers treat a null engine as "no measurements" and
// the extraction pipeline degrades to its pre-existing behavior.
//
// Detection is multi-person (up to 4): callers receive every athlete in the
// frame and choose who to follow via the track builder in kinematics.

import {
  POSE_LANDMARK_COUNT,
  createMonotonicClock,
  type Landmark,
  type PersonFrame,
} from "./types.ts";
import { mapRegionPersons, type FocusRegion } from "./kinematics.ts";

const WASM_BASE = "/pose/wasm";
// Ordered preference: the full landmarker tracks fast volleyball motion better
// than lite (same 33 landmarks, same license, bigger net); devices that fail
// to load it fall back to lite rather than losing measurements entirely.
const MODELS = [
  { path: "/pose/pose_landmarker_full.task", name: "pose-landmarker-full" },
  { path: "/pose/pose_landmarker_lite.task", name: "pose-landmarker-lite" },
];
const INIT_TIMEOUT_MS = 12_000;
const DETECT_TIMEOUT_MS = 4_000;
const MAX_PERSONS = 4;
// Long edge for detection input; normalized outputs are size-invariant.
const DETECT_DIM = 512;

export type PoseEngine = {
  // Which landmarker variant actually loaded (reported in measurements).
  modelName: string;
  // With a region, detection runs on that crop of the frame (a distant player
  // fills the model's input) and landmarks come back in full-frame coords.
  detectPersonsFromVideo(
    video: HTMLVideoElement,
    timeS: number,
    region?: FocusRegion,
  ): Promise<PersonFrame | null>;
  dispose(): void;
};

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
    let loadedModel = MODELS[MODELS.length - 1].name;

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
        if (typeof msg.model === "string" && msg.model) {
          loadedModel = msg.model;
          engine.modelName = msg.model;
        }
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
      modelName: loadedModel,
      async detectPersonsFromVideo(video, timeS, region) {
        let bitmap: ImageBitmap;
        try {
          if (region) {
            const { sx, sy, sw, sh } = regionRect(video, region);
            const scale = Math.min(1, DETECT_DIM / Math.max(sw, sh));
            bitmap = await createImageBitmap(video, sx, sy, sw, sh, {
              resizeWidth: Math.max(1, Math.round(sw * scale)),
              resizeHeight: Math.max(1, Math.round(sh * scale)),
            });
          } else {
            bitmap = await createImageBitmap(video, detectSize(video));
          }
        } catch {
          return null;
        }
        const id = nextId++;
        const result = await withTimeout(
          new Promise<WorkerResult>((settle) => {
            pending.set(id, settle);
            worker.postMessage({ type: "detect", id, bitmap, tMs: timeS * 1000 }, [bitmap]);
          }),
          DETECT_TIMEOUT_MS,
          { count: 0, pts: null },
        );
        pending.delete(id);
        return result.pts && result.count > 0
          ? remapped(unpack(result.pts, result.count, timeS), region)
          : null;
      },
      dispose() {
        pending.clear();
        worker.postMessage({ type: "dispose" });
      },
    };

    worker.postMessage({ type: "init", wasmBase: WASM_BASE, models: MODELS });
  });
}

// Main-thread fallback for browsers without OffscreenCanvas in workers. Loads
// the vision bundle into the page chunk lazily; only the analyze flow pays.
async function createMainThreadEngine(): Promise<PoseEngine | null> {
  try {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    const options = (modelPath: string, delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: modelPath, delegate },
      runningMode: "VIDEO" as const,
      numPoses: MAX_PERSONS,
    });
    let landmarker: import("@mediapipe/tasks-vision").PoseLandmarker | undefined;
    let modelName = MODELS[MODELS.length - 1].name;
    for (const model of MODELS) {
      try {
        landmarker = await PoseLandmarker.createFromOptions(fileset, options(model.path, "GPU"));
      } catch {
        try {
          landmarker = await PoseLandmarker.createFromOptions(fileset, options(model.path, "CPU"));
        } catch {
          continue;
        }
      }
      modelName = model.name;
      break;
    }
    if (!landmarker) return null;
    const clock = createMonotonicClock();
    let cropCanvas: HTMLCanvasElement | null = null;
    return {
      modelName,
      async detectPersonsFromVideo(video, timeS, region) {
        try {
          const stamp = clock(timeS * 1000);
          let source: HTMLVideoElement | HTMLCanvasElement = video;
          if (region) {
            const { sx, sy, sw, sh } = regionRect(video, region);
            const scale = Math.min(1, DETECT_DIM / Math.max(sw, sh));
            cropCanvas ??= document.createElement("canvas");
            cropCanvas.width = Math.max(1, Math.round(sw * scale));
            cropCanvas.height = Math.max(1, Math.round(sh * scale));
            cropCanvas
              .getContext("2d")!
              .drawImage(video, sx, sy, sw, sh, 0, 0, cropCanvas.width, cropCanvas.height);
            source = cropCanvas;
          }
          const result = landmarker.detectForVideo(source, stamp);
          const persons = (result.landmarks ?? []).filter(
            (p) => p.length === POSE_LANDMARK_COUNT,
          );
          if (persons.length === 0) return null;
          return remapped(
            {
              t: Math.round(timeS * 1000) / 1000,
              persons: persons.slice(0, MAX_PERSONS).map((person) =>
                person.map((p) => ({
                  x: p.x,
                  y: p.y,
                  z: p.z ?? 0,
                  v: p.visibility ?? 0,
                })),
              ),
            },
            region,
          );
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
