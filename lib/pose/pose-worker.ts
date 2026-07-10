/// <reference lib="webworker" />
// Hand-rolled worker hosting the WASM pose landmarker. Receives transferred
// ImageBitmaps, returns flat Float32Array landmark buffers (x, y, z, v per
// point). The detector requires monotonically increasing timestamps, so the
// worker keeps its own synthetic clock; clip time stays with the caller.

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { POSE_LANDMARK_COUNT } from "./types.ts";

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
    numPoses: 1,
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
    try {
      if (landmarker) {
        clockMs += 33.34;
        const result = landmarker.detectForVideo(bitmap, clockMs);
        const person = result.landmarks?.[0];
        if (person && person.length === POSE_LANDMARK_COUNT) {
          pts = new Float32Array(POSE_LANDMARK_COUNT * 4);
          for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
            const p = person[i];
            pts[i * 4] = p.x;
            pts[i * 4 + 1] = p.y;
            pts[i * 4 + 2] = p.z ?? 0;
            pts[i * 4 + 3] = p.visibility ?? 0;
          }
        }
      }
    } catch {
      pts = null;
    } finally {
      bitmap.close();
    }
    if (pts) {
      scope.postMessage({ type: "result", id, pts }, [pts.buffer]);
    } else {
      scope.postMessage({ type: "result", id, pts: null });
    }
    return;
  }

  if (msg.type === "dispose") {
    landmarker?.close();
    landmarker = null;
    scope.close();
  }
};
