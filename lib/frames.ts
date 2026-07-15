import { MAX_FRAMES, MAX_STORED_FRAMES, MAX_BODY_BYTES } from "@/lib/analysis-types";
import {
  buildProbeTimes,
  clampTrimWindow,
  findPeaks,
  planFrameTimes,
  planFromPose,
  planExtraStoreTimes,
  type PlannedFrame,
  type FrameKind,
  type TrimWindow,
} from "./frame-select";
import type { PoseEngine } from "./pose/engine";
import type {
  BallPoint,
  LandmarkFrame,
  MeasurementsBlock,
  PersonFrame,
  PersonTrack,
} from "./pose/types";
import { cleanBallTrack } from "./pose/ball-track";
import { buildMeasurementsBlock } from "./pose/metrics";
import {
  buildTracks,
  dedupePersons,
  focusPoint,
  offerPersons,
  pickTargetTrack,
  speedPeakTimes,
  type FocusRegion,
} from "./pose/kinematics";
import { trackContinuity, type TrackContinuity } from "./pose/track-state";
import type { Skill } from "./skills";

export const MAX_FRAME_DIM = 768;
export const MAX_CLIP_SECONDS = 45;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Content-aware sampler tuning (video only; the photo path is unchanged).
const VIDEO_FRAME_DIM = 1568; // final video frames render larger than photos
const VIDEO_JPEG_QUALITY = 0.7;
const SCAN_DIM = 144; // tiny throwaway canvas for the motion scan
const PROBE_COUNT = 24;
const SCAN_TIME_BUDGET_MS = 6000;
const SHORT_CLIP_SECONDS = 6; // below this, skip the scan and sample uniformly
const NOISE_FLOOR = 12; // per-pixel luminance diff below this is treated as noise

// Motion-tracking capture tuning. Tracking is strictly additive: any failure
// or budget overrun degrades to the luminance-scan pipeline.
export const STORE_FRAMES = MAX_STORED_FRAMES; // stored permanently; only the send set ships to the model
// The full-clip pass plays in real time; the wall clock only intervenes when
// playback stalls well beyond the window it should cover.
const FULL_PASS_SLACK_FACTOR = 2.5;
const FULL_PASS_SLACK_MS = 20_000;

export type Frame = {
  index: number;
  time_s: number | null;
  dataUrl: string;
};

export type FrameDebug = {
  curve: { t: number; score: number }[];
  chosen: { t: number; kind: FrameKind }[];
  scanMs: number;
  fellBack: boolean;
  totalBytes: number;
  trackedFrames?: number;
  passMs?: number;
  repContacts?: number[];
};

export type PoseCapture = {
  // The followed athlete's series (top-ranked track by default).
  landmarks: LandmarkFrame[];
  measurements: MeasurementsBlock | null;
  denseFps: number | null;
  // Every athlete tracked through the clip, strongest first, so the flow can
  // offer a different focus player and recompute without re-extracting.
  tracks: PersonTrack[];
  selectedTrackId: number | null;
  // How the follow went: coverage plus evidenced occlusions and frame exits.
  continuity: TrackContinuity | null;
  // Cleaned on-device ball path (D-019), full-frame normalized, timed.
  ball: BallPoint[];
};

export type VideoExtraction = {
  frames: Frame[];
  extras: Frame[];
  pose: PoseCapture | null;
  debug?: FrameDebug;
};

export type ExtractOpts = {
  debug?: boolean;
  // A user-trimmed analysis window (absolute clip seconds). Every sampling
  // path stays inside it; omitted means the whole clip. Lets a long clip be
  // analyzed by choosing a window instead of being rejected outright.
  window?: TrimWindow;
  // Full-clip tracking progress, 0..1 across the trimmed window.
  onProgress?: (pct: number) => void;
  pose?: {
    engine: PoseEngine;
    skill: Skill;
    // A user-picked focus player: normalized focus-point position at a clip
    // time. Track selection anchors to this instead of the activity ranking,
    // and the engine prioritizes the person nearest it on slow tiers. box is
    // the detected body's bounds at that moment.
    target?: { x: number; y: number; t: number; box?: FocusRegion };
  };
};

