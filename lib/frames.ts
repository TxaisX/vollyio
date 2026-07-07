export const MAX_FRAME_DIM = 768;
export const MAX_CLIP_SECONDS = 45;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type Frame = {
  index: number;
  time_s: number | null;
  dataUrl: string;
};

function sampleFractions(duration: number): number[] {
  if (duration <= 6) return [0.1, 0.3, 0.45, 0.55, 0.7, 0.88];
  const count = duration <= 20 ? 8 : 12;
  const inset = 0.05;
  const span = 1 - 2 * inset;
  return Array.from({ length: count }, (_, i) => inset + (span * i) / (count - 1));
}

function scaledSize(w: number, h: number): [number, number] {
  if (w > h && w > MAX_FRAME_DIM) return [MAX_FRAME_DIM, Math.round((h * MAX_FRAME_DIM) / w)];
  if (h > MAX_FRAME_DIM) return [Math.round((w * MAX_FRAME_DIM) / h), MAX_FRAME_DIM];
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
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
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

export async function extractFramesFromVideo(video: HTMLVideoElement): Promise<Frame[]> {
  const duration = video.duration;
  const [width, height] = scaledSize(
    video.videoWidth || 640,
    video.videoHeight || 360,
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const fractions = sampleFractions(duration);
  const frames: Frame[] = [];

  for (let i = 0; i < fractions.length; i++) {
    const t = Math.min(duration * fractions[i], Math.max(duration - 0.05, 0));
    await seekTo(video, t);
    ctx.drawImage(video, 0, 0, width, height);
    frames.push({
      index: i,
      time_s: Math.round(t * 10) / 10,
      dataUrl: canvas.toDataURL("image/jpeg", 0.6),
    });
  }
  return frames;
}

export async function extractFrames(source: File | Blob): Promise<{
  frames: Frame[];
  duration_s: number;
}> {
  const url = URL.createObjectURL(source);
  try {
    const video = await loadVideo(url);
    if (video.duration > MAX_CLIP_SECONDS + 0.5) {
      throw new Error(
        `That clip is ${Math.round(video.duration)}s. Trim it to ${MAX_CLIP_SECONDS} seconds or less and try again.`,
      );
    }
    const frames = await extractFramesFromVideo(video);
    return { frames, duration_s: video.duration };
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
