import { MAX_FRAMES, MAX_BODY_BYTES } from "@/lib/analysis-types";
import {
  buildProbeTimes,
  findPeaks,
  planFrameTimes,
  planExtraStoreTimes,
  type Peak,
  type PlannedFrame,
  type FrameKind,
} from "./frame-select";
import type { PoseEngine } from "./pose/engine";
import type {
  LandmarkFrame,
  MeasurementsBlock,
  PersonFrame,
  PersonTrack,
} from "./pose/types";
import { buildMeasurementsBlock } from "./pose/metrics";
import {
  buildTracks,
  dedupePersons,
  focusRegionAround,
  hipCenter,
  type FocusRegion,
} from "./pose/kinematics";
import { LM } from "./pose/types";
import type { Skill } from "./skills";

export const MAX_FRAME_DIM = 768;
export const MAX_CLIP_SECONDS = 45;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Content-aware sampler tuning (video only; the photo path is unchanged).
const VIDEO_FRAME_DIM = 960; // final video frames render larger than photos
const VIDEO_JPEG_QUALITY = 0.7;
const SCAN_DIM = 144; // tiny throwaway canvas for the motion scan
const PROBE_COUNT = 24;
const SCAN_TIME_BUDGET_MS = 6000;
const SHORT_CLIP_SECONDS = 6; // below this, skip the scan and sample uniformly
const NOISE_FLOOR = 12; // per-pixel luminance diff below this is treated as noise

// Motion-tracking capture tuning. Tracking is strictly additive: any failure
// or budget overrun degrades to the exact pre-existing pipeline.
export const STORE_FRAMES = 24; // stored permanently; only the send set ships to the model
const POSE_PROBE_BUDGET_MS = 4000; // probe landmarks stop consuming time after this
const DENSE_WINDOW_S = 1.2; // dense capture reaches this far around each peak
const DENSE_WINDOW_MAX_FRAMES = 48;
const DENSE_TOTAL_BUDGET_MS = 9000;

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
  poseProbeCount?: number;
  denseCount?: number;
  denseMs?: number;
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
};

export type VideoExtraction = {
  frames: Frame[];
  extras: Frame[];
  pose: PoseCapture | null;
  debug?: FrameDebug;
};

export type ExtractOpts = {
  debug?: boolean;
  pose?: {
    engine: PoseEngine;
    skill: Skill;
    // A user-pinned focus player: normalized hip-center position at a clip
    // time. Track selection anchors to this instead of the activity ranking,
    // and detection zooms into a region around it so a small, distant player
    // still registers. box is the user's drawn frame, when they drew one.
    target?: { x: number; y: number; t: number; box?: FocusRegion };
  };
};

