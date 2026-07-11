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
  dedupePersons,
  focusPoint,
  focusRegionAround,
} from "@/lib/pose/kinematics";
import {
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
      // The ring rides on the player's head.
      const head = focusPoint(best.pts);
      if (!head) return f;
      const cx = head.x;
      const cy = head.y;
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
            // Cropped frames: place the ring in the crop's coordinate space.
            const crop = f.crop;
            const nx = crop ? (cx - crop.left) / crop.width : cx;
            const ny = crop ? (cy - crop.top) / crop.height : cy;
            if (nx < 0.02 || nx > 0.98 || ny < 0.02 || ny > 0.98) {
              return resolve(null);
            }
            const x = nx * canvas.width;
            const y = ny * canvas.height;
            const bodyHRel = crop ? bodyH / crop.height : bodyH;
            const r = Math.min(24, Math.max(5, bodyHRel * canvas.height * 0.07));
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
    // Cropped frames carry their window; overlays live in that window's space.
    const c = f.crop;
    out.push({
      frame_index: f.index,
      pts: best.pts.flatMap((p) => [
        r3(c ? (p.x - c.left) / c.width : p.x),
        r3(c ? (p.y - c.top) / c.height : p.y),
        r3(p.z),
        r3(p.v),
      ]),
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
  // The draggable point of interest over the clip (normalized). Dropped on a
  // player; the body under it is detected and everything follows from that.
  const [poi, setPoi] = useState<{ x: number; y: number } | null>(null);
  const poiDragRef = useRef<number | null>(null);
  const frameStageRef = useRef<HTMLDivElement>(null);
  // Scrubbable clip inside the framing card: pick the moment, then the player.
  const frameVideoRef = useRef<HTMLVideoElement>(null);
  const [framingUrl, setFramingUrl] = useState<string | null>(null);
  const [frameVideoFailed, setFrameVideoFailed] = useState(false);
  const [scrubT, setScrubT] = useState(0);
  // The pinned player was never found in the clip; nobody else was analyzed.
  const [poiMissed, setPoiMissed] = useState(false);
  const markedRef = useRef(false);
  const [markerShown, setMarkerShown] = useState(false);

  // Start the dot on the first detected person's head, else centered.
  useEffect(() => {
    if (!openingPick) {
      setPoi(null);
      poiDragRef.current = null;
      return;
    }
    const first = openingPick.persons[0];
    const head = first ? focusPoint(first) : null;
    setPoi(head ?? { x: 0.5, y: 0.45 });
  }, [openingPick]);

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

  function stagePoint(e: React.PointerEvent): { x: number; y: number } | null {
    const rect = frameStageRef.current?.getBoundingClientRect();
    if (!rect || rect.width < 1 || rect.height < 1) return null;
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  // Tap anywhere on the clip to drop the dot there; keep dragging to adjust.
  function onStagePointerDown(e: React.PointerEvent) {
    const p = stagePoint(e);
    if (!p) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    poiDragRef.current = e.pointerId;
    setPoi(p);
  }

  function onStagePointerMove(e: React.PointerEvent) {
    if (poiDragRef.current !== e.pointerId) return;
    const p = stagePoint(e);
    if (p) setPoi(p);
  }

  function onStagePointerUp(e: React.PointerEvent) {
    if (poiDragRef.current === e.pointerId) poiDragRef.current = null;
  }

  function onPoiKeyDown(e: React.KeyboardEvent) {
    if (!poi) return;
    const step = e.shiftKey ? 0.05 : 0.02;
    let { x, y } = poi;
    if (e.key === "ArrowLeft") x -= step;
    else if (e.key === "ArrowRight") x += step;
    else if (e.key === "ArrowUp") y -= step;
    else if (e.key === "ArrowDown") y += step;
    else return;
    e.preventDefault();
    setPoi({ x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) });
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
    target?: { x: number; y: number; t: number; box?: Box },
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
      // The user pinned a player but tracking never found them: analyze
      // nobody rather than somebody else, and say so.
      setPoiMissed(!!target && !!poseCapture && poseCapture.selectedTrackId == null);
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

  // The dot is confirmed: find the body under it at the scrubbed moment. A
  // fresh detection zoomed around the dot finds the player even when they are
  // small; the anchor snaps to their head and the detected body's bounds
  // drive the zoom and crops downstream.
  async function confirmFraming() {
    const opening = openingPick;
    const dot = poi;
    if (!opening || !dot) return;
    const video = frameVideoRef.current;
    const t =
      video && Number.isFinite(video.currentTime) && video.currentTime > 0.01
        ? video.currentTime
        : opening.timeS;
    setOpeningPick(null);
    setStatus({ kind: "reading" });
    // Opening detections only describe the opening probe; re-detect when the
    // player scrubbed elsewhere (or to sharpen the snap when they did not).
    let persons = Math.abs(t - opening.timeS) < 0.2 ? opening.persons : [];
    const engine = poseRef.current;
    if (video && engine) {
      try {
        const found = await engine.detectPersonsFromVideo(
          video,
          t,
          focusRegionAround(dot.x, dot.y, null),
        );
        if (found && found.persons.length > 0) persons = dedupePersons(found.persons);
      } catch {
        // The dot position still anchors tracking.
      }
    }
    // The body under the dot wins; otherwise the nearest head within reach.
    let bestPts: (typeof persons)[number] | null = null;
    let bestScore = 0.2;
    for (const pts of persons) {
      const bb = boxFromPts(pts);
      const head = focusPoint(pts);
      if (!head) continue;
      const inside =
        bb != null &&
        dot.x >= bb.left &&
        dot.x <= bb.left + bb.width &&
        dot.y >= bb.top &&
        dot.y <= bb.top + bb.height;
      const d = Math.hypot(head.x - dot.x, head.y - dot.y);
      const score = inside ? Math.min(d, 0.02) : d;
      if (score < bestScore) {
        bestScore = score;
        bestPts = pts;
      }
    }
    let target: { x: number; y: number; t: number; box?: Box };
    if (bestPts) {
      const head = focusPoint(bestPts)!;
      target = { x: head.x, y: head.y, t, box: boxFromPts(bestPts) ?? undefined };
    } else {
      // Nobody detected at the dot yet: anchor on the dot itself with a
      // person-sized window below it (the dot sits on the head).
      const width = 0.24;
      const height = 0.44;
      target = {
        x: dot.x,
        y: dot.y,
        t,
        box: {
          left: Math.min(Math.max(0, dot.x - width / 2), 1 - width),
          top: Math.min(Math.max(0, dot.y - 0.06), 1 - height),
          width,
          height,
        },
      };
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
        setPoiMissed(false);
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

            {openingPick && poi && (
              <div className="card mb-3 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
                  Who should I watch?
                </p>
                <p className="mt-1 text-xs text-chalk-dim">
                  Scrub to a moment where your player is clear, then drop the
                  dot on their head.
                </p>
                <div
                  ref={frameStageRef}
                  onPointerDown={onStagePointerDown}
                  onPointerMove={onStagePointerMove}
                  onPointerUp={onStagePointerUp}
                  onPointerCancel={onStagePointerUp}
                  className="relative mx-auto mt-3 w-fit max-w-full cursor-crosshair select-none overflow-hidden rounded-lg bg-navy"
                  style={{ touchAction: "none" }}
                >
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
                      alt="Opening frame. Frame the player to analyze."
                      className="block max-h-[45vh] w-auto max-w-full"
                      draggable={false}
                    />
                  )}
                  <div
                    role="group"
                    aria-label="Point of interest. Tap or drag onto your player's head, or use the arrow keys."
                    tabIndex={0}
                    onKeyDown={onPoiKeyDown}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                    style={{ left: `${poi.x * 100}%`, top: `${poi.y * 100}%` }}
                  >
                    <span
                      aria-hidden
                      className="relative block h-8 w-8 rounded-full border-[3px] border-gold shadow-lift"
                      style={{
                        boxShadow:
                          "0 0 0 2px color-mix(in srgb, var(--color-navy) 85%, transparent), 0 0 14px color-mix(in srgb, var(--color-gold) 55%, transparent)",
                      }}
                    >
                      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold" />
                    </span>
                  </div>
                </div>
                {framingUrl && !frameVideoFailed && (
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0.1, openingPick.duration_s - 0.05)}
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
                {poiMissed && (
                  <p className="mb-2 text-xs text-coral">
                    Couldn't find your framed player in the clip, so nobody
                    else was measured in their place. Reframe to try again.
                  </p>
                )}
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
