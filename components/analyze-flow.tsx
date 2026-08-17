"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SkillPicker } from "@/components/skill-picker";
import { Filmstrip } from "@/components/filmstrip";
import { createClient } from "@/lib/supabase/client";
import {
  extractFrames,
  openingFrame,
  MAX_CLIP_SECONDS,
  type Frame,
  type FrameDebug,
  type OpeningFrame,
} from "@/lib/frames";
import { canTrimVideo, trimClip, type TrimmedClip } from "@/lib/video-clip";
import { Reveal } from "@/components/motion";
import { LimitNotice } from "@/components/limit-notice";
import { ClaimAccountNotice } from "@/components/claim-account-notice";
import { TesterInvite } from "@/components/tester-invite";
import { TEST_COUNTS_TOWARD_PRODUCTION } from "@/lib/android-test";
import {
  analyzeFailureStatus,
  type AnalyzeErrorBody,
} from "@/lib/analyze-status";
import { planFromReason, resetDateOf } from "@/lib/allowance";
import {
  SKILL_LABEL,
  ANALYZE_DISCIPLINES,
  DISCIPLINE_LABEL,
  type Skill,
  type Discipline,
} from "@/lib/skills";
import type { Plan } from "@/lib/plans";
import {
  clampTrimWindow,
  clockStamp,
  MIN_TRIM_SPAN_S,
  type TrimWindow,
} from "@/lib/frame-select";
import { scaledSize, SPOT_FRAME_DIM } from "@/lib/frame-scale";
import { MAX_CLIP_BYTES } from "@/lib/analysis-types";
// TYPE-ONLY, both of them, so neither zod nor the request schema is pulled into
// the browser bundle. The body is typed from the SCHEMA the route validates
// against rather than from AnalyzeRequest in lib/analysis-types.ts, because the
// schema is what actually decides whether a request is accepted: focus_label
// (D-100) is a wire field the route reads and nothing stores, and typing the
// body off the validator is what stops the client and the route drifting.
import type { z } from "zod";
import type { analyzeRequestSchema } from "@/lib/analyze-request";

type AnalyzeBody = z.infer<typeof analyzeRequestSchema>;

type Status =
  | { kind: "idle" | "reading" | "sending" }
  | { kind: "error"; message: string }
  | {
      kind: "unavailable";
      message: string;
      // Set only for a 402: the monthly allowance is spent, as opposed to the
      // hourly limit or a capacity outage, which are the other two calm states.
      // Read from the HTTP status rather than inferred from the body, because a
      // body lost in transit must not turn a paywall back into a retry button
      // that is guaranteed to be refused again.
      exhausted?: boolean;
      // Which plan ran out, when the reason survived the trip. Null means the
      // 402 arrived without one; the offer then stays available rather than
      // naming a plan nobody read.
      plan?: Plan | null;
      // The reset date, formatted from the raw instant in the body.
      resetsOn?: string | null;
      // D-118. The 402 was an anonymous player's spent free read, so the card
      // asks for an account instead of a payment. Carried explicitly rather
      // than inferred from a null plan: a plan that simply failed to survive
      // the trip is also null, and that case must keep showing the offer.
      needsAccount?: boolean;
    };

// Whether there is anything to sell. `lib/billing.ts` owns the server-side view
// of this variable, but that module is server-only, so the client reads the
// public var itself. Unset means no paid tier has shipped: render no offer at
// all rather than a button that leads nowhere.
//
// A signal, not a destination. The offer starts checkout directly through
// /api/stripe/checkout; nothing in the product sends a player to the plan page
// to press a second button.
const CAN_BUY = (process.env.NEXT_PUBLIC_UPGRADE_URL?.trim() || null) !== null;

// The tap that marks the athlete: a normalized point in the frame at a clip
// time. Just a coordinate; nothing on the device interprets it (D-033).
type Mark = { x: number; y: number; t: number };

// Two-handle trim bar over the clip timeline: the gold span is the analyzed
// window. Drag a handle (or use arrow keys on it; Shift steps bigger) to
// shorten the window to the reps that matter.
function TrimBar({
  duration,
  trim,
  onMove,
}: {
  duration: number;
  trim: TrimWindow;
  onMove: (which: "start" | "end", toS: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<"start" | "end" | null>(null);

  function timeAt(e: React.PointerEvent): number | null {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    return frac * duration;
  }

  function onPointerMove(e: React.PointerEvent) {
    const which = dragRef.current;
    if (!which) return;
    const t = timeAt(e);
    if (t != null) onMove(which, t);
  }

  const pct = (s: number) => `${(s / Math.max(0.1, duration)) * 100}%`;

  const slider = (which: "start" | "end") => ({
    role: "slider" as const,
    tabIndex: 0,
    "aria-label": which === "start" ? "Analysis window start" : "Analysis window end",
    "aria-valuemin": 0,
    "aria-valuemax": Math.round(duration * 10) / 10,
    "aria-valuenow": Math.round((which === "start" ? trim.startS : trim.endS) * 10) / 10,
    "aria-valuetext": clockStamp(which === "start" ? trim.startS : trim.endS),
    onKeyDown: (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 1 : 0.2;
      const cur = which === "start" ? trim.startS : trim.endS;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        onMove(which, cur - step);
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        onMove(which, cur + step);
      }
    },
    onPointerDown: (e: React.PointerEvent) => {
      dragRef.current = which;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove,
    onPointerUp: () => {
      dragRef.current = null;
    },
  });

  const handleClass =
    "absolute top-1/2 h-6 w-3 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize rounded-sm bg-gold shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

  return (
    <div className="mt-3">
      <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-chalk-dim">
        <span>Analysis window</span>
        <span>
          Analyze {clockStamp(trim.startS)} to {clockStamp(trim.endS)}
        </span>
      </div>
      <div
        ref={trackRef}
        className="relative mt-1.5 h-8 touch-none rounded bg-navy-light"
      >
        <span
          aria-hidden
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gold/45"
          style={{ left: pct(trim.startS), width: pct(trim.endS - trim.startS) }}
        />
        <span {...slider("start")} className={handleClass} style={{ left: pct(trim.startS) }} />
        <span {...slider("end")} className={handleClass} style={{ left: pct(trim.endS) }} />
      </div>
    </div>
  );
}

// Burn a hollow gold ring around the marked athlete onto the frame nearest the
// tap instant. Hollow so the body underneath stays fully visible: the mark
// must identify the athlete without hiding the thing being judged. Returns the
// frames (originals untouched) plus which index carries the ring, or null when
// no frame decoded.
async function burnMark(
  rawFrames: Frame[],
  mark: Mark,
): Promise<{ frames: Frame[]; markerIndex: number } | null> {
  let nearest = -1;
  let nearestD = Infinity;
  rawFrames.forEach((f, i) => {
    if (f.time_s == null) return;
    const d = Math.abs(f.time_s - mark.t);
    if (d < nearestD) {
      nearestD = d;
      nearest = i;
    }
  });
  if (nearest < 0) return null;
  const f = rawFrames[nearest];
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
        const W = canvas.width;
        const H = canvas.height;
        const cx = mark.x * W;
        const cy = mark.y * H;
        // A SOFT GLOW, not a ring.
        //
        // This was a hollow gold circle, and it was drawn hollow so the body
        // underneath stayed visible: the mark has to identify the athlete
        // without hiding the thing being judged. That constraint has not
        // changed, but the ring was a heavy way to meet it. It had to be large
        // enough to contain a player, so on a phone it read as a bulky sticker
        // sitting on top of the footage, and its hard edge competed with the
        // very body it was pointing at.
        //
        // A radial gradient meets the same constraint more quietly. It is
        // brightest slightly off centre and falls to nothing at the rim, so the
        // athlete is lit rather than enclosed and nothing is occluded at any
        // point. `lighter` composites it as added light, which is why the
        // player stays fully legible underneath instead of being tinted.
        //
        // Radius is a little wider than the old ring, because a gradient needs
        // room to fall off; it reads smaller regardless, since the eye takes
        // the bright core as the mark rather than the outer edge.
        const r = Math.max(26, Math.min(W, H) * 0.085);
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        glow.addColorStop(0, gold);
        glow.addColorStop(0.45, gold);
        glow.addColorStop(1, gold);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        // The falloff lives in alpha rather than in the colour stops, so the
        // glow keeps one hue and simply fades. Stopping at 0.52 keeps the core
        // short of blowing out to white on light sand or a bright gym floor.
        ctx.globalAlpha = 0.52;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // One faint dark ring at the very rim, well outside the glow's bright
        // core. Not decoration: on pale footage an added-light glow can wash out
        // almost entirely, and this keeps the mark findable without returning to
        // a hard outline. `navy` is the app's own background colour, so it reads
        // as a shadow rather than as a second marker.
        ctx.strokeStyle = navy;
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = Math.max(2, r * 0.06);
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.98, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = f.dataUrl;
  });
  if (!stamped) return null;
  const frames = rawFrames.slice();
  frames[nearest] = { ...f, dataUrl: stamped };
  return { frames, markerIndex: nearest };
}

