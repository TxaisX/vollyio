import { MAX_FRAMES, MAX_BODY_BYTES } from "@/lib/analysis-types";
import {
  clampTrimWindow,
  type PlannedFrame,
  type FrameKind,
  type TrimWindow,
} from "./frame-select";
import { MAX_FRAME_DIM, VIDEO_FRAME_DIM, scaledSize } from "./frame-scale";
import {
  planFrameTimes,
  frameDimForKind,
  CORE_FRAME_DIM,
  normalizeFps,
  fpsFromSamples,
} from "./frame-plan";
import {
  BLANK_ABORT_RUN,
  blankFilterVerdict,
  isBlankStats,
  lumaStats,
} from "./frame-guard";
import type { Skill } from "./skills";

// Re-exported: callers have imported MAX_FRAME_DIM from this module since
// before the sizing rules were split out into their own pure file.
export { MAX_FRAME_DIM };

// A product limit, not a technical one. Nothing here can reliably pick one
// skill out of continuous play yet, so a long clip gets scored against
// whatever happened to be in frame. Ten seconds is about one rep plus the
// approach, which forces the player to choose the moment instead of us
// guessing at it. Raise this only when segmentation is proven, not when the
// request budget allows more.
export const MAX_CLIP_SECONDS = 10;

// Dense uniform sampler tuning (D-041): the coach sees the WHOLE window at a
// steady rate, never a motion-picked subset. Frames render smaller than the
// old sparse set so a full watch still fits the request budget.
const VIDEO_JPEG_QUALITY = 0.65;
const DENSE_FRAME_DIM = 1024;
// Sized to the movement, not to a round number. A spike arm swing from cocked
// to contact runs 120-160ms and a phase needs 4-5 frames before its sequence
// is readable rather than aliased, so the swing wants ~30ms between frames.
// MAX_FRAMES is the real ceiling (40 frames at 1024px already fills the 4MB
// body), which makes this a coverage-versus-resolution trade: 40 frames buys
// 20fps over 2s, 16fps over 2.5s, or 4fps over the full 10s window.
//
// At the old value of 6 a short window UNDERSPENT the budget: a 2s window
// asked for 12 frames when 40 were available. This only changes short windows,
// since anything past ~2s was already clamped by MAX_FRAMES.
const DENSE_FPS = 20;


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
  // Always empty since D-041 folded the extras pass into the dense send set.
  // Kept, deliberately, because the layers behind it are still wired end to end
  // and deleting this field alone would leave them live and lying. Retiring it
  // is one change across: lib/analysis-types.ts (MAX_STORED_FRAMES,
  // extra_frame_count), lib/analyze-request.ts, app/api/analyze/route.ts
  // (storedFramePaths), components/analyze-flow.tsx (uploadExtraFrames and
  // extrasRef), lib/security-contract.test.ts (the stored_frame_paths pin), and
  // a new migration retiring analyses.stored_frame_paths from the insert
  // trigger and the frames storage policies.
  extras: Frame[];
  debug?: FrameDebug;
};