// The opening of the clip: a rendered frame from the first seconds plus any
// people detected in it, so the player can frame who to follow. persons is
// empty when nobody was detected yet; null only when the video is unreadable.
export type OpeningPlayers = {
  dataUrl: string;
  timeS: number;
  persons: LandmarkFrame["pts"][];
  duration_s: number;
};

export async function detectOpeningPlayers(
  source: File | Blob,
  engine: PoseEngine | null,
): Promise<OpeningPlayers | null> {
  const url = URL.createObjectURL(source);
  try {
    const video = await loadVideo(url);
    const render = () => {
      const [w, h] = scaledSize(
        video.videoWidth || 640,
        video.videoHeight || 360,
        VIDEO_FRAME_DIM,
      );
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
      return canvas.toDataURL("image/jpeg", VIDEO_JPEG_QUALITY);
    };
    // Without an engine one probe still yields the framing frame: the player
    // draws who to follow themselves, and detection is skipped entirely.
    const probeTimes = (engine ? [0.4, 1.2, 2.4] : [0.4]).filter(
      (t) => t < video.duration - 0.05,
    );
    if (probeTimes.length === 0 && video.duration > 0.15) {
      probeTimes.push(video.duration / 2);
    }
    let fallback: OpeningPlayers | null = null;
    for (const t of probeTimes) {
      await seekTo(video, t);
      let frame: PersonFrame | null = null;
      if (engine) {
        try {
          frame = await engine.detectPersonsFromVideo(video, video.currentTime);
        } catch {
          frame = null;
        }
      }
      // High-confidence people are offered first; when nobody clears the
      // bar, the best available detections still give the player a choice.
      const persons = frame ? offerPersons(dedupePersons(frame.persons)) : [];
      if (persons.length > 0) {
        return {
          dataUrl: render(),
          timeS: video.currentTime,
          persons,
          duration_s: video.duration,
        };
      }
      if (!fallback) {
        fallback = {
          dataUrl: render(),
          timeS: video.currentTime,
          persons: [],
          duration_s: video.duration,
        };
      }
    }
    return fallback;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sampleFractions(duration: number): number[] {
  if (duration <= 6) return [0.1, 0.3, 0.45, 0.55, 0.7, 0.88];
  const count = duration <= 20 ? 8 : 12;
  const inset = 0.05;
  const span = 1 - 2 * inset;
  return Array.from({ length: count }, (_, i) => inset + (span * i) / (count - 1));
}

function scaledSize(w: number, h: number, maxDim = MAX_FRAME_DIM): [number, number] {
  if (w > h && w > maxDim) return [maxDim, Math.round((h * maxDim) / w)];
  if (h > maxDim) return [Math.round((w * maxDim) / h), maxDim];
  return [w, h];
}

export function videoErrorMessage(video: HTMLVideoElement): string {
  const code = video.error?.code;
  if (code === 4)
    return "This browser can't decode that file. iPhone clips are often HEVC, which desktop Chrome can't play. Record in-app instead, or use the photo option below.";
  if (code === 3)
    return "That video looks corrupted or only partly loaded. Re-export the clip, or use the photo option below.";
  return "Couldn't read that video in this browser. Try recording in-app, or use the photo option below.";
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    // Seeking to the current time fires no 'seeked' event — resolve immediately.
    if (Math.abs(video.currentTime - time) < 1e-3) {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    const onSeeked = () => finish();
    // Safety net: a missed 'seeked' event must never wedge extraction.
    const timer = setTimeout(finish, 3000);
    video.addEventListener("seeked", onSeeked);
    video.currentTime = time;
  });
}

export function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = src;
    const timeout = setTimeout(
      () =>
        reject(
          new Error(
            "This video is taking too long to load, which usually means the format isn't supported. Record in-app or use the photo option below.",
          ),
        ),
      8000,
    );
    video.onloadedmetadata = () => {
      if (!video.videoWidth || !video.videoHeight) {
        clearTimeout(timeout);
        reject(new Error(videoErrorMessage(video)));
        return;
      }
      if (Number.isFinite(video.duration)) {
        clearTimeout(timeout);
        resolve(video);
        return;
      }
      // Freshly recorded streams report an infinite duration until the
      // element is forced to seek to the end; wait for the real value.
      video.ondurationchange = () => {
        if (!Number.isFinite(video.duration)) return;
        video.ondurationchange = null;
        video.currentTime = 0;
        clearTimeout(timeout);
        resolve(video);
      };
      video.currentTime = 1e101;
    };
    video.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(videoErrorMessage(video)));
    };
    video.load();
  });
}