// The container, from the MIME lib/video-clip.ts settled on. Not from the
// filename: the trimmed clip is either the source's own bytes with a MIME the
// passthrough check already narrowed, or a re-encode whose type this app chose,
// so there is no case left where a file extension knows better. The three
// values are the closed set the storage policy and the request schema both
// enforce, and an unrecognised one is a bug rather than a default.
type ClipExt = "mp4" | "webm" | "mov";

function clipExtOf(mime: string): ClipExt | null {
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  if (mime === "video/quicktime") return "mov";
  return null;
}

// The MIME declared on an upload, from the container the file turned out to be.
// The storage policy checks the two against each other, so they are derived
// from one place rather than read off the file twice.
const CLIP_MIME: Record<ClipExt, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

/**
 * The container of a file about to be forwarded untouched, or null when it is
 * not one of the three the storage policy and the request schema both admit.
 *
 * The MIME the picker reports comes first, because it is what the platform
 * actually knows. The FILENAME is the fallback and not a guess: some Android
 * pickers hand back a File with an empty type, and an iPhone .mov arriving
 * through a share sheet can come through as a generic binary type. In both
 * cases the extension is the only container evidence there is, and refusing on
 * a missing MIME would dead-end a player over a field their picker chose not to
 * fill in. Anything still unrecognised is refused rather than relabelled: this
 * function decides the MIME the upload declares, so a wrong answer here would
 * hand the read a container that is not what it says it is.
 */
function uploadExtOf(file: File | Blob): ClipExt | null {
  const type = (file.type || "").toLowerCase();
  if (type.includes("quicktime")) return "mov";
  if (type.includes("mp4")) return "mp4";
  if (type.includes("webm")) return "webm";
  const name = (file instanceof File ? file.name : "").toLowerCase();
  if (name.endsWith(".mov")) return "mov";
  if (name.endsWith(".mp4") || name.endsWith(".m4v")) return "mp4";
  if (name.endsWith(".webm")) return "webm";
  return null;
}

// COPY FOR THE NO-PREVIEW PATH (D-100), collected here because it is the whole
// product surface of that path and it is easy to get wrong.
//
// The house rule for every string below: the player filmed a rep and did
// nothing wrong, so none of them may read as "your device is broken", none of
// them names a format, a codec or a vendor (neither is actionable for someone
// standing in a gym holding a phone), and each one says what is happening and
// what to do next. The refusal at the top is the ONLY remaining hard stop on
// this path, so it names the one thing that fixes it.
const CLIP_TOO_LARGE_MESSAGE =
  `That clip is bigger than ${Math.round(MAX_CLIP_BYTES / 1_000_000)} MB, which is more than can be sent, ` +
  "and it can't be shortened here. Film a shorter one, about one rep and a few seconds long, and pick that instead.";

const CLIP_TYPE_MESSAGE =
  "That clip's file type can't be sent for analysis. Film the rep with your phone's camera app and pick that recording instead.";

// Calibrated against the 16 live analyses on record (2026-08-03): the coaching
// call runs 34-56s, p50 45.4s, p90 54.4s. Its length is set by the ~2,300
// output tokens it writes, NOT by how many frames were sent, so a 12-frame clip
// and a 64-frame clip wait the same. A wait that predictable can be shown
// honestly, which is the whole reason this is a real bar and not a spinner
// pretending to know something.
//
// The window the bar covers is wider than the coaching call: it opens when the
// request body starts uploading and closes when the row, its frames, and the
// clip are committed. Only the middle of that is instrumented, so the overhead
// term is an estimate. Retune both numbers from `telemetry.duration_ms` on the
// analyses table whenever the model, the effort level, or the frame budget
// moves, or the bar starts lying.
const COACHING_P50_MS = 45_400;
const REQUEST_OVERHEAD_MS = 7_000;
const WAIT_P50_MS = COACHING_P50_MS + REQUEST_OVERHEAD_MS;

// The bar approaches CEILING and is never allowed to reach it: only the arriving
// response finishes it. TAU is solved so the curve passes exactly through
// AT_P50 at the median wait, which is what keeps the calibration a promise
// rather than a shape someone eyeballed. Overshooting is the one unforgivable
// failure here (a bar that sits full while the player keeps waiting reads as
// broken), so the curve is deliberately behind on the fastest reads.
const CEILING = 0.99;
const AT_P50 = 0.85;
const TAU_MS = WAIT_P50_MS / Math.log(CEILING / (CEILING - AT_P50));

function waitProgress(elapsedMs: number): number {
  return CEILING * (1 - Math.exp(-Math.max(0, elapsedMs) / TAU_MS));
}

// What the pipeline is actually doing while the model scores the rep, in order.
// Each line is keyed to real elapsed time rather than a blind interval, so the
// copy and the bar can never disagree about how far along the read is. The
// ticker walks forward and rests on the last line rather than looping, a loop
// would read as fake progress.
const SCORING_STAGES: { atMs: number; line: string }[] = [
  { atMs: 0, line: "Reading your clip…" },
  { atMs: 10_000, line: "Following your player…" },
  { atMs: 24_000, line: "Scoring against the rubric…" },
  { atMs: 40_000, line: "Writing your one fix…" },
];

// One clock for the bar and the stage line. Resets on every run so a retry
// starts from zero instead of inheriting the failed attempt's elapsed time.
function useElapsedMs(running: boolean): number {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    setElapsedMs(0);
    if (!running) return;
    const startedAt = Date.now();
    const t = setInterval(() => setElapsedMs(Date.now() - startedAt), 200);
    return () => clearInterval(t);
  }, [running]);
  return elapsedMs;
}

