"use client";

// TEMPORARY EXPORT HARNESS. Delete before merge.
//
// Kill gate B: once a player is marked on the first frame, which arm keeps
// hold of that player across the clip — the on-device tracker, or the model
// looking at the frames?
//
// Each arm runs in the configuration it would actually ship in, which is the
// only fair comparison even though the two look asymmetric here:
//   - the tracker gets a DENSE frame series, because nearest-neighbour
//     association assumes small motion between frames and starves without it
//   - the model gets the SPARSE set an analysis actually uploads
// Both are then read out at the same eight timestamps, so their claims are
// directly comparable even though their inputs are not.
//
// The association logic below is lifted from the shipped fullPass loop in
// lib/frames.ts rather than reimplemented, so a win here is a win for the code
// that ships and not for a friendlier version of it.

import { useCallback, useState } from "react";
import { focusPoint } from "@/lib/pose/kinematics";
import { POSE_LANDMARK_COUNT, type Landmark } from "@/lib/pose/types";
import { torsoCenter } from "@/lib/pose/subject-select";
import { type Box, containsPoint, cropForBox, fromCrop, usableBoxes } from "@/lib/pose/two-stage";

const CAPTURE_DIM = 1280;
const CROP_RENDER = 512;
const SEND_DIM = 1024;
// What an analysis uploads.
const SEND_FRAMES = 8;
// What the tracker walks. Dense enough that a player moves far less than the
// association radius between consecutive frames.
const DENSE_FRAMES = 96;
// Matches HINT_RADIUS in the shipped fullPass loop.
const ASSOC_RADIUS = 0.3;

type Pt = { x: number; y: number };

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