function b64Bytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  return comma < 0 ? dataUrl.length : dataUrl.length - comma - 1;
}

// Fallback pass: seek through probe timestamps and score motion by luminance
// frame-differencing on a tiny canvas. Throws on time budget → uniform
// fallback. Only runs when the tracking engine is absent or its full-clip
// pass produced nothing to plan from.
async function scanMotion(video: HTMLVideoElement, probeTimes: number[]): Promise<number[]> {
  const [w, h] = scaledSize(video.videoWidth || 640, video.videoHeight || 360, SCAN_DIM);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const motion = new Array(probeTimes.length).fill(0);
  let prev: Uint8Array | null = null;
  const start = Date.now();

  for (let i = 0; i < probeTimes.length; i++) {
    if (Date.now() - start > SCAN_TIME_BUDGET_MS) throw new Error("scan-timeout");
    await seekTo(video, probeTimes[i]);
    ctx.drawImage(video, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const lum = new Uint8Array(w * h);
    for (let p = 0, q = 0; p < data.length; p += 4, q++) {
      lum[q] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
    }
    if (prev) {
      let acc = 0;
      for (let q = 0; q < lum.length; q++) {
        const d = Math.abs(lum[q] - prev[q]);
        if (d > NOISE_FLOOR) acc += d;
      }
      motion[i] = acc / lum.length;
    }
    prev = lum;
  }
  return motion;
}

// Wait until the video presents its next frame; falls back to a short timer
// when requestVideoFrameCallback is unavailable.
function nextVideoFrame(video: HTMLVideoElement, timeoutMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    type WithRvfc = HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    const rvfc = (video as WithRvfc).requestVideoFrameCallback;
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    if (typeof rvfc === "function") {
      rvfc.call(video, () => finish(true));
    } else {
      finish(false);
    }
  });
}

// Seek stride when real-time playback cannot drive the pass (see below).
const FULL_PASS_STEP_S = 1 / 12;

// The tracking pass: play the whole trimmed window once at real speed and
// detect on every presented frame the device keeps up with. Slow devices
// simply skip frames (detection is serial); coverage stays wall-to-wall.
// requestVideoFrameCallback only fires while the page composites, so a
// hidden tab (or a browser that never presents a detached video) drops the
// pass into deterministic seek-stepping instead of losing coverage.
async function captureFullClip(
  video: HTMLVideoElement,
  engine: PoseEngine,
  startS: number,
  endS: number,
  target?: NonNullable<ExtractOpts["pose"]>["target"],
  onProgress?: (pct: number) => void,
): Promise<{
  frames: PersonFrame[];
  balls: BallPoint[];
  effectiveFps: number | null;
  passMs: number;
}> {
  const frames: PersonFrame[] = [];
  const balls: BallPoint[] = [];
  const started = Date.now();
  const span = Math.max(0.1, endS - startS);
  const deadline = started + span * 1000 * FULL_PASS_SLACK_FACTOR + FULL_PASS_SLACK_MS;
  // The focus hint follows the picked player between frames; it only steers
  // which person gets pose priority on slow tiers, never what is detected.
  let hint: { x: number; y: number } | null = target ? { x: target.x, y: target.y } : null;

  let playing = false;
  try {
    await seekTo(video, Math.max(0.05, startS));
  } catch {
    return { frames, balls, effectiveFps: null, passMs: Date.now() - started };
  }
  try {
    await video.play();
    playing = true;
  } catch {
    playing = false;
  }

  while (!video.ended && video.currentTime < endS && Date.now() < deadline) {
    if (playing) {
      const presented = await nextVideoFrame(video);
      if (!presented) {
        // No composited frame: fall back to stepping from right here.
        playing = false;
        video.pause();
        continue;
      }
    } else {
      const next = video.currentTime + FULL_PASS_STEP_S;
      if (next >= endS - 0.02) break;
      await seekTo(video, next);
    }
    try {
      const frame = await engine.detectPersonsFromVideo(
        video,
        video.currentTime,
        undefined,
        hint,
      );
      if (frame?.ball) balls.push(frame.ball);
      if (frame && frame.persons.length > 0) {
        frames.push(frame);
        if (hint) {
          let best: { x: number; y: number } | null = null;
          let bestD = 0.3;
          for (const pts of frame.persons) {
            const c = focusPoint(pts);
            if (!c) continue;
            const d = Math.hypot(c.x - hint.x, c.y - hint.y);
            if (d < bestD) {
              bestD = d;
              best = c;
            }
          }
          if (best) hint = best;
        }
      }
    } catch {
      break;
    }
    onProgress?.(Math.min(1, (video.currentTime - startS) / span));
  }
  video.pause();

  const passMs = Date.now() - started;
  const coveredS = Math.max(0, Math.min(video.currentTime, endS) - startS);
  const effectiveFps =
    coveredS > 0.2 ? Math.round((frames.length / coveredS) * 10) / 10 : null;
  return { frames, balls, effectiveFps, passMs };
}

