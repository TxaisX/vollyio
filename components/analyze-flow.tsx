"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SkillPicker } from "@/components/skill-picker";
import { Recorder } from "@/components/recorder";
import { Filmstrip } from "@/components/filmstrip";
import { createClient } from "@/lib/supabase/client";
import {
  detectOpeningPlayers,
  extractFrames,
  extractFramesFromPhotos,
  MAX_CLIP_SECONDS,
  type Frame,
  type FrameDebug,
  type OpeningPlayers,
} from "@/lib/frames";
import {
  continuityNote,
  continuityToWire,
  type TrackContinuity,
} from "@/lib/pose/track-state";
import { loadPoseEngine, type PoseEngine } from "@/lib/pose/engine";
import {
  dedupePersons,
  focusPoint,
  offerPersons,
  otherTrackBoxes,
  personBox,
} from "@/lib/pose/kinematics";
import {
  SKELETON_REGION_BONES,
  SKELETON_REGION_COLOR,
  SKELETON_MIN_V,
  headGeometry,
  type BallPoint,
  type Landmark,
  type LandmarkFrame,
  type MeasurementsBlock,
  type KeypointsFile,
  type PersonTrack,
} from "@/lib/pose/types";
import { ballMarksForFrames, MIN_TRACK_POINTS } from "@/lib/pose/ball-track";
import {
  captureQuality,
  type CaptureQualityReason,
} from "@/lib/pose/capture-quality";
import { Reveal } from "@/components/motion";
import {
  SKILL_LABEL,
  DISCIPLINES,
  DISCIPLINE_LABEL,
  type Skill,
  type Discipline,
} from "@/lib/skills";
import {
  clampTrimWindow,
  MIN_TRIM_SPAN_S,
  type TrimWindow,
} from "@/lib/frame-select";
import { clockStamp } from "@/lib/pose/measurement-format";
import type { AnalyzeRequest, FrameKeypointsWire } from "@/lib/analysis-types";

type Status =
  | { kind: "idle" | "reading" | "sending" }
  | { kind: "tracking"; pct: number }
  | { kind: "error"; message: string };

type Capture = {
  landmarks: LandmarkFrame[];
  measurements: MeasurementsBlock | null;
  extras: Frame[];
  tracks: PersonTrack[];
  selectedTrackId: number | null;
  denseFps: number | null;
  continuity: TrackContinuity | null;
  ball: BallPoint[];
  skill: Skill;
};

type Box = { left: number; top: number; width: number; height: number };

// A detected person on the framing card: their box plus the landmarks it
// came from, so confirming a tap needs no fresh detection.
type Candidate = { box: Box; pts: Landmark[] };

// Human copy for each capture-quality reason code. Kept here (not in the pure
// module) so wording, tone, and the no-vendor/no-em-dash rules live in the
// lint-checked component.
const CAPTURE_TIP_COPY: Record<CaptureQualityReason, string> = {
  too_small: "This player is small in the frame. Move closer or zoom in for a sharper read.",
  low_visibility: "The joints that matter for this skill are hard to make out. Face the player more side-on.",
  edge_cut: "Part of the body is cut off at the frame edge. Fit the whole player in.",
};

// Overlap over the smaller box, for re-attaching the selection to the same
// human after a scrub re-detection.
function boxOverlap(a: Box, b: Box): number {
  const ix =
    Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
  return ix / Math.max(1e-6, Math.min(a.width * a.height, b.width * b.height));
}

// Two-handle trim bar over the clip timeline: the gold span is the analyzed
// window. Drag a handle (or use arrow keys on it; Shift steps bigger) to
// shorten the window to the reps that matter.
function TrimBar({
  duration,
  trim,
  onMove,
}: {
  duration: number;
  trim: TrimWindow;
  onMove: (which: "start" | "end", toS: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<"start" | "end" | null>(null);

  function timeAt(e: React.PointerEvent): number | null {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width < 1) return null;
    const frac = (e.clientX - rect.left) / rect.width;
    return Math.min(Math.max(0, frac), 1) * duration;
  }

  function onPointerDown(e: React.PointerEvent) {
    const t = timeAt(e);
    if (t == null) return;
    dragRef.current = Math.abs(t - trim.startS) <= Math.abs(t - trim.endS) ? "start" : "end";
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onMove(dragRef.current, t);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const t = timeAt(e);
    if (t != null) onMove(dragRef.current, t);
  }

  function handleKey(which: "start" | "end") {
    return (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 2 : 0.5;
      const at = which === "start" ? trim.startS : trim.endS;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        onMove(which, at - step);
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        onMove(which, at + step);
      } else if (e.key === "Home") {
        e.preventDefault();
        onMove(which, which === "start" ? 0 : trim.startS);
      } else if (e.key === "End") {
        e.preventDefault();
        onMove(which, which === "start" ? trim.endS : duration);
      }
    };
  }

  const pct = (s: number) => `${(s / Math.max(0.1, duration)) * 100}%`;
  const handleClass =
    "absolute top-1/2 h-6 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize " +
    "rounded-[4px] bg-gold shadow-lift focus-visible:outline-2 " +
    "focus-visible:outline-offset-2 focus-visible:outline-gold";
  const slider = (which: "start" | "end") => ({
    role: "slider" as const,
    tabIndex: 0,
    "aria-label": which === "start" ? "Analysis window start" : "Analysis window end",
    "aria-valuemin": which === "start" ? 0 : Math.round(trim.startS * 10) / 10,
    "aria-valuemax":
      which === "start" ? Math.round(trim.endS * 10) / 10 : Math.round(duration * 10) / 10,
    "aria-valuenow":
      Math.round((which === "start" ? trim.startS : trim.endS) * 10) / 10,
    "aria-valuetext": clockStamp(which === "start" ? trim.startS : trim.endS),
    onKeyDown: handleKey(which),
  });

  return (
    <div>
      <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-chalk-dim">
        <span>
          Analyze {clockStamp(trim.startS)} to {clockStamp(trim.endS)}
        </span>
        <span>{Math.round((trim.endS - trim.startS) * 10) / 10}s window</span>
      </div>
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (dragRef.current = null)}
        onPointerCancel={() => (dragRef.current = null)}
        className="relative mt-1 h-9 select-none"
        style={{ touchAction: "none" }}
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-navy-lighter"
        />
        <span
          aria-hidden
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gold/45"
          style={{ left: pct(trim.startS), width: pct(trim.endS - trim.startS) }}
        />
        <span {...slider("start")} className={handleClass} style={{ left: pct(trim.startS) }} />
        <span {...slider("end")} className={handleClass} style={{ left: pct(trim.endS) }} />
      </div>
    </div>
  );
}

