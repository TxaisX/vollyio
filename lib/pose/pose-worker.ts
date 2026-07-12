/// <reference lib="webworker" />
// Hand-rolled worker hosting the WASM pose landmarker. Receives transferred
// ImageBitmaps, returns every detected person as one flat Float32Array
// (count x 33 x [x, y, z, v]). The detector requires monotonically increasing
// timestamps; real clip times feed a rebasing monotonic clock so the temporal
// filter sees true inter-frame spacing instead of a fixed synthetic tick.

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { POSE_LANDMARK_COUNT, createMonotonicClock } from "./types.ts";

const MAX_PERSONS = 4;

type InitMsg = { type: "init"; wasmBase: string; models: { path: string; name: string }[] };
type DetectMsg = { type: "detect"; id: number; bitmap: ImageBitmap; tMs?: number };
type DisposeMsg = { type: "dispose" };
type InMsg = InitMsg | DetectMsg | DisposeMsg;

const scope = self as unknown as DedicatedWorkerGlobalScope;

let landmarker: PoseLandmarker | null = null;
const clock = createMonotonicClock();
let fallbackMs = 0;

async function createLandmarker(wasmBase: string, modelPath: string, delegate: "GPU" | "CPU") {
  const fileset = await FilesetResolver.forVisionTasks(wasmBase);
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelPath, delegate },
    runningMode: "VIDEO",
    numPoses: MAX_PERSONS,
  });
}

scope.onmessage = async (event: MessageEvent<InMsg>) => {
  const msg = event.data;

  if (msg.type === "init") {
    let loadedName: string | null = null;
    let lastError: unknown = null;
    for (const model of msg.models) {
      try {
        try {
          landmarker = await createLandmarker(msg.wasmBase, model.path, "GPU");
        } catch {
          landmarker = await createLandmarker(msg.wasmBase, model.path, "CPU");
        }
        loadedName = model.name;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (loadedName) {
      scope.postMessage({ type: "ready", model: loadedName });
    } else {
      scope.postMessage({
        type: "init-error",
        message: lastError instanceof Error ? lastError.message : "pose init failed",
      });
    }
    return;
  }

  if (msg.type === "detect") {
    const { id, bitmap, tMs } = msg;
    let pts: Float32Array | null = null;
    let count = 0;
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
    } catch {
      pts = null;
      count = 0;
    } finally {
      bitmap.close();
    }
    if (pts) {
      scope.postMessage({ type: "result", id, count, pts }, [pts.buffer]);
    } else {
      scope.postMessage({ type: "result", id, count: 0, pts: null });
    }
    return;
  }

  if (msg.type === "dispose") {
    landmarker?.close();
    landmarker = null;
    scope.close();
  }
};
