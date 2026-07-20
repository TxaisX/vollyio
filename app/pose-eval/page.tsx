"use client";

// TEMPORARY EVALUATION HARNESS. Delete before merge.
//
// Runs single-stage and two-stage detection over the whole frame corpus and
// scores them without any human labels, so "does this work" stops being a
// question answered by squinting at screenshots.
//
// The metric that matters is CROP FIDELITY: when a pose is produced from a crop
// built around one person's box, does the resulting torso actually land inside
// that box? That directly measures the failure single-stage detection could not
// see — a skeleton drawn confidently on the wrong athlete. Engine confidence
// cannot answer it, because it reports ~0.95 either way.
//
// Results are printed as JSON for collection.

import { useCallback, useRef, useState } from "react";
import { POSE_LANDMARK_COUNT, type Landmark } from "@/lib/pose/types";
import { torsoCenter } from "@/lib/pose/subject-select";
import {
  type Box,
  containsPoint,
  cropForBox,
  fromCrop,
  usableBoxes,
} from "@/lib/pose/two-stage";

type FrameEntry = { src: string; clip: string; t: number };

type FrameResult = {
  src: string;
  clip: string;
  detectorPeople: number;
  singleStagePeople: number;
  twoStagePoses: number;
  // Poses whose torso landed inside the box they were cropped from.
  twoStageFaithful: number;
  ms: number;
};

const CAPTURE_DIM = 1280;

