"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LM, type BallPoint, type KeypointsFile, type TimedBox } from "@/lib/pose/types";
import { boxAtTime } from "@/lib/pose/kinematics";
import { ballAtTime } from "@/lib/pose/ball-track";
import { activeAbsence, absenceLabel } from "@/lib/pose/track-state";
import type { ContinuityAbsenceWire, ContinuityWire } from "@/lib/analysis-types";

export type PlayerFrame = { url: string; time_s: number | null; highlighted: boolean };
export type BallPos = { x: number; y: number; visible: boolean };
// Flat [x, y, z, v, ...] landmark array per sent-frame index.
export type FrameSkeletons = Map<number, number[]>;

const FRAME_MS = 700;

// Skeleton bone graph over the 33-landmark body model.
const BONES: [number, number][] = [
  [LM.leftShoulder, LM.rightShoulder],
  [LM.leftShoulder, LM.leftElbow],
  [LM.leftElbow, LM.leftWrist],
  [LM.rightShoulder, LM.rightElbow],
  [LM.rightElbow, LM.rightWrist],
  [LM.leftShoulder, LM.leftHip],
  [LM.rightShoulder, LM.rightHip],
  [LM.leftHip, LM.rightHip],
  [LM.leftHip, LM.leftKnee],
  [LM.leftKnee, LM.leftAnkle],
  [LM.rightHip, LM.rightKnee],
  [LM.rightKnee, LM.rightAnkle],
  [LM.leftAnkle, LM.leftHeel],
  [LM.rightAnkle, LM.rightHeel],
];
const SKELETON_MIN_V = 0.5;

/** Tracked body lines over the frame, in normalized image coordinates. */
function SkeletonOverlay({ pts }: { pts: number[] }) {
  const at = (i: number) => ({ x: pts[i * 4], y: pts[i * 4 + 1], v: pts[i * 4 + 3] });
  return (
    <svg
      aria-hidden
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {BONES.map(([a, b], i) => {
        const pa = at(a);
        const pb = at(b);
        if (pa.v < SKELETON_MIN_V || pb.v < SKELETON_MIN_V) return null;
        return (
          <line
            key={i}
            x1={pa.x}
            y1={pa.y}
            x2={pb.x}
            y2={pb.y}
            strokeWidth={0.006}
            strokeLinecap="round"
            style={{ stroke: "var(--color-teal)", opacity: 0.85 }}
          />
        );
      })}
      {BONES.flat()
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .map((i) => {
          const p = at(i);
          if (p.v < SKELETON_MIN_V) return null;
          return (
            <circle
              key={`j${i}`}
              cx={p.x}
              cy={p.y}
              r={0.007}
              style={{ fill: "var(--color-chalk)", opacity: 0.9 }}
            />
          );
        })}
    </svg>
  );
}

// Normalized landmark and ball coordinates are relative to the video/image
// content, which letterboxes inside its container when aspects differ
// (portrait phone clips especially). This inner-box style pins overlays to
// the actual content.
function contentBoxStyle(
  containerAspect: number | null,
  mediaAspect: number | null,
): React.CSSProperties {
  if (!containerAspect || !mediaAspect || !isFinite(containerAspect) || !isFinite(mediaAspect)) {
    return { position: "absolute", inset: 0 };
  }
  if (Math.abs(containerAspect - mediaAspect) < 0.01) {
    return { position: "absolute", inset: 0 };
  }
  if (mediaAspect > containerAspect) {
    const heightPct = (containerAspect / mediaAspect) * 100;
    return {
      position: "absolute",
      left: 0,
      width: "100%",
      top: `${(100 - heightPct) / 2}%`,
      height: `${heightPct}%`,
    };
  }
  const widthPct = (mediaAspect / containerAspect) * 100;
  return {
    position: "absolute",
    top: 0,
    height: "100%",
    left: `${(100 - widthPct) / 2}%`,
    width: `${widthPct}%`,
  };
}

