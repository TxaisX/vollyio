"use client";

// TEMPORARY ABLATION HARNESS. Delete before merge.
//
// The two-stage baseline reaches 82.4% fidelity: 17.6% of poses describe a body
// other than the one their crop was built around. The engine currently DROPS
// those, which is honest but throws away real detections. This measures whether
// they can be recovered instead.
//
// Hypothesis under test: a padded crop around player A often contains player B,
// and the landmarker locks onto whichever body it finds more prominent. If so,
// making the intended body dominant inside the crop should raise fidelity
// without costing recall.
//
// Strategies compared on identical frames and identical detector boxes, so the
// only variable is how the crop is prepared:
//   tight    less padding, so a neighbour is less likely to be inside at all
//   baseline current behaviour
//   dimmed   baseline, but everything outside the box is darkened
//   masked   baseline, but outside the box is flattened to a solid field
//   retry    baseline, and on an unfaithful result re-run tight
//
// Fidelity alone is not the score. A strategy that rejects everything scores
// 100% and is worthless, so recall is reported beside it.

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

const CAPTURE_DIM = 1280;
const CROP_RENDER = 512;

// See pose-eval: decode() can hang forever in a throttled tab even on a fully
// loaded image, which stalls a batch run at its first frame.
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


type StrategyName =
  | "tight"
  | "baseline"
  | "dimmed"
  | "masked"
  | "retry"
  | "occlude"
  | "occlude+retry";
const STRATEGIES: StrategyName[] = [
  "tight",
  "baseline",
  "dimmed",
  "masked",
  "retry",
  "occlude",
  "occlude+retry",
];

type Tally = { attempts: number; poses: number; faithful: number; ms: number };
const emptyTally = (): Tally => ({ attempts: 0, poses: 0, faithful: 0, ms: 0 });