// Bake a thin skeleton onto the focus athlete in each frame, so the player
// sees the tracked body and the coaching service is told exactly which athlete
// to analyze. Uses the shared bone graph so it matches the live viewer overlay.
// Returns new frames; originals untouched.
async function markFocusFrames(
  rawFrames: Frame[],
  landmarks: LandmarkFrame[],
): Promise<{ frames: Frame[]; marked: number }> {
  if (landmarks.length === 0) return { frames: rawFrames, marked: 0 };
  let marked = 0;
  const out = await Promise.all(
    rawFrames.map(async (f) => {
      if (f.time_s == null) return f;
      let best: LandmarkFrame | null = null;
      let bestD = 0.3;
      for (const lf of landmarks) {
        const d = Math.abs(lf.t - f.time_s);
        if (d < bestD) {
          bestD = d;
          best = lf;
        }
      }
      if (!best) return f;
      const pts = best.pts;
      const vis = (i: number) => {
        const p = pts[i];
        return !!p && p.v >= SKELETON_MIN_V;
      };
      // Skip frames the tracker barely saw, so we never bake a noisy stick.
      if (pts.filter((p) => p.v >= SKELETON_MIN_V).length < 6) return f;
      const stamped = await new Promise<string | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) return resolve(null);
            ctx.drawImage(img, 0, 0);
            const style = getComputedStyle(document.documentElement);
            const color = (name: string) =>
              style.getPropertyValue(`--color-${name}`).trim();
            const chalk = color("chalk");
            const navy = color("navy");
            const W = canvas.width;
            const H = canvas.height;
            const S = (W + H) / 2;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            const allBones = Object.values(SKELETON_REGION_BONES).flat();
            const head = headGeometry(pts);
            const line = (ax: number, ay: number, bx: number, by: number) => {
              ctx.beginPath();
              ctx.moveTo(ax, ay);
              ctx.lineTo(bx, by);
              ctx.stroke();
            };
            const strokeBones = (bones: [number, number][]) => {
              for (const [a, b] of bones) {
                if (!vis(a) || !vis(b)) continue;
                line(pts[a].x * W, pts[a].y * H, pts[b].x * W, pts[b].y * H);
              }
            };
            const strokeHead = () => {
              if (!head) return;
              line(head.neckX * W, head.neckY * H, head.cx * W, head.cy * H);
              ctx.beginPath();
              ctx.arc(head.cx * W, head.cy * H, head.r * W, 0, Math.PI * 2);
              ctx.stroke();
            };
            // Dark halo first so the lines read on any background.
            ctx.strokeStyle = navy;
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = Math.max(3, S * 0.012);
            strokeBones(allBones);
            strokeHead();
            // Color-coded body regions on top, matching the live viewer overlay.
            ctx.globalAlpha = 0.92;
            ctx.lineWidth = Math.max(1.5, S * 0.006);
            for (const region of ["arms", "torso", "legs"] as const) {
              ctx.strokeStyle = color(SKELETON_REGION_COLOR[region]);
              strokeBones(SKELETON_REGION_BONES[region]);
            }
            ctx.strokeStyle = color(SKELETON_REGION_COLOR.head);
            strokeHead();
            // Chalk joint pins at each visible bone endpoint.
            ctx.fillStyle = chalk;
            ctx.globalAlpha = 0.95;
            const jr = Math.max(1.5, S * 0.007);
            const seen = new Set<number>();
            for (const [a, b] of allBones) {
              for (const i of [a, b]) {
                if (seen.has(i)) continue;
                seen.add(i);
                if (!vis(i)) continue;
                ctx.beginPath();
                ctx.arc(pts[i].x * W, pts[i].y * H, jr, 0, Math.PI * 2);
                ctx.fill();
              }
            }
            ctx.globalAlpha = 1;
            resolve(canvas.toDataURL("image/jpeg", 0.7));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = f.dataUrl;
      });
      if (!stamped) return f;
      marked++;
      return { ...f, dataUrl: stamped };
    }),
  );
  return { frames: out, marked };
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

// Landmarks for each sent frame (nearest tracked instant within 200ms), as
// flat rounded arrays for the results-page skeleton overlay.
function keypointsForFrames(landmarks: LandmarkFrame[], sent: Frame[]): FrameKeypointsWire[] {
  const out: FrameKeypointsWire[] = [];
  for (const f of sent) {
    if (f.time_s == null) continue;
    let best: LandmarkFrame | null = null;
    let bestD = 0.2;
    for (const lf of landmarks) {
      const d = Math.abs(lf.t - f.time_s);
      if (d < bestD) {
        bestD = d;
        best = lf;
      }
    }
    if (!best) continue;
    out.push({
      frame_index: f.index,
      pts: best.pts.flatMap((p) => [r3(p.x), r3(p.y), r3(p.z), r3(p.v)]),
    });
  }
  return out;
}

// Fire-and-forget persistence of the tracking sidecar after the analysis is
// saved: dense keypoints plus the extra stored frames. Failures are silent;
// the results page handles absence.
function uploadCaptureArtifacts(
  capture: Capture,
  durationS: number | null,
  keypointsPath: string | null,
  storedFramePaths: string[],
) {
  const supabase = createClient();
  if (keypointsPath && (capture.landmarks.length >= 8 || capture.ball.length >= 8)) {
    const others = otherTrackBoxes(capture.tracks, capture.selectedTrackId).map((series) =>
      series.map((b) => ({
        t: r3(b.t),
        left: r3(b.left),
        top: r3(b.top),
        width: r3(b.width),
        height: r3(b.height),
      })),
    );
    const file: KeypointsFile = {
      version: 3,
      clip_duration_s: durationS,
      frames: capture.landmarks.map((lf) => ({
        t: r3(lf.t),
        pts: lf.pts.map((p) => ({ x: r3(p.x), y: r3(p.y), z: r3(p.z), v: r3(p.v) })),
      })),
      // The timed on-device ball path; the clip player follows it live.
      ball: capture.ball.length
        ? capture.ball.map((b) => ({
            t: r3(b.t),
            x: r3(b.x),
            y: r3(b.y),
            score: Math.round(b.score * 100) / 100,
          }))
        : undefined,
      // The other players' timed boxes; the clip player shows the court.
      others: others.length ? others : undefined,
    };
    void supabase.storage
      .from("frames")
      .upload(keypointsPath, new Blob([JSON.stringify(file)], { type: "application/json" }), {
        contentType: "application/json",
        upsert: false,
      })
      .catch(() => {});
  }
  const count = Math.min(storedFramePaths.length, capture.extras.length);
  for (let i = 0; i < count; i++) {
    try {
      const b64 = capture.extras[i].dataUrl.split(",")[1];
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      void supabase.storage
        .from("frames")
        .upload(storedFramePaths[i], bytes, { contentType: "image/jpeg", upsert: false })
        .catch(() => {});
    } catch {
      // Skip a frame that fails to decode; the rest still upload.
    }
  }
}