/** Consistent accessible name for a frame thumbnail across both strips. */
function frameName(i: number, timeS: number | null) {
  return timeS != null ? `Frame ${i + 1}, ${timeS}s` : `Frame ${i + 1}`;
}

type ViewerProps = {
  clipUrl: string | null;
  frames: PlayerFrame[];
  ball?: Map<number, BallPos>;
  focusIndex?: number | null;
  contactIndex?: number | null;
  skeletons?: FrameSkeletons;
  keypointsUrl?: string | null;
  ballEstimated?: boolean;
  continuity?: ContinuityWire | null;
};

export function ClipViewer({
  clipUrl,
  frames,
  ball,
  focusIndex,
  contactIndex,
  skeletons,
  keypointsUrl,
  ballEstimated,
  continuity,
}: ViewerProps) {
  if (clipUrl) {
    return (
      <ClipPlayer
        clipUrl={clipUrl}
        frames={frames}
        focusIndex={focusIndex}
        contactIndex={contactIndex}
        keypointsUrl={keypointsUrl ?? null}
        fallbackSkeletons={skeletons}
        fallbackBall={ball}
        ballEstimated={ballEstimated}
        continuity={continuity}
      />
    );
  }
  return (
    <FramePlayer
      frames={frames}
      ball={ball}
      focusIndex={focusIndex}
      contactIndex={contactIndex}
      skeletons={skeletons}
      ballEstimated={ballEstimated}
      continuity={continuity}
    />
  );
}

/** A gold crosshair marking the ball, positioned by normalized (0-1) coords. */
function BallMarker({ pos }: { pos: BallPos }) {
  if (!pos.visible) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
    >
      <span className="block h-6 w-6 rounded-full border-2 border-gold ring-2 ring-navy/55" />
      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold" />
    </span>
  );
}

const ABSENCE_ARROW: Record<string, string> = {
  left: "←",
  right: "→",
  top: "↑",
  bottom: "↓",
};
const ABSENCE_POS: Record<string, string> = {
  left: "left-2 top-1/2 -translate-y-1/2",
  right: "right-2 top-1/2 -translate-y-1/2",
  top: "top-2 left-1/2 -translate-x-1/2",
  bottom: "bottom-2 left-1/2 -translate-x-1/2",
};

/** Edge chip shown while the playhead sits inside a tracked absence. */
function AbsenceBadge({ absence }: { absence: ContinuityAbsenceWire }) {
  const offFrame = absence.kind === "off_frame";
  const pos = offFrame ? ABSENCE_POS[absence.edge ?? "left"] : "bottom-2 left-1/2 -translate-x-1/2";
  return (
    <span
      className={`pointer-events-none absolute z-10 ${pos} flex items-center gap-1.5 rounded border border-dashed border-gold/80 bg-navy/85 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-gold`}
    >
      {offFrame && <span aria-hidden>{ABSENCE_ARROW[absence.edge ?? "left"]}</span>}
      {absenceLabel(absence)}
    </span>
  );
}

/** Small mono badge used to mark the contact / focus frame in a strip. */
function StripTag({ text }: { text: string }) {
  return (
    <span className="absolute bottom-1 left-1 rounded bg-gold px-1 py-px font-mono text-[9px] uppercase tracking-wide text-navy">
      {text}
    </span>
  );
}

function stripTag(i: number, focusIndex?: number | null, contactIndex?: number | null) {
  if (i === focusIndex) return "focus";
  if (i === contactIndex) return "contact";
  return null;
}