export default function PoseAblationPage() {
  const [status, setStatus] = useState("idle");
  const [tallies, setTallies] = useState<Record<StrategyName, Tally>>(
    Object.fromEntries(STRATEGIES.map((s) => [s, emptyTally()])) as Record<StrategyName, Tally>,
  );
  const [frames, setFrames] = useState(0);
  const abortRef = useRef(false);

  const run = useCallback(async () => {
    abortRef.current = false;
    const acc = Object.fromEntries(
      STRATEGIES.map((s) => [s, emptyTally()]),
    ) as Record<StrategyName, Tally>;
    setTallies(acc);
    setFrames(0);

    setStatus("loading manifest");
    // Prefer the full corpus when it exists; fall back to the sampled one.
    // Failures are surfaced rather than thrown: an unhandled rejection here
    // leaves the page sitting on "idle" with no indication anything went wrong,
    // which wastes far more time than the error message costs.
    let manifest: { frames: { src: string; clip: string }[] } | null = null;
    for (const url of ["/evalframes-full/manifest.json", "/evalframes/manifest.json"]) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const parsed = await res.json();
        if (parsed?.frames?.length) {
          manifest = parsed;
          setStatus(`manifest ${url}: ${parsed.frames.length} frames`);
          break;
        }
      } catch {
        // try the next candidate
      }
    }
    if (!manifest) {
      setStatus("no manifest found; run scripts/extract-eval-frames.mjs first");
      return;
    }
    // Deterministic stride so a partial run still spans every clip rather than
    // over-representing whichever videos happen to sort first.
    const target = 600;
    const stride = Math.max(1, Math.floor(manifest.frames.length / target));
    const sample = manifest.frames.filter((_, i) => i % stride === 0).slice(0, target);

    setStatus("loading models");
    const { FilesetResolver, ObjectDetector, PoseLandmarker } = await import(
      "@mediapipe/tasks-vision"
    );
    const fileset = await FilesetResolver.forVisionTasks("/pose/wasm");
    const mk = async (d: "GPU" | "CPU") => ({
      pose: await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "/pose/pose_landmarker_full.task", delegate: d },
        runningMode: "IMAGE",
        numPoses: 4,
      }),
      det: await ObjectDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "/pose/efficientdet_lite0_f16.tflite", delegate: d },
        runningMode: "IMAGE",
        // Matched to the shipped worker exactly. Measuring a different
        // operating point than production makes every number describe a
        // configuration no user ever reaches.
        categoryAllowlist: ["person", "sports ball"],
        scoreThreshold: 0.2,
        maxResults: 16,
      }),
    });
    let models;
    try {
      models = await mk("GPU");
    } catch {
      models = await mk("CPU");
    }
    const { pose, det } = models;

    const frame = document.createElement("canvas");
    const fctx = frame.getContext("2d", { willReadFrequently: true })!;
    const crop = document.createElement("canvas");
    const cctx = crop.getContext("2d", { willReadFrequently: true })!;

    // Renders one crop under a strategy and returns whether the resulting pose
    // describes the body the box refers to.
    const attempt = (
      box: Box,
      padding: number,
      W: number,
      H: number,
      treatment: "none" | "dim" | "mask" | "occlude",
      others: Box[] = [],
    ): { pose: boolean; faithful: boolean } => {
      const c = cropForBox(box, padding);
      const sw = Math.max(1, Math.round(c.w * W));
      const sh = Math.max(1, Math.round(c.h * H));
      const rw = Math.min(CROP_RENDER, sw);
      const rh = Math.max(1, Math.round((sh / sw) * rw));
      crop.width = rw;
      crop.height = rh;
      cctx.imageSmoothingEnabled = true;
      cctx.imageSmoothingQuality = "high";
      cctx.clearRect(0, 0, rw, rh);
      cctx.drawImage(frame, Math.round(c.x * W), Math.round(c.y * H), sw, sh, 0, 0, rw, rh);

      if (treatment === "occlude") {
        // Surgical version of masking. Full masking reached 100% fidelity but
        // collapsed recall, because the model needs surrounding context to find
        // a body at all. Darkening ONLY the competing bodies removes the thing
        // that actually causes the wrong pick while leaving the scene intact.
        cctx.save();
        for (const other of others) {
          const ox = ((other.x - c.x) / c.w) * rw;
          const oy = ((other.y - c.y) / c.h) * rh;
          const ow = (other.w / c.w) * rw;
          const oh = (other.h / c.h) * rh;
          if (ox + ow < 0 || oy + oh < 0 || ox > rw || oy > rh) continue;
          cctx.beginPath();
          cctx.rect(ox, oy, ow, oh);
          cctx.save();
          cctx.clip();
          cctx.filter = "brightness(0.1)";
          cctx.drawImage(frame, Math.round(c.x * W), Math.round(c.y * H), sw, sh, 0, 0, rw, rh);
          cctx.filter = "none";
          cctx.restore();
        }
        cctx.restore();
      } else if (treatment !== "none") {
        // Where the intended body sits inside this crop.
        const bx = ((box.x - c.x) / c.w) * rw;
        const by = ((box.y - c.y) / c.h) * rh;
        const bw = (box.w / c.w) * rw;
        const bh = (box.h / c.h) * rh;
        cctx.save();
        // Punch the body out so only its surroundings are treated. Redrawing
        // the source through a brightness filter rather than laying a coloured
        // rectangle over it keeps the treatment neutral: a tinted overlay would
        // shift the image's colour balance, which is itself an input to the
        // model being measured.
        cctx.beginPath();
        cctx.rect(0, 0, rw, rh);
        cctx.rect(bx, by, bw, bh);
        cctx.clip("evenodd");
        cctx.filter = treatment === "dim" ? "brightness(0.35)" : "brightness(0.06)";
        cctx.drawImage(frame, Math.round(c.x * W), Math.round(c.y * H), sw, sh, 0, 0, rw, rh);
        cctx.filter = "none";
        cctx.restore();
      }

      const found = (pose.detect(crop).landmarks ?? []).filter(
        (p) => p.length === POSE_LANDMARK_COUNT,
      );
      if (found.length === 0) return { pose: false, faithful: false };
      const pts: Landmark[] = found[0].map((q) => ({
        x: q.x,
        y: q.y,
        z: q.z ?? 0,
        v: q.visibility ?? 0,
      }));
      const centre = torsoCenter(pts);
      return {
        pose: true,
        faithful: !!centre && containsPoint(box, fromCrop(centre, c)),
      };
    };

    for (let i = 0; i < sample.length; i++) {
      if (abortRef.current) break;
      setStatus(`${i + 1}/${sample.length}`);
      const img = await loadImage(sample[i].src);
      if (!img) continue;
      const scale = Math.min(1, CAPTURE_DIM / Math.max(img.naturalWidth, img.naturalHeight));
      const W = Math.round(img.naturalWidth * scale);
      const H = Math.round(img.naturalHeight * scale);
      frame.width = W;
      frame.height = H;
      fctx.imageSmoothingEnabled = true;
      fctx.imageSmoothingQuality = "high";
      fctx.drawImage(img, 0, 0, W, H);

      const boxes: Box[] = (det.detect(frame).detections ?? [])
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

      for (const box of people) {
        for (const name of STRATEGIES) {
          const t0 = performance.now();
          let r: { pose: boolean; faithful: boolean };
          const others = people.filter((p) => p !== box);
          if (name === "tight") r = attempt(box, 0.12, W, H, "none");
          else if (name === "baseline") r = attempt(box, 0.35, W, H, "none");
          else if (name === "dimmed") r = attempt(box, 0.35, W, H, "dim");
          else if (name === "masked") r = attempt(box, 0.35, W, H, "mask");
          else if (name === "occlude") r = attempt(box, 0.35, W, H, "occlude", others);
          else if (name === "occlude+retry") {
            r = attempt(box, 0.35, W, H, "occlude", others);
            if (!r.faithful) r = attempt(box, 0.12, W, H, "occlude", others);
          } else {
            r = attempt(box, 0.35, W, H, "none");
            if (!r.faithful) r = attempt(box, 0.12, W, H, "none");
          }
          const tally = acc[name];
          tally.attempts++;
          tally.ms += performance.now() - t0;
          if (r.pose) tally.poses++;
          if (r.faithful) tally.faithful++;
          // Yield between inferences. Every strategy runs the model
          // synchronously, so a frame with four people is around thirty
          // uninterrupted inferences: without this the main thread never
          // repaints, progress appears frozen, and the tab stops responding to
          // anything at all.
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      setFrames(i + 1);
      if (i % 10 === 0) setTallies({ ...acc });
    }

    pose.close();
    det.close();
    setTallies({ ...acc });
    setStatus(`done`);
  }, []);

  const runGuarded = useCallback(() => {
    run().catch((err) => {
      setStatus(`failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [run]);

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
      <h1 style={{ fontSize: 18 }}>Crop strategy ablation</h1>
      <button
        onClick={runGuarded}
        style={{
          padding: "8px 16px",
          background: "var(--color-gold)",
          color: "var(--color-navy)",
          border: 0,
          borderRadius: 6,
          fontWeight: 700,
          marginRight: 8,
        }}
      >
        Run ablation
      </button>
      <button onClick={() => { abortRef.current = true; }} style={{ padding: "8px 12px" }}>
        stop
      </button>
      <p>{status} · frames {frames}</p>
      <pre style={{ fontSize: 13, lineHeight: 1.7 }}>
{`strategy    attempts   poses   faithful   recall   fidelity   ms/attempt
${STRATEGIES.map((s) => {
  const t = tallies[s];
  const recall = t.attempts ? ((t.poses / t.attempts) * 100).toFixed(1) : "0.0";
  const fid = t.poses ? ((t.faithful / t.poses) * 100).toFixed(1) : "0.0";
  const per = t.attempts ? (t.ms / t.attempts).toFixed(1) : "0.0";
  return `${s.padEnd(11)} ${String(t.attempts).padStart(8)} ${String(t.poses).padStart(7)} ${String(t.faithful).padStart(10)} ${recall.padStart(7)}% ${fid.padStart(9)}% ${per.padStart(10)}`;
}).join("\n")}`}
      </pre>
    </main>
  );
}