function clipExt(b: Blob): string {
  const type = (b.type || "").toLowerCase();
  if (type.includes("mp4")) return "mp4";
  if (type.includes("quicktime") || type.includes("mov")) return "mov";
  if (type.includes("webm")) return "webm";
  const name = (b as File).name ?? "";
  const m = name.toLowerCase().match(/\.([a-z0-9]{2,4})$/);
  return m ? m[1] : "webm";
}

// What the pipeline is actually doing while the model scores the rep, in
// order. The ticker walks forward and rests on the last line rather than
// looping — a loop would read as fake progress.
const SCORING_STAGES = [
  "Reading your frames…",
  "Tracing the motion…",
  "Checking the measured angles…",
  "Scoring against the rubric…",
  "Writing your one fix…",
];

function StatusTicker({ lines }: { lines: string[] }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setStep((v) => Math.min(v + 1, lines.length - 1)),
      6500,
    );
    return () => clearInterval(t);
  }, [lines.length]);
  return (
    <span key={step} className="message-in inline-block">
      {lines[step]}
    </span>
  );
}

function WorkingDots() {
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-teal"
          style={{ animationDelay: `${i * 200}ms` }}
        />
      ))}
    </span>
  );
}

const KIND_FILL: Record<string, string> = {
  peak: "var(--color-gold)",
  burst: "var(--color-chalk)",
  context: "var(--color-chalk-dim)",
};

