/// <reference lib="webworker" />
// Hand-rolled worker hosting the WASM pose landmarker. Receives transferred
// ImageBitmaps, returns every detected person as one flat Float32Array
// (count x 33 x [x, y, z, v]). The detector requires monotonically increasing
// timestamps, so the worker keeps its own synthetic clock; clip time stays
// with the caller.

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { POSE_LANDMARK_COUNT } from "./types.ts";

const MAX_PERSONS = 4;

type InitMsg = { type: "init"; wasmBase: string; modelPath: string };
type DetectMsg = { type: "detect"; id: number; bitmap: ImageBitmap };
type DisposeMsg = { type: "dispose" };
type InMsg = InitMsg | DetectMsg | DisposeMsg;

const scope = self as unknown as DedicatedWorkerGlobalScope;

let landmarker: PoseLandmarker | null = null;
let clockMs = 0;

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
    try {
      try {
        landmarker = await createLandmarker(msg.wasmBase, msg.modelPath, "GPU");
      } catch {
        landmarker = await createLandmarker(msg.wasmBase, msg.modelPath, "CPU");
      }
      scope.postMessage({ type: "ready" });
    } catch (error) {
      scope.postMessage({
        type: "init-error",
        message: error instanceof Error ? error.message : "pose init failed",
      });
    }
    return;
  }

  if (msg.type === "detect") {
    const { id, bitmap } = msg;
    let pts: Float32Array | null = null;
    let count = 0;
    try {
      if (landmarker) {
        clockMs += 33.34;
        const result = landmarker.detectForVideo(bitmap, clockMs);
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
