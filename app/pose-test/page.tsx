"use client";

// TEMPORARY DIAGNOSTIC PAGE. Delete before merge.
//
// Isolates the pose engine from auth, upload, storage, and the analyze flow, so
// a bad skeleton can be attributed to the model rather than to the six other
// things that sit between a clip and a drawn overlay.
//
// Tests two hypotheses at once without changing app code:
//   1. Capture resolution. The same frame is run at several long-edge sizes.
//      MediaPipe's landmark model crops the SOURCE image, so a small capture
//      starves a distant player of pixels.
//   2. Inferred landmarks. MediaPipe emits all 33 landmarks always and reports
//      its own confidence for ones it cannot see. The per-landmark visibility
//      table shows whether bones are being drawn from guesses.
//
// Renders with the real SKELETON_REGION_BONES and SKELETON_MIN_V so what is
// drawn here matches what the app would draw.

import { useCallback, useRef, useState } from "react";
import {
  LM,
  POSE_LANDMARK_COUNT,
  SKELETON_MIN_V,
  SKELETON_REGION_BONES,
  SKELETON_REGION_COLOR,
  type Landmark,
} from "@/lib/pose/types";
import { pickSubject, type SubjectChoice } from "@/lib/pose/subject-select";

const DIMS = [640, 960, 1280, 1600];
// Canvas cannot read CSS variables, so they are resolved at draw time from
// the document rather than duplicated as literals here.
function regionColor(name: string): string {
  if (typeof window === "undefined") return "currentColor";
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(`--color-${name}`)
    .trim();
  return v || "currentColor";
}

type Run = {
  dim: number;
  persons: Landmark[][];
  ms: number;
  sourceW: number;
  sourceH: number;
  sx: number;
  sy: number;
  cw: number;
  ch: number;
  choice: SubjectChoice;
};

// A 4K frame from real court footage, extracted alongside this page. 4K matters:
// the smaller the capture the app takes, the fewer real pixels a distant player
// keeps, and that ratio is what this page is measuring.
const FRAMES = [
  {
    src: "/pose-test-known.png",
    label: "Benchmark clip, 720x1280, one large subject (known-good content)",
  },
  { src: "/pose-test-frame.jpg", label: "4K wide court, many distant players" },
  { src: "/pose-test-frame2.jpg", label: "4K court, second angle" },
];

