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
import { loadPoseEngine, type PoseEngine } from "@/lib/pose/engine";
import {
  LM,
  type Landmark,
  type LandmarkFrame,
  type MeasurementsBlock,
  type KeypointsFile,
  type PersonTrack,
} from "@/lib/pose/types";
import {
  SKILL_LABEL,
  DISCIPLINES,
  DISCIPLINE_LABEL,
  type Skill,
  type Discipline,
} from "@/lib/skills";
import type { AnalyzeRequest, FrameKeypointsWire } from "@/lib/analysis-types";

type Status = { kind: "idle" | "reading" | "sending" } | { kind: "error"; message: string };

type Capture = {
  landmarks: LandmarkFrame[];
  measurements: MeasurementsBlock | null;
  extras: Frame[];
  tracks: PersonTrack[];
  selectedTrackId: number | null;
  denseFps: number | null;
  skill: Skill;
};

// Bounding box (normalized, padded) around one detected person.
function boxFromPts(
  pts: Landmark[],
): { left: number; top: number; width: number; height: number } | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of pts) {
    if (p.v < 0.4) continue;
    xs.push(p.x);
    ys.push(p.y);
  }
  if (xs.length < 6) return null;
  const pad = 0.035;
  const left = Math.max(0, Math.min(...xs) - pad);
  const top = Math.max(0, Math.min(...ys) - pad);
  const right = Math.min(1, Math.max(...xs) + pad);
  const bottom = Math.min(1, Math.max(...ys) + pad);
  return { left, top, width: right - left, height: bottom - top };
}

type Box = { left: number; top: number; width: number; height: number };