export type ExtractOpts = {
  debug?: boolean;
  // The skill the player declared at upload. It decides where the frame budget
  // goes: each skill's contact phase gets the source's own frame rate and the
  // rest of the window stays gapless around it (D-061). Omitted falls back to
  // the uniform pass, so nothing depends on it being supplied.
  skill?: Skill;
  // A user-trimmed analysis window (absolute clip seconds). Every sampling
  // path stays inside it; omitted means the whole clip. Lets a long clip be
  // analyzed by choosing a window instead of being rejected outright.
  window?: TrimWindow;
  // The instant the player tapped their athlete (D-033). The send set is
  // guaranteed to include a frame at exactly this time, so the tap marker is
  // burned onto the moment the user actually chose rather than the nearest
  // sampled one, where the athlete may already have moved.
  markT?: number;
  // Internal to the blank-extraction retry (D-091): skip fps detection so the
  // element is NEVER played. Playback is one of the suspected poisoners on
  // mobile (it claims a decoder session and can move the element onto a
  // pipeline whose frames canvas cannot read), so the second attempt runs
  // cold, trading contact-phase sampling precision for frames that exist.
  noPlayback?: boolean;
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
  let video: HTMLVideoElement | null = null;
  try {
    video = await loadVideo(url);
    const t = Math.min(0.4, Math.max(0.05, video.duration / 2));
    await seekAndSettle(video, t);
    const [w, h] = scaledSize(
      video.videoWidth || 640,
      video.videoHeight || 360,
      VIDEO_FRAME_DIM,
    );
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, w, h);
    // A blank draw here gets two more presentation waits, then ships whatever
    // it has. Deliberately NOT a dead stop: this image is a poster, the player
    // aims their tap on the live scrub <video>, and t≈0.4s sits inside a
    // typical fade-from-black, so refusing a dark frame would reject
    // legitimate clips. Null stays reserved for video that cannot load at all.
    for (let retry = 0; retry < 2 && canvasLooksBlank(ctx, w, h); retry++) {
      await framePresentedOnce(video, BLANK_RETRY_WAIT_MS);
      ctx.drawImage(video, 0, 0, w, h);
    }
    return {
      dataUrl: canvas.toDataURL("image/jpeg", VIDEO_JPEG_QUALITY),
      timeS: video.currentTime,
      duration_s: video.duration,
    };
  } catch {
    return null;
  } finally {
    // Explicit decoder release, not just a dropped reference. Mobile decoders
    // are a capped pool per device; a detached element with a live src pins
    // one until GC, and this element's session would otherwise still be held
    // when the dense extraction loop asks for its own (D-091).
    if (video) releaseVideo(video);
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


// Frames are pulled client side, so playability is a property of the BROWSER
// the player is standing in, not of the file. The same iPhone clip that fails
// in desktop Chrome plays fine in Safari, because Chrome ships no HEVC decoder
// on most platforms.
//
// THESE STRINGS NO LONGER REACH A PLAYER, and nothing new may surface one
// (D-100). Every caller of loadVideo and extractFrames now treats a decode
// failure as a missing PREVIEW rather than a missing analysis: the clip is
// uploaded whole and read on the other side, where the container decodes fine,
// so telling somebody to change browser sends them somewhere that helps with
// nothing. They survive as the text of internal Errors, which is why they are
// still specific: a log line naming the decoder that failed is worth having.
// Anything shown to a player belongs in components/analyze-flow.tsx, where the
// no-preview copy lives together and says what happens next.

type Rvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    cb: (now: number, meta: { mediaTime: number; presentedFrames: number }) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

// How long a readiness wait may hold a frame. On iOS the decoded frame becomes
// drawable up to ~100ms AFTER 'seeked' fires, so the no-signal fallback covers
// that gap; where requestVideoFrameCallback exists the wait usually resolves in
// one frame time and the ceiling is only the wedge case.
const SETTLE_RVFC_MS = 250;
const SETTLE_FALLBACK_MS = 120;
const BLANK_RETRY_WAIT_MS = 120;

/**
 * Resolve once the element presents a new frame, or after `timeoutMs`.
 *
 * The callback is registered up front and ALWAYS cancelled on the way out: a
 * stale requestVideoFrameCallback left behind would fire on the NEXT seek's
 * frame and satisfy the wrong wait, which is exactly the off-by-one hazard
 * this file exists to remove. Where the API is missing (Firefox), the timeout
 * alone runs, a plain timer, never requestAnimationFrame, because rAF stops
 * in a backgrounded tab and would turn a mid-extraction tab switch into a
 * permanent hang.
 */
function framePresentedOnce(video: HTMLVideoElement, timeoutMs: number): Promise<void> {
  const v = video as Rvfc;
  if (typeof v.requestVideoFrameCallback !== "function") {
    return new Promise((resolve) => setTimeout(resolve, timeoutMs));
  }
  return new Promise((resolve) => {
    let settled = false;
    const handle = v.requestVideoFrameCallback!(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      v.cancelVideoFrameCallback?.(handle);
      resolve();
    }, timeoutMs);
  });
}

