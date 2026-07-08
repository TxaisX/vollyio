"use client";

import { useEffect, useRef, useState } from "react";

export type PlayerFrame = { url: string; time_s: number | null; highlighted: boolean };
export type BallPos = { x: number; y: number; visible: boolean };

const FRAME_MS = 700;

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
      <span className="block h-6 w-6 rounded-full border-2 border-gold shadow-[0_0_0_2px_rgba(11,18,32,0.55)]" />
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
}: {
  clipUrl: string;
  frames: PlayerFrame[];
  focusIndex?: number | null;
  contactIndex?: number | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  if (failed) return <FramePlayer frames={frames} focusIndex={focusIndex} contactIndex={contactIndex} />;

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

      <div className="overflow-hidden rounded-lg bg-navy">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={clipUrl}
          controls
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          className="block max-h-[70vh] w-full"
        />
      </div>

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
                  title={f.time_s != null ? `Jump to ${f.time_s}s` : `Frame ${i + 1}`}
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

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % frames.length);
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [playing, frames.length]);

  const current = frames[active];
  const currentBall = ball?.get(active);

  return (
    <div>
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-gold">
        Frame by frame
      </p>

      <div className="relative overflow-hidden rounded-lg bg-navy">
        {current?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={`Frame ${active + 1}`}
            className="block aspect-video w-full object-contain"
          />
        ) : (
          <div className="aspect-video w-full" />
        )}
        {currentBall && <BallMarker pos={currentBall} />}
        <span className="absolute left-2 top-2 rounded bg-navy/85 px-2 py-1 font-mono text-xs text-chalk">
          {current?.time_s != null ? `${current.time_s}s` : `Frame ${active + 1}`}
        </span>
        <span className="absolute right-2 top-2 rounded bg-navy/85 px-2 py-1 font-mono text-xs text-chalk-dim">
          {active + 1} / {frames.length}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="btn-primary px-5 py-2 text-sm"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setActive((i) => (i - 1 + frames.length) % frames.length);
          }}
          className="chip"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setActive((i) => (i + 1) % frames.length);
          }}
          className="chip"
        >
          Next
        </button>
      </div>

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