// Stamp a small gold tracking ring at the focus athlete's hips in each frame,
// so the player sees who is being tracked and the coaching service is told
// exactly which athlete to analyze. Returns new frames; originals untouched.
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
      const xs: number[] = [];
      const ys: number[] = [];
      for (const p of best.pts) {
        if (p.v < 0.4) continue;
        xs.push(p.x);
        ys.push(p.y);
      }
      if (xs.length < 6) return f;
      const lh = best.pts[LM.leftHip];
      const rh = best.pts[LM.rightHip];
      const hipsOk = lh.v >= 0.4 && rh.v >= 0.4;
      const cx = hipsOk ? (lh.x + rh.x) / 2 : xs.reduce((a, b) => a + b, 0) / xs.length;
      const cy = hipsOk ? (lh.y + rh.y) / 2 : ys.reduce((a, b) => a + b, 0) / ys.length;
      const bodyH = Math.max(...ys) - Math.min(...ys);
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
            const gold = style.getPropertyValue("--color-gold").trim();
            const navy = style.getPropertyValue("--color-navy").trim();
            const x = cx * canvas.width;
            const y = cy * canvas.height;
            const r = Math.min(16, Math.max(5, bodyH * canvas.height * 0.07));
            // Dark halo first so the ring reads on any background.
            ctx.lineWidth = Math.max(4.5, r * 0.45);
            ctx.strokeStyle = navy;
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.lineWidth = Math.max(2.5, r * 0.25);
            ctx.strokeStyle = gold;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = gold;
            ctx.beginPath();
            ctx.arc(x, y, Math.max(1.5, r * 0.2), 0, Math.PI * 2);
            ctx.fill();
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
  if (keypointsPath && capture.landmarks.length >= 8) {
    const file: KeypointsFile = {
      version: 1,
      clip_duration_s: durationS,
      frames: capture.landmarks.map((lf) => ({
        t: r3(lf.t),
        pts: lf.pts.map((p) => ({ x: r3(p.x), y: r3(p.y), z: r3(p.z), v: r3(p.v) })),
      })),
    };
    void supabase.storage
      .from("frames")
      .upload(keypointsPath, new Blob([JSON.stringify(file)], { type: "application/json" }), {
        contentType: "application/json",
        upsert: true,
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
        .upload(storedFramePaths[i], bytes, { contentType: "image/jpeg", upsert: true })
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

export function AnalyzeFlow() {
  const router = useRouter();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [source, setSource] = useState<"video" | "photos">("video");
  const [duration, setDuration] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [useUpload, setUseUpload] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [discipline, setDiscipline] = useState<Discipline>("indoor");
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
  // The draggable, resizable frame over the opening image (normalized).
  const [frameBox, setFrameBox] = useState<Box | null>(null);
  const frameStageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: "move" | "resize";
    pointerId: number;
    startX: number;
    startY: number;
    start: Box;
  } | null>(null);
  const markedRef = useRef(false);
  const [markerShown, setMarkerShown] = useState(false);

  // Start the frame over the first detected person, else centered.
  useEffect(() => {
    if (!openingPick) {
      setFrameBox(null);
      dragRef.current = null;
      return;
    }
    const first = openingPick.persons[0] ? boxFromPts(openingPick.persons[0]) : null;
    setFrameBox(first ?? { left: 0.35, top: 0.18, width: 0.3, height: 0.6 });
  }, [openingPick]);

  function onFramePointerDown(e: React.PointerEvent, mode: "move" | "resize") {
    if (!frameBox) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      start: frameBox,
    };
  }

  function onFramePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const rect = frameStageRef.current?.getBoundingClientRect();
    if (!drag || !rect || e.pointerId !== drag.pointerId) return;
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    if (drag.mode === "move") {
      setFrameBox({
        ...drag.start,
        left: Math.min(Math.max(0, drag.start.left + dx), 1 - drag.start.width),
        top: Math.min(Math.max(0, drag.start.top + dy), 1 - drag.start.height),
      });
    } else {
      setFrameBox({
        ...drag.start,
        width: Math.min(Math.max(0.08, drag.start.width + dx), 1 - drag.start.left),
        height: Math.min(Math.max(0.08, drag.start.height + dy), 1 - drag.start.top),
      });
    }
  }

  function onFramePointerUp(e: React.PointerEvent) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  }

  function onFrameKeyDown(e: React.KeyboardEvent) {
    if (!frameBox) return;
    const step = e.shiftKey ? 0.05 : 0.02;
    let { left, top } = frameBox;
    if (e.key === "ArrowLeft") left -= step;
    else if (e.key === "ArrowRight") left += step;
    else if (e.key === "ArrowUp") top -= step;
    else if (e.key === "ArrowDown") top += step;
    else return;
    e.preventDefault();
    setFrameBox({
      ...frameBox,
      left: Math.min(Math.max(0, left), 1 - frameBox.width),
      top: Math.min(Math.max(0, top), 1 - frameBox.height),
    });
  }
  const [consentAnswered, setConsentAnswered] = useState<boolean | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const pendingSubmitRef = useRef<(() => void) | null>(null);
  const consentAllowRef = useRef<HTMLButtonElement>(null);

  // Warm the motion-tracking engine once a skill is picked; a null engine
  // simply means extraction runs without measurements.
  useEffect(() => {
    if (!skill) return;
    let cancelled = false;
    loadPoseEngine().then((engine) => {
      if (!cancelled) poseRef.current = engine;
    });
    return () => {
      cancelled = true;
    };
  }, [skill]);

  // Has this account answered the training-data question yet? Fail open on
  // read errors: analysis is never blocked, and consent stays false in the
  // database until explicitly granted.
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setConsentAnswered(true);
          return;
        }
        const { data } = await supabase
          .from("profiles")
          .select("training_consent_at")
          .eq("id", user.id)
          .single();
        setConsentAnswered(data?.training_consent_at != null);
      } catch {
        setConsentAnswered(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (consentOpen) consentAllowRef.current?.focus();
  }, [consentOpen]);

  async function answerConsent(allow: boolean) {
    setConsentOpen(false);
    setConsentAnswered(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({
            training_consent: allow,
            training_consent_at: new Date().toISOString(),
          })
          .eq("id", user.id);
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

  const busy = status.kind === "reading" || status.kind === "sending";
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
    if (consentAnswered === false) {
      pendingSubmitRef.current = () => {
        void submit(payloadFrames, src, dur, isRetry);
      };
      setConsentOpen(true);
      return;
    }
    setRetrying(isRetry);
    setStatus({ kind: "sending" });
    const clip = src === "video" ? clipRef.current : null;
    const capture = src === "video" ? captureRef.current : null;
    const landmarks = capture?.landmarks ?? [];
    const hasKeypoints = landmarks.length >= 8;
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
        capture && capture.tracks.length > 0
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
      has_keypoints: hasKeypoints,
      focus_marker: src === "video" && markedRef.current ? true : undefined,
      extra_frame_count: capture?.extras.length ?? 0,
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
              upsert: true,
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
    target?: { x: number; y: number; t: number },
  ) {
    try {
      const engine = poseRef.current ?? (await loadPoseEngine());
      poseRef.current = engine;
      const pose = engine && skill ? { engine, skill, target } : undefined;
      const { frames: f, extras, pose: poseCapture, duration_s, debug } = await extractFrames(
        blob,
        { debug: debugRef.current, pose },
      );
      captureRef.current =
        poseCapture && skill
          ? {
              landmarks: poseCapture.landmarks,
              measurements: poseCapture.measurements,
              extras,
              tracks: poseCapture.tracks,
              selectedTrackId: poseCapture.selectedTrackId,
              denseFps: poseCapture.denseFps,
              skill,
            }
          : null;
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
    clipRef.current = blob;
    setVideoUrl(isRecorded ? null : URL.createObjectURL(blob));
    try {
      const engine = poseRef.current ?? (await loadPoseEngine());
      poseRef.current = engine;
      if (engine && skill) {
        const opening = await detectOpeningPlayers(blob, engine);
        if (opening && opening.duration_s <= MAX_CLIP_SECONDS + 0.5) {
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

  // The frame is confirmed: aim tracking at the framed person. If a detected
  // person's hips sit inside the box, snap the anchor to them; otherwise the
  // box center is the anchor.
  function confirmFraming() {
    const opening = openingPick;
    const box = frameBox;
    if (!opening || !box) return;
    setOpeningPick(null);
    setStatus({ kind: "reading" });
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    let target = { x: cx, y: cy, t: opening.timeS };
    let bestD = Infinity;
    for (const pts of opening.persons) {
      const lh = pts[LM.leftHip];
      const rh = pts[LM.rightHip];
      if (lh.v < 0.4 || rh.v < 0.4) continue;
      const hx = (lh.x + rh.x) / 2;
      const hy = (lh.y + rh.y) / 2;
      const inside =
        hx >= box.left &&
        hx <= box.left + box.width &&
        hy >= box.top &&
        hy <= box.top + box.height;
      if (!inside) continue;
      const d = Math.hypot(hx - cx, hy - cy);
      if (d < bestD) {
        bestD = d;
        target = { x: hx, y: hy, t: opening.timeS };
      }
    }
    void runVideoExtraction(opening.blob, opening.isRecorded, target);
  }

  function skipFraming() {
    const opening = openingPick;
    if (!opening) return;
    setOpeningPick(null);
    setStatus({ kind: "reading" });
    void runVideoExtraction(opening.blob, opening.isRecorded);
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
                // Lead with image/* so Android opens the media gallery picker
                // rather than treating video/* as a capture intent and jumping
                // straight to the camera. onVideoPicked handles either type.
                accept="image/*,video/*"
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

            {openingPick && frameBox && (
              <div className="card mb-3 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
                  Who should I watch?
                </p>
                <p className="mt-1 text-xs text-chalk-dim">
                  Drag the box over your player. Pull the corner to resize.
                </p>
                <div
                  ref={frameStageRef}
                  className="relative mt-3 select-none overflow-hidden rounded-lg bg-navy"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={openingPick.dataUrl}
                    alt="Opening frame. Frame the player to analyze."
                    className="block w-full"
                    draggable={false}
                  />
                  <div
                    role="group"
                    aria-label="Player frame. Drag to move, or use the arrow keys."
                    tabIndex={0}
                    onPointerDown={(e) => onFramePointerDown(e, "move")}
                    onPointerMove={onFramePointerMove}
                    onPointerUp={onFramePointerUp}
                    onPointerCancel={onFramePointerUp}
                    onKeyDown={onFrameKeyDown}
                    className="absolute cursor-move rounded-xl border-2 border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                    style={{
                      left: `${frameBox.left * 100}%`,
                      top: `${frameBox.top * 100}%`,
                      width: `${frameBox.width * 100}%`,
                      height: `${frameBox.height * 100}%`,
                      touchAction: "none",
                      boxShadow:
                        "0 0 0 9999px color-mix(in srgb, var(--color-navy) 55%, transparent)",
                    }}
                  >
                    <button
                      type="button"
                      aria-label="Resize the frame"
                      onPointerDown={(e) => onFramePointerDown(e, "resize")}
                      onPointerMove={onFramePointerMove}
                      onPointerUp={onFramePointerUp}
                      onPointerCancel={onFramePointerUp}
                      className="absolute -bottom-4 -right-4 flex h-11 w-11 cursor-nwse-resize items-center justify-center rounded-full bg-gold text-navy shadow-lift"
                      style={{ touchAction: "none" }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="M9.5 2H14v4.5M6.5 14H2V9.5M14 2 9 7M2 14l5-5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={confirmFraming}
                  className="btn-primary mt-4 min-h-11 w-full"
                >
                  Analyze this athlete
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
                {(markerShown || (lastOpening && source === "video")) && (
                  <div className="mb-2 flex items-center gap-2 text-xs text-chalk-dim">
                    {markerShown && (
                      <>
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-gold"
                        />
                        <span>
                          The gold ring marks the tracked player in every frame.
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
                <Filmstrip frames={frames} variant="grid" />
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
                  <WorkingDots /> Pulling key frames…
                </span>
              )}
              {status.kind === "sending" && !retrying && (
                <span className="flex items-center gap-2.5 text-teal">
                  <WorkingDots /> Scoring your rep, frame by frame…
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