/**
 * Seek and wait until the sought frame is actually drawable, not merely sought.
 *
 * 'seeked' announces that the media timeline moved, NOT that the decoded frame
 * reached the element; drawing in the same task samples the old compositor
 * state, and below HAVE_CURRENT_DATA drawImage is a spec-mandated silent no-op
 * onto a transparent canvas that JPEG then flattens to solid black (D-091).
 * The presentation callback is registered BEFORE the seek is issued, attached
 * after 'seeked' it can miss a frame that already presented and then never
 * fire on a paused element.
 */
async function seekAndSettle(video: HTMLVideoElement, time: number): Promise<void> {
  const v = video as Rvfc;
  const hasRvfc = typeof v.requestVideoFrameCallback === "function";
  let presented = false;
  let presentedResolve: () => void = () => {};
  const presentedP = new Promise<void>((resolve) => {
    presentedResolve = resolve;
  });
  let handle = -1;
  if (hasRvfc) {
    handle = v.requestVideoFrameCallback!(() => {
      presented = true;
      presentedResolve();
    });
  }
  try {
    const didSeek = await seekTo(video, time);
    if (presented) return;
    // No seek was issued and a frame is already current: nothing new will
    // present, so waiting would burn the full grace period for nothing.
    if (!didSeek && video.readyState >= 2) return;
    await Promise.race([
      presentedP,
      new Promise<void>((resolve) =>
        setTimeout(resolve, hasRvfc ? SETTLE_RVFC_MS : SETTLE_FALLBACK_MS),
      ),
    ]);
  } finally {
    if (hasRvfc && !presented && handle >= 0) {
      v.cancelVideoFrameCallback?.(handle);
    }
  }
}

/**
 * Release a media element's decoder, explicitly.
 *
 * Mobile decode sessions are a small per-device pool (AVFoundation on iOS,
 * MediaCodec on Android), and a detached element with a live src pins its
 * session until garbage collection, which is invisible and late. During one
 * upload this page can otherwise hold FOUR elements on the same clip, the
 * preview player, the marking scrub video, the opening-frame element, and the
 * extraction element, and the last one to ask is the one that silently gets
 * no decoder and produces black (D-091).
 */
export function releaseVideo(video: HTMLVideoElement): void {
  try {
    video.pause();
    video.removeAttribute("src");
    video.load();
  } catch {
    // Teardown must never throw over the result it is cleaning up after.
  }
}

// The source's own frame rate, measured rather than assumed, because it sets
// the floor on stride: asking for frames closer together than the source
// contains just re-decodes the same image. requestVideoFrameCallback reports
// the presented-frame count against media time, which is exact where it
// exists; Firefox has no such API, so 30 is the fallback and the planner
// treats it as a normal value rather than a special case.
//
// The measurement doubles as a free health check: if play() ran for the full
// window and the presentation callback NEVER fired, this element is playing
// without presenting, decode is dead, and every seek-and-draw against it
// will come out black. `blind` reports that so the caller can skip straight to
// a fresh element instead of grinding through a doomed render pass.
export async function detectSourceFps(
  video: HTMLVideoElement,
): Promise<{ fps: number; blind: boolean }> {
  type Meta = { mediaTime: number; presentedFrames: number };
  const v = video as Rvfc;
  if (typeof v.requestVideoFrameCallback !== "function") {
    return { fps: 30, blind: false };
  }

  const wasMuted = video.muted;
  video.muted = true;
  try {
    return await new Promise<{ fps: number; blind: boolean }>((resolve) => {
      let first: Meta | null = null;
      let sawFrame = false;
      let playRejected = false;
      let settled = false;
      const finish = (fps: number) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        video.pause();
        // Blind only when playback genuinely ran and presented nothing: a
        // rejected play() (Low Power Mode, expired activation) proves only
        // that priming was refused, not that the element cannot decode.
        resolve({ fps: normalizeFps(fps), blind: !sawFrame && !playRejected });
      };
      // Measuring must never be able to hang an upload.
      const timer = setTimeout(() => finish(30), 1500);
      const step = (_now: number, meta: Meta) => {
        sawFrame = true;
        if (settled) return;
        if (!first) {
          first = { ...meta };
        } else {
          const measured = fpsFromSamples(first, meta);
          if (measured != null) return finish(measured);
        }
        v.requestVideoFrameCallback!(step);
      };
      v.requestVideoFrameCallback!(step);
      video.play().catch(() => {
        playRejected = true;
        finish(30);
      });
    });
  } finally {
    video.muted = wasMuted;
  }
}