type Rendered = { time_s: number; dataUrl: string; kind: FrameKind };

async function renderPlanned(
  video: HTMLVideoElement,
  planned: PlannedFrame[],
  dim: number,
  quality: number,
): Promise<Rendered[]> {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 360;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const out: Rendered[] = [];
  for (const pf of planned) {
    await seekTo(video, pf.timeS);
    const [w, h] = scaledSize(vw, vh, dim);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    out.push({
      // Read the ACTUAL post-seek frame time so time_s matches the image the
      // model sees (the route maps frame_index → time_s from this value).
      time_s: Math.round(video.currentTime * 10) / 10,
      dataUrl: canvas.toDataURL("image/jpeg", quality),
      kind: pf.kind,
    });
  }
  return out;
}

// Render the planned frames and hold the request under MAX_BODY_BYTES.
async function finalizePlanned(
  video: HTMLVideoElement,
  planned: PlannedFrame[],
): Promise<{ frames: Frame[]; chosen: { t: number; kind: FrameKind }[]; totalBytes: number }> {
  const budget = MAX_BODY_BYTES * 0.9;
  let rendered = await renderPlanned(video, planned, VIDEO_FRAME_DIM, VIDEO_JPEG_QUALITY);
  let total = rendered.reduce((a, r) => a + b64Bytes(r.dataUrl), 0);

  // Over budget → re-encode everything smaller and cheaper (one extra pass).
  if (total > budget) {
    rendered = await renderPlanned(video, planned, MAX_FRAME_DIM, 0.6);
    total = rendered.reduce((a, r) => a + b64Bytes(r.dataUrl), 0);
  }
  // Still over → drop the heaviest context frames (never a peak/burst, never
  // below the 2-frame minimum the route requires).
  while (total > budget && rendered.length > 2 && rendered.some((r) => r.kind === "context")) {
    let worst = -1;
    let worstBytes = -1;
    rendered.forEach((r, i) => {
      if (r.kind !== "context") return;
      const b = b64Bytes(r.dataUrl);
      if (b > worstBytes) {
        worstBytes = b;
        worst = i;
      }
    });
    rendered.splice(worst, 1);
    total = rendered.reduce((a, r) => a + b64Bytes(r.dataUrl), 0);
  }

  const frames = rendered.map((r, index) => ({
    index,
    time_s: r.time_s,
    dataUrl: r.dataUrl,
  }));
  const chosen = rendered.map((r) => ({ t: r.time_s, kind: r.kind }));
  return { frames, chosen, totalBytes: total };
}

