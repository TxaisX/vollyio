import { loadVideo, releaseVideo } from "@/lib/frames";

/**
 * Cut the analyzed window out of a player's upload, in the browser.
 *
 * The app has never needed this: the frame path extracts stills and the trim
 * window only ever decided WHICH stills. Sending video needs the bytes
 * themselves, and `clipRef` holds the whole untrimmed upload, which for a phone
 * recording is routinely minutes long and tens of megabytes. Uploading that to
 * be told about one rep is wrong on cost and on the request budget both.
 *
 * There is no server-side option. ffmpeg is not on the function runtime and
 * `scripts/cut-eval-clips.mjs` is a developer tool that shells out to a local
 * binary. So the cut happens here, by playing the window through a canvas and
 * recording what the canvas draws.
 *
 * ON OUTPUT QUALITY, AND A MISTAKE WORTH NOT REPEATING. The provider samples
 * video at roughly one low-resolution image per second (VIDEO_TOKENS_PER_SECOND
 * in lib/ai/vision.ts), and this module first shipped at 720px / 1.2 Mbps on
 * the reasoning that detail beyond that gets discarded anyway. That reasoning
 * is wrong, and the first end-to-end run proved it: a setting clip the model
 * rated 5/10 from its original file came back REFUSED after the trim, with
 * "the player is too far away and the footage is too blurry to observe hand
 * shape". Sampling RATE and image LEGIBILITY are different things. The model
 * takes few frames and still needs those frames sharp, and a player filmed from
 * the sideline is small in frame before anything is compressed. Pre-shrinking
 * here compounds with the provider's own downsample and lands under readable.
 *
 * So the budget is set by the request instead: 1080px at ~2.5 Mbps puts a 10
 * second window near 3 MB, which is the most that survives base64 inside a
 * reasonable body cap. Shrink further only with a measured reason.
 */

const DEFAULT_MAX_WIDTH = 1080;
const DEFAULT_BITS_PER_SECOND = 2_500_000;
// Was 15, which visibly cost detail on a dark clip. Re-encoding is already the
// slow, lossy path; there is no reason to also starve it of frames.
const DEFAULT_CAPTURE_FPS = 30;
// Largest source we will forward untouched. 3 MB of binary is ~4 MB of base64,
// which is the production body cap exactly, so this leaves the JSON envelope
// its own room.
const DEFAULT_PASSTHROUGH_MAX_BYTES = 2_800_000;

// The source's own container, narrowed to what the provider dispatches on. An
// unrecognised type is not forwarded: re-encoding produces a mime we chose.
function passthroughMime(type: string): string | null {
  const t = (type || "").toLowerCase();
  if (t.includes("mp4")) return "video/mp4";
  if (t.includes("webm")) return "video/webm";
  if (t.includes("quicktime") || t.includes("mov")) return "video/quicktime";
  return null;
}

// MP4 first: it is what the eval harness has exercised against this provider
// since 2026-08-04, and what Safari emits. WebM is the Chrome/Firefox answer
// and the provider accepts it too, so the negotiation never has to fail over
// to "unsupported" on a desktop browser.
const CANDIDATE_TYPES = [
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

export type TrimmedClip = {
  blob: Blob;
  /** Bare MIME type, no codecs parameter: what the provider dispatches on. */
  mime: string;
  duration_s: number;
};

function supportedType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of CANDIDATE_TYPES) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

/**
 * Whether this browser can cut a clip at all. Callers check BEFORE promising
 * the player an analysis: an older iOS Safari has no MediaRecorder, and finding
 * that out after the upload has already been accepted turns a graceful fallback
 * into a dead end.
 */
export function canTrimVideo(): boolean {
  if (typeof document === "undefined") return false;
  if (supportedType() === null) return false;
  const canvas = document.createElement("canvas");
  return typeof canvas.captureStream === "function";
}

export type TrimOptions = {
  startS: number;
  endS: number;
  maxWidth?: number;
  bitsPerSecond?: number;
  captureFps?: number;
  passthroughMaxBytes?: number;
};