export function videoErrorMessage(video: HTMLVideoElement): string {
  const code = video.error?.code;
  if (code === 4)
    return "This browser can't play that clip. iPhones record HEVC by default, which Chrome can't decode. Open Vollyio in Safari, or set your iPhone to Camera, Formats, Most Compatible and film it again.";
  if (code === 3)
    return "That video looks corrupted or only partly loaded. Re-export the clip and try again.";
  return "Couldn't read that video in this browser. Try Safari on iPhone, or re-export the clip as MP4.";
}

// Resolves true when a seek was actually issued, false when the element was
// already at the target time (no 'seeked' will fire, and no new frame will
// present). The 3s timeout still resolves rather than rejecting, a wedged
// seek must never dead-end extraction on its own, but callers no longer
// treat resolution as proof of a drawable frame: seekAndSettle waits for
// presentation and the render loop verifies pixels (D-091).
function seekTo(video: HTMLVideoElement, time: number): Promise<boolean> {
  return new Promise((resolve) => {
    // Seeking to the current time fires no 'seeked' event, resolve immediately.
    if (Math.abs(video.currentTime - time) < 1e-3) {
      resolve(false);
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      resolve(true);
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
    const timeout = setTimeout(() => {
      releaseVideo(video);
      reject(
        new Error(
          "This video is taking too long to load, which usually means the format isn't supported. Re-export the clip as MP4 or use the photo option below.",
        ),
      );
    }, 8000);
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
      releaseVideo(video);
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

type Rendered = { time_s: number; dataUrl: string; kind: FrameKind; blank: boolean };

// A render pass produced nothing usable. Internal control flow only: the
// entry point catches it, retries once on a fresh element, and only then
// surfaces a user-facing message. Never shown to a player as-is.
class BlankExtractionError extends Error {
  readonly blankExtraction = true;
}

// The guard samples pixels off a TINY canvas, not the full-size frame:
// getImageData on a 1024px canvas copies ~4MB per frame, on a 48x27 it copies
// 5KB. drawImage is a GPU blit either way, so verifying costs microseconds.
const GUARD_W = 48;
const GUARD_H = 27;

function canvasLooksBlank(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): boolean {
  // The guard itself must fail OPEN: if pixel readback is unavailable (iOS
  // canvas memory pressure), the frame is presumed real and extraction
  // proceeds exactly as it did before this guard existed. A guard that can
  // crash extraction is a new bug, not a fix.
  try {
    return isBlankStats(lumaStats(ctx.getImageData(0, 0, w, h).data));
  } catch {
    return false;
  }
}

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
  // One guard canvas for the whole pass, flagged for repeated readback.
  const guard = document.createElement("canvas");
  guard.width = GUARD_W;
  guard.height = GUARD_H;
  const guardCtx = guard.getContext("2d", { willReadFrequently: true });

  const out: Rendered[] = [];
  let blankRun = 0;
  for (const pf of planned) {
    await seekAndSettle(video, pf.timeS);
    // Verify PIXELS before spending the full-size encode. Presentation events
    // are advisory on the platforms that break; what came off the canvas is
    // the only signal that cannot lie about what the model would see.
    let blank = false;
    if (guardCtx) {
      guardCtx.drawImage(video, 0, 0, GUARD_W, GUARD_H);
      blank = canvasLooksBlank(guardCtx, GUARD_W, GUARD_H);
      for (let retry = 0; blank && retry < 2; retry++) {
        await framePresentedOnce(video, BLANK_RETRY_WAIT_MS);
        guardCtx.drawImage(video, 0, 0, GUARD_W, GUARD_H);
        blank = canvasLooksBlank(guardCtx, GUARD_W, GUARD_H);
      }
    }

    // Pixels follow the frame's role (D-061): contact frames keep full size,
    // approach and recovery frames render smaller. `dim` scales both together
    // so the over-budget fallback can shrink the whole set at once.
    const kindDim = Math.round(dim * (frameDimForKind(pf.kind) / CORE_FRAME_DIM));
    const [w, h] = scaledSize(vw, vh, kindDim, { upscale });
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
      blank,
    });

    // A frame-dead element costs seconds per frame in waits and retries;
    // grinding out sixty of them teaches nothing new after the eighth. Abandon
    // the pass and let the entry point try a fresh element.
    blankRun = blank ? blankRun + 1 : 0;
    if (blankRun >= BLANK_ABORT_RUN) {
      throw new BlankExtractionError(
        `render pass abandoned: ${blankRun} consecutive blank frames`,
      );
    }
  }
  return out;
}

// Render the planned frames and hold the request under MAX_BODY_BYTES.
async function finalizePlanned(
  video: HTMLVideoElement,
  planned: PlannedFrame[],
  dim = DENSE_FRAME_DIM,
): Promise<{ frames: Frame[]; chosen: { t: number; kind: FrameKind }[]; totalBytes: number }> {
  const budget = MAX_BODY_BYTES * 0.9;
  // Upscale on the primary pass only: a sub-target clip is worth interpolating
  // up to the budget. The fallback pass below exists because we are already
  // over budget, so enlarging there would be self-defeating.
  let rendered = await renderPlanned(video, planned, dim, VIDEO_JPEG_QUALITY, true);

  // Blank frames never reach the wire. Dropping happens HERE, before indices
  // are assigned below, so the sent set stays contiguous and the marker index
  // burnMark later computes refers to a frame that exists. A pass with too
  // little real content to send (fewer than the route's 2-frame minimum left)
  // fails wholesale and the entry point retries on a fresh element.
  const verdictOf = (set: Rendered[]) =>
    blankFilterVerdict(set.length, set.filter((r) => r.blank).length);
  if (verdictOf(rendered) === "fail-pass") {
    throw new BlankExtractionError("render pass produced no usable frames");
  }
  rendered = rendered.filter((r) => !r.blank);
  let total = rendered.reduce((a, r) => a + b64Bytes(r.dataUrl), 0);

  // Over budget → re-encode everything smaller and cheaper (one extra pass).
  if (total > budget) {
    rendered = await renderPlanned(video, planned, MAX_FRAME_DIM, 0.6);
    if (verdictOf(rendered) === "fail-pass") {
      throw new BlankExtractionError("render pass produced no usable frames");
    }
    rendered = rendered.filter((r) => !r.blank);
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
  skill?: Skill,
  sourceFps = 30,
): Promise<VideoExtraction> {
  const duration = video.duration;
  const startS = Math.max(0, win?.startS ?? 0);
  const endS = Math.min(duration, win?.endS ?? duration);
  const span = Math.max(0.1, endS - startS);

  // With a declared skill the budget is shaped to the movement: the contact
  // phase at the source's own frame rate, the rest gapless around it (D-061).
  // Without one, the original uniform pass, unchanged.
  let planned: PlannedFrame[];
  if (skill) {
    planned = planFrameTimes({
      window: { startS, endS },
      skill,
      sourceFps,
      maxFrames: MAX_FRAMES,
      markT,
    });
  } else {
    const count = Math.max(4, Math.min(MAX_FRAMES, Math.ceil(span * DENSE_FPS)));
    const step = span / count;
    planned = Array.from({ length: count }, (_, i) => ({
      timeS: Math.min(startS + step * (i + 0.5), Math.max(endS - 0.05, startS)),
      kind: "context" as const,
    }));
  }
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
  // Only worth measuring when a skill plan will actually use it, and never on
  // the no-playback retry pass.
  let sourceFps = 30;
  if (opts?.skill && !opts?.noPlayback) {
    const measured = await detectSourceFps(video);
    // Playback ran and presented nothing: every draw against this element
    // would come out black. Don't spend a doomed render pass proving it
    // frame by frame; fail now so the entry point brings a fresh element.
    if (measured.blind) {
      throw new BlankExtractionError("playback presented no frames");
    }
    sourceFps = measured.fps;
  }
  return sampleDense(video, opts?.debug ?? false, win, markT, opts?.skill, sourceFps);
}

// The end of the line, reached only after BOTH extraction passes produced
// nothing. NOT user-facing any more (D-100): the caller catches this and keeps
// going, because the cut clip is what the read is performed on and it is
// already in hand by the time this can throw. Left specific for the log.
const BLANK_CLIP_MESSAGE =
  "This browser handed back only black frames for that clip, so there was nothing to analyze and nothing was counted. Close other tabs or apps that are playing video and try again, or use Safari on iPhone, Chrome on Android. If it keeps happening, re-export the clip as MP4.";

async function extractOnePass(
  url: string,
  opts: ExtractOpts | undefined,
  noPlayback: boolean,
): Promise<VideoExtraction & { duration_s: number }> {
  const video = await loadVideo(url);
  try {
    const win = clampTrimWindow(video.duration, opts?.window ?? null);
    if (win.endS - win.startS > MAX_CLIP_SECONDS + 0.5) {
      throw new Error(
        opts?.window
          ? `That window is ${Math.round(win.endS - win.startS)}s. Keep the analyzed window to ${MAX_CLIP_SECONDS} seconds or less.`
          : `That clip is ${Math.round(video.duration)}s. Trim the analyzed window to ${MAX_CLIP_SECONDS} seconds or less.`,
      );
    }
    const extraction = await extractFramesFromVideo(video, { ...opts, noPlayback });
    return { ...extraction, duration_s: video.duration };
  } finally {
    // Whatever happened, this element's decoder goes back to the pool NOW.
    // Without the explicit release, the retry element below becomes the next
    // claimant against a session this one still pins (D-091).
    releaseVideo(video);
  }
}

export async function extractFrames(
  source: File | Blob,
  opts?: ExtractOpts,
): Promise<VideoExtraction & { duration_s: number }> {
  const url = URL.createObjectURL(source);
  try {
    try {
      return await extractOnePass(url, opts, opts?.noPlayback ?? false);
    } catch (err) {
      // Only the blank-extraction family earns a retry. Real errors (too-long
      // window, unplayable format) surface immediately with their own copy.
      if (!(err instanceof BlankExtractionError)) throw err;
    }
    // Second attempt: a FRESH element, never played. The first element has
    // been explicitly released, so this one is not competing with it for a
    // decoder; skipping playback also sidesteps every played-element failure
    // mode in one move. If this pass is blank too, the clip genuinely cannot
    // be read in this browser right now, and the player hears that honestly.
    try {
      return await extractOnePass(url, opts, true);
    } catch (err) {
      if (!(err instanceof BlankExtractionError)) throw err;
      throw new Error(BLANK_CLIP_MESSAGE);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

