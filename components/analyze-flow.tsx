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
import { buildMeasurementsBlock } from "@/lib/pose/metrics";
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

// Same box for a track near a moment in the clip.
function trackBoxAt(
  track: PersonTrack,
  timeS: number,
): { left: number; top: number; width: number; height: number } | null {
  let best: LandmarkFrame | null = null;
  let bestD = 0.7;
  for (const f of track.frames) {
    const d = Math.abs(f.t - timeS);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best ? boxFromPts(best.pts) : null;
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
  // Mirrors captureRef's track state for rendering the focus-player picker.
  const [playerTracks, setPlayerTracks] = useState<PersonTrack[]>([]);
  const [playerChoice, setPlayerChoice] = useState<number | null>(null);
  // Pre-analysis pause: several people are on screen, waiting for the tap.
  const [openingPick, setOpeningPick] = useState<
    (OpeningPlayers & { blob: Blob; isRecorded: boolean }) | null
  >(null);

  // Follow a different athlete: recompute the measurements from that track
  // without re-extracting anything.
  function selectTrack(trackId: number) {
    const capture = captureRef.current;
    if (!capture) return;
    const track = capture.tracks.find((t) => t.id === trackId);
    if (!track || capture.selectedTrackId === trackId) return;
    capture.selectedTrackId = trackId;
    capture.landmarks = track.frames;
    capture.measurements = buildMeasurementsBlock(
      capture.skill,
      track.frames,
      capture.denseFps,
    );
    setPlayerChoice(trackId);
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
      setPlayerTracks(poseCapture?.tracks ?? []);
      setPlayerChoice(poseCapture?.selectedTrackId ?? null);
      setFrames(f);
      setSource("video");
      setDuration(duration_s);
      setFrameDebug(debug ?? null);
      if (debug) {
        // Debug mode: inspect the selected frames instead of spending an API call.
        setStatus({ kind: "idle" });
        return;
      }
      if (isRecorded) {
        await submit(f, "video", duration_s);
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

  // Shared entry for recorded and uploaded clips: when several people are on
  // screen in the opening seconds, pause and let the user pin their player
  // before any analysis runs.
  async function handleVideo(blob: Blob, isRecorded: boolean) {
    setStatus({ kind: "reading" });
    setFrameDebug(null);
    setOpeningPick(null);
    clipRef.current = blob;
    setVideoUrl(isRecorded ? null : URL.createObjectURL(blob));
    try {
      const engine = poseRef.current ?? (await loadPoseEngine());
      poseRef.current = engine;
      if (engine && skill) {
        const opening = await detectOpeningPlayers(blob, engine);
        if (
          opening &&
          opening.persons.length >= 2 &&
          opening.duration_s <= MAX_CLIP_SECONDS + 0.5
        ) {
          captureRef.current = null;
          setPlayerTracks([]);
          setPlayerChoice(null);
          setFrames([]);
          setSource("video");
          setDuration(opening.duration_s);
          setOpeningPick({ ...opening, blob, isRecorded });
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

  function pickOpeningPlayer(index: number | null) {
    const opening = openingPick;
    if (!opening) return;
    setOpeningPick(null);
    setStatus({ kind: "reading" });
    let target: { x: number; y: number; t: number } | undefined;
    if (index != null && opening.persons[index]) {
      const pts = opening.persons[index];
      target = {
        x: (pts[LM.leftHip].x + pts[LM.rightHip].x) / 2,
        y: (pts[LM.leftHip].y + pts[LM.rightHip].y) / 2,
        t: opening.timeS,
      };
    }
    void runVideoExtraction(opening.blob, opening.isRecorded, target);
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

            {openingPick && (
              <div className="card mb-3 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
                  Who should I watch?
                </p>
                <p className="mt-1 text-xs text-chalk-dim">
                  Tap your player. Every measurement and score comes from them.
                </p>
                <div className="relative mt-3 overflow-hidden rounded-lg bg-navy">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={openingPick.dataUrl}
                    alt="Opening frame. Tap the player to analyze."
                    className="block w-full"
                  />
                  {openingPick.persons.map((pts, i) => {
                    const box = boxFromPts(pts);
                    if (!box) return null;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => pickOpeningPlayer(i)}
                        aria-label={`Analyze player ${i + 1}`}
                        className="absolute rounded-md border-2 border-chalk/50 transition-colors hover:border-gold focus-visible:border-gold"
                        style={{
                          left: `${box.left * 100}%`,
                          top: `${box.top * 100}%`,
                          width: `${box.width * 100}%`,
                          height: `${box.height * 100}%`,
                        }}
                      />
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => pickOpeningPlayer(null)}
                  className="chip mt-3 min-h-11"
                >
                  Let the app decide
                </button>
              </div>
            )}

            {playerTracks.length > 1 &&
              source === "video" &&
              frames.length > 0 &&
              (() => {
                const selected = playerChoice ?? playerTracks[0].id;
                const refTrack =
                  playerTracks.find((t) => t.id === selected) ?? playerTracks[0];
                const midT =
                  refTrack.frames[Math.floor(refTrack.frames.length / 2)]?.t ?? 0;
                let display = frames[0];
                for (const f of frames) {
                  if (
                    f.time_s != null &&
                    Math.abs(f.time_s - midT) <
                      Math.abs((display.time_s ?? 1e9) - midT)
                  ) {
                    display = f;
                  }
                }
                const boxes = playerTracks
                  .map((t) => ({
                    id: t.id,
                    box:
                      display.time_s != null ? trackBoxAt(t, display.time_s) : null,
                  }))
                  .filter(
                    (b): b is { id: number; box: NonNullable<typeof b.box> } =>
                      b.box != null,
                  );
                if (boxes.length < 2) return null;
                return (
                  <div className="card mb-3 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
                      Players detected
                    </p>
                    <p className="mt-1 text-xs text-chalk-dim">
                      Analyzing the player in the gold box. Tap another player to
                      switch.
                    </p>
                    <div className="relative mt-3 overflow-hidden rounded-lg bg-navy">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={display.dataUrl}
                        alt="Frame used to choose which player to analyze"
                        className="block w-full"
                      />
                      {boxes.map(({ id, box }, i) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => selectTrack(id)}
                          disabled={busy}
                          aria-pressed={id === selected}
                          aria-label={`Analyze player ${i + 1}${
                            id === selected ? " (selected)" : ""
                          }`}
                          className={`absolute rounded-md border-2 transition-colors ${
                            id === selected
                              ? "border-gold shadow-lift"
                              : "border-chalk/40 hover:border-gold/70"
                          }`}
                          style={{
                            left: `${box.left * 100}%`,
                            top: `${box.top * 100}%`,
                            width: `${box.width * 100}%`,
                            height: `${box.height * 100}%`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}

            {frames.length > 0 ? (
              <div className="reward-earned">
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