export default function PoseTestPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [useImage, setUseImage] = useState(true);
  const [frameIdx, setFrameIdx] = useState(0);
  // Normalized click point. The app detects inside a crop around the tapped
  // player, not on the whole frame, so a full-frame-only test says nothing
  // about the path that actually runs.
  const [focus, setFocus] = useState<{ x: number; y: number } | null>(null);
  const [cropFrac, setCropFrac] = useState(0.25);
  const [minDet, setMinDet] = useState(0.5);
  const [runs, setRuns] = useState<Run[]>([]);
  const [status, setStatus] = useState("Ready. Run against the default frame, or load a clip.");
  const [busy, setBusy] = useState(false);
  const [modelTier, setModelTier] = useState("");

  const run = useCallback(async () => {
    const video = videoRef.current;
    const img = imgRef.current;
    const source: HTMLVideoElement | HTMLImageElement | null = useImage ? img : video;
    const srcW = useImage ? (img?.naturalWidth ?? 0) : (video?.videoWidth ?? 0);
    const srcH = useImage ? (img?.naturalHeight ?? 0) : (video?.videoHeight ?? 0);
    if (!source || !srcW) {
      setStatus("No frame loaded yet.");
      return;
    }
    setBusy(true);
    setRuns([]);
    try {
      setStatus("Loading the landmarker...");
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks("/pose/wasm");

      let landmarker: Awaited<ReturnType<typeof PoseLandmarker.createFromOptions>> | null = null;
      let tier = "gpu";
      const opts = (delegate: "GPU" | "CPU") =>
        ({
          baseOptions: {
            modelAssetPath: "/pose/pose_landmarker_full.task",
            delegate,
          },
          runningMode: "IMAGE" as const,
          numPoses: 4,
          minPoseDetectionConfidence: minDet,
          minPosePresenceConfidence: minDet,
        });
      try {
        landmarker = await PoseLandmarker.createFromOptions(fileset, opts("GPU"));
      } catch {
        landmarker = await PoseLandmarker.createFromOptions(fileset, opts("CPU"));
        tier = "cpu";
      }
      setModelTier(`pose-landmarker-full/${tier}`);

      const out: Run[] = [];
      for (const dim of DIMS) {
        setStatus(`Running at ${dim}px...`);
        // Region crop when a focus point is set, mirroring the app's path.
        const cw = focus ? Math.max(1, Math.round(srcW * cropFrac)) : srcW;
        const ch = focus ? Math.max(1, Math.round(srcH * cropFrac)) : srcH;
        const sx = focus ? Math.max(0, Math.min(srcW - cw, Math.round(focus.x * srcW - cw / 2))) : 0;
        const sy = focus ? Math.max(0, Math.min(srcH - ch, Math.round(focus.y * srcH - ch / 2))) : 0;

        const scale = Math.min(1, dim / Math.max(cw, ch));
        const w = Math.max(1, Math.round(cw * scale));
        const h = Math.max(1, Math.round(ch * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(source, sx, sy, cw, ch, 0, 0, w, h);

        const started = performance.now();
        const result = landmarker.detect(canvas);
        const ms = Math.round(performance.now() - started);

        const persons = (result.landmarks ?? [])
          .filter((p) => p.length === POSE_LANDMARK_COUNT)
          .map((p) =>
            p.map((q) => ({ x: q.x, y: q.y, z: q.z ?? 0, v: q.visibility ?? 0 })),
          );
        // Same rejection the engine now applies. The hint is already in crop
        // space here because the crop was built around it.
        const localHint = focus ? { x: 0.5, y: 0.5 } : null;
        const choice = pickSubject(persons, localHint);
        out.push({ dim, persons, ms, sourceW: w, sourceH: h, sx, sy, cw, ch, choice });
        setRuns([...out]);
      }
      landmarker.close();
      setStatus("Done.");
    } catch (err) {
      setStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [useImage, focus, cropFrac, minDet]);

  return (
    <main style={{ padding: 24, fontFamily: "var(--font-sans, system-ui)", background: "var(--color-navy)", color: "var(--color-chalk)", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Pose engine diagnostic</h1>
      <p style={{ opacity: 0.7, fontSize: 13, marginBottom: 16 }}>
        Temporary. Runs the landmarker directly on one frame at several capture
        sizes. {modelTier ? `Loaded: ${modelTier}` : ""}
      </p>

      <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={useImage}
          onChange={(e) => {
            setUseImage(e.target.checked);
            setRuns([]);
          }}
        />{" "}
        Use a bundled frame (uncheck to load your own clip)
      </label>

      {useImage && (
        <div style={{ marginBottom: 10 }}>
          {FRAMES.map((f, i) => (
            <label key={f.src} style={{ display: "block", fontSize: 12, opacity: 0.9 }}>
              <input
                type="radio"
                name="frame"
                checked={frameIdx === i}
                onChange={() => {
                  setFrameIdx(i);
                  setRuns([]);
                }}
              />{" "}
              {f.label}
            </label>
          ))}
        </div>
      )}

      {!useImage && (
        <input
          type="file"
          accept="video/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && videoRef.current) {
              videoRef.current.src = URL.createObjectURL(file);
              setRuns([]);
              setStatus("Scrub to the frame you want, then run.");
            }
          }}
          style={{ marginBottom: 12 }}
        />
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={FRAMES[frameIdx].src}
        alt="test frame"
        key={FRAMES[frameIdx].src}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setFocus({
            x: (e.clientX - r.left) / r.width,
            y: (e.clientY - r.top) / r.height,
          });
          setRuns([]);
        }}
        style={{
          display: useImage ? "block" : "none",
          maxWidth: 640,
          width: "100%",
          marginBottom: 12,
        }}
      />

      <video
        ref={videoRef}
        controls
        playsInline
        muted
        style={{
          display: useImage ? "none" : "block",
          maxWidth: 640,
          width: "100%",
          marginBottom: 12,
          background: "var(--color-navy)",
        }}
      />

      <div style={{ fontSize: 12, marginBottom: 10, lineHeight: 1.8 }}>
        <div>
          Click a player on the frame to detect inside a crop around them (the
          path the app actually uses).{" "}
          {focus
            ? `Focus set at ${focus.x.toFixed(2)}, ${focus.y.toFixed(2)}.`
            : "No focus set: running full frame."}{" "}
          {focus && (
            <button onClick={() => { setFocus(null); setRuns([]); }} style={{ fontSize: 11 }}>
              clear
            </button>
          )}
        </div>
        <label>
          crop size{" "}
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={cropFrac}
            onChange={(e) => { setCropFrac(Number(e.target.value)); setRuns([]); }}
          />{" "}
          {(cropFrac * 100).toFixed(0)}% of frame
        </label>
        <br />
        <label>
          min detection confidence{" "}
          <input
            type="range"
            min={0.1}
            max={0.9}
            step={0.05}
            value={minDet}
            onChange={(e) => { setMinDet(Number(e.target.value)); setRuns([]); }}
          />{" "}
          {minDet.toFixed(2)}
        </label>
      </div>

      <button
        onClick={run}
        disabled={busy}
        style={{
          padding: "8px 16px",
          background: busy ? "var(--color-navy-lighter)" : "var(--color-gold)",
          color: "var(--color-navy)",
          border: 0,
          borderRadius: 6,
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "Running..." : "Run at every capture size"}
      </button>
      <p style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>{status}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginTop: 20 }}>
        {runs.map((r) => (
          <RunView
            key={r.dim}
            r={r}
            source={useImage ? imgRef.current : videoRef.current}
          />
        ))}
      </div>
    </main>
  );
}

// Draws the frame at this capture size with the app's real skeleton contract on
// top, plus the numbers that distinguish "no pixels" from "confident guess".
function RunView({
  r,
  source,
}: {
  r: Run;
  source: HTMLVideoElement | HTMLImageElement | null;
}) {
  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas || !source) return;
      const W = 420;
      const H = Math.round((r.sourceH / r.sourceW) * W);
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(source, r.sx, r.sy, r.cw, r.ch, 0, 0, W, H);

      const shown =
        r.choice.index === null ? [] : [r.persons[r.choice.index]];
      for (const pts of shown) {
        for (const [region, bones] of Object.entries(SKELETON_REGION_BONES)) {
          ctx.strokeStyle = regionColor(
            SKELETON_REGION_COLOR[region as keyof typeof SKELETON_REGION_COLOR],
          );
          ctx.lineWidth = 2;
          for (const [a, b] of bones as number[][]) {
            const pa = pts[a];
            const pb = pts[b];
            if (!pa || !pb) continue;
            if (pa.v < SKELETON_MIN_V || pb.v < SKELETON_MIN_V) continue;
            ctx.beginPath();
            ctx.moveTo(pa.x * W, pa.y * H);
            ctx.lineTo(pb.x * W, pb.y * H);
            ctx.stroke();
          }
        }
      }
    },
    [r, source],
  );

  const primary = r.persons[0];
  const named: [string, number][] = [
    ["L shoulder", LM.leftShoulder],
    ["R shoulder", LM.rightShoulder],
    ["L elbow", LM.leftElbow],
    ["R elbow", LM.rightElbow],
    ["L wrist", LM.leftWrist],
    ["R wrist", LM.rightWrist],
    ["L hip", LM.leftHip],
    ["R hip", LM.rightHip],
    ["L knee", LM.leftKnee],
    ["R knee", LM.rightKnee],
    ["L ankle", LM.leftAnkle],
    ["R ankle", LM.rightAnkle],
  ];
  const passing = primary
    ? primary.filter((p) => p.v >= SKELETON_MIN_V).length
    : 0;

  return (
    <div style={{ width: 420 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
        {r.dim}px capture ({r.sourceW}x{r.sourceH}) - {r.persons.length} person
        {r.persons.length === 1 ? "" : "s"}, {r.ms}ms
      </div>
      <canvas ref={canvasRef} style={{ width: "100%", border: "1px solid var(--color-navy-lighter)" }} />
      <div
        style={{
          fontSize: 12,
          margin: "4px 0",
          color: r.choice.index === null ? "var(--color-coral)" : "var(--color-teal)",
        }}
      >
        {r.choice.index === null
          ? `REJECTED (${r.choice.reason}${r.choice.distance !== undefined ? `, d=${r.choice.distance.toFixed(2)}` : ""})`
          : `accepted person ${r.choice.index}${r.choice.distance !== undefined ? `, d=${r.choice.distance.toFixed(2)}` : ""}`}
      </div>
      {primary ? (
        <div style={{ fontSize: 11, marginTop: 6, opacity: 0.85 }}>
          <div style={{ marginBottom: 4 }}>
            {passing}/{POSE_LANDMARK_COUNT} landmarks at or above the draw
            threshold ({SKELETON_MIN_V})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
            {named.map(([label, i]) => {
              const v = primary[i]?.v ?? 0;
              return (
                <div key={label} style={{ color: v >= SKELETON_MIN_V ? "var(--color-teal)" : "var(--color-coral)" }}>
                  {label}: {v.toFixed(2)}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, marginTop: 6, color: "var(--color-coral)" }}>No person detected.</div>
      )}
    </div>
  );
}
