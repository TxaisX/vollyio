"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type PlayerFrame = { url: string; time_s: number | null; highlighted: boolean };
export type BallPos = { x: number; y: number; visible: boolean };

const FRAME_MS = 700;

// A timed ball position on the clip timeline, built from the model's sparse
// per-frame estimates via each frame's stored clip time.
type BallPoint = { t: number; x: number; y: number };

// Linear interpolation between neighbouring marks, abstaining across gaps too
// wide to bridge honestly: a marker gliding through a two-second hole would be
// an invented path, not a followed one.
function ballAtTime(
  path: BallPoint[],
  t: number,
  maxGapS: number,
): { x: number; y: number } | null {
  if (path.length === 0) return null;
  let before: BallPoint | null = null;
  let after: BallPoint | null = null;
  for (const p of path) {
    if (p.t <= t && (!before || p.t > before.t)) before = p;
    if (p.t >= t && (!after || p.t < after.t)) after = p;
  }
  if (before && after && before !== after) {
    if (after.t - before.t > maxGapS) return null;
    const f = (t - before.t) / Math.max(1e-6, after.t - before.t);
    return { x: before.x + (after.x - before.x) * f, y: before.y + (after.y - before.y) * f };
  }
  const nearest = before ?? after;
  if (!nearest || Math.abs(nearest.t - t) > maxGapS / 2) return null;
  return { x: nearest.x, y: nearest.y };
}

// Normalized ball coordinates are relative to the video/image content, which
// letterboxes inside its container when aspects differ (portrait phone clips
// especially). This inner-box style pins overlays to the actual content.
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
};

export function ClipViewer({ clipUrl, frames, ball, focusIndex, contactIndex }: ViewerProps) {
  if (clipUrl) {
    return (
      <ClipPlayer
        clipUrl={clipUrl}
        frames={frames}
        focusIndex={focusIndex}
        contactIndex={contactIndex}
        fallbackBall={ball}
      />
    );
  }
  return (
    <FramePlayer
      frames={frames}
      ball={ball}
      focusIndex={focusIndex}
      contactIndex={contactIndex}
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
  fallbackBall,
}: {
  clipUrl: string;
  frames: PlayerFrame[];
  focusIndex?: number | null;
  contactIndex?: number | null;
  fallbackBall?: Map<number, BallPos>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [traceOn, setTraceOn] = useState(true);
  const [playheadBall, setPlayheadBall] = useState<{ x: number; y: number } | null>(null);
  const [mediaAspect, setMediaAspect] = useState<number | null>(null);
  const [boxAspect, setBoxAspect] = useState<number | null>(null);

  // The path the ball marker follows: the sparse per-frame estimates placed on
  // the timeline via each frame's stored clip time.
  const ballPath = useMemo<BallPoint[]>(() => {
    if (!fallbackBall) return [];
    const pts: BallPoint[] = [];
    frames.forEach((f, i) => {
      const b = fallbackBall.get(i);
      if (b?.visible && f.time_s != null) {
        pts.push({ t: f.time_s, x: b.x, y: b.y });
      }
    });
    return pts.sort((a, b) => a.t - b.t);
  }, [fallbackBall, frames]);
  // Sparse marks sit up to ~1s apart.
  const ballGapS = 1.2;

  // Follow the playhead.
  useEffect(() => {
    const wantBall = traceOn && ballPath.length > 0;
    if (!wantBall) {
      setPlayheadBall(null);
      return;
    }
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        setPlayheadBall(ballAtTime(ballPath, v.currentTime, ballGapS));
        const box = boxRef.current;
        if (v.videoWidth && v.videoHeight) setMediaAspect(v.videoWidth / v.videoHeight);
        if (box && box.clientHeight > 0) setBoxAspect(box.clientWidth / box.clientHeight);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [traceOn, ballPath, ballGapS]);

  if (failed) {
    return (
      <FramePlayer
        frames={frames}
        ball={fallbackBall}
        focusIndex={focusIndex}
        contactIndex={contactIndex}
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
          className="block max-h-[70vh] w-full"
        />
        {playheadBall && (
          <div style={contentBoxStyle(boxAspect, mediaAspect)} aria-hidden>
            <BallMarker pos={{ x: playheadBall.x, y: playheadBall.y, visible: true }} />
          </div>
        )}
      </div>

      {ballPath.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTraceOn((v) => !v)}
            aria-pressed={traceOn}
            className={`chip min-h-11 ${traceOn ? "chip-active" : ""}`}
          >
            Ball marker
          </button>
          <span className="font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
            Estimated ball position over your rep
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
}: {
  frames: PlayerFrame[];
  ball?: Map<number, BallPos>;
  focusIndex?: number | null;
  contactIndex?: number | null;
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
          {currentBall && <BallMarker pos={currentBall} />}
        </div>
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

      {ball && ball.size > 0 && (
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