/** Video always visible, with the analyzed frames as a seek strip underneath. */
function ClipPlayer({
  clipUrl,
  frames,
  focusIndex,
  contactIndex,
  keypointsUrl,
  fallbackSkeletons,
  fallbackBall,
  ballEstimated,
  continuity,
}: {
  clipUrl: string;
  frames: PlayerFrame[];
  focusIndex?: number | null;
  contactIndex?: number | null;
  keypointsUrl: string | null;
  fallbackSkeletons?: FrameSkeletons;
  fallbackBall?: Map<number, BallPos>;
  ballEstimated?: boolean;
  continuity?: ContinuityWire | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [nowS, setNowS] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [track, setTrack] = useState<KeypointsFile | null>(null);
  const [traceOn, setTraceOn] = useState(true);
  const [playheadPts, setPlayheadPts] = useState<number[] | null>(null);
  const [playheadBall, setPlayheadBall] = useState<{ x: number; y: number } | null>(null);
  const [playheadOthers, setPlayheadOthers] = useState<TimedBox[]>([]);
  const [mediaAspect, setMediaAspect] = useState<number | null>(null);
  const [boxAspect, setBoxAspect] = useState<number | null>(null);

  // Dense keypoints are optional and load lazily; absence means no trace.
  // Version 2 adds the timed ball path; version-1 files still draw skeletons.
  useEffect(() => {
    if (!keypointsUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(keypointsUrl);
        if (!res.ok) return;
        const file = (await res.json()) as KeypointsFile;
        if (
          !cancelled &&
          (file?.version === 1 || file?.version === 2) &&
          Array.isArray(file.frames)
        ) {
          setTrack(file);
        }
      } catch {
        // No trace; the video plays exactly as before.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [keypointsUrl]);

  // The path the ball marker follows: the dense on-device track when the
  // sidecar carries one, otherwise the sparse per-frame marks placed on the
  // timeline via each frame's stored clip time.
  const ballPath = useMemo<BallPoint[]>(() => {
    if (track?.ball && track.ball.length > 1) return track.ball;
    if (!fallbackBall) return [];
    const pts: BallPoint[] = [];
    frames.forEach((f, i) => {
      const b = fallbackBall.get(i);
      if (b?.visible && f.time_s != null) {
        pts.push({ t: f.time_s, x: b.x, y: b.y, score: 1 });
      }
    });
    return pts.sort((a, b) => a.t - b.t);
  }, [track, fallbackBall, frames]);
  // Sparse marks sit up to ~1s apart; the dense track interpolates tightly.
  const ballGapS = track?.ball && track.ball.length > 1 ? 0.6 : 1.2;

  // Follow the playhead: nearest tracked instant within 150ms of currentTime.
  useEffect(() => {
    const wantSkeleton = !!track && traceOn;
    const wantBall = traceOn && ballPath.length > 0;
    if (!wantSkeleton && !wantBall) {
      setPlayheadPts(null);
      setPlayheadBall(null);
      setPlayheadOthers([]);
      return;
    }
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        const t = v.currentTime;
        let best: number[] | null = null;
        if (wantSkeleton && track) {
          let bestD = 0.15;
          for (const lf of track.frames) {
            const d = Math.abs(lf.t - t);
            if (d < bestD) {
              bestD = d;
              best = lf.pts.flatMap((p) => [p.x, p.y, p.z, p.v]);
            }
          }
        }
        setPlayheadPts(best);
        setPlayheadBall(wantBall ? ballAtTime(ballPath, t, ballGapS) : null);
        const otherSeries = wantSkeleton ? track?.others : undefined;
        setPlayheadOthers(
          otherSeries?.length
            ? otherSeries
                .map((s) => boxAtTime(s, t))
                .filter((b): b is TimedBox => b != null)
            : [],
        );
        const box = boxRef.current;
        if (v.videoWidth && v.videoHeight) setMediaAspect(v.videoWidth / v.videoHeight);
        if (box && box.clientHeight > 0) setBoxAspect(box.clientWidth / box.clientHeight);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [track, traceOn, ballPath, ballGapS]);

  if (failed) {
    return (
      <FramePlayer
        frames={frames}
        ball={fallbackBall}
        focusIndex={focusIndex}
        contactIndex={contactIndex}
        skeletons={fallbackSkeletons}
        ballEstimated={ballEstimated}
      />
    );
  }

  const seekTo = (i: number) => {
    const f = frames[i];
    setActive(i);
    const v = videoRef.current;
    if (v && f?.time_s != null) {
      v.currentTime = f.time_s;
      v.pause();
    }
  };

  return (
    <div>
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-gold">
        Clip
      </p>

      <div ref={boxRef} className="relative overflow-hidden rounded-lg bg-navy">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={clipUrl}
          aria-label="Your analyzed rep"
          controls
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          onTimeUpdate={(e) => setNowS((e.target as HTMLVideoElement).currentTime)}
          className="block max-h-[70vh] w-full"
        />
        {(() => {
          const absence = activeAbsence(continuity, nowS);
          return absence ? <AbsenceBadge absence={absence} /> : null;
        })()}
        {(playheadPts || playheadBall || playheadOthers.length > 0) && (
          <div style={contentBoxStyle(boxAspect, mediaAspect)} aria-hidden>
            {playheadOthers.map((b, i) => (
              <span
                key={i}
                className="absolute rounded border border-chalk-dim/50"
                style={{
                  left: `${b.left * 100}%`,
                  top: `${b.top * 100}%`,
                  width: `${b.width * 100}%`,
                  height: `${b.height * 100}%`,
                }}
              />
            ))}
            {playheadPts && <SkeletonOverlay pts={playheadPts} />}
            {playheadBall && (
              <BallMarker pos={{ x: playheadBall.x, y: playheadBall.y, visible: true }} />
            )}
          </div>
        )}
      </div>

      {(track || ballPath.length > 0) && (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTraceOn((v) => !v)}
            aria-pressed={traceOn}
            className={`chip min-h-11 ${traceOn ? "chip-active" : ""}`}
          >
            Motion trace
          </button>
          <span className="font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
            {(ballPath.length === 0
              ? "Tracked body lines over your rep"
              : track
                ? `Body lines and ${ballEstimated ? "estimated" : "measured"} ball over your rep`
                : `${ballEstimated ? "Estimated" : "Measured"} ball over your rep`) +
              (track?.others?.length ? " · other players boxed" : "")}
          </span>
        </div>
      )}

      {frames.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-chalk-dim">
            Frames analyzed for ratings
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {frames.map((f, i) => {
              const tag = stripTag(i, focusIndex, contactIndex);
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => seekTo(i)}
                  aria-current={i === active ? "true" : undefined}
                  aria-label={frameName(i, f.time_s)}
                  title={frameName(i, f.time_s)}
                  className={`relative w-20 shrink-0 overflow-hidden rounded-md border-2 transition-transform hover:scale-[1.03] ${
                    i === active
                      ? "border-gold"
                      : f.highlighted
                        ? "border-gold/40"
                        : "border-transparent"
                  }`}
                >
                  {f.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.url}
                      alt={`Frame ${i + 1}`}
                      className="block w-full object-cover"
                      style={{ height: 56 }}
                    />
                  )}
                  <span
                    className={`absolute left-1 top-1 rounded px-1 py-px font-mono text-[9px] ${
                      i === active ? "bg-gold text-navy" : "bg-navy/85 text-chalk"
                    }`}
                  >
                    {f.time_s != null ? `${f.time_s}s` : i + 1}
                  </span>
                  {tag && <StripTag text={tag} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Fallback when there is no clip: step through the frames themselves. */
function FramePlayer({
  frames,
  ball,
  focusIndex,
  contactIndex,
  skeletons,
  ballEstimated,
  continuity,
}: {
  frames: PlayerFrame[];
  ball?: Map<number, BallPos>;
  focusIndex?: number | null;
  contactIndex?: number | null;
  skeletons?: FrameSkeletons;
  ballEstimated?: boolean;
  continuity?: ContinuityWire | null;
}) {
  const [active, setActive] = useState(
    focusIndex != null && focusIndex >= 0 && focusIndex < frames.length ? focusIndex : 0,
  );
  const [playing, setPlaying] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [imgAspect, setImgAspect] = useState<number | null>(null);

  // Re-read reduced-motion on every change so auto-advance never starts (and
  // settles paused) when the user turns motion off mid-session.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduceMotion(mq.matches);
      if (mq.matches) setPlaying(false);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!playing || frames.length === 0 || reduceMotion) return;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % frames.length);
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [playing, frames.length, reduceMotion]);

  if (frames.length === 0) {
    return (
      <div>
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-gold">
          Frame by frame
        </p>
        <div className="card border-dashed border-line p-10 text-center text-sm text-chalk-dim">
          No frames to show for this rep.
        </div>
      </div>
    );
  }

  const current = frames[active];
  const currentBall = ball?.get(active);
  const currentSkeleton = skeletons?.get(active);
  const announcement = current
    ? `Frame ${active + 1} of ${frames.length}${
        current.time_s != null ? `, ${current.time_s} seconds` : ""
      }.`
    : "";

  return (
    <div>
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-gold">
        Frame by frame
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="relative overflow-hidden rounded-lg bg-navy">
        {current?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={`Frame ${active + 1}`}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setImgAspect(img.naturalWidth / img.naturalHeight);
              }
            }}
            className="block aspect-video w-full object-contain"
          />
        ) : (
          <div className="aspect-video w-full" />
        )}
        <div style={contentBoxStyle(16 / 9, imgAspect)} aria-hidden>
          {currentSkeleton && <SkeletonOverlay pts={currentSkeleton} />}
          {currentBall && <BallMarker pos={currentBall} />}
        </div>
        {(() => {
          const absence =
            current?.time_s != null ? activeAbsence(continuity, current.time_s) : null;
          return absence ? <AbsenceBadge absence={absence} /> : null;
        })()}
        <span
          aria-hidden
          className="absolute left-2 top-2 rounded bg-navy/85 px-2 py-1 font-mono text-xs text-chalk"
        >
          {current?.time_s != null ? `${current.time_s}s` : `Frame ${active + 1}`}
        </span>
        <span
          aria-hidden
          className="absolute right-2 top-2 rounded bg-navy/85 px-2 py-1 font-mono text-xs text-chalk-dim"
        >
          {active + 1} / {frames.length}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          disabled={reduceMotion}
          className="btn-primary min-h-11 px-5 py-2 text-sm disabled:opacity-40"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setActive((i) => (i - 1 + frames.length) % frames.length);
          }}
          className="chip min-h-11"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setActive((i) => (i + 1) % frames.length);
          }}
          className="chip min-h-11"
        >
          Next
        </button>
      </div>

      {ball && ball.size > 0 && ballEstimated !== false && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
          Ball marker: estimated position
        </p>
      )}

      <div className="mt-4">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-chalk-dim">
          Frames analyzed for ratings
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {frames.map((f, i) => {
            const tag = stripTag(i, focusIndex, contactIndex);
            return (
              <button
                type="button"
                key={i}
                onClick={() => {
                  setPlaying(false);
                  setActive(i);
                }}
                aria-current={i === active ? "true" : undefined}
                aria-label={frameName(i, f.time_s)}
                title={frameName(i, f.time_s)}
                className={`relative w-20 shrink-0 overflow-hidden rounded-md border-2 transition-transform hover:scale-[1.03] ${
                  i === active
                    ? "border-gold"
                    : f.highlighted
                      ? "border-gold/40"
                      : "border-transparent"
                }`}
              >
                {f.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.url}
                    alt={`Frame ${i + 1}`}
                    className="block w-full object-cover"
                    style={{ height: 56 }}
                  />
                )}
                <span
                  className={`absolute left-1 top-1 rounded px-1 py-px font-mono text-[9px] ${
                    i === active ? "bg-gold text-navy" : "bg-navy/85 text-chalk"
                  }`}
                >
                  {f.time_s != null ? `${f.time_s}s` : i + 1}
                </span>
                {tag && <StripTag text={tag} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