export default function PoseEvalPage() {
  const [status, setStatus] = useState("idle");
  const [results, setResults] = useState<FrameResult[]>([]);
  const [done, setDone] = useState(false);
  const abortRef = useRef(false);

  const runAll = useCallback(async () => {
    abortRef.current = false;
    setResults([]);
    setDone(false);
    setStatus("loading manifest");
    const manifest: { frames: FrameEntry[] } = await (
      await fetch("/evalframes/manifest.json")
    ).json();

    setStatus("loading models");
    const { FilesetResolver, ObjectDetector, PoseLandmarker } = await import(
      "@mediapipe/tasks-vision"
    );
    const fileset = await FilesetResolver.forVisionTasks("/pose/wasm");

    const makePose = async (delegate: "GPU" | "CPU") =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/pose/pose_landmarker_full.task",
          delegate,
        },
        runningMode: "IMAGE",
        numPoses: 4,
      });
    const makeDetector = async (delegate: "GPU" | "CPU") =>
      ObjectDetector.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/pose/efficientdet_lite0_f16.tflite",
          delegate,
        },
        runningMode: "IMAGE",
        categoryAllowlist: ["person"],
        scoreThreshold: 0.25,
        maxResults: 12,
      });

    let pose: Awaited<ReturnType<typeof makePose>>;
    let detector: Awaited<ReturnType<typeof makeDetector>>;
    try {
      pose = await makePose("GPU");
      detector = await makeDetector("GPU");
    } catch {
      pose = await makePose("CPU");
      detector = await makeDetector("CPU");
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const out: FrameResult[] = [];

    for (let i = 0; i < manifest.frames.length; i++) {
      if (abortRef.current) break;
      const entry = manifest.frames[i];
      setStatus(`${i + 1}/${manifest.frames.length} ${entry.clip}`);

      const img = new Image();
      img.src = entry.src;
      try {
        await img.decode();
      } catch {
        continue;
      }

      const started = performance.now();
      const scale = Math.min(1, CAPTURE_DIM / Math.max(img.naturalWidth, img.naturalHeight));
      const W = Math.round(img.naturalWidth * scale);
      const H = Math.round(img.naturalHeight * scale);
      canvas.width = W;
      canvas.height = H;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, W, H);

      // Stage 1: enumerate people.
      const detections = detector.detect(canvas).detections ?? [];
      const boxes: Box[] = detections
        .map((d) => {
          const b = d.boundingBox;
          if (!b) return null;
          return {
            x: b.originX / W,
            y: b.originY / H,
            w: b.width / W,
            h: b.height / H,
            score: d.categories?.[0]?.score ?? 0,
          };
        })
        .filter((b): b is Box => b !== null);
      const people = usableBoxes(boxes);

      // Single stage, for comparison: pose straight at the whole frame.
      const singleStage = (pose.detect(canvas).landmarks ?? []).filter(
        (p) => p.length === POSE_LANDMARK_COUNT,
      );

      // Stage 2: pose per person crop, checked for fidelity to its own box.
      let twoStagePoses = 0;
      let twoStageFaithful = 0;
      const cropCanvas = document.createElement("canvas");
      const cropCtx = cropCanvas.getContext("2d", { willReadFrequently: true })!;
      for (const box of people) {
        const crop = cropForBox(box);
        const sw = Math.max(1, Math.round(crop.w * W));
        const sh = Math.max(1, Math.round(crop.h * H));
        cropCanvas.width = Math.min(512, sw);
        cropCanvas.height = Math.max(1, Math.round((sh / sw) * Math.min(512, sw)));
        cropCtx.imageSmoothingEnabled = true;
        cropCtx.imageSmoothingQuality = "high";
        cropCtx.drawImage(
          canvas,
          Math.round(crop.x * W),
          Math.round(crop.y * H),
          sw,
          sh,
          0,
          0,
          cropCanvas.width,
          cropCanvas.height,
        );
        const found = (pose.detect(cropCanvas).landmarks ?? []).filter(
          (p) => p.length === POSE_LANDMARK_COUNT,
        );
        if (found.length === 0) continue;
        twoStagePoses++;
        const pts: Landmark[] = found[0].map((q) => ({
          x: q.x,
          y: q.y,
          z: q.z ?? 0,
          v: q.visibility ?? 0,
        }));
        const center = torsoCenter(pts);
        if (center && containsPoint(box, fromCrop(center, crop))) twoStageFaithful++;
      }

      out.push({
        src: entry.src,
        clip: entry.clip,
        detectorPeople: people.length,
        singleStagePeople: singleStage.length,
        twoStagePoses,
        twoStageFaithful,
        ms: Math.round(performance.now() - started),
      });
      if (out.length % 5 === 0) setResults([...out]);
    }

    pose.close();
    detector.close();
    setResults(out);
    setDone(true);
    setStatus(`done: ${out.length} frames`);
  }, []);

  const totals = results.reduce(
    (a, r) => ({
      detector: a.detector + r.detectorPeople,
      single: a.single + r.singleStagePeople,
      two: a.two + r.twoStagePoses,
      faithful: a.faithful + r.twoStageFaithful,
      framesWithPeople: a.framesWithPeople + (r.detectorPeople > 0 ? 1 : 0),
      singleFound: a.singleFound + (r.singleStagePeople > 0 ? 1 : 0),
      twoFound: a.twoFound + (r.twoStagePoses > 0 ? 1 : 0),
    }),
    { detector: 0, single: 0, two: 0, faithful: 0, framesWithPeople: 0, singleFound: 0, twoFound: 0 },
  );

  return (
    <main style={{ padding: 20, fontFamily: "ui-monospace, monospace", background: "#0d1b22", color: "#f2efe6", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 18 }}>Pose evaluation over the frame corpus</h1>
      <button
        onClick={runAll}
        style={{ padding: "8px 16px", background: "#e8b53f", color: "#0d1b22", border: 0, borderRadius: 6, fontWeight: 700, marginRight: 8 }}
      >
        Run all frames
      </button>
      <button onClick={() => { abortRef.current = true; }} style={{ padding: "8px 12px" }}>
        stop
      </button>
      <p id="status">{status}</p>

      <pre style={{ fontSize: 13, lineHeight: 1.6 }}>
{`frames scored        ${results.length}
frames with people   ${totals.framesWithPeople}
detector people      ${totals.detector}
single-stage poses   ${totals.single}   (frames with any: ${totals.singleFound})
two-stage poses      ${totals.two}   (frames with any: ${totals.twoFound})
two-stage faithful   ${totals.faithful}  <- torso landed inside its own box
fidelity             ${totals.two > 0 ? ((totals.faithful / totals.two) * 100).toFixed(1) : "n/a"}%
recall vs detector   ${totals.detector > 0 ? ((totals.two / totals.detector) * 100).toFixed(1) : "n/a"}%
single-stage recall  ${totals.detector > 0 ? ((totals.single / totals.detector) * 100).toFixed(1) : "n/a"}%`}
      </pre>

      {done && (
        <details>
          <summary>raw json</summary>
          <pre id="raw" style={{ fontSize: 10, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(results)}
          </pre>
        </details>
      )}
    </main>
  );
}
