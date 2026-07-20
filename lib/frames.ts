import { MAX_FRAMES, MAX_BODY_BYTES } from "@/lib/analysis-types";
import {
  clampTrimWindow,
  type PlannedFrame,
  type FrameKind,
  type TrimWindow,
} from "./frame-select";
import { MAX_FRAME_DIM, VIDEO_FRAME_DIM, scaledSize } from "./frame-scale";

// Re-exported: callers have imported MAX_FRAME_DIM from this module since
// before the sizing rules were split out into their own pure file.
export { MAX_FRAME_DIM };

export const MAX_CLIP_SECONDS = 45;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Dense uniform sampler tuning (D-041): the coach sees the WHOLE window at a
// steady rate, never a motion-picked subset. Frames render smaller than the
// old sparse set so a full watch still fits the request budget.
const VIDEO_JPEG_QUALITY = 0.65;
const DENSE_FRAME_DIM = 1024;
const DENSE_FPS = 6;


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

export type VideoExtraction = {
  frames: Frame[];
  extras: Frame[];
  debug?: FrameDebug;
};

export type ExtractOpts = {
  debug?: boolean;
  // A user-trimmed analysis window (absolute clip seconds). Every sampling
  // path stays inside it; omitted means the whole clip. Lets a long clip be
  // analyzed by choosing a window instead of being rejected outright.
  window?: TrimWindow;
  // The instant the player tapped their athlete (D-033). The send set is
  // guaranteed to include a frame at exactly this time, so the tap marker is
  // burned onto the moment the user actually chose rather than the nearest
  // sampled one, where the athlete may already have moved.
  markT?: number;
};

// The opening of the clip: a rendered frame from the first second plus the
// duration, so the player can scrub to a moment and mark their athlete.
// Null only when the video is unreadable.
export type OpeningFrame = {
  dataUrl: string;
  timeS: number;
  duration_s: number;
};

export async function openingFrame(source: File | Blob): Promise<OpeningFrame | null> {
  const url = URL.createObjectURL(source);
  try {
    const video = await loadVideo(url);
    const t = Math.min(0.4, Math.max(0.05, video.duration / 2));
    await seekTo(video, t);
    const [w, h] = scaledSize(
      video.videoWidth || 640,
      video.videoHeight || 360,
      VIDEO_FRAME_DIM,
    );
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
    return {
      dataUrl: canvas.toDataURL("image/jpeg", VIDEO_JPEG_QUALITY),
      timeS: video.currentTime,
      duration_s: video.duration,
    };
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


export function videoErrorMessage(video: HTMLVideoElement): string {
  const code = video.error?.code;
  if (code === 4)
    return "This browser can't decode that file. iPhone clips are often HEVC, which desktop Chrome can't play. Re-export the clip as MP4, or use the photo option below.";
  if (code === 3)
    return "That video looks corrupted or only partly loaded. Re-export the clip, or use the photo option below.";
  return "Couldn't read that video in this browser. Try a different export of the clip, or use the photo option below.";
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
            "This video is taking too long to load, which usually means the format isn't supported. Re-export the clip as MP4 or use the photo option below.",
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

// Guarantee the plan contains a frame at exactly the marked instant, replacing
// the nearest planned frame so the count never exceeds the send budget. The
// marked frame is a peak: the byte-budget trimmer never drops peaks, so the
// one frame carrying the tap marker cannot be the one that gets cut.
function injectMarkTime(planned: PlannedFrame[], markT: number): PlannedFrame[] {
  if (planned.length === 0) return [{ timeS: markT, kind: "peak" }];
  let nearest = 0;
  let nearestD = Infinity;
  planned.forEach((p, i) => {
    const d = Math.abs(p.timeS - markT);
    if (d < nearestD) {
      nearestD = d;
      nearest = i;
    }
  });
  const out = planned.slice();
  out[nearest] = { timeS: markT, kind: "peak" };
  return out.sort((a, b) => a.timeS - b.timeS);
}

type Rendered = { time_s: number; dataUrl: string; kind: FrameKind };

async function renderPlanned(
  video: HTMLVideoElement,
  planned: PlannedFrame[],
  dim: number,
  quality: number,
  upscale = false,
): Promise<Rendered[]> {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 360;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  // Interpolation quality matters when the source is being enlarged; the
  // default nearest-ish resampling produces blocky limbs the model then has to
  // read through.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const out: Rendered[] = [];
  for (const pf of planned) {
    await seekTo(video, pf.timeS);
    const [w, h] = scaledSize(vw, vh, dim, { upscale });
    canvas.width = w;
    canvas.height = h;
    // Canvas resets context state when the backing size changes.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
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
  // Upscale on the primary pass only: a sub-target clip is worth interpolating
  // up to the budget. The fallback pass below exists because we are already
  // over budget, so enlarging there would be self-defeating.
  let rendered = await renderPlanned(video, planned, DENSE_FRAME_DIM, VIDEO_JPEG_QUALITY, true);
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

async function sampleDense(
  video: HTMLVideoElement,
  wantDebug: boolean,
  win?: TrimWindow,
  markT?: number,
): Promise<VideoExtraction> {
  const duration = video.duration;
  const startS = Math.max(0, win?.startS ?? 0);
  const endS = Math.min(duration, win?.endS ?? duration);
  const span = Math.max(0.1, endS - startS);

  // Uniform coverage of the WHOLE window: near video rate on short clips,
  // spread evenly when the window is longer than the frame budget covers.
  const count = Math.max(4, Math.min(MAX_FRAMES, Math.ceil(span * DENSE_FPS)));
  const step = span / count;
  let planned: PlannedFrame[] = Array.from({ length: count }, (_, i) => ({
    timeS: Math.min(startS + step * (i + 0.5), Math.max(endS - 0.05, startS)),
    kind: "context" as const,
  }));
  if (markT != null) planned = injectMarkTime(planned, markT);

  const { frames, chosen, totalBytes } = await finalizePlanned(video, planned);

  const debug: FrameDebug | undefined = wantDebug
    ? {
        curve: [],
        chosen,
        scanMs: 0,
        fellBack: false,
        totalBytes,
      }
    : undefined;

  // The dense send set IS the record; no separate extras pass remains.
  return { frames, extras: [], debug };
}

export async function extractFramesFromVideo(
  video: HTMLVideoElement,
  opts?: ExtractOpts,
): Promise<VideoExtraction> {
  const win = clampTrimWindow(video.duration, opts?.window ?? null);
  const markT =
    opts?.markT != null
      ? Math.min(Math.max(opts.markT, win.startS + 0.02), Math.max(win.startS + 0.02, win.endS - 0.05))
      : undefined;
  return sampleDense(video, opts?.debug ?? false, win, markT);
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