export async function trimClip(source: Blob, opts: TrimOptions): Promise<TrimmedClip> {
  const mimeWithCodecs = supportedType();
  if (mimeWithCodecs === null) {
    throw new Error(
      "This browser can't trim video. On iPhone open Vollyio in Safari, or use the photo option below.",
    );
  }

  const url = URL.createObjectURL(source);
  let video: HTMLVideoElement | null = null;
  try {
    video = await loadVideo(url);

    const startS = Math.max(0, opts.startS);
    const endS = Math.min(video.duration || opts.endS, opts.endS);
    const span = endS - startS;
    if (!(span > 0)) throw new Error("That trim window is empty.");

    // Nothing to cut and it already fits: forward the player's own bytes.
    //
    // This is not an optimisation, it is a correctness fix. Re-encoding through
    // a canvas is lossy, and on the first live run it turned a clip the model
    // had rated 5/10 into one it REFUSED as "too low, dark and blurry" while
    // also costing 2.3 seconds of the player's time. Whenever the window is the
    // whole clip and the file is inside the request budget, every one of those
    // costs buys nothing at all. Short reps filmed deliberately are the common
    // case in this product, so this path is the one most players take.
    const keepWhole =
      startS <= 0.05 && endS >= (video.duration || endS) - 0.05;
    const sourceMime = passthroughMime(source.type);
    if (
      keepWhole &&
      sourceMime !== null &&
      source.size <= (opts.passthroughMaxBytes ?? DEFAULT_PASSTHROUGH_MAX_BYTES)
    ) {
      return { blob: source, mime: sourceMime, duration_s: video.duration || span };
    }

    // Preserve aspect. A source narrower than the cap is never upscaled: that
    // would spend bitrate inventing pixels the source never had.
    const scale = Math.min(1, (opts.maxWidth ?? DEFAULT_MAX_WIDTH) / video.videoWidth);
    const canvas = document.createElement("canvas");
    // Even dimensions: H.264 chroma subsampling rejects odd ones, and the
    // failure surfaces as a recorder that starts and produces nothing.
    canvas.width = Math.max(2, Math.round((video.videoWidth * scale) / 2) * 2);
    canvas.height = Math.max(2, Math.round((video.videoHeight * scale) / 2) * 2);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser couldn't prepare the clip.");

    const captureFps = opts.captureFps ?? DEFAULT_CAPTURE_FPS;
    const stream = canvas.captureStream(captureFps);
    const recorder = new MediaRecorder(stream, {
      mimeType: mimeWithCodecs,
      videoBitsPerSecond: opts.bitsPerSecond ?? DEFAULT_BITS_PER_SECOND,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const finished = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error("Recording the clip failed."));
    });

    video.currentTime = startS;
    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        video?.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video?.addEventListener("seeked", onSeeked);
    });

    recorder.start();
    await video.play();

    // Draw on every presented frame where the browser exposes them, so the
    // recording follows real decode rather than a timer that drifts against it.
    // rAF is the fallback and is close enough at this bitrate.
    let stopped = false;
    const finish = () => {
      if (stopped) return;
      stopped = true;
      try {
        video?.pause();
        recorder.stop();
      } catch {
        // Already stopping; the recorder's own onstop still resolves.
      }
    };
    // Trimming to the very end of a source is the common case, and there the
    // draw loop can never observe the end: rVFC and rAF both stop firing once
    // playback finishes, so the condition below is never re-evaluated and the
    // stall guard ends up being what stops the recording, eight seconds late.
    // Shipping without this made a 2.2s clip take 10.3s to cut.
    video.addEventListener("ended", finish, { once: true });
    const draw = () => {
      if (stopped || !video) return;
      if (video.currentTime >= endS || video.ended) {
        finish();
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      schedule();
    };
    const rvfc = (
      video as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number;
      }
    ).requestVideoFrameCallback;
    const schedule = rvfc
      ? () => rvfc.call(video, draw)
      : () => requestAnimationFrame(draw);
    schedule();

    // Real-time capture, so the ceiling is the window plus slack for a slow
    // decoder. Without it a stalled source hangs the analysis with no message.
    const guard = setTimeout(() => finish(), (span + 8) * 1000);

    await finished;
    clearTimeout(guard);
    video.removeEventListener("ended", finish);
    for (const track of stream.getTracks()) track.stop();

    const mime = mimeWithCodecs.split(";")[0];
    const blob = new Blob(chunks, { type: mime });
    if (blob.size === 0) {
      throw new Error("That clip came out empty. Re-export it as MP4 and try again.");
    }
    return { blob, mime, duration_s: span };
  } finally {
    // D-091: mobile decode sessions are a small pool and a detached element
    // with a live src pins one until GC. Release before the next element asks.
    if (video) releaseVideo(video);
    URL.revokeObjectURL(url);
  }
}

/** base64 payload only, no `data:` prefix, which is what readVideo expects. */
export async function clipToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  // Chunked: String.fromCharCode(...buf) blows the argument limit on anything
  // above a few hundred KB, and a trimmed clip is megabytes.
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