function ScoringProgress({ elapsedMs }: { elapsedMs: number }) {
  const stage = SCORING_STAGES.reduce(
    (current, next) => (elapsedMs >= next.atMs ? next : current),
    SCORING_STAGES[0],
  );
  return (
    <div className="space-y-2.5">
      {/* Decorative: the stage line below carries the same state as text, and
          it already sits inside the live region, so announcing a percentage
          that changes five times a second would only talk over it. */}
      <div aria-hidden className="h-1 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-teal transition-[width] duration-300 ease-linear"
          style={{ width: `${waitProgress(elapsedMs) * 100}%` }}
        />
      </div>
      <span className="flex items-center gap-2.5 text-teal">
        <WorkingDots />
        <span key={stage.line} className="message-in inline-block">
          {stage.line}
        </span>
      </span>
    </div>
  );
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

export function AnalyzeFlow({
  initialSkill = null,
  initialDiscipline = null,
}: {
  initialSkill?: Skill | null;
  initialDiscipline?: Discipline | null;
}) {
  const router = useRouter();
  const [skill, setSkill] = useState<Skill | null>(initialSkill);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [duration, setDuration] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [retrying, setRetrying] = useState(false);
  // No default surface: the environment is an explicit step-01 decision
  // (D-052). Only a deliberate ?discipline= deep link preselects it.
  const [discipline, setDiscipline] = useState<Discipline | null>(
    initialDiscipline,
  );
  const [frameDebug, setFrameDebug] = useState<FrameDebug | null>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const debugRef = useRef(false);
  const clipRef = useRef<Blob | null>(null);
  // The clip the analysis is actually performed on: the trimmed window, cut in
  // the browser because there is no server-side cutter (lib/video-clip.ts).
  // This is the request's whole payload now, so a submit without one has
  // nothing to send.
  const trimmedRef = useRef<TrimmedClip | null>(null);
  // The player's own upload, forwarded byte for byte because this browser could
  // not decode it and therefore could not cut it (D-100). Set only on the
  // no-preview path; the trimmed clip above is still what every other upload
  // sends.
  const untrimmedRef = useRef<{ blob: Blob; ext: ClipExt } | null>(null);
  // The tap, in the trimmed clip's own time base. Absolute source seconds would
  // point past the end of a window that does not start at zero.
  const focusRef = useRef<{ x: number; y: number; t_s: number } | null>(null);
  // The athlete the player picked off a text list when there was no picture to
  // tap. A ref for the same reason focusRef is one: the queued submit closure
  // runs before the next render.
  const labelRef = useRef<string | null>(null);
  // A clip already sitting in the caller's pending prefix, uploaded for the
  // clip-spotting call. Reused by the submit that follows so an untrimmed
  // upload, which is the whole recording and runs to MAX_CLIP_BYTES, is sent
  // once rather than twice. Consumed on use: the route moves the object out of the
  // prefix on success and the client removes it on every failure, so a second
  // attempt always uploads afresh.
  const pendingRef = useRef<{ id: string; path: string; ext: ClipExt } | null>(null);
  const stepSkillRef = useRef<HTMLHeadingElement>(null);
  const prevDisciplineRef = useRef<Discipline | null>(discipline);
  const stepTwoRef = useRef<HTMLHeadingElement>(null);
  const prevSkillRef = useRef<Skill | null>(skill);
  // Pre-analysis pause: the opening frame is up, waiting for the player to
  // mark who to analyze.
  const [openingPick, setOpeningPick] = useState<
    (OpeningFrame & { blob: Blob }) | null
  >(null);
  // Kept after analysis so the player can re-mark and re-run.
  const [lastOpening, setLastOpening] = useState<
    (OpeningFrame & { blob: Blob }) | null
  >(null);
  // Scrubbable clip inside the framing card: pick the moment, then tap the player.
  const frameVideoRef = useRef<HTMLVideoElement>(null);
  const frameBoxRef = useRef<HTMLDivElement>(null);
  const [framingUrl, setFramingUrl] = useState<string | null>(null);
  const [frameVideoFailed, setFrameVideoFailed] = useState(false);
  const [scrubT, setScrubT] = useState(0);
  // The tap that marks the athlete. Scrubbing clears it: a mark belongs to the
  // moment it was made at, and a stale one would ring empty court.
  const [mark, setMark] = useState<Mark | null>(null);
  const markedRef = useRef(false);
  const markerIndexRef = useRef<number | null>(null);
  const [markerShown, setMarkerShown] = useState(false);
  // Coach-spotted candidates for the current moment: short descriptions with a
  // torso point each, so the athlete can be picked from a list instead of a
  // blind tap. An assist only; tapping anywhere still works, and an empty list
  // is a valid answer, never a block.
  const [spotted, setSpotted] = useState<{ label: string; x: number; y: number }[]>([]);
  const [spotting, setSpotting] = useState(false);
  const spotTRef = useRef<number | null>(null);
  // The trimmed analysis window (absolute clip seconds). Dragging a handle
  // past the longest analyzable span slides the other handle along, so the
  // window is always valid and long clips become usable by trimming.
  const [trim, setTrim] = useState<TrimWindow | null>(null);
  // THE NO-PREVIEW PATH (D-100). Set when this browser could not render a frame
  // from the clip, or could not cut one, which used to be a dead stop. Nothing
  // about the ANALYSIS needs a local decode: the clip goes to storage and is
  // read whole on the other side. Only the poster, the filmstrip and the trim
  // need pixels here, and all three are conveniences.
  //
  // `candidates` are descriptions of the people in the clip, read off the clip
  // itself by /api/players, because the marking D-062 made mandatory still has
  // to happen: an unmarked read on multi-person footage analyses whoever the
  // model picks and never tells the player.
  //
  // `marked` is the other way in: the player DID mark an athlete on a frame
  // they could see, and only a later step failed, so there is nothing left to
  // choose and no reason to ask again. `whole` says whether the untrimmed file
  // is what goes up, which is the difference between a clip that never decoded
  // and one that decoded, cut, and only failed to render a preview strip.
  const [noPreview, setNoPreview] = useState<{
    candidates: string[];
    chosen: string | null;
    spotting: boolean;
    marked: boolean;
    whole: boolean;
  } | null>(null);

  // Seed the trim window at the clip's head, capped at the longest analyzable
  // span so long clips begin valid.
  useEffect(() => {
    setMark(null);
    if (!openingPick) {
      setTrim(null);
      return;
    }
    setTrim(
      clampTrimWindow(openingPick.duration_s, {
        startS: 0,
        endS: Math.min(openingPick.duration_s, MAX_CLIP_SECONDS),
      }),
    );
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

  // The scrubbed moment always stays inside the trimmed window.
  useEffect(() => {
    if (!trim) return;
    const hi = Math.max(trim.startS, trim.endS - 0.05);
    const clamped = Math.min(Math.max(scrubT, trim.startS), hi);
    if (clamped !== scrubT) {
      setScrubT(clamped);
      const v = frameVideoRef.current;
      if (v) v.currentTime = clamped;
    }
  }, [trim, scrubT]);

  // Move one trim handle. Dragging past the longest analyzable span slides
  // the other handle along, so the window is valid at every instant.
  function moveTrim(which: "start" | "end", toS: number) {
    const opening = openingPick;
    if (!opening || !trim) return;
    const dur = opening.duration_s;
    const snap = (n: number) => Math.round(n * 20) / 20;
    let { startS, endS } = trim;
    if (which === "start") {
      startS = Math.max(0, Math.min(toS, endS - MIN_TRIM_SPAN_S));
      if (endS - startS > MAX_CLIP_SECONDS) {
        endS = Math.min(dur, startS + MAX_CLIP_SECONDS);
      }
    } else {
      endS = Math.max(Math.min(dur, toS), Math.min(dur, startS + MIN_TRIM_SPAN_S));
      if (endS - startS > MAX_CLIP_SECONDS) {
        startS = Math.max(0, endS - MAX_CLIP_SECONDS);
      }
    }
    setTrim({ startS: snap(startS), endS: snap(endS) });
  }

  async function spotPlayers(frameB64: string, atT: number, signal?: AbortSignal) {
    setSpotting(true);
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frame: frameB64 }),
        signal,
      });
      if (res.ok) {
        const { players } = await res.json();
        if (Array.isArray(players)) {
          setSpotted(players.slice(0, 6));
          spotTRef.current = atT;
        }
      }
    } catch {
      // Spotting is an assist; the tap path is unaffected. An abort lands
      // here too, which is the point: an aborted call may never write state.
    } finally {
      setSpotting(false);
    }
  }

  // Put a clip in the caller's own pending prefix and return what names it.
  // The path is composed from the VERIFIED user id and a fresh UUID, which is
  // what the storage policy matches on, so nothing here can address a folder
  // that is not the caller's. A fresh id per upload: the policies grant
  // create-only semantics and never replacement, so a reused id collides.
  async function uploadPendingClip(
    blob: Blob,
    ext: ClipExt,
  ): Promise<{ id: string; path: string; ext: ClipExt } | null> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.assign("/login");
      return null;
    }
    const id = crypto.randomUUID();
    const path = `${user.id}/pending/${id}/clip.${ext}`;
    const { error } = await supabase.storage
      .from("clips")
      .upload(path, blob, { contentType: CLIP_MIME[ext], upsert: false });
    if (error) return null;
    return { id, path, ext };
  }

  // Drop a pending clip nothing is going to analyze. The orphan sweep is the
  // backstop, so nothing here is worth failing a retry for; this only stops a
  // player who re-picks four files from leaving four clips behind meanwhile.
  async function dropPendingClip(path: string) {
    try {
      await createClient().storage.from("clips").remove([path]);
    } catch {
      // The sweep collects it on age.
    }
  }

  // Spot the athletes in a clip that is already in storage. Descriptions only:
  // the player asking cannot see the clip, so there is nothing to put a
  // coordinate on. An empty list is a valid answer and never an error, exactly
  // as it is on the frame path.
  async function spotFromClip(pendingId: string, ext: ClipExt): Promise<string[]> {
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pending_clip_id: pendingId, clip_ext: ext }),
      });
      if (!res.ok) return [];
      const { players } = await res.json();
      if (!Array.isArray(players)) return [];
      return players
        .map((p: { label?: unknown }) =>
          typeof p?.label === "string" ? p.label.replace(/\s+/g, " ").trim() : "",
        )
        // The same bounds lib/analyze-request.ts enforces on focus_label. A
        // label outside them would be refused by the route as a bad request
        // AFTER the player had chosen it, which reads as the analysis failing;
        // filtering here means every button on screen is one that works. The
        // number is written out rather than imported so this component does not
        // pull the request schema and its validator into the browser bundle.
        .filter((label: string) => label.length >= 3 && label.length <= 80)
        .slice(0, 6);
    } catch {
      return [];
    }
  }

  /**
   * The no-preview path: analyze a clip this browser cannot decode.
   *
   * Reached three ways, all of which used to be a dead stop: the browser has no
   * way to cut a clip at all, the opening frame came back null, or the cut
   * itself failed after the player had already marked their athlete. The last
   * one arrives with `mark` set and skips the spotting entirely, because the
   * player has already answered the question it asks.
   *
   * The size check is the ONE refusal left on this path and it is honest: there
   * is no decoder here, so there is nothing that could trim the file down for
   * them, and saying "try a different browser" would be sending them somewhere
   * that cannot help either.
   */
  async function startNoPreview(file: File | Blob, mark?: Mark) {
    // A clip that could not be DECODED cannot be played either, so the preview
    // element would render nothing but its own error icon. A clip that decoded
    // and only failed to CUT still plays, and arrives here with a mark, so its
    // preview is left alone.
    if (!mark && videoUrl) setVideoUrl(null);
    const ext = uploadExtOf(file);
    if (!ext) {
      setStatus({ kind: "error", message: CLIP_TYPE_MESSAGE });
      return;
    }
    if (file.size > MAX_CLIP_BYTES) {
      setStatus({ kind: "error", message: CLIP_TOO_LARGE_MESSAGE });
      return;
    }
    untrimmedRef.current = { blob: file, ext };
    // The tap survives a failed cut untouched. It was taken against the source
    // clip's own time base, and the source clip is exactly what is being sent
    // now, so there is no window offset left to rebase it onto.
    focusRef.current = mark ? { x: mark.x, y: mark.y, t_s: mark.t } : null;
    labelRef.current = null;
    setFrames([]);
    setMarkerShown(false);
    if (mark) {
      setNoPreview({ candidates: [], chosen: null, spotting: false, marked: true, whole: true });
      setStatus({ kind: "idle" });
      return;
    }
    setNoPreview({ candidates: [], chosen: null, spotting: true, marked: false, whole: true });
    setStatus({ kind: "idle" });
    const uploaded = await uploadPendingClip(file, ext);
    if (!uploaded) {
      // The upload failed, so there is nothing to spot from. Not a stop: the
      // submit below uploads again and reports its own failure if it recurs,
      // and a player who cannot be shown a list can still be analyzed unmarked.
      setNoPreview({ candidates: [], chosen: null, spotting: false, marked: false, whole: true });
      return;
    }
    pendingRef.current = uploaded;
    const candidates = await spotFromClip(uploaded.id, ext);
    setNoPreview({
      candidates,
      // One candidate is not a choice. Pre-select it rather than making the
      // player confirm the only thing on the list.
      chosen: candidates.length === 1 ? candidates[0] : null,
      spotting: false,
      marked: false, whole: true,
    });
  }

  // Render the framing video's current moment as a JPEG for spotting.
  function currentFrameB64(): string | null {
    const v = frameVideoRef.current;
    if (!v || !v.videoWidth) return null;
    // Shared sizing with the analysis pipeline (scaledSize) instead of a second
    // inline scale math, so the spot frame never drifts from the frame rules.
    const [w, h] = scaledSize(v.videoWidth, v.videoHeight, SPOT_FRAME_DIM);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.72).split(",")[1];
  }

  // Spot on the opening frame as soon as the card is up. The abort in the
  // cleanup does two jobs: a response for a clip the user has already replaced
  // can never land in `spotted` (the fetch rejects before the state writes),
  // and dev strict-mode's doubled effect cancels its first call instead of
  // paying for two coaching-service reads per clip pick.
  useEffect(() => {
    setSpotted([]);
    spotTRef.current = null;
    if (!openingPick) return;
    const b64 = openingPick.dataUrl.split(",")[1];
    if (!b64) return;
    const controller = new AbortController();
    void spotPlayers(b64, openingPick.timeS, controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openingPick]);

  // A tap on the framing media marks the athlete at the scrubbed moment. The
  // coordinate is normalized against the media box; the framing element sizes
  // itself to the content (w-auto), so there is no letterbox to correct for.
  function placeMark(e: React.PointerEvent) {
    const box = frameBoxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const video = frameVideoRef.current;
    const t =
      video && Number.isFinite(video.currentTime) && video.currentTime > 0.01
        ? video.currentTime
        : (openingPick?.timeS ?? scrubT);
    setMark({ x, y, t });
  }

  // Gate state lives in a ref, not render state: the queued submit closure
  // runs synchronously after an answer, before any re-render, and a stale
  // state read here is how an answered question used to reopen itself.
  const consentAnsweredRef = useRef<boolean | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const pendingSubmitRef = useRef<(() => void) | null>(null);
  const consentAllowRef = useRef<HTMLButtonElement>(null);

  // Settles the has-the-question-been-answered read and releases any submit
  // that arrived while it was in flight: straight through when answered,
  // through the modal when not.
  function resolveConsent(answered: boolean) {
    consentAnsweredRef.current = answered;
    const run = pendingSubmitRef.current;
    if (!run) return;
    if (answered) {
      pendingSubmitRef.current = null;
      run();
    } else {
      setConsentOpen(true);
    }
  }

  // Has this account answered the training-data question yet? Transient read
  // errors and hangs fail open (analysis is never blocked; consent stays
  // false in the database until explicitly granted), but a session whose user
  // no longer exists is dead everywhere: clear it and start over at login
  // instead of silently skipping the question and losing every later write.
  useEffect(() => {
    let settled = false;
    const settle = (answered: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(failOpen);
      resolveConsent(answered);
    };
    const failOpen = setTimeout(() => settle(true), 6000);
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          settled = true;
          clearTimeout(failOpen);
          await supabase.auth.signOut();
          window.location.assign("/login");
          return;
        }
        const { data } = await supabase
          .from("profiles")
          .select("training_consent_at")
          .eq("id", user.id)
          .single();
        settle(data?.training_consent_at != null);
      } catch {
        settle(true);
      }
    })();
    return () => clearTimeout(failOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (consentOpen) consentAllowRef.current?.focus();
  }, [consentOpen]);

  async function answerConsent(allow: boolean) {
    setConsentOpen(false);
    consentAnsweredRef.current = true;
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // supabase-js reports failures in the return value, not by throwing,
        // and an RLS-blocked update is a silent zero-row success; selecting
        // the row back makes both visible so an unsaved answer is never
        // mistaken for a saved one. The analysis itself still runs either way.
        const { data, error } = await supabase
          .from("profiles")
          .update({
            training_consent: allow,
            training_consent_at: new Date().toISOString(),
          })
          .eq("id", user.id)
          .select("training_consent_at");
        if (error || !data?.length) {
          console.warn("Training-consent answer did not save; it will be asked again.", error?.message);
        }
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
  // Drives the calibrated progress bar. The clock runs for every send, but the
  // bar renders only on a first attempt: a retry keeps the spinner already on
  // its own button rather than showing two indicators for one wait.
  const scoringElapsedMs = useElapsedMs(status.kind === "sending");
  // The highest-intent moment in the product: they filmed, marked their
  // athlete, waited, and got refused. It is also the one calm state where
  // sending the same clip again cannot possibly work, so the offer REPLACES
  // both retry affordances rather than sitting beside them. Leaving either one
  // up would cost the player another round trip to be told the same thing.
  const outOfAnalyses =
    status.kind === "unavailable" && status.exhausted === true;
  const canSubmit = frames.length > 0 && !outOfAnalyses;
  const canRetry =
    !outOfAnalyses &&
    frames.length > 0 &&
    (status.kind === "error" || status.kind === "unavailable" || retrying);

  // Release the preview object URL when it is replaced or on unmount.
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // Move focus into the revealed skill step the first time a discipline is
  // picked (null -> a value); re-picks leave focus on the chips.
  useEffect(() => {
    const had = prevDisciplineRef.current;
    prevDisciplineRef.current = discipline;
    if (!had && discipline) stepSkillRef.current?.focus();
  }, [discipline]);

  // Move focus into the revealed capture block the first time a skill is picked
  // (null -> a value); re-picks leave focus where it is so roving arrow-key
  // navigation in the skill radiogroup is not disrupted.
  useEffect(() => {
    const had = prevSkillRef.current;
    prevSkillRef.current = skill;
    if (!had && skill) stepTwoRef.current?.focus();
  }, [skill]);

  async function submit(
    payloadFrames: Frame[],
    dur: number | null,
    isRetry = false,
  ) {
    if (!skill || !discipline) return;
    // One-time training-data question before the first analysis ever runs.
    // While the answered-check is still in flight (null), the submit waits for
    // it; skipping ahead here is how the question used to get lost entirely.
    if (consentAnsweredRef.current !== true) {
      pendingSubmitRef.current = () => {
        void submit(payloadFrames, dur, isRetry);
      };
      if (consentAnsweredRef.current === false) setConsentOpen(true);
      return;
    }
    // What actually goes up: the cut window on every browser that could make
    // one, or the player's own file on the browsers that could not (D-100).
    // Both end as the same three fields, so nothing below this line branches.
    const trimmed = trimmedRef.current;
    const untrimmed = untrimmedRef.current;
    const source = trimmed
      ? { blob: trimmed.blob, ext: clipExtOf(trimmed.mime), duration_s: trimmed.duration_s }
      : untrimmed
        ? { blob: untrimmed.blob, ext: untrimmed.ext, duration_s: null }
        : null;
    if (!source || !source.ext) {
      setStatus({
        kind: "error",
        message: "That clip couldn't be prepared for analysis. Pick it again and retry.",
      });
      return;
    }
    const ext = source.ext;
    setRetrying(isRetry);
    setStatus({ kind: "sending" });

    // The clip goes to storage BEFORE the request, because the request cannot
    // carry it: the platform caps a body at 4.5 MB and a ten second window is
    // about that once base64'd. The route reads it back from the pending prefix
    // (D-097, migration 054), which is owner-scoped, so this path is only
    // writable by the account it names.
    //
    // A fresh id per attempt (uploadPendingClip mints one). Reusing an id would
    // collide on a retry, because the storage policies grant create-only
    // semantics and never replacement.
    //
    // The one exception is a clip that is ALREADY up, because the no-preview
    // path uploaded this same file to spot the athletes in it. Reused rather
    // than re-uploaded: that file is the whole untrimmed recording and the
    // player is on the device least able to send it twice. Consumed either way,
    // since the route moves the object out of the prefix when it succeeds and
    // every failure below removes it, so a retry finds nothing here and uploads
    // afresh.
    const reusable = pendingRef.current;
    pendingRef.current = null;
    const uploaded =
      reusable && reusable.ext === ext
        ? reusable
        : await uploadPendingClip(source.blob, ext);
    if (!uploaded) {
      setRetrying(false);
      setStatus({
        kind: "error",
        message: "Your clip didn't finish uploading. Check your connection and try again.",
      });
      return;
    }
    const pendingId = uploaded.id;
    const pendingPath = uploaded.path;
    // Remove the uploaded clip on any path that does not hand it to an
    // analysis. The orphan sweep would collect it eventually, but a player who
    // retries four times should not leave four clips behind in the meantime.
    const dropPending = () => dropPendingClip(pendingPath);

    const body: AnalyzeBody = {
      skill,
      discipline,
      source: "video",
      duration_s: source.duration_s ?? dur,
      pending_clip_id: pendingId,
      clip_ext: ext,
      focus_point: focusRef.current ?? undefined,
      // Only ever set when there was no frame to tap, and the route prefers the
      // tap when both somehow arrive.
      focus_label: labelRef.current ?? undefined,
    };
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        // The whole body, not just the message: a monthly-allowance 402 also
        // carries which wall was hit and when it lifts.
        const body: AnalyzeErrorBody | null = await res
          .json()
          .catch(() => null);
        // Degraded service, hourly limit, and monthly allowance (D-043/D-054)
        // all mean the player did nothing wrong and the clip was never read,
        // so they render calm (not the coral error state) with a path forward;
        // everything else stays an error. The mapping lives in
        // lib/analyze-status.ts where it is unit-tested.
        const failure = analyzeFailureStatus(res.status, body);
        await dropPending();
        setRetrying(false);
        setStatus(
          failure.kind === "unavailable"
            ? {
                kind: "unavailable",
                message: failure.message,
                exhausted: res.status === 402,
                plan: planFromReason(failure.reason),
                needsAccount: failure.needsAccount,
                // The raw instant, formatted in UTC, because the window is a
                // UTC calendar month: rendering it in the viewer's own zone
                // tells anyone west of Greenwich that an Aug 1 reset happens on
                // Jul 31, and it would then disagree with the counter on the
                // dashboard by a day.
                resetsOn: resetDateOf(body?.resets_at),
              }
            : { kind: "error", message: failure.message },
        );
        return;
      }
      // The route has already copied the clip to the analysis path and removed
      // the pending object. Nothing left to upload here: this used to be where
      // the clip and the extra frames went up, and both are now either the
      // request's input or not stored at all.
      const { analysisId, xpAwarded } = await res.json();
      // Purge the client router cache so dashboard/history show this rep
      // immediately instead of a cached copy for up to 30s.
      router.refresh();
      router.push(
        `/analysis/${analysisId}${xpAwarded ? `?xp=${xpAwarded}` : ""}`,
      );
    } catch (err) {
      await dropPending();
      setRetrying(false);
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }

  // Cut the analyzed window, extract the preview strip, and hold the tap.
  //
  // The frames no longer travel: the read is performed on the clip itself
  // (D-097), and these stills exist to show the player what they are about to
  // spend an analysis on and to prove this browser can decode the file at all,
  // which is D-091's guard. Their budget is now larger than a preview needs and
  // is worth revisiting.
  async function runVideoExtraction(
    blob: Blob,
    target?: Mark,
    window?: TrimWindow,
  ) {
    // Cut first. Its failure is the one that decides WHICH clip gets sent, so
    // finding out before the extraction spends the player's time is the
    // difference between one clear state and a filmstrip that leads nowhere.
    let cut: TrimmedClip;
    try {
      cut = await trimClip(blob, {
        startS: window?.startS ?? 0,
        endS: window?.endS ?? Number.POSITIVE_INFINITY,
      });
    } catch {
      // The cut failed, and it used to end here with "pick the clip again",
      // which sent the player back to re-do the one thing that had worked. The
      // ORIGINAL bytes are still analyzable on the other side and the mark is
      // still valid against them, so the whole file goes instead (D-100).
      // Nothing is lost but the trim window itself, and the player is told.
      await startNoPreview(blob, target);
      return;
    }
    try {
      trimmedRef.current = cut;
      // The tap, rebased onto the cut. A window that starts at 3s makes an
      // absolute 4.2s tap 1.2s into what the model is shown, and handing over
      // the absolute number would point past the end of a short window.
      focusRef.current = target
        ? {
            x: target.x,
            y: target.y,
            t_s: Math.max(0, Math.min(cut.duration_s, target.t - (window?.startS ?? 0))),
          }
        : null;

      const { frames: f, duration_s, debug } = await extractFrames(blob, {
        debug: debugRef.current,
        window,
        markT: target?.t,
        // Shapes the frame budget around this skill's contact phase (D-061).
        skill: skill ?? undefined,
      });
      setStatus({ kind: "reading" });
      let shown = f;
      markedRef.current = false;
      markerIndexRef.current = null;
      if (target) {
        const burned = await burnMark(f, target);
        if (burned) {
          shown = burned.frames;
          markedRef.current = true;
          markerIndexRef.current = burned.markerIndex;
        }
      }
      setMarkerShown(markedRef.current);
      setFrames(shown);
      setDuration(duration_s);
      setFrameDebug(debug ?? null);
      if (debug) {
        // Debug mode: inspect the selected frames instead of spending an API call.
        setStatus({ kind: "idle" });
        return;
      }
      setStatus({ kind: "idle" });
    } catch {
      // THE FILMSTRIP IS A PREVIEW, and only a preview. Since D-097 the frames
      // do not travel: the read is performed on the cut clip, which succeeded
      // above and is already in hand, and the player's mark is already rebased
      // onto it. So a render pass that produced nothing costs a picture, not an
      // analysis, and stopping here used to throw away a good upload and a good
      // mark over a decoder that would not hand back pixels twice in a row.
      //
      // `whole: false` because the CUT window is what goes up here, not the
      // original file. `marked: true` because confirmFraming is the only way in
      // and it cannot get here without a tap.
      setNoPreview({
        candidates: [],
        chosen: null,
        spotting: false,
        marked: true,
        whole: false,
      });
      // The message that used to be shown here named the browser and told the
      // player to close other tabs and try again. It was accurate and it is no
      // longer worth saying, because nothing they do about it changes what
      // happens next: the analysis runs either way.
      setStatus({ kind: "idle" });
    }
  }

  // Entry for uploaded clips: pause on the opening frame so the player can
  // mark who to analyze before any analysis runs.
  //
  // A browser that cannot decode the clip gets the no-preview path instead of
  // the refusal that used to live here (D-100). The refusal was wrong on the
  // facts: NOTHING about the analysis needs a local decode, since the clip is
  // uploaded whole and read on the other side, and only the poster, the
  // filmstrip and the trim need pixels in this browser. Marking is still
  // mandatory in substance (D-062); it moves to a list of descriptions read off
  // the clip server-side, because an unmarked read on multi-person footage
  // analyses whoever the model picks and never says so.
  async function handleVideo(file: File | Blob) {
    setStatus({ kind: "reading" });
    setFrameDebug(null);
    setOpeningPick(null);
    setLastOpening(null);
    setNoPreview(null);
    trimmedRef.current = null;
    untrimmedRef.current = null;
    focusRef.current = null;
    labelRef.current = null;
    // A clip left over from a previous pick is now an orphan nothing will
    // analyze. Drop it before the reference is overwritten.
    const stale = pendingRef.current;
    pendingRef.current = null;
    if (stale) void dropPendingClip(stale.path);
    clipRef.current = file;
    // Asked BEFORE anything else. A browser with no way to cut a clip has no
    // way to decode one either, so there would be no poster to tap and no
    // filmstrip to show.
    if (!canTrimVideo()) {
      await startNoPreview(file);
      return;
    }
    try {
      const opening = await openingFrame(file);
      if (!opening) {
        // The file loaded or it did not; either way this browser produced no
        // frame from it, and that says nothing about whether the clip can be
        // analyzed. Send it whole.
        await startNoPreview(file);
        return;
      }
      // Only now is there a preview worth showing. Setting this earlier put an
      // undecodable clip into a <video> that could only render an error.
      setVideoUrl(URL.createObjectURL(file));
      // Long clips get the card too: the trim window makes them analyzable.
      setFrames([]);
      markedRef.current = false;
      markerIndexRef.current = null;
      setMarkerShown(false);
      setDuration(opening.duration_s);
      const pick = { ...opening, blob: file };
      setLastOpening(pick);
      setOpeningPick(pick);
      setStatus({ kind: "idle" });
    } catch {
      // openingFrame swallows its own failures, so reaching here means the
      // decode died somewhere this browser did not report. Same answer: the
      // clip is still analyzable, it just cannot be previewed.
      await startNoPreview(file);
    }
  }

  // The mark is confirmed. There is no unmarked path any more (D-062): this is
  // the only way out of the framing card.
  function confirmFraming() {
    const opening = openingPick;
    const picked = mark;
    if (!opening || !picked) return;
    const win = trim ?? undefined;
    const t = win
      ? Math.min(
          Math.max(picked.t, win.startS + 0.02),
          Math.max(win.startS + 0.02, win.endS - 0.05),
        )
      : picked.t;
    setOpeningPick(null);
    setStatus({ kind: "reading" });
    void runVideoExtraction(opening.blob, { x: picked.x, y: picked.y, t }, win);
  }

  // The no-preview path's one button. The subject is settled before it fires:
  // a kept mark, the single candidate the list pre-selected, the one the player
  // pressed, or nothing at all when the clip showed nobody pickable. Only the
  // last of those is an unmarked read, and the card says so above this button
  // rather than letting the player find out from the analysis.
  function confirmNoPreview() {
    if (!noPreview || busy) return;
    if (noPreview.candidates.length > 1 && !noPreview.chosen) return;
    labelRef.current = noPreview.marked ? null : noPreview.chosen;
    void submit([], null);
  }

  async function onVideoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // The gallery picker can hand back a still even though the input asks for
    // video types only. Stills are not analyzable (D-062): one photo has no
    // sequence to read and no moment to mark an athlete at.
    if (file.type.startsWith("image/")) {
      setStatus({
        kind: "error",
        message:
          "That's a photo. Vollyio reads the movement between frames, so pick a video of the rep.",
      });
      return;
    }
    setStatus({ kind: "reading" });
    try {
      await handleVideo(file);
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't read that clip.",
      });
    }
  }

  function downloadEvalCase() {
    if (!skill || !discipline || frames.length === 0) return;
    const caseId = `${skill}-${discipline}-${Date.now()}`;
    const payload = {
      id: caseId,
      skill,
      discipline,
      frames: frames.map((f) => ({ time_s: f.time_s, data: f.dataUrl.split(",")[1] })),
      // Deliberately empty rather than placeholder-filled. The old export wrote
      // a 0-100 band and an empty weakest_metric, which is worse than no label:
      // the band made overall_in_range fire and pass on every case, so the suite
      // reported agreement it had never earned, while the empty string silently
      // skipped the weakest_metric check. An unlabeled case must read as
      // unlabeled. See decisions.md D-031.
      expected: {
        notes: `Unlabeled. Run: npm run eval:label ${caseId}`,
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
      {/* THE OPENING BAND (D-117), the same block the dashboard and Trends
          open with. This was a bare gold kicker over a `text-3xl` h1 sitting
          on the page ground, which is what every screen looked like before
          D-116 gave the app one opening shape. Nothing was added to it: the
          eyebrow and the title are the two things that were already here. */}
      <div className="hero-band card spot p-5 sm:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
          Analyze
        </p>
        <h1 className="mt-1.5 font-display text-page-title">Film the rep.</h1>
      </div>

      <div
        className={
          skill && discipline
            ? "mt-6 lg:grid lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:items-start lg:gap-10"
            : "mt-6 max-w-3xl"
        }
      >
        {/* Controls */}
        <div className="min-w-0">
          <div>
            {/* THE STEP HEADINGS ARE `.section-head` NOW (D-117), the same
                label-with-a-standing-bar every other section in the app uses,
                instead of three retyped `font-display text-sm font-bold`
                headings. The step number stays inside it: the bar marks where
                a section starts, but only the number says which of three this
                is, and a capture flow is the one place in the app where that
                ordering is the point. */}
            <h2 id="where-playing" className="section-head mb-3">
              <span className="font-mono text-xs text-gold">01</span> Where are you
              playing?
            </h2>
            <div
              role="group"
              aria-labelledby="where-playing"
              className="flex flex-wrap gap-2"
            >
              {ANALYZE_DISCIPLINES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDiscipline(d)}
                  aria-pressed={discipline === d}
                  className={`chip min-h-11 ${discipline === d ? "chip-active" : ""}`}
                >
                  {DISCIPLINE_LABEL[d]}
                </button>
              ))}
            </div>
          </div>

          {discipline && (
            <div className="mt-8 animate-fade-up">
              <h2
                ref={stepSkillRef}
                tabIndex={-1}
                id="pick-a-skill"
                className="section-head mb-3"
              >
                <span className="font-mono text-xs text-gold">02</span> Pick a skill
              </h2>
              <SkillPicker value={skill} onChange={setSkill} labelledBy="pick-a-skill" />
            </div>
          )}

          {discipline && skill && (
            <div className="mt-8 animate-fade-up">
              <h2
                ref={stepTwoRef}
                tabIndex={-1}
                className="section-head mb-3"
              >
                <span className="font-mono text-xs text-gold">03</span> Capture your{" "}
                {SKILL_LABEL[skill].toLowerCase()} rep
              </h2>

              <div className="card border-dashed border-gold/40 p-8 text-center">
                <button
                  type="button"
                  onClick={() => videoInput.current?.click()}
                  disabled={busy}
                  className="btn-primary mx-auto min-h-11 text-sm"
                >
                  Upload a clip
                </button>
                {/* Concrete framing guidance, not "any angle you can get"
                    (D-081). The first cold signup filmed a rep the read could
                    not see at all: every cue came back not_visible, the score
                    fell back to a whole-clip guess, and the player spent one
                    of their analyses to learn nothing. The checklist scores
                    what the camera shows, so what the camera shows is the one
                    thing worth saying before they film. */}
                <p className="mt-3 text-xs text-chalk-dim">
                  One rep, up to 10 seconds. Film with your camera app, then
                  pick the clip here.
                </p>
                <ul className="mx-auto mt-3 max-w-xs space-y-1 text-left text-xs text-chalk-dim">
                  <li className="flex gap-2">
                    <span aria-hidden="true" className="text-gold">
                      &middot;
                    </span>
                    Fill the frame with the athlete, not the whole court
                  </li>
                  <li className="flex gap-2">
                    <span aria-hidden="true" className="text-gold">
                      &middot;
                    </span>
                    Start before the rep and stop after it, so the whole motion
                    is in the clip
                  </li>
                  <li className="flex gap-2">
                    <span aria-hidden="true" className="text-gold">
                      &middot;
                    </span>
                    From the side beats head on, and one rep beats a rally
                  </li>
                </ul>
                <p className="mx-auto mt-3 max-w-xs text-xs text-chalk-dim/80">
                  The read scores what it can see. A distant or half-cut rep
                  comes back with cues marked not visible instead of scored.
                </p>
              </div>

              <input
                ref={videoInput}
                type="file"
                // Explicit MIME types only, Android maps wildcard accepts
                // (video/*, image/*) to a camera-capture intent on some
                // devices, skipping the gallery entirely. Concrete types
                // always open the media picker.
                //
                // Covers both platforms at the picker: video/quicktime is the
                // iPhone .mov, video/3gpp and video/x-matroska are what some
                // Android cameras write. Stills are no longer offered here.
                // A single photo cannot show a swing's sequence, and the whole
                // point of the read is the mechanics between frames.
                accept="video/mp4,video/quicktime,video/webm,video/3gpp,video/x-matroska"
                hidden
                onChange={onVideoPicked}
              />

            </div>
          )}
        </div>

        {/* Preview. While the mark/trim card is up it spans the full content
            width on desktop: that stage is the whole task at that point, and
            the wider box renders the clip larger. The wrapper stays sized by
            its content (w-fit media box), so tap-coordinate math is unchanged. */}
        {skill && discipline && (
          <div
            className={`mt-8 min-w-0 lg:mt-0 ${
              openingPick ? "lg:col-span-2" : "lg:sticky lg:top-8"
            }`}
          >
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

            {/* The no-preview path (D-100). No poster, no filmstrip, no trim
                bar: none of them can be drawn here, and none of them is what
                the analysis runs on. What survives is the part that matters,
                choosing who gets watched, moved from a tap on a picture to a
                pick from a list the coach read off the clip itself. */}
            {noPreview && (
              <div className="card mb-3 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
                  No preview, full analysis
                </p>
                <p className="mt-1 text-xs text-chalk-dim">
                  {!noPreview.marked
                    ? "There's no preview of this clip here, so there's nothing to tap. That's only the preview: the coach reads the clip itself, so your rep is analyzed in full."
                    : noPreview.whole
                      ? "This clip can't be shortened here, so the whole recording is sent. Your marked player is kept, and the coach reads the clip itself."
                      : "The frame-by-frame strip couldn't be built here. Nothing else changed: your window and your marked player are exactly as you set them, and the coach reads the clip itself."}
                </p>

                {noPreview.spotting && (
                  <p className="mt-3 flex items-center gap-2.5 font-mono text-xs text-teal">
                    <WorkingDots /> Looking for players in your clip…
                  </p>
                )}

                {!noPreview.spotting && noPreview.candidates.length > 1 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs text-chalk-dim">
                      Here&rsquo;s who the coach can see in your clip. Pick the
                      player you want analyzed.
                    </p>
                    {noPreview.candidates.map((label, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={noPreview.chosen === label}
                        onClick={() =>
                          setNoPreview({ ...noPreview, chosen: label })
                        }
                        className={`chip block min-h-11 w-full text-left text-xs ${
                          noPreview.chosen === label ? "chip-active" : ""
                        }`}
                      >
                        <span className="mr-2 font-mono text-gold">{i + 1}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* One candidate is not a choice, so it is stated rather than
                    asked. Stated all the same: this is the only place the
                    player learns who the coach is about to watch. */}
                {!noPreview.spotting &&
                  !noPreview.marked &&
                  noPreview.candidates.length === 1 && (
                    <p className="mt-3 text-xs text-chalk-dim">
                      One player showed up in your clip:{" "}
                      <span className="text-chalk">{noPreview.candidates[0]}</span>. That&rsquo;s
                      who gets analyzed.
                    </p>
                  )}

                {/* The honest version of an unmarked read. D-062 made marking
                    mandatory because an unmarked analysis of multi-person
                    footage picks somebody and never says who; it stays refused
                    silently, and is said out loud here instead. */}
                {!noPreview.spotting &&
                  !noPreview.marked &&
                  noPreview.candidates.length === 0 && (
                    <p className="mt-3 text-xs text-chalk-dim">
                      Nobody could be picked out of this clip, so the coach will
                      analyze whoever is doing the rep. If more than one person
                      is playing, film a clip with just your rep in it and you
                      will get a sharper read.
                    </p>
                  )}

                {!outOfAnalyses && (
                  <>
                    <button
                      type="button"
                      aria-busy={busy}
                      aria-describedby={
                        noPreview.candidates.length > 1 && !noPreview.chosen
                          ? "no-preview-pick-reason"
                          : undefined
                      }
                      disabled={
                        busy ||
                        noPreview.spotting ||
                        (noPreview.candidates.length > 1 && !noPreview.chosen)
                      }
                      onClick={confirmNoPreview}
                      className="btn-primary mt-4 min-h-11 w-full disabled:opacity-40"
                    >
                      {busy ? (
                        <>
                          <WorkingDots /> Analyze my rep
                        </>
                      ) : status.kind === "error" || status.kind === "unavailable" ? (
                        "Send it again"
                      ) : (
                        "Analyze my rep"
                      )}
                    </button>
                    {noPreview.candidates.length > 1 && !noPreview.chosen && (
                      <p
                        id="no-preview-pick-reason"
                        aria-live="polite"
                        className="mt-2 text-center text-xs text-chalk-dim"
                      >
                        Pick the player you want analyzed to continue.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {openingPick && (
              <div className="card mb-3 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
                  Who should I watch?
                </p>
                <p className="mt-1 text-xs text-chalk-dim">
                  {mark
                    ? "Marked. Scrub to double-check the ring is on your player, then analyze."
                    : spotted.length > 0
                      ? "Pick your player from the list, or tap them directly. The gold ring tells the coach exactly who to analyze."
                      : "Scrub to a moment where your player is easy to see, then tap them. The gold ring tells the coach exactly who to analyze."}
                </p>
                <div
                  ref={frameBoxRef}
                  onPointerDown={placeMark}
                  role="button"
                  tabIndex={0}
                  aria-label="Tap the player you want analyzed"
                  className="relative mx-auto mt-3 w-fit max-w-full cursor-crosshair select-none overflow-hidden rounded-lg bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
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
                      className="pointer-events-none block max-h-[45vh] w-auto max-w-full lg:max-h-[60vh]"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={openingPick.dataUrl}
                      alt="Opening frame. Tap the player to analyze."
                      className="pointer-events-none block max-h-[45vh] w-auto max-w-full lg:max-h-[60vh]"
                      draggable={false}
                    />
                  )}
                  {mark && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%` }}
                    >
                      <span className="block h-14 w-14 rounded-full border-4 border-gold shadow-[0_0_0_3px_var(--color-navy)]" />
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-gold px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-navy">
                        watching
                      </span>
                    </span>
                  )}
                  {!mark &&
                    spotted.map((p, i) => (
                      <span
                        key={i}
                        aria-hidden
                        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gold/80 bg-navy/70 font-mono text-[10px] text-gold">
                          {i + 1}
                        </span>
                      </span>
                    ))}
                </div>
                {/* The coach-spotted candidates: picking one places the mark on
                    that player at the current moment. */}
                {!mark && (spotted.length > 0 || spotting) && (
                  <div className="mt-3 space-y-1.5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-chalk-dim">
                      {spotting ? "Looking for players…" : "Players spotted"}
                    </p>
                    {spotted.map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          const video = frameVideoRef.current;
                          const t =
                            video && Number.isFinite(video.currentTime) && video.currentTime > 0.01
                              ? video.currentTime
                              : (spotTRef.current ?? scrubT);
                          setMark({ x: p.x, y: p.y, t });
                        }}
                        className="chip block min-h-11 w-full text-left text-xs"
                      >
                        <span className="mr-2 font-mono text-gold">{i + 1}</span>
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
                {!mark && !spotting && spotted.length === 0 && framingUrl && !frameVideoFailed && (
                  <button
                    type="button"
                    onClick={() => {
                      const b64 = currentFrameB64();
                      if (b64) void spotPlayers(b64, scrubT);
                    }}
                    className="chip mt-3 min-h-11 text-xs"
                  >
                    Find players at this moment
                  </button>
                )}
                {framingUrl && !frameVideoFailed && (
                  <input
                    type="range"
                    min={trim?.startS ?? 0}
                    max={
                      trim
                        ? Math.max(trim.startS + 0.05, trim.endS - 0.05)
                        : Math.max(0.1, openingPick.duration_s - 0.05)
                    }
                    step={0.05}
                    value={scrubT}
                    onChange={(e) => {
                      const t = Number(e.target.value);
                      setScrubT(t);
                      // The moment moved out from under the mark; re-tap to
                      // mark at the new moment. Keeping a stale mark would
                      // ring whatever is at that spot now. Spotted candidates
                      // go stale the same way.
                      if (mark && Math.abs(t - mark.t) > 0.25) setMark(null);
                      if (
                        spotTRef.current != null &&
                        Math.abs(t - spotTRef.current) > 0.25
                      ) {
                        setSpotted([]);
                        spotTRef.current = null;
                      }
                      const v = frameVideoRef.current;
                      if (v) v.currentTime = t;
                    }}
                    aria-label="Scrub through the clip"
                    className="mt-3 h-11 w-full cursor-pointer accent-gold"
                  />
                )}
                {trim && openingPick.duration_s > MIN_TRIM_SPAN_S + 0.5 && (
                  <>
                    <TrimBar
                      duration={openingPick.duration_s}
                      trim={trim}
                      onMove={moveTrim}
                    />
                    {openingPick.duration_s > MAX_CLIP_SECONDS && (
                      <p className="mt-1 text-xs text-chalk-dim">
                        Only the gold window is analyzed, up to {MAX_CLIP_SECONDS}s.
                        Slide it over your best reps.
                      </p>
                    )}
                  </>
                )}
                {/* One primary button, one path. A mark is required (D-062):
                    without it the button stays disabled with the reason
                    spelled out. */}
                {mark ? (
                  <button
                    type="button"
                    onClick={confirmFraming}
                    className="btn-primary mt-4 min-h-11 w-full"
                  >
                    Analyze this player
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled
                      aria-describedby="framing-pick-reason"
                      className="btn-primary mt-4 min-h-11 w-full disabled:opacity-40"
                    >
                      Analyze this player
                    </button>
                    <p
                      id="framing-pick-reason"
                      aria-live="polite"
                      className="mt-2 text-center text-xs text-chalk-dim"
                    >
                      Tap the player you want analyzed to continue.
                    </p>
                  </>
                )}
              </div>
            )}

            {frames.length > 0 ? (
              <div className="reward-earned">
                {(markerShown || lastOpening) && (
                  <div className="mb-2 flex items-center gap-2 text-xs text-chalk-dim">
                    {markerShown && (
                      <>
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-teal"
                        />
                        <span>
                          The gold ring marks your player for the coach.
                        </span>
                      </>
                    )}
                    {lastOpening && !openingPick && (
                      <button
                        type="button"
                        onClick={() => setOpeningPick(lastOpening)}
                        disabled={busy}
                        className="chip ml-auto shrink-0"
                      >
                        Re-mark player
                      </button>
                    )}
                  </div>
                )}
                <div className="relative">
                  <Filmstrip frames={frames} variant="grid" />
                  {status.kind === "sending" && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-lg"
                    >
                      <div className="scan-line" />
                    </div>
                  )}
                </div>
              </div>
            ) : noPreview ? null : (
              // Suppressed on the no-preview path: there are no frames coming,
              // and promising a filmstrip that can never render is the kind of
              // small lie that makes a player think something broke.
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
                onClick={() => submit(frames, duration)}
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
                  <WorkingDots /> Reading your clip…
                </span>
              )}
              {status.kind === "sending" && !retrying && (
                <ScoringProgress elapsedMs={scoringElapsedMs} />
              )}
              {status.kind === "error" && (
                <p className="animate-fade-up text-coral">{status.message}</p>
              )}
              {/* Extraction failed but the clip and its opening frame survive:
                  reopen the framing card instead of stranding the player. The
                  mark and trim they set are theirs; a failed render pass is
                  not a reason to make them re-pick the file (D-091). */}
              {status.kind === "error" && lastOpening && !openingPick && (
                <button
                  type="button"
                  onClick={() => setOpeningPick(lastOpening)}
                  className="chip mt-3"
                >
                  Re-mark and try again
                </button>
              )}
              {status.kind === "unavailable" && !outOfAnalyses && (
                <p className="animate-fade-up text-chalk">{status.message}</p>
              )}
              {status.kind === "unavailable" && outOfAnalyses && status.needsAccount && (
                <ClaimAccountNotice className="animate-fade-up font-sans" />
              )}
              {status.kind === "unavailable" && outOfAnalyses && !status.needsAccount && (
                // Inside the live region so the refusal is announced, and
                // font-sans so the card escapes the monospace status context
                // around it. The card carries the message itself: this state
                // used to be one line of text with a small link beside a retry
                // button that could not help.
                <LimitNotice
                  className="animate-fade-up font-sans"
                  plan={status.plan ?? null}
                  resetsOn={status.resetsOn ?? null}
                  canBuy={CAN_BUY}
                />
              )}
              {canRetry && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    aria-busy={retrying}
                    disabled={busy}
                    onClick={() => submit(frames, duration, true)}
                    className="btn-ghost flex min-h-11 items-center gap-2 px-4 py-2 text-sm disabled:opacity-40"
                  >
                    {retrying ? (
                      <>
                        <WorkingDots /> Scoring your rep…
                      </>
                    ) : (
                      "Send it again"
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* The scoring wait is the one captive moment in the product: the
                player is watching a progress line for half a minute or more
                with nothing to do. The tester ask fills it. OUTSIDE the
                aria-live region above, deliberately, so a screen reader is not
                interrupted mid-scoring-announcement by a favour; both links in
                the card open new tabs, so tapping one cannot abandon the
                analysis in flight. font-sans escapes the mono status context. */}
            {status.kind === "sending" && TEST_COUNTS_TOWARD_PRODUCTION && (
              <div className="mt-4 animate-fade-up font-sans">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-chalk-dim">
                  While the coach reads your rep
                </p>
                <TesterInvite />
              </div>
            )}
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
              Help improve future analysis?
            </h2>
            <p className="mt-3 text-body text-chalk-dim">
              Allow your uploaded clips and extracted frames to help train future
              analysis features. Your footage stays private to your account
              either way, and you can change this any time from your dashboard.
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