async function sampleContentAware(
  video: HTMLVideoElement,
  wantDebug: boolean,
  pose?: ExtractOpts["pose"],
  win?: TrimWindow,
  onProgress?: (pct: number) => void,
): Promise<VideoExtraction | null> {
  const duration = video.duration;
  // The trimmed window bounds every path; full-clip tracking covers all of
  // it regardless of where the player confirmed their pick.
  const startS = Math.max(0, win?.startS ?? 0);
  const endS = Math.min(duration, win?.endS ?? duration);

  // Tracking pass + measurement. Multi-player footage becomes per-person
  // tracks; the picked player's track is followed (or the strongest track
  // when analysis was started without a pick).
  let landmarks: LandmarkFrame[] = [];
  let measurements: MeasurementsBlock | null = null;
  let effectiveFps: number | null = null;
  let passMs = 0;
  let contacts: number[] = [];
  let tracks: PersonTrack[] = [];
  let selectedTrackId: number | null = null;
  let continuity: TrackContinuity | null = null;
  let ballTrack: BallPoint[] = [];
  let planned: PlannedFrame[] = [];
  const coarseInterval = Math.max(0.1, (endS - startS) / PROBE_COUNT);

  if (pose) {
    try {
      const pass = await captureFullClip(
        video,
        pose.engine,
        startS,
        endS,
        pose.target,
        onProgress,
      );
      passMs = pass.passMs;
      effectiveFps = pass.effectiveFps;
      ballTrack = cleanBallTrack(pass.balls);
      tracks = buildTracks(pass.frames);
      // A user-picked player overrides the activity ranking. When no track
      // matches the pick, choose NOBODY rather than silently analyzing a
      // different player; the flow surfaces the miss.
      const target = pose.target;
      const chosen = target ? pickTargetTrack(tracks, target) : (tracks[0] ?? null);
      if (chosen) {
        selectedTrackId = chosen.id;
        landmarks = chosen.frames;
        measurements = buildMeasurementsBlock(
          pose.skill,
          landmarks,
          effectiveFps,
          pose.engine.modelName,
          "full",
        );
        contacts = (measurements?.reps ?? [])
          .map((r) => r.contact_s)
          .filter((c): c is number => c != null);
        continuity = trackContinuity(landmarks);
        if (measurements && continuity) {
          // Session stats ride the existing numeric record: the coaching
          // service learns how much of the play the follow actually covered.
          measurements.session.tracked_coverage =
            Math.round(continuity.coverage * 100) / 100;
          const exits = continuity.absences.filter((a) => a.kind === "off_frame").length;
          if (exits > 0) measurements.session.frame_exits = exits;
        }
        // The sent frames come from the measured motion itself: rep contacts
        // first, strongest wrist-speed instants after.
        planned = planFromPose(
          endS,
          contacts,
          speedPeakTimes(landmarks),
          coarseInterval,
          MAX_FRAMES,
          startS,
        );
      }
    } catch {
      measurements = null;
      tracks = [];
      selectedTrackId = null;
      continuity = null;
      ballTrack = [];
      landmarks = [];
      planned = [];
    }
  }

  // Luminance fallback plan: no engine, engine failure, or nobody tracked.
  let fallbackCurve: { t: number; score: number }[] = [];
  let scanMs = 0;
  if (planned.length < 2) {
    const probeTimes = buildProbeTimes(endS, PROBE_COUNT, startS);
    const scanStart = Date.now();
    const motion = await scanMotion(video, probeTimes);
    scanMs = Date.now() - scanStart;
    const peaks = findPeaks(motion, probeTimes);
    if (peaks.length === 0) return null;
    fallbackCurve = probeTimes.map((t, i) => ({
      t: Math.round(t * 10) / 10,
      score: Math.round(motion[i] * 100) / 100,
    }));
    planned = planFrameTimes(
      endS,
      peaks,
      probeTimes.length > 1 ? probeTimes[1] - probeTimes[0] : coarseInterval,
      MAX_FRAMES,
      startS,
    );
  }
  if (planned.length < 2) return null;

  const { frames, chosen, totalBytes } = await finalizePlanned(video, planned);

  // Extra frames for permanent storage; never part of the request body, so
  // no byte budget applies. Failure to render extras is non-fatal.
  let extras: Frame[] = [];
  try {
    const extraPlan = planExtraStoreTimes(endS, planned, STORE_FRAMES, startS);
    if (extraPlan.length > 0) {
      const renderedExtras = await renderPlanned(video, extraPlan, VIDEO_FRAME_DIM, VIDEO_JPEG_QUALITY);
      extras = renderedExtras.map((r, i) => ({
        index: frames.length + i,
        time_s: r.time_s,
        dataUrl: r.dataUrl,
      }));
    }
  } catch {
    extras = [];
  }

  const debug: FrameDebug | undefined = wantDebug
    ? {
        curve: fallbackCurve,
        chosen,
        scanMs,
        fellBack: false,
        totalBytes,
        trackedFrames: landmarks.length,
        passMs,
        repContacts: contacts.map((c) => Math.round(c * 10) / 10),
      }
    : undefined;

  return {
    frames,
    extras,
    pose: pose
      ? {
          landmarks,
          measurements,
          denseFps: effectiveFps,
          tracks,
          selectedTrackId,
          continuity,
          ball: ballTrack,
        }
      : null,
    debug,
  };
}

