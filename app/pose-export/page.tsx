"use client";

// TEMPORARY EXPORT HARNESS. Delete before merge.
//
// Produces the inputs for the measured-versus-vision A/B (kill gate A). The
// pose engine is wasm and browser-only, so the measurement block has to be
// built here; the comparison itself runs in Node against the model API.
//
// Each bundle carries the SAME frames twice over: one arm gets the measurement
// block, the other does not. Anything else that differed between the arms would
// confound the result, which is the whole point of the exercise.
//
// Uses the real buildMeasurementsBlock, so what ships is what is measured.

import { useCallback, useState } from "react";
import { POSE_LANDMARK_COUNT, type Landmark, type LandmarkFrame } from "@/lib/pose/types";
import { buildMeasurementsBlock } from "@/lib/pose/metrics";
import { torsoCenter } from "@/lib/pose/subject-select";
import {
  type Box,
  containsPoint,
  cropForBox,
  fromCrop,
  usableBoxes,
} from "@/lib/pose/two-stage";
import { SKILLS, type Skill } from "@/lib/skills";

const CAPTURE_DIM = 1280;
const CROP_RENDER = 512;
// Frames per clip handed to the model. Matches the shipped analyze path's
// order of magnitude rather than the full corpus, which no analysis sends.
const FRAMES_PER_CLIP = 8;

async function loadImage(src: string, timeoutMs = 15000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const done = (v: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(v);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    img.onload = () => done(img.naturalWidth > 0 ? img : null);
    img.onerror = () => done(null);
    img.src = src;
  });
}

