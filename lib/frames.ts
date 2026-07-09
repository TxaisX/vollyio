import { MAX_FRAMES, MAX_BODY_BYTES } from "@/lib/analysis-types";
import {
  buildProbeTimes,
  findPeaks,
  planFrameTimes,
  type PlannedFrame,
  type FrameKind,
} from "./frame-select";

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
};

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
      clearTimeout(timeout);
      if (!video.videoWidth || !video.videoHeight) {
        reject(new Error(videoErrorMessage(video)));
        return;
      }
      resolve(video);
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
// frame-differencing on a tiny canvas. Throws on time budget → uniform fallback.
async function scanMotion(
  video: HTMLVideoElement,
  probeTimes: number[],
): Promise<number[]> {
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
): Promise<{ frames: Frame[]; debug?: FrameDebug } | null> {
  const duration = video.duration;
  const probeTimes = buildProbeTimes(duration, PROBE_COUNT);
  const scanStart = Date.now();
  const motion = await scanMotion(video, probeTimes);
  const scanMs = Date.now() - scanStart;

  const peaks = findPeaks(motion, probeTimes);
  if (peaks.length === 0) return null;

  const coarseInterval = probeTimes.length > 1 ? probeTimes[1] - probeTimes[0] : 0;
  const planned = planFrameTimes(duration, peaks, coarseInterval, MAX_FRAMES);
  if (planned.length < 2) return null;

  const { frames, chosen, totalBytes } = await finalizePlanned(video, planned);
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
      }
    : undefined;
  return { frames, debug };
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
  opts?: { debug?: boolean },
): Promise<{ frames: Frame[]; debug?: FrameDebug }> {
  if (video.duration > SHORT_CLIP_SECONDS) {
    try {
      const result = await sampleContentAware(video, opts?.debug ?? false);
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
  return { frames, debug };
}

export async function extractFrames(
  source: File | Blob,
  opts?: { debug?: boolean },
): Promise<{ frames: Frame[]; duration_s: number; debug?: FrameDebug }> {
  const url = URL.createObjectURL(source);
  try {
    const video = await loadVideo(url);
    if (video.duration > MAX_CLIP_SECONDS + 0.5) {
      throw new Error(
        `That clip is ${Math.round(video.duration)}s. Trim it to ${MAX_CLIP_SECONDS} seconds or less and try again.`,
      );
    }
    const { frames, debug } = await extractFramesFromVideo(video, opts);
    return { frames, duration_s: video.duration, debug };
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
      reject(new Error("Could not decode that image — it may be corrupted or unsupported."));
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
      `"${bad.name}" isn't a JPG, PNG, or WEBP. iPhone photos are often HEIC — pick "Most Compatible" in Settings > Camera > Formats, or take a screenshot instead.`,
    );
  }
  const raw = await Promise.all(files.map(readDataUrl));
  const resized = await Promise.all(raw.map(resizeDataUrl));
  return resized.map((dataUrl, index) => ({ index, time_s: null, dataUrl }));
}