async function sampleUniform(
  video: HTMLVideoElement,
  startS = 0,
  endS = video.duration,
): Promise<Frame[]> {
  const span = Math.max(0.1, endS - startS);
  const planned: PlannedFrame[] = sampleFractions(span).map((frac) => ({
    timeS: Math.min(startS + span * frac, Math.max(endS - 0.05, startS)),
    kind: "context" as const,
  }));
  const { frames } = await finalizePlanned(video, planned);
  return frames;
}

export async function extractFramesFromVideo(
  video: HTMLVideoElement,
  opts?: ExtractOpts,
): Promise<VideoExtraction> {
  // The trimmed window bounds every path. With a tracking engine the full
  // pass runs even on short clips (it is cheap there); without one, short
  // clips go straight to uniform sampling.
  const win = clampTrimWindow(video.duration, opts?.window ?? null);
  if (opts?.pose || win.endS - win.startS > SHORT_CLIP_SECONDS) {
    try {
      const result = await sampleContentAware(
        video,
        opts?.debug ?? false,
        opts?.pose,
        win,
        opts?.onProgress,
      );
      if (result) return result;
    } catch {
      // Any failure (slow seeks, decode, getImageData) degrades to uniform.
    }
  }
  const frames = await sampleUniform(video, win.startS, win.endS);
  const debug: FrameDebug | undefined = opts?.debug
    ? {
        curve: [],
        chosen: frames.map((f) => ({ t: f.time_s ?? 0, kind: "context" as const })),
        scanMs: 0,
        fellBack: true,
        totalBytes: frames.reduce((a, f) => a + b64Bytes(f.dataUrl), 0),
      }
    : undefined;
  return { frames, extras: [], pose: null, debug };
}

export async function extractFrames(
  source: File | Blob,
  opts?: ExtractOpts,
): Promise<VideoExtraction & { duration_s: number }> {
  const url = URL.createObjectURL(source);
  try {
    const video = await loadVideo(url);
    const win = clampTrimWindow(video.duration, opts?.window ?? null);
    if (win.endS - win.startS > MAX_CLIP_SECONDS + 0.5) {
      throw new Error(
        opts?.window
          ? `That window is ${Math.round(win.endS - win.startS)}s. Keep the analyzed window to ${MAX_CLIP_SECONDS} seconds or less.`
          : `That clip is ${Math.round(video.duration)}s. Trim the analyzed window to ${MAX_CLIP_SECONDS} seconds or less.`,
      );
    }
    const extraction = await extractFramesFromVideo(video, opts);
    return { ...extraction, duration_s: video.duration };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Could not decode that image. It may be corrupted or unsupported."));
    img.src = dataUrl;
  });
}

async function resizeDataUrl(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const [width, height] = scaledSize(
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

export async function extractFramesFromPhotos(files: File[]): Promise<Frame[]> {
  if (files.length < 2) {
    throw new Error("Pick at least 2-3 photos so there is a sequence to read.");
  }
  if (files.length > MAX_FRAMES) {
    throw new Error(`Pick up to ${MAX_FRAMES} photos - the sequence reads best under that.`);
  }
  const bad = files.find((f) => !ALLOWED_IMAGE_TYPES.includes(f.type));
  if (bad) {
    throw new Error(
      `"${bad.name}" isn't a JPG, PNG, or WEBP. iPhone photos are often HEIC. Pick "Most Compatible" in Settings > Camera > Formats, or take a screenshot instead.`,
    );
  }
  const raw = await Promise.all(files.map(readDataUrl));
  const resized = await Promise.all(raw.map(resizeDataUrl));
  return resized.map((dataUrl, index) => ({ index, time_s: null, dataUrl }));
}