export default function PoseExportPage() {
  const [status, setStatus] = useState("idle");
  const [bundleJson, setBundleJson] = useState("");
  const [skill, setSkill] = useState<Skill>("attack");

  const run = useCallback(async () => {
    setBundleJson("");
    setStatus("loading manifest");
    const manifest: { frames: { src: string; clip: string; t: number; mode?: string }[] } =
      await (await fetch("/evalframes-full/manifest.json")).json();

    // Rally-length clips only. The long session recordings are sampled at 3fps
    // and are not what a user uploads for a single rep.
    const byClip = new Map<string, { src: string; t: number }[]>();
    for (const f of manifest.frames) {
      if (f.mode !== "native") continue;
      const list = byClip.get(f.clip) ?? [];
      list.push({ src: f.src, t: f.t });
      byClip.set(f.clip, list);
    }

    setStatus("loading models");
    const { FilesetResolver, ObjectDetector, PoseLandmarker } = await import(
      "@mediapipe/tasks-vision"
    );
    const fileset = await FilesetResolver.forVisionTasks("/pose/wasm");
    const pose = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/pose/pose_landmarker_full.task", delegate: "GPU" },
      runningMode: "IMAGE",
      numPoses: 4,
    });
    const det = await ObjectDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/pose/efficientdet_lite0_f16.tflite", delegate: "GPU" },
      runningMode: "IMAGE",
      categoryAllowlist: ["person", "sports ball"],
      scoreThreshold: 0.2,
      maxResults: 16,
    });

    const frameCanvas = document.createElement("canvas");
    const fctx = frameCanvas.getContext("2d", { willReadFrequently: true })!;
    const cropCanvas = document.createElement("canvas");
    const cctx = cropCanvas.getContext("2d", { willReadFrequently: true })!;
    const sendCanvas = document.createElement("canvas");
    const sctx = sendCanvas.getContext("2d")!;

    const cases: unknown[] = [];

    for (const [clip, all] of byClip) {
      setStatus(`${clip}: sampling`);
      // Spread across the clip so the sequence covers a whole action.
      const stride = Math.max(1, Math.floor(all.length / FRAMES_PER_CLIP));
      const picked = all.filter((_, i) => i % stride === 0).slice(0, FRAMES_PER_CLIP);
      // Dense series for the measurement block: metrics need many frames to
      // find reps at all (the builder rejects anything under eight).
      const denseStride = Math.max(1, Math.floor(all.length / 60));
      const dense = all.filter((_, i) => i % denseStride === 0).slice(0, 60);

      const landmarkFrames: LandmarkFrame[] = [];
      for (let i = 0; i < dense.length; i++) {
        if (i % 10 === 0) setStatus(`${clip}: tracking ${i}/${dense.length}`);
        const img = await loadImage(dense[i].src);
        if (!img) continue;
        const scale = Math.min(1, CAPTURE_DIM / Math.max(img.naturalWidth, img.naturalHeight));
        const W = Math.round(img.naturalWidth * scale);
        const H = Math.round(img.naturalHeight * scale);
        frameCanvas.width = W;
        frameCanvas.height = H;
        fctx.imageSmoothingEnabled = true;
        fctx.imageSmoothingQuality = "high";
        fctx.drawImage(img, 0, 0, W, H);

        const boxes: Box[] = (det.detect(frameCanvas).detections ?? [])
          .filter((d) => d.categories?.[0]?.categoryName === "person")
          .map((d) => {
            const b = d.boundingBox;
            return b
              ? {
                  x: b.originX / W,
                  y: b.originY / H,
                  w: b.width / W,
                  h: b.height / H,
                  score: d.categories?.[0]?.score ?? 0,
                }
              : null;
          })
          .filter((b): b is Box => b !== null);
        const people = usableBoxes(boxes, { max: 4 });
        if (people.length === 0) continue;

        // Follow the largest body: on a rally clip that is the subject nearest
        // camera, and it stays consistent across frames without a tap.
        const target = people.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
        const crop = cropForBox(target);
        const sw = Math.max(1, Math.round(crop.w * W));
        const sh = Math.max(1, Math.round(crop.h * H));
        const rw = Math.min(CROP_RENDER, sw);
        const rh = Math.max(1, Math.round((sh / sw) * rw));
        cropCanvas.width = rw;
        cropCanvas.height = rh;
        cctx.imageSmoothingEnabled = true;
        cctx.imageSmoothingQuality = "high";
        cctx.drawImage(
          frameCanvas,
          Math.round(crop.x * W),
          Math.round(crop.y * H),
          sw,
          sh,
          0,
          0,
          rw,
          rh,
        );
        const found = (pose.detect(cropCanvas).landmarks ?? []).filter(
          (p) => p.length === POSE_LANDMARK_COUNT,
        );
        if (found.length === 0) continue;
        const pts: Landmark[] = found[0].map((q) => ({
          x: crop.x + (q.x ?? 0) * crop.w,
          y: crop.y + (q.y ?? 0) * crop.h,
          z: q.z ?? 0,
          v: q.visibility ?? 0,
        }));
        // Same fidelity gate the engine applies: a pose that did not land on
        // the body its crop was built around is not evidence about that body.
        const centre = torsoCenter(
          found[0].map((q) => ({ x: q.x, y: q.y, z: q.z ?? 0, v: q.visibility ?? 0 })),
        );
        if (centre && !containsPoint(target, fromCrop(centre, crop))) continue;
        landmarkFrames.push({ t: dense[i].t, pts });
      }

      setStatus(`${clip}: building measurements (${landmarkFrames.length} tracked)`);
      const measurements = buildMeasurementsBlock(
        skill,
        landmarkFrames,
        landmarkFrames.length > 1 ? 60 / Math.max(1, Math.floor(all.length / 60)) : null,
        "mp-pose-full/gpu",
        "full",
      );

      // The frames both arms receive, encoded once.
      const frames: { time_s: number; data: string }[] = [];
      for (const p of picked) {
        const img = await loadImage(p.src);
        if (!img) continue;
        const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
        sendCanvas.width = Math.round(img.naturalWidth * scale);
        sendCanvas.height = Math.round(img.naturalHeight * scale);
        sctx.imageSmoothingEnabled = true;
        sctx.imageSmoothingQuality = "high";
        sctx.drawImage(img, 0, 0, sendCanvas.width, sendCanvas.height);
        frames.push({
          time_s: p.t,
          data: sendCanvas.toDataURL("image/jpeg", 0.72).split(",")[1],
        });
      }

      cases.push({
        clip,
        skill,
        trackedFrames: landmarkFrames.length,
        hasMeasurements: !!measurements,
        measurements,
        frames,
      });
      setStatus(`${clip}: done (${frames.length} frames, measurements ${measurements ? "yes" : "no"})`);
    }

    pose.close();
    det.close();
    const json = JSON.stringify({ generatedSkill: skill, cases });
    setBundleJson(`${(json.length / 1048576).toFixed(1)} MB built`);
    // Posted rather than shown: the bundle is megabytes of base64 frames.
    try {
      const res = await fetch("http://localhost:8900/bundle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: json,
      });
      const ack = await res.json();
      setStatus(`done: ${cases.length} clips, sent ${(ack.bytes / 1048576).toFixed(1)} MB`);
    } catch (err) {
      setStatus(`built ${cases.length} clips but POST failed: ${err instanceof Error ? err.message : err}`);
    }
  }, [skill]);

  return (
    <main
      style={{
        padding: 20,
        fontFamily: "var(--font-mono, ui-monospace)",
        background: "var(--color-navy)",
        color: "var(--color-chalk)",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontSize: 18 }}>Export A/B bundle</h1>
      <label style={{ fontSize: 13 }}>
        skill{" "}
        <select value={skill} onChange={(e) => setSkill(e.target.value as Skill)}>
          {SKILLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>{" "}
      <button
        onClick={() => {
          run().catch((e) => setStatus(`failed: ${e?.message ?? e}`));
        }}
        style={{
          padding: "8px 16px",
          background: "var(--color-gold)",
          color: "var(--color-navy)",
          border: 0,
          borderRadius: 6,
          fontWeight: 700,
        }}
      >
        Build bundle
      </button>
      <p>{status}</p>
      <textarea
        id="bundle"
        readOnly
        value={bundleJson}
        style={{ width: "100%", height: 200, fontSize: 10, background: "var(--color-navy-light)", color: "var(--color-chalk-dim)" }}
      />
      <p style={{ fontSize: 12 }}>bytes: {bundleJson.length}</p>
    </main>
  );
}