export default function PoseTrackExportPage() {
  const [status, setStatus] = useState("idle");
  const [built, setBuilt] = useState("");

  const run = useCallback(async () => {
    setStatus("loading manifest");
    const manifest: { frames: { src: string; clip: string; t: number; mode?: string }[] } = await (
      await fetch("/evalframes-full/manifest.json")
    ).json();

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
      categoryAllowlist: ["person"],
      scoreThreshold: 0.2,
      maxResults: 16,
    });

    const frameCanvas = document.createElement("canvas");
    const fctx = frameCanvas.getContext("2d", { willReadFrequently: true })!;
    const cropCanvas = document.createElement("canvas");
    const cctx = cropCanvas.getContext("2d", { willReadFrequently: true })!;
    const sendCanvas = document.createElement("canvas");
    const sctx = sendCanvas.getContext("2d")!;

    // One frame through the shipped two-stage path: enumerate people, crop each,
    // pose each, keep only poses that landed on the body their crop was built
    // around. Returns every surviving person's focus point.
    const peopleIn = (img: HTMLImageElement): { point: Pt; box: Box }[] => {
      const scale = Math.min(1, CAPTURE_DIM / Math.max(img.naturalWidth, img.naturalHeight));
      const W = Math.round(img.naturalWidth * scale);
      const H = Math.round(img.naturalHeight * scale);
      frameCanvas.width = W;
      frameCanvas.height = H;
      fctx.imageSmoothingEnabled = true;
      fctx.imageSmoothingQuality = "high";
      fctx.drawImage(img, 0, 0, W, H);

      const boxes: Box[] = (det.detect(frameCanvas).detections ?? [])
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

      const out: { point: Pt; box: Box }[] = [];
      for (const target of usableBoxes(boxes, { max: 6 })) {
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
        const local: Landmark[] = found[0].map((q) => ({
          x: q.x ?? 0,
          y: q.y ?? 0,
          z: q.z ?? 0,
          v: q.visibility ?? 0,
        }));
        const centre = torsoCenter(local);
        if (!centre || !containsPoint(target, fromCrop(centre, crop))) continue;
        const full: Landmark[] = local.map((q) => ({
          x: crop.x + q.x * crop.w,
          y: crop.y + q.y * crop.h,
          z: q.z,
          v: q.v,
        }));
        const fp = focusPoint(full);
        if (fp) out.push({ point: fp, box: target });
      }
      return out;
    };

    const cases: unknown[] = [];

    for (const [clip, all] of byClip) {
      const sendStride = Math.max(1, Math.floor(all.length / SEND_FRAMES));
      const send = all.filter((_, i) => i % sendStride === 0).slice(0, SEND_FRAMES);
      const denseStride = Math.max(1, Math.floor(all.length / DENSE_FRAMES));
      const dense = all.filter((_, i) => i % denseStride === 0).slice(0, DENSE_FRAMES);
      if (send.length < 4) continue;

      // The mark. Chosen on the FIRST SEND FRAME so both arms are anchored to
      // the identical instant, and taken as the largest body there, which is
      // what a user tapping the athlete nearest camera would produce.
      setStatus(`${clip}: marking`);
      const firstImg = await loadImage(send[0].src);
      if (!firstImg) continue;
      const firstPeople = peopleIn(firstImg);
      if (firstPeople.length === 0) {
        setStatus(`${clip}: no body on frame 0, skipped`);
        continue;
      }
      const marked = firstPeople.reduce((a, b) =>
        b.box.w * b.box.h > a.box.w * a.box.h ? b : a,
      );

      // Tracker arm. Same association rule as the shipped loop: nearest focus
      // point inside the radius wins and becomes the next frame's hint; nothing
      // inside the radius means the hint holds and the track is reported lost.
      setStatus(`${clip}: tracking`);
      let hint: Pt = marked.point;
      const trackAt = new Map<number, Pt | null>();
      let lost = false;
      for (let i = 0; i < dense.length; i++) {
        if (i % 16 === 0) setStatus(`${clip}: tracking ${i}/${dense.length}`);
        if (dense[i].t < send[0].t) continue;
        const img = await loadImage(dense[i].src);
        if (!img) continue;
        const people = peopleIn(img);
        let best: Pt | null = null;
        let bestD = ASSOC_RADIUS;
        for (const p of people) {
          const d = Math.hypot(p.point.x - hint.x, p.point.y - hint.y);
          if (d < bestD) {
            bestD = d;
            best = p.point;
          }
        }
        if (best) {
          hint = best;
          lost = false;
        } else {
          lost = true;
        }
        trackAt.set(dense[i].t, lost ? null : hint);
      }

      // Read the track out at the send timestamps.
      const engineTrack = send.map((s) => {
        let nearestT: number | null = null;
        let nearestD = Infinity;
        for (const t of trackAt.keys()) {
          const d = Math.abs(t - s.t);
          if (d < nearestD) {
            nearestD = d;
            nearestT = t;
          }
        }
        const p = nearestT === null ? null : (trackAt.get(nearestT) ?? null);
        return { t: s.t, point: p };
      });

      setStatus(`${clip}: encoding frames`);
      const frames: { time_s: number; data: string }[] = [];
      for (const s of send) {
        const img = await loadImage(s.src);
        if (!img) continue;
        const scale = Math.min(1, SEND_DIM / Math.max(img.naturalWidth, img.naturalHeight));
        sendCanvas.width = Math.round(img.naturalWidth * scale);
        sendCanvas.height = Math.round(img.naturalHeight * scale);
        sctx.imageSmoothingEnabled = true;
        sctx.imageSmoothingQuality = "high";
        sctx.drawImage(img, 0, 0, sendCanvas.width, sendCanvas.height);
        frames.push({
          time_s: s.t,
          data: sendCanvas.toDataURL("image/jpeg", 0.72).split(",")[1],
        });
      }
      if (frames.length < 4) continue;

      cases.push({
        clip,
        mark: { point: marked.point, box: marked.box },
        engineTrack,
        denseFrames: dense.length,
        frames,
      });
      setStatus(`${clip}: done`);
    }

    pose.close();
    det.close();
    const json = JSON.stringify({ cases });
    setBuilt(`${(json.length / 1048576).toFixed(1)} MB`);
    try {
      const res = await fetch("http://localhost:8900/trackbundle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: json,
      });
      const ack = await res.json();
      setStatus(`done: ${cases.length} clips, sent ${(ack.bytes / 1048576).toFixed(1)} MB`);
    } catch (err) {
      setStatus(`built ${cases.length} clips but POST failed: ${err instanceof Error ? err.message : err}`);
    }
  }, []);

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
      <h1 style={{ fontSize: 18 }}>Export tracking A/B bundle</h1>
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
      <p style={{ fontSize: 12 }}>{built}</p>
    </main>
  );
}