function FrameDebugPanel({ debug }: { debug: FrameDebug }) {
  const span = debug.curve.length
    ? debug.curve[debug.curve.length - 1].t || 1
    : 1;
  const maxScore = Math.max(1, ...debug.curve.map((c) => c.score));
  return (
    <div className="card mt-4 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
        Frame debug
      </p>
      <p className="mt-1 font-mono text-[11px] text-chalk-dim">
        {debug.fellBack ? "uniform fallback" : "motion-guided"} · scan {debug.scanMs}ms ·{" "}
        {Math.round(debug.totalBytes / 1024)} KB · {debug.chosen.length} frames
      </p>
      {debug.curve.length > 0 && (
        <svg
          viewBox="0 0 100 26"
          preserveAspectRatio="none"
          className="mt-3 h-14 w-full"
          aria-hidden
        >
          {debug.curve.map((c, i) => {
            const h = (c.score / maxScore) * 22;
            return (
              <rect
                key={i}
                x={(c.t / span) * 100}
                y={24 - h}
                width={1.2}
                height={h}
                style={{ fill: "var(--color-teal)" }}
              />
            );
          })}
          {debug.chosen.map((c, i) => (
            <circle
              key={`c${i}`}
              cx={(c.t / span) * 100}
              cy={2.5}
              r={1.2}
              style={{ fill: KIND_FILL[c.kind] }}
            />
          ))}
        </svg>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {debug.chosen.map((c, i) => (
          <span
            key={i}
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
              c.kind === "peak"
                ? "bg-gold text-navy"
                : c.kind === "burst"
                  ? "border border-line text-chalk"
                  : "text-chalk-dim"
            }`}
          >
            {c.t.toFixed(1)}s
          </span>
        ))}
      </div>
    </div>
  );
}

export function AnalyzeFlow({
  initialSkill = null,
  initialDiscipline = null,
}: {
  initialSkill?: Skill | null;
  initialDiscipline?: Discipline | null;
}) {
  const router = useRouter();
  const [skill, setSkill] = useState<Skill | null>(initialSkill);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [source, setSource] = useState<"video" | "photos">("video");
  const [duration, setDuration] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [useUpload, setUseUpload] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [discipline, setDiscipline] = useState<Discipline>(
    initialDiscipline ?? "indoor",
  );
  const [frameDebug, setFrameDebug] = useState<FrameDebug | null>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const debugRef = useRef(false);
  const clipRef = useRef<Blob | null>(null);
  const stepTwoRef = useRef<HTMLHeadingElement>(null);
  const prevSkillRef = useRef<Skill | null>(skill);
  const poseRef = useRef<PoseEngine | null>(null);
  const captureRef = useRef<Capture | null>(null);
  // Pre-analysis pause: the opening frame is up, waiting for the player to
  // frame who to follow.
  const [openingPick, setOpeningPick] = useState<
    (OpeningPlayers & { blob: Blob; isRecorded: boolean }) | null
  >(null);
  // Kept after analysis so the player can reframe and re-run tracking.
  const [lastOpening, setLastOpening] = useState<
    (OpeningPlayers & { blob: Blob; isRecorded: boolean }) | null
  >(null);
  // Scrubbable clip inside the framing card: pick the moment, then the player.
  const frameVideoRef = useRef<HTMLVideoElement>(null);
  const [framingUrl, setFramingUrl] = useState<string | null>(null);
  const [frameVideoFailed, setFrameVideoFailed] = useState(false);
  const [scrubT, setScrubT] = useState(0);
  // The picked player was never found in the clip; nobody else was analyzed.
  const [poiMissed, setPoiMissed] = useState(false);
  // One human line about how the follow went (exits, occlusions, coverage).
  const [trackNote, setTrackNote] = useState<string | null>(null);
  const markedRef = useRef(false);
  const [markerShown, setMarkerShown] = useState(false);

  // Every detected person renders as a tappable box. Candidates start from
  // the opening probe and re-detect live as the user scrubs, so selection
  // always reflects the moment on screen. The most confident candidate is
  // pre-selected; a tap pins that player explicitly.
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  // Capture-quality reasons for the selected player, settled so a momentary bad
  // frame does not nag. A warning only, never a block.
  const [captureWarn, setCaptureWarn] = useState<CaptureQualityReason[]>([]);
  // Whether the selection was the user's own tap (kept glued to the same
  // human across re-detections, dropped when they vanish) or the automatic
  // pre-select (free to follow the strongest detection).
  const userPickedRef = useRef(false);
  const selectedBoxRef = useRef<Box | null>(null);
  // The trimmed analysis window (absolute clip seconds). Dragging a handle
  // past the longest analyzable span slides the other handle along, so the
  // window is always valid and long clips become usable by trimming.
  const [trim, setTrim] = useState<TrimWindow | null>(null);

  function selectCandidate(idx: number | null, byUser: boolean) {
    setSelectedIdx(idx);
    userPickedRef.current = byUser ? idx != null : userPickedRef.current && idx != null;
    selectedBoxRef.current = idx != null ? (candidatesRef.current[idx]?.box ?? null) : null;
  }
  const candidatesRef = useRef<Candidate[]>([]);

  function applyCandidates(next: Candidate[]) {
    candidatesRef.current = next;
    setCandidates(next);
    const prevBox = selectedBoxRef.current;
    if (userPickedRef.current && prevBox) {
      // Re-attach the pick to the same human; a vanished pick stays lost
      // rather than silently switching players.
      let bestIdx: number | null = null;
      let bestOv = 0.3;
      next.forEach((c, i) => {
        const ov = boxOverlap(prevBox, c.box);
        if (ov > bestOv) {
          bestOv = ov;
          bestIdx = i;
        }
      });
      setSelectedIdx(bestIdx);
      selectedBoxRef.current = bestIdx != null ? next[bestIdx].box : prevBox;
      if (bestIdx == null) userPickedRef.current = false;
      return;
    }
    setSelectedIdx(next.length > 0 ? 0 : null);
    selectedBoxRef.current = next[0]?.box ?? null;
  }

  // Seed candidates from the opening probe. The trim window starts at the
  // clip's head, capped at the longest analyzable span so long clips begin
  // valid.
  useEffect(() => {
    userPickedRef.current = false;
    selectedBoxRef.current = null;
    if (!openingPick) {
      applyCandidates([]);
      setTrim(null);
      return;
    }
    applyCandidates(
      openingPick.persons
        .map((pts) => ({ box: personBox(pts), pts }))
        .filter((c): c is Candidate => c.box != null),
    );
    setTrim(
      clampTrimWindow(openingPick.duration_s, {
        startS: 0,
        endS: Math.min(openingPick.duration_s, MAX_CLIP_SECONDS),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openingPick]);

  // Live auto-detection while scrubbing: after the scrubber settles, detect
  // the people at the current moment and refresh the tappable boxes.
  useEffect(() => {
    if (!openingPick || !framingUrl || frameVideoFailed) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const video = frameVideoRef.current;
      const engine = poseRef.current;
      if (!video || !engine) return;
      try {
        const found = await engine.detectPersonsFromVideo(video, scrubT);
        if (cancelled || !found) return;
        const next = offerPersons(dedupePersons(found.persons))
          .map((pts) => ({ box: personBox(pts), pts }))
          .filter((c): c is Candidate => c.box != null);
        if (next.length === 0) return;
        applyCandidates(next);
      } catch {
        // Stale candidates are still tappable.
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubT, openingPick, framingUrl, frameVideoFailed]);

  // Capture-quality check on the selected player, settled ~350ms so a fleeting
  // bad frame does not flash a warning. Nothing selected (or no skill yet) shows
  // nothing; the check reads the same key joints and visibility scale the
  // scoring gate uses, so the tip never contradicts the eventual result.
  useEffect(() => {
    const picked = selectedIdx != null ? candidates[selectedIdx] : null;
    if (!skill || !picked) {
      setCaptureWarn([]);
      return;
    }
    const timer = setTimeout(() => {
      setCaptureWarn(captureQuality(picked.pts, skill).reasons);
    }, 350);
    return () => clearTimeout(timer);
  }, [selectedIdx, candidates, skill]);

  // Blob URL for the scrubbable framing clip, revoked when the card closes.
  useEffect(() => {
    if (!openingPick) {
      setFramingUrl(null);
      return;
    }
    const url = URL.createObjectURL(openingPick.blob);
    setFramingUrl(url);
    setFrameVideoFailed(false);
    setScrubT(openingPick.timeS);
    return () => URL.revokeObjectURL(url);
  }, [openingPick]);

  // The scrubbed moment always stays inside the trimmed window.
  useEffect(() => {
    if (!trim) return;
    const hi = Math.max(trim.startS, trim.endS - 0.05);
    const clamped = Math.min(Math.max(scrubT, trim.startS), hi);
    if (clamped !== scrubT) {
      setScrubT(clamped);
      const v = frameVideoRef.current;
      if (v) v.currentTime = clamped;
    }
  }, [trim, scrubT]);

  // Move one trim handle. Dragging past the longest analyzable span slides
  // the other handle along, so the window is valid at every instant.
  function moveTrim(which: "start" | "end", toS: number) {
    const opening = openingPick;
    if (!opening || !trim) return;
    const dur = opening.duration_s;
    const snap = (n: number) => Math.round(n * 20) / 20;
    let { startS, endS } = trim;
    if (which === "start") {
      startS = Math.max(0, Math.min(toS, endS - MIN_TRIM_SPAN_S));
      if (endS - startS > MAX_CLIP_SECONDS) {
        endS = Math.min(dur, startS + MAX_CLIP_SECONDS);
      }
    } else {
      endS = Math.max(Math.min(dur, toS), Math.min(dur, startS + MIN_TRIM_SPAN_S));
      if (endS - startS > MAX_CLIP_SECONDS) {
        startS = Math.max(0, endS - MAX_CLIP_SECONDS);
      }
    }
    setTrim({ startS: snap(startS), endS: snap(endS) });
  }

  // Gate state lives in a ref, not render state: the queued submit closure
  // runs synchronously after an answer, before any re-render, and a stale
  // state read here is how an answered question used to reopen itself.
  const consentAnsweredRef = useRef<boolean | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const pendingSubmitRef = useRef<(() => void) | null>(null);
  const consentAllowRef = useRef<HTMLButtonElement>(null);

  // Warm the motion-tracking engine once a skill is picked; a null engine
  // simply means extraction runs without measurements. The first-ever load
  // downloads the tracking models, so surface its progress.
  const [modelPct, setModelPct] = useState<number | null>(null);
  useEffect(() => {
    if (!skill) return;
    let cancelled = false;
    loadPoseEngine({
      onProgress: (p) => {
        if (cancelled) return;
        setModelPct(Math.min(100, Math.round((p.loadedBytes / p.totalBytes) * 100)));
      },
    }).then((engine) => {
      if (!cancelled) {
        poseRef.current = engine;
        setModelPct(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [skill]);

  // Settles the has-the-question-been-answered read and releases any submit
  // that arrived while it was in flight: straight through when answered,
  // through the modal when not.
  function resolveConsent(answered: boolean) {
    consentAnsweredRef.current = answered;
    const run = pendingSubmitRef.current;
    if (!run) return;
    if (answered) {
      pendingSubmitRef.current = null;
      run();
    } else {
      setConsentOpen(true);
    }
  }

  // Has this account answered the training-data question yet? Transient read
  // errors and hangs fail open (analysis is never blocked; consent stays
  // false in the database until explicitly granted), but a session whose user
  // no longer exists is dead everywhere: clear it and start over at login
  // instead of silently skipping the question and losing every later write.
  useEffect(() => {
    let settled = false;
    const settle = (answered: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(failOpen);
      resolveConsent(answered);
    };
    const failOpen = setTimeout(() => settle(true), 6000);
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          settled = true;
          clearTimeout(failOpen);
          await supabase.auth.signOut();
          window.location.assign("/login");
          return;
        }
        const { data } = await supabase
          .from("profiles")
          .select("training_consent_at")
          .eq("id", user.id)
          .single();
        settle(data?.training_consent_at != null);
      } catch {
        settle(true);
      }
    })();
    return () => clearTimeout(failOpen);
  }, []);

  useEffect(() => {
    if (consentOpen) consentAllowRef.current?.focus();
  }, [consentOpen]);

  async function answerConsent(allow: boolean) {
    setConsentOpen(false);
    consentAnsweredRef.current = true;
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // supabase-js reports failures in the return value, not by throwing,
        // and an RLS-blocked update is a silent zero-row success; selecting
        // the row back makes both visible so an unsaved answer is never
        // mistaken for a saved one. The analysis itself still runs either way.
        const { data, error } = await supabase
          .from("profiles")
          .update({
            training_consent: allow,
            training_consent_at: new Date().toISOString(),
          })
          .eq("id", user.id)
          .select("training_consent_at");
        if (error || !data?.length) {
          console.warn("Training-consent answer did not save; it will be asked again.", error?.message);
        }
      }
    } catch {
      // The default in the database is no consent; a failed write stays safe.
    }
    const run = pendingSubmitRef.current;
    pendingSubmitRef.current = null;
    run?.();
  }

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("debug")
    ) {
      debugRef.current = true;
    }
  }, []);

  const busy =
    status.kind === "reading" || status.kind === "sending" || status.kind === "tracking";
  const canSubmit = frames.length > 0 && (source === "photos" || useUpload);

  // Release the preview object URL when it is replaced or on unmount.
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // Move focus into the revealed step-02 block the first time a skill is picked
  // (null -> a value); re-picks leave focus where it is so roving arrow-key
  // navigation in the skill radiogroup is not disrupted.
  useEffect(() => {
    const had = prevSkillRef.current;
    prevSkillRef.current = skill;
    if (!had && skill) stepTwoRef.current?.focus();
  }, [skill]);

  async function submit(
    payloadFrames: Frame[],
    src: "video" | "photos",
    dur: number | null,
    isRetry = false,
  ) {
    if (!skill || payloadFrames.length === 0) return;
    // One-time training-data question before the first analysis ever runs.
    // While the answered-check is still in flight (null), the submit waits for
    // it; skipping ahead here is how the question used to get lost entirely.
    if (consentAnsweredRef.current !== true) {
      pendingSubmitRef.current = () => {
        void submit(payloadFrames, src, dur, isRetry);
      };
      if (consentAnsweredRef.current === false) setConsentOpen(true);
      return;
    }
    setRetrying(isRetry);
    setStatus({ kind: "sending" });
    const clip = src === "video" ? clipRef.current : null;
    const capture = src === "video" ? captureRef.current : null;
    const landmarks = capture?.landmarks ?? [];
    const hasKeypoints = landmarks.length >= 8;
    // Tracked ball marks replace the model's eyeballed ones only when the
    // detector demonstrably followed the ball: a real path, landing on at
    // least a few of the frames actually being sent.
    const ballPath = capture?.ball ?? [];
    const trackedMarks =
      ballPath.length >= MIN_TRACK_POINTS
        ? ballMarksForFrames(ballPath, payloadFrames)
        : null;
    const trackedBall =
      trackedMarks && trackedMarks.filter((m) => m.visible).length >= 3
        ? trackedMarks
        : undefined;
    const body: AnalyzeRequest = {
      skill,
      discipline,
      source: src,
      duration_s: dur,
      has_clip: !!clip,
      clip_ext: clip ? clipExt(clip) : null,
      frames: payloadFrames.map((f) => ({
        index: f.index,
        time_s: f.time_s,
        data: f.dataUrl.split(",")[1],
      })),
      measurements: capture?.measurements ?? undefined,
      player_selection:
        capture && capture.tracks.length > 0 && capture.selectedTrackId != null
          ? {
              candidates: capture.tracks.length,
              selected_rank:
                Math.max(
                  0,
                  capture.tracks.findIndex((t) => t.id === capture.selectedTrackId),
                ) + 1,
              auto: capture.selectedTrackId === capture.tracks[0]?.id,
            }
          : undefined,
      frame_keypoints: hasKeypoints
        ? keypointsForFrames(landmarks, payloadFrames)
        : undefined,
      // The sidecar file is worth storing when either the skeleton or the
      // ball path has substance; the server issues its path off this flag.
      has_keypoints: hasKeypoints || ballPath.length >= MIN_TRACK_POINTS,
      focus_marker: src === "video" && markedRef.current ? true : undefined,
      extra_frame_count: capture?.extras.length ?? 0,
      continuity: capture?.continuity ? continuityToWire(capture.continuity) : undefined,
      ball_track: trackedBall,
    };
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: null }));
        throw new Error(error ?? "The coaching service is unavailable. Try again.");
      }
      const { analysisId, clipPath, keypointsPath, storedFramePaths, xpAwarded } =
        await res.json();
      if (clip && clipPath) {
        try {
          await createClient()
            .storage.from("clips")
            .upload(clipPath, clip, {
              contentType: (clip.type || "video/webm").split(";")[0],
              upsert: false,
            });
        } catch {
          // Non-fatal: the results page falls back to the frame player.
        }
      }
      if (capture) {
        // Background persistence; navigation does not wait on it.
        uploadCaptureArtifacts(
          capture,
          dur,
          typeof keypointsPath === "string" ? keypointsPath : null,
          Array.isArray(storedFramePaths) ? storedFramePaths : [],
        );
      }
      // Purge the client router cache so dashboard/history show this rep
      // immediately instead of a cached copy for up to 30s.
      router.refresh();
      router.push(
        `/analysis/${analysisId}${xpAwarded ? `?xp=${xpAwarded}` : ""}`,
      );
    } catch (err) {
      setRetrying(false);
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }

  // Extraction over a chosen (or auto) focus player, then submit or preview.
  async function runVideoExtraction(
    blob: Blob,
    isRecorded: boolean,
    target?: { x: number; y: number; t: number; box?: Box },
    window?: TrimWindow,
  ) {
    try {
      const engine = poseRef.current ?? (await loadPoseEngine());
      poseRef.current = engine;
      const pose = engine && skill ? { engine, skill, target } : undefined;
      const { frames: f, extras, pose: poseCapture, duration_s, debug } = await extractFrames(
        blob,
        {
          debug: debugRef.current,
          pose,
          window,
          onProgress: (pct) =>
            setStatus({ kind: "tracking", pct: Math.round(pct * 100) }),
        },
      );
      setStatus({ kind: "reading" });
      captureRef.current =
        poseCapture && skill
          ? {
              landmarks: poseCapture.landmarks,
              measurements: poseCapture.measurements,
              extras,
              tracks: poseCapture.tracks,
              selectedTrackId: poseCapture.selectedTrackId,
              denseFps: poseCapture.denseFps,
              continuity: poseCapture.continuity,
              ball: poseCapture.ball,
              skill,
            }
          : null;
      // The user pinned a player but tracking never found them: analyze
      // nobody rather than somebody else, and say so.
      setPoiMissed(!!target && !!poseCapture && poseCapture.selectedTrackId == null);
      setTrackNote(
        poseCapture?.continuity ? continuityNote(poseCapture.continuity) : null,
      );
      let shown = f;
      markedRef.current = false;
      if (captureRef.current && captureRef.current.landmarks.length >= 8) {
        const { frames: stamped, marked } = await markFocusFrames(
          f,
          captureRef.current.landmarks,
        );
        if (marked > 0) {
          shown = stamped;
          markedRef.current = true;
        }
      }
      setMarkerShown(markedRef.current);
      setFrames(shown);
      setSource("video");
      setDuration(duration_s);
      setFrameDebug(debug ?? null);
      if (debug) {
        // Debug mode: inspect the selected frames instead of spending an API call.
        setStatus({ kind: "idle" });
        return;
      }
      if (isRecorded) {
        await submit(shown, "video", duration_s);
      } else {
        setStatus({ kind: "idle" });
      }
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't read that clip.",
      });
    }
  }

  // Shared entry for recorded and uploaded clips: pause on the opening frame
  // so the player can frame who to follow before any analysis runs.
  async function handleVideo(blob: Blob, isRecorded: boolean) {
    setStatus({ kind: "reading" });
    setFrameDebug(null);
    setOpeningPick(null);
    setLastOpening(null);
    setPoiMissed(false);
    setTrackNote(null);
    clipRef.current = blob;
    setVideoUrl(isRecorded ? null : URL.createObjectURL(blob));
    try {
      const engine = poseRef.current ?? (await loadPoseEngine());
      poseRef.current = engine;
      // Choosing the moment and the player is always the user's: the framing
      // card opens even when the pose engine failed or found nobody. The
      // drawn frame then anchors tracking on its own.
      if (skill) {
        const opening = await detectOpeningPlayers(blob, engine);
        // Long clips get the card too: the trim window makes them analyzable.
        if (opening) {
          captureRef.current = null;
          setFrames([]);
          markedRef.current = false;
          setMarkerShown(false);
          setSource("video");
          setDuration(opening.duration_s);
          const pick = { ...opening, blob, isRecorded };
          setLastOpening(pick);
          setOpeningPick(pick);
          setStatus({ kind: "idle" });
          return;
        }
      }
      await runVideoExtraction(blob, isRecorded);
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't read that clip.",
      });
    }
  }

  // The pick is confirmed: the selected candidate's own landmarks anchor
  // tracking (no fresh detection needed). With nothing selected, the
  // automated identifier follows the most involved player across the trimmed
  // window, so trimming alone stays a complete flow.
  function confirmFraming() {
    const opening = openingPick;
    if (!opening) return;
    const win = trim ?? undefined;
    const picked = selectedIdx != null ? (candidates[selectedIdx] ?? null) : null;
    const video = frameVideoRef.current;
    const rawT =
      video && Number.isFinite(video.currentTime) && video.currentTime > 0.01
        ? video.currentTime
        : opening.timeS;
    const t = win
      ? Math.min(Math.max(rawT, win.startS + 0.02), Math.max(win.startS + 0.02, win.endS - 0.05))
      : rawT;
    setOpeningPick(null);
    setStatus({ kind: "reading" });
    if (!picked) {
      void runVideoExtraction(opening.blob, opening.isRecorded, undefined, win);
      return;
    }
    const anchor = focusPoint(picked.pts) ?? {
      x: picked.box.left + picked.box.width / 2,
      y: picked.box.top + picked.box.height / 2,
    };
    void runVideoExtraction(
      opening.blob,
      opening.isRecorded,
      { x: anchor.x, y: anchor.y, t, box: picked.box },
      win,
    );
  }

  function skipFraming() {
    const opening = openingPick;
    if (!opening) return;
    const win = trim ?? undefined;
    setOpeningPick(null);
    setStatus({ kind: "reading" });
    void runVideoExtraction(opening.blob, opening.isRecorded, undefined, win);
  }

  async function onRecorded(blob: Blob) {
    await handleVideo(blob, true);
  }

  async function onVideoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus({ kind: "reading" });
    try {
      // The gallery picker can return a still image as well as a video —
      // handle whichever the player chose.
      if (file.type.startsWith("image/")) {
        const f = await extractFramesFromPhotos([file]);
        setFrames(f);
        setLastOpening(null);
        markedRef.current = false;
        setMarkerShown(false);
        setPoiMissed(false);
    setTrackNote(null);
        setSource("photos");
        setDuration(null);
        setVideoUrl(null);
        clipRef.current = null;
        captureRef.current = null;
        setStatus({ kind: "idle" });
      } else {
        await handleVideo(file, false);
      }
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't read that clip.",
      });
    }
  }

  async function onPhotosPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setStatus({ kind: "reading" });
    try {
      const f = await extractFramesFromPhotos(files);
      setFrames(f);
      setLastOpening(null);
      markedRef.current = false;
      setMarkerShown(false);
      setPoiMissed(false);
    setTrackNote(null);
      setSource("photos");
      setDuration(null);
      setVideoUrl(null);
      clipRef.current = null;
      captureRef.current = null;
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't read those photos.",
      });
    }
  }

  function downloadEvalCase() {
    if (!skill || frames.length === 0) return;
    const payload = {
      id: `${skill}-${discipline}-${Date.now()}`,
      skill,
      discipline,
      frames: frames.map((f) => ({ time_s: f.time_s, data: f.dataUrl.split(",")[1] })),
      measurements: captureRef.current?.measurements ?? undefined,
      expected: {
        overall_min: 0,
        overall_max: 100,
        weakest_metric: "",
        notes: "TODO: label this rep: expected score band + weakest metric.",
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${payload.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="max-w-xl lg:max-w-none">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
        Analyze
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
        Film the rep.
      </h1>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-chalk-dim">
          Discipline
        </span>
        {DISCIPLINES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDiscipline(d)}
            aria-pressed={discipline === d}
            className={`chip ${discipline === d ? "chip-active" : ""}`}
          >
            {DISCIPLINE_LABEL[d]}
          </button>
        ))}
      </div>

      <div
        className={
          skill
            ? "mt-8 lg:grid lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:items-start lg:gap-10"
            : "mt-8 max-w-xl"
        }
      >
        {/* Controls */}
        <div className="min-w-0">
          <div>
            <h2
              id="pick-a-skill"
              className="mb-3 flex items-center gap-2 font-display text-sm font-bold"
            >
              <span className="font-mono text-xs text-gold">01</span> Pick a skill
            </h2>
            <SkillPicker value={skill} onChange={setSkill} labelledBy="pick-a-skill" />
          </div>

          {skill && (
            <div className="mt-8 animate-fade-up">
              <h2
                ref={stepTwoRef}
                tabIndex={-1}
                className="mb-3 flex items-center gap-2 font-display text-sm font-bold"
              >
                <span className="font-mono text-xs text-gold">02</span> Capture your{" "}
                {SKILL_LABEL[skill].toLowerCase()} rep
              </h2>

              {!useUpload ? (
                <Recorder onClip={onRecorded} onUnavailable={() => setUseUpload(true)} />
              ) : (
                <div className="card border-dashed border-gold/40 p-8 text-center">
                  <button
                    type="button"
                    onClick={() => videoInput.current?.click()}
                    disabled={busy}
                    className="btn-ghost mx-auto text-sm"
                  >
                    Upload a clip
                  </button>
                  <p className="mt-3 text-xs text-chalk-dim">
                    A few seconds, up to 45. Any angle you can get.
                  </p>
                </div>
              )}

              <input
                ref={videoInput}
                type="file"
                // Explicit MIME types only — Android maps wildcard accepts
                // (video/*, image/*) to a camera-capture intent on some
                // devices, skipping the gallery entirely. Concrete types
                // always open the media picker. onVideoPicked handles
                // either kind.
                accept="video/mp4,video/quicktime,video/webm,video/3gpp,video/x-matroska,image/jpeg,image/png,image/webp"
                hidden
                onChange={onVideoPicked}
              />
              <input
                ref={photoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={onPhotosPicked}
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (useUpload) {
                      setUseUpload(false);
                    } else {
                      // Skip the recorder — open the file picker straight away.
                      setUseUpload(true);
                      videoInput.current?.click();
                    }
                  }}
                  disabled={busy}
                  className="chip min-h-11"
                >
                  {useUpload ? "Record in-app instead" : "Upload a clip instead"}
                </button>
                <button
                  type="button"
                  onClick={() => photoInput.current?.click()}
                  disabled={busy}
                  className="chip min-h-11"
                >
                  Use photos instead
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        {skill && (
          <div className="mt-8 min-w-0 lg:sticky lg:top-8 lg:mt-0">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-gold">
              Preview
            </p>

            {videoUrl && (
              <div className="mb-3 overflow-hidden rounded-lg bg-navy">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src={videoUrl}
                  aria-label="Clip preview"
                  controls
                  playsInline
                  preload="metadata"
                  className="block max-h-[60vh] w-full"
                />
              </div>
            )}

            {openingPick && (
              <div className="card mb-3 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
                  Who should I watch?
                </p>
                <p className="mt-1 text-xs text-chalk-dim">
                  Tap the boxed player you want analyzed. Scrub to any moment
                  and trim the window; every frame inside it gets tracked.
                </p>
                <div className="relative mx-auto mt-3 w-fit max-w-full select-none overflow-hidden rounded-lg bg-navy">
                  {framingUrl && !frameVideoFailed ? (
                    <video
                      ref={frameVideoRef}
                      src={framingUrl}
                      muted
                      playsInline
                      preload="auto"
                      aria-label="Clip frame. Scrub below to choose the moment."
                      onLoadedMetadata={() => {
                        const v = frameVideoRef.current;
                        if (v) v.currentTime = openingPick.timeS;
                      }}
                      onError={() => setFrameVideoFailed(true)}
                      className="block max-h-[45vh] w-auto max-w-full"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={openingPick.dataUrl}
                      alt="Opening frame. Tap the player to analyze."
                      className="block max-h-[45vh] w-auto max-w-full"
                      draggable={false}
                    />
                  )}
                  {/* Every detected person is a tappable box; gold = watching. */}
                  {candidates.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectCandidate(i, true)}
                      aria-pressed={i === selectedIdx}
                      aria-label={`Player ${i + 1}${i === selectedIdx ? ", selected" : ""}`}
                      className={`absolute rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                        i === selectedIdx
                          ? "border-2 border-gold"
                          : "border border-chalk-dim/60"
                      }`}
                      style={{
                        left: `${c.box.left * 100}%`,
                        top: `${c.box.top * 100}%`,
                        width: `${c.box.width * 100}%`,
                        height: `${c.box.height * 100}%`,
                        boxShadow:
                          i === selectedIdx
                            ? "0 0 14px color-mix(in srgb, var(--color-gold) 45%, transparent)"
                            : undefined,
                      }}
                    >
                      {i === selectedIdx && (
                        <span
                          aria-hidden
                          className="absolute -top-5 left-0 rounded bg-gold px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-navy"
                        >
                          watching
                        </span>
                      )}
                    </button>
                  ))}
                  {candidates.length === 0 && (
                    <p className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded bg-navy/80 px-2 py-1 text-center text-[11px] text-chalk-dim">
                      No players spotted at this moment. Scrub to a clearer
                      point in the clip.
                    </p>
                  )}
                </div>
                {framingUrl && !frameVideoFailed && (
                  <input
                    type="range"
                    min={trim?.startS ?? 0}
                    max={
                      trim
                        ? Math.max(trim.startS + 0.05, trim.endS - 0.05)
                        : Math.max(0.1, openingPick.duration_s - 0.05)
                    }
                    step={0.05}
                    value={scrubT}
                    onChange={(e) => {
                      const t = Number(e.target.value);
                      setScrubT(t);
                      const v = frameVideoRef.current;
                      if (v) v.currentTime = t;
                    }}
                    aria-label="Scrub through the clip"
                    className="mt-3 h-11 w-full cursor-pointer accent-gold"
                  />
                )}
                {trim && openingPick.duration_s > MIN_TRIM_SPAN_S + 0.5 && (
                  <>
                    <TrimBar
                      duration={openingPick.duration_s}
                      trim={trim}
                      onMove={moveTrim}
                    />
                    {openingPick.duration_s > MAX_CLIP_SECONDS && (
                      <p className="mt-1 text-xs text-chalk-dim">
                        Only the gold window is analyzed, up to {MAX_CLIP_SECONDS}s.
                        Slide it over your best reps.
                      </p>
                    )}
                  </>
                )}
                {captureWarn.length > 0 && (
                  <Reveal className="mt-3">
                    <div className="flex items-start gap-2 text-xs text-coral">
                      <span
                        aria-hidden
                        className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-coral"
                      />
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.12em]">
                          Capture tip
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {captureWarn.map((r) => (
                            <li key={r}>{CAPTURE_TIP_COPY[r]}</li>
                          ))}
                        </ul>
                        <p className="mt-1 text-chalk-dim">
                          You can still analyze now; this only helps accuracy.
                        </p>
                      </div>
                    </div>
                  </Reveal>
                )}
                <button
                  type="button"
                  onClick={confirmFraming}
                  className="btn-primary mt-4 min-h-11 w-full"
                >
                  {selectedIdx != null
                    ? "Analyze this player"
                    : "Find my player and analyze"}
                </button>
                <button
                  type="button"
                  onClick={skipFraming}
                  className="btn-ghost mt-2 min-h-11 w-full"
                >
                  Skip and analyze the whole frame
                </button>
              </div>
            )}

            {frames.length > 0 ? (
              <div className="reward-earned">
                {poiMissed && (
                  <p className="mb-2 text-xs text-coral">
                    Couldn't find your picked player in the clip, so nobody
                    else was measured in their place. Pick again to retry.
                  </p>
                )}
                {trackNote && !poiMissed && (
                  <p className="mb-2 text-xs text-chalk-dim">{trackNote}</p>
                )}
                {(markerShown || (lastOpening && source === "video")) && (
                  <div className="mb-2 flex items-center gap-2 text-xs text-chalk-dim">
                    {markerShown && (
                      <>
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-teal"
                        />
                        <span>
                          The skeleton traces the tracked player in every frame.
                        </span>
                      </>
                    )}
                    {lastOpening && source === "video" && !openingPick && (
                      <button
                        type="button"
                        onClick={() => setOpeningPick(lastOpening)}
                        disabled={busy}
                        className="chip ml-auto shrink-0"
                      >
                        Reframe player
                      </button>
                    )}
                  </div>
                )}
                <div className="relative">
                  <Filmstrip frames={frames} variant="grid" />
                  {status.kind === "sending" && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-lg"
                    >
                      <div className="scan-line" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card border-dashed border-line p-10 text-center text-xs text-chalk-dim">
                {busy
                  ? "Reading your rep…"
                  : "Your captured rep shows up here, frame by frame."}
              </div>
            )}

            {frameDebug && (
              <>
                <FrameDebugPanel debug={frameDebug} />
                <button
                  type="button"
                  onClick={downloadEvalCase}
                  className="btn-ghost mt-3 text-xs"
                >
                  Download eval case
                </button>
              </>
            )}

            {canSubmit && (
              <button
                type="button"
                aria-busy={busy}
                disabled={busy}
                onClick={() => submit(frames, source, duration)}
                className="btn-primary mt-4 w-full disabled:opacity-40"
              >
                {busy ? (
                  <>
                    <WorkingDots /> Break it down
                  </>
                ) : (
                  "Break it down"
                )}
              </button>
            )}

            <div className="mt-4 min-h-6 font-mono text-sm" aria-live="polite">
              {status.kind === "reading" && (
                <span className="flex items-center gap-2.5 text-teal">
                  <WorkingDots />{" "}
                  {modelPct != null && modelPct < 100
                    ? `Preparing motion tracking… ${modelPct}%`
                    : "Reading your clip…"}
                </span>
              )}
              {status.kind === "tracking" && (
                <span className="flex items-center gap-2.5 text-teal">
                  <WorkingDots /> Tracking the play… {status.pct}%
                </span>
              )}
              {status.kind === "sending" && !retrying && (
                <span className="flex items-center gap-2.5 text-teal">
                  <WorkingDots /> <StatusTicker lines={SCORING_STAGES} />
                </span>
              )}
              {status.kind === "error" && (
                <p className="animate-fade-up text-coral">{status.message}</p>
              )}
              {frames.length > 0 && (status.kind === "error" || retrying) && (
                <button
                  type="button"
                  aria-busy={retrying}
                  disabled={busy}
                  onClick={() => submit(frames, source, duration, true)}
                  className="btn-ghost mt-3 flex min-h-11 items-center gap-2 px-4 py-2 text-sm disabled:opacity-40"
                >
                  {retrying ? (
                    <>
                      <WorkingDots /> Scoring your rep, frame by frame…
                    </>
                  ) : (
                    "Send it again"
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {consentOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="training-consent-title"
        >
          <div className="card w-full max-w-md p-6">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
              One-time question
            </p>
            <h2 id="training-consent-title" className="mt-2 font-display text-xl font-bold">
              Help improve motion tracking?
            </h2>
            <p className="mt-3 text-sm text-chalk-dim">
              Allow your uploaded clips and extracted frames to help train future
              analysis features, like automatic ball tracking. Your footage stays
              private to your account either way, and you can change this any time
              from your dashboard.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                ref={consentAllowRef}
                type="button"
                onClick={() => answerConsent(true)}
                className="btn-primary min-h-11"
              >
                Allow
              </button>
              <button
                type="button"
                onClick={() => answerConsent(false)}
                className="btn-ghost min-h-11"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
