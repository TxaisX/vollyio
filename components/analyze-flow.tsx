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
import { Reveal } from "@/components/motion";
import { LimitNotice } from "@/components/limit-notice";
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
import type { AnalyzeRequest } from "@/lib/analysis-types";

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
        const r = Math.max(18, Math.min(W, H) * 0.055);
        // Dark halo first so the ring reads on any background.
        ctx.lineCap = "round";
        ctx.strokeStyle = navy;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = Math.max(6, r * 0.34);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = gold;
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = Math.max(3.5, r * 0.2);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
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

// Fire-and-forget persistence of the extra stored frames after the analysis is
// saved. Failures are silent; the results page handles absence.
function uploadExtraFrames(extras: Frame[], storedFramePaths: string[]) {
  const supabase = createClient();
  const count = Math.min(storedFramePaths.length, extras.length);
  for (let i = 0; i < count; i++) {
    try {
      const b64 = extras[i].dataUrl.split(",")[1];
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      void supabase.storage
        .from("frames")
        .upload(storedFramePaths[i], bytes, { contentType: "image/jpeg", upsert: false })
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
  { atMs: 0, line: "Reading your frames…" },
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
  const extrasRef = useRef<Frame[]>([]);
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
    if (!skill || !discipline || payloadFrames.length === 0) return;
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
    setRetrying(isRetry);
    setStatus({ kind: "sending" });
    const clip = clipRef.current;
    const body: AnalyzeRequest = {
      skill,
      discipline,
      source: "video",
      duration_s: dur,
      has_clip: !!clip,
      clip_ext: clip ? clipExt(clip) : null,
      frames: payloadFrames.map((f) => ({
        index: f.index,
        time_s: f.time_s,
        data: f.dataUrl.split(",")[1],
      })),
      focus_marker: markedRef.current ? true : undefined,
      marker_frame_index:
        markedRef.current && markerIndexRef.current != null
          ? markerIndexRef.current
          : undefined,
      extra_frame_count: extrasRef.current.length,
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
        setRetrying(false);
        setStatus(
          failure.kind === "unavailable"
            ? {
                kind: "unavailable",
                message: failure.message,
                exhausted: res.status === 402,
                plan: planFromReason(failure.reason),
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
      const { analysisId, clipPath, storedFramePaths, xpAwarded } = await res.json();
      if (clip && clipPath) {
        try {
          await createClient()
            .storage.from("clips")
            .upload(clipPath, clip, {
              contentType: (clip.type || "video/webm").split(";")[0],
              upsert: false,
            });
        } catch {
          // Non-fatal: the results page falls back to the frame player.
        }
      }
      if (extrasRef.current.length > 0 && Array.isArray(storedFramePaths)) {
        // Background persistence; navigation does not wait on it.
        uploadExtraFrames(extrasRef.current, storedFramePaths);
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

  // Extraction over the trimmed window, marking the tapped athlete when there
  // is a tap, then submit or preview.
  async function runVideoExtraction(
    blob: Blob,
    target?: Mark,
    window?: TrimWindow,
  ) {
    try {
      const { frames: f, extras, duration_s, debug } = await extractFrames(blob, {
        debug: debugRef.current,
        window,
        markT: target?.t,
        // Shapes the frame budget around this skill's contact phase (D-061).
        skill: skill ?? undefined,
      });
      setStatus({ kind: "reading" });
      extrasRef.current = extras;
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
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't read that clip.",
      });
    }
  }

  // Entry for uploaded clips: pause on the opening frame so the player can
  // mark who to analyze before any analysis runs. Marking is mandatory
  // (D-062), so a clip this browser cannot render a frame from is a dead stop
  // and says so, rather than quietly analyzing whoever the model picks.
  async function handleVideo(blob: Blob) {
    setStatus({ kind: "reading" });
    setFrameDebug(null);
    setOpeningPick(null);
    setLastOpening(null);
    clipRef.current = blob;
    setVideoUrl(URL.createObjectURL(blob));
    try {
      const opening = await openingFrame(blob);
      if (!opening) {
        clipRef.current = null;
        setVideoUrl(null);
        setStatus({
          kind: "error",
          message:
            "This browser couldn't read a frame from that clip, so there's no way to mark your player. On iPhone open Vollyio in Safari (iPhones record HEVC, which other browsers often can't decode); on Android try Chrome. Or re-export the clip as MP4 and try again.",
        });
        return;
      }
      // Long clips get the card too: the trim window makes them analyzable.
      extrasRef.current = [];
      setFrames([]);
      markedRef.current = false;
      markerIndexRef.current = null;
      setMarkerShown(false);
      setDuration(opening.duration_s);
      const pick = { ...opening, blob };
      setLastOpening(pick);
      setOpeningPick(pick);
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't read that clip.",
      });
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
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
        Analyze
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
        Film the rep.
      </h1>

      <div
        className={
          skill && discipline
            ? "mt-8 lg:grid lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:items-start lg:gap-10"
            : "mt-8 max-w-3xl"
        }
      >
        {/* Controls */}
        <div className="min-w-0">
          <div>
            <h2
              id="where-playing"
              className="mb-3 flex items-center gap-2 font-display text-sm font-bold"
            >
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
                className="mb-3 flex items-center gap-2 font-display text-sm font-bold"
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
                className="mb-3 flex items-center gap-2 font-display text-sm font-bold"
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
              {status.kind === "unavailable" && outOfAnalyses && (
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
                        <WorkingDots /> Scoring your rep, frame by frame…
                      </>
                    ) : (
                      "Send it again"
                    )}
                  </button>
                </div>
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