// Follows the framed player through the capture passes: detection runs on a
// padded crop around their last known position, re-centering on every hit.
// A few consecutive misses widen back to the full frame; a full-frame hit
// near the last known position re-tightens the zoom.
function createFocusTracker(target: NonNullable<ExtractOpts["pose"]>["target"]): {
  region(): FocusRegion | undefined;
  update(frame: PersonFrame | null): void;
} | null {
  if (!target) return null;
  const box = target.box ?? null;
  let region: FocusRegion | null = focusRegionAround(target.x, target.y, box);
  let misses = 0;
  let lastX = target.x;
  let lastY = target.y;
  return {
    region: () => region ?? undefined,
    update(frame) {
      const persons = frame?.persons ?? [];
      let best: { x: number; y: number } | null = null;
      let bestD = Infinity;
      for (const pts of persons) {
        const c = hipCenter(pts);
        if (!c) continue;
        const d = Math.hypot(c.x - lastX, c.y - lastY);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (!best) {
        if (region && ++misses >= 3) region = null;
        return;
      }
      // On a widened (full-frame) pass, only re-lock near the lost position.
      if (!region && bestD > 0.3) return;
      misses = 0;
      lastX = best.x;
      lastY = best.y;
      region = focusRegionAround(best.x, best.y, box);
    },
  };
}

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
  engine: PoseEngine,
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
    const probeTimes = [0.4, 1.2, 2.4].filter((t) => t < video.duration - 0.05);
    let fallback: OpeningPlayers | null = null;
    for (const t of probeTimes) {
      await seekTo(video, t);
      let frame: PersonFrame | null = null;
      try {
        frame = await engine.detectPersonsFromVideo(video, video.currentTime);
      } catch {
        frame = null;
      }
      const persons = frame ? dedupePersons(frame.persons) : [];
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

// Pass A: seek through probe timestamps and score motion by luminance
// frame-differencing on a tiny canvas. Throws on time budget → uniform
// fallback. When a tracking engine is provided, the same seek pass also
// collects a probe landmark frame until the pose sub-budget runs out; that
// part is best-effort garnish and can never fail the scan.
async function scanMotion(
  video: HTMLVideoElement,
  probeTimes: number[],
  engine?: PoseEngine,
  tracker?: ReturnType<typeof createFocusTracker>,
): Promise<{ motion: number[]; poseFrames: PersonFrame[] }> {
  const [w, h] = scaledSize(video.videoWidth || 640, video.videoHeight || 360, SCAN_DIM);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const motion = new Array(probeTimes.length).fill(0);
  const poseFrames: PersonFrame[] = [];
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

    if (engine && Date.now() - start <= POSE_PROBE_BUDGET_MS) {
      try {
        const frame = await engine.detectPersonsFromVideo(
          video,
          video.currentTime,
          tracker?.region(),
        );
        if (frame) poseFrames.push(frame);
        tracker?.update(frame);
      } catch {
        // Probe landmarks are optional; the luminance scan is the contract.
      }
    }
  }
  return { motion, poseFrames };
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

// Stage 2: play short muted segments around each peak and collect dense
// landmark frames. Serial detection while the video plays in real time; the
// effective capture rate is whatever the device manages inside the budget.
async function captureDenseWindows(
  video: HTMLVideoElement,
  engine: PoseEngine,
  peakTimes: number[],
  duration: number,
  tracker?: ReturnType<typeof createFocusTracker>,
): Promise<{ frames: PersonFrame[]; denseFps: number | null; denseMs: number }> {
  const frames: PersonFrame[] = [];
  const deadline = Date.now() + DENSE_TOTAL_BUDGET_MS;
  const started = Date.now();
  let coveredS = 0;

  const sorted = [...peakTimes].sort((a, b) => a - b);
  let lastEnd = 0;
  for (const peak of sorted) {
    if (Date.now() >= deadline) break;
    const startS = Math.max(0.05, peak - DENSE_WINDOW_S, lastEnd);
    const endS = Math.min(duration - 0.05, peak + DENSE_WINDOW_S);
    if (endS - startS < 0.3) continue;
    lastEnd = endS;

    try {
      await seekTo(video, startS);
      await video.play();
    } catch {
      continue;
    }

    let captured = 0;
    while (
      !video.ended &&
      video.currentTime < endS &&
      captured < DENSE_WINDOW_MAX_FRAMES &&
      Date.now() < deadline
    ) {
      const presented = await nextVideoFrame(video);
      if (!presented) break;
      try {
        const frame = await engine.detectPersonsFromVideo(
          video,
          video.currentTime,
          tracker?.region(),
        );
        if (frame) {
          frames.push(frame);
          captured++;
        }
        tracker?.update(frame);
      } catch {
        break;
      }
    }
    video.pause();
    coveredS += Math.max(0, Math.min(video.currentTime, endS) - startS);
  }

  const denseMs = Date.now() - started;
  const denseFps = coveredS > 0.2 ? Math.round((frames.length / coveredS) * 10) / 10 : null;
  return { frames, denseFps, denseMs };
}

// Snap luminance peaks to measured rep contacts when tracking found reps
// close by; contact instants are where the frames must land.
function refinePeaks(peaks: Peak[], contacts: number[]): Peak[] {
  if (contacts.length === 0) return peaks;
  const used = new Set<number>();
  return peaks.map((peak) => {
    let best = -1;
    let bestD = 0.8;
    contacts.forEach((c, i) => {
      const d = Math.abs(c - peak.timeS);
      if (!used.has(i) && d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best < 0) return peak;
    used.add(best);
    return { timeS: contacts[best], score: peak.score };
  });
}

type Rendered = { time_s: number; dataUrl: string; kind: FrameKind };

async function renderPlanned(
  video: HTMLVideoElement,
  planned: PlannedFrame[],
  dim: number,
  quality: number,
): Promise<Rendered[]> {
  const [w, h] = scaledSize(video.videoWidth || 640, video.videoHeight || 360, dim);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const out: Rendered[] = [];
  for (const pf of planned) {
    await seekTo(video, pf.timeS);
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
): Promise<VideoExtraction | null> {
  const duration = video.duration;
  const probeTimes = buildProbeTimes(duration, PROBE_COUNT);
  const scanStart = Date.now();
  // Each chronological pass gets its own tracker so both start from the
  // user's anchor rather than wherever the previous pass ended.
  const { motion, poseFrames } = await scanMotion(
    video,
    probeTimes,
    pose?.engine,
    createFocusTracker(pose?.target),
  );
  const scanMs = Date.now() - scanStart;

  const peaks = findPeaks(motion, probeTimes);
  if (peaks.length === 0) return null;

  // Stage 2 + measurement: strictly additive, every failure leaves the
  // luminance plan untouched. Multi-player footage becomes per-person tracks;
  // the strongest track (most active, most prominent) is followed by default
  // and the rest ride along for the focus-player picker.
  let landmarks: LandmarkFrame[] = [];
  let measurements: MeasurementsBlock | null = null;
  let denseFps: number | null = null;
  let denseMs = 0;
  let contacts: number[] = [];
  let tracks: PersonTrack[] = [];
  let selectedTrackId: number | null = null;
  if (pose) {
    try {
      const dense = await captureDenseWindows(
        video,
        pose.engine,
        peaks.map((p) => p.timeS),
        duration,
        createFocusTracker(pose.target),
      );
      denseMs = dense.denseMs;
      denseFps = dense.denseFps;
      const personFrames = [...poseFrames, ...dense.frames].sort((a, b) => a.t - b.t);
      tracks = buildTracks(personFrames);
      let chosen = tracks[0] ?? null;
      // A user-pinned player overrides the activity ranking: pick the track
      // whose hip center sits closest to the tap at the anchored moment.
      const target = pose.target;
      if (target && tracks.length > 1) {
        let bestD = 0.35;
        for (const track of tracks) {
          let near: LandmarkFrame | null = null;
          let nearD = 1.5;
          for (const f of track.frames) {
            const d = Math.abs(f.t - target.t);
            if (d < nearD) {
              nearD = d;
              near = f;
            }
          }
          if (!near) continue;
          const cx = (near.pts[LM.leftHip].x + near.pts[LM.rightHip].x) / 2;
          const cy = (near.pts[LM.leftHip].y + near.pts[LM.rightHip].y) / 2;
          const d = Math.hypot(cx - target.x, cy - target.y);
          if (d < bestD) {
            bestD = d;
            chosen = track;
          }
        }
      }
      if (chosen) {
        selectedTrackId = chosen.id;
        landmarks = chosen.frames;
        measurements = buildMeasurementsBlock(pose.skill, landmarks, denseFps);
        contacts = (measurements?.reps ?? [])
          .map((r) => r.contact_s)
          .filter((c): c is number => c != null);
      }
    } catch {
      measurements = null;
      tracks = [];
      selectedTrackId = null;
    }
  }

  const coarseInterval = probeTimes.length > 1 ? probeTimes[1] - probeTimes[0] : 0;
  const planned = planFrameTimes(duration, refinePeaks(peaks, contacts), coarseInterval, MAX_FRAMES);
  if (planned.length < 2) return null;

  const { frames, chosen, totalBytes } = await finalizePlanned(video, planned);

  // Extra frames for permanent storage; never part of the request body, so
  // no byte budget applies. Failure to render extras is non-fatal.
  let extras: Frame[] = [];
  try {
    const extraPlan = planExtraStoreTimes(duration, planned, STORE_FRAMES);
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
        curve: probeTimes.map((t, i) => ({
          t: Math.round(t * 10) / 10,
          score: Math.round(motion[i] * 100) / 100,
        })),
        chosen,
        scanMs,
        fellBack: false,
        totalBytes,
        poseProbeCount: poseFrames.length,
        denseCount: landmarks.length,
        denseMs,
        repContacts: contacts.map((c) => Math.round(c * 10) / 10),
      }
    : undefined;

  return {
    frames,
    extras,
    pose: pose ? { landmarks, measurements, denseFps, tracks, selectedTrackId } : null,
    debug,
  };
}

async function sampleUniform(video: HTMLVideoElement): Promise<Frame[]> {
  const duration = video.duration;
  const planned: PlannedFrame[] = sampleFractions(duration).map((frac) => ({
    timeS: Math.min(duration * frac, Math.max(duration - 0.05, 0)),
    kind: "context" as const,
  }));
  const { frames } = await finalizePlanned(video, planned);
  return frames;
}

export async function extractFramesFromVideo(
  video: HTMLVideoElement,
  opts?: ExtractOpts,
): Promise<VideoExtraction> {
  if (video.duration > SHORT_CLIP_SECONDS) {
    try {
      const result = await sampleContentAware(video, opts?.debug ?? false, opts?.pose);
      if (result) return result;
    } catch {
      // Any failure (slow seeks, decode, getImageData) degrades to uniform.
    }
  }
  const frames = await sampleUniform(video);
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
    if (video.duration > MAX_CLIP_SECONDS + 0.5) {
      throw new Error(
        `That clip is ${Math.round(video.duration)}s. Trim it to ${MAX_CLIP_SECONDS} seconds or less and try again.`,
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
