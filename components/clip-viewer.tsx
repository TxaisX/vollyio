"use client";

import { useEffect, useRef, useState } from "react";

export type PlayerFrame = { url: string; time_s: number | null; highlighted: boolean };

const FRAME_MS = 700;

/** Consistent accessible name for a frame thumbnail across both strips. */
function frameName(i: number, timeS: number | null) {
  return timeS != null ? `Frame ${i + 1}, ${timeS}s` : `Frame ${i + 1}`;
}

type ViewerProps = {
  clipUrl: string | null;
  frames: PlayerFrame[];
  focusIndex?: number | null;
  contactIndex?: number | null;
};

export function ClipViewer({ clipUrl, frames, focusIndex, contactIndex }: ViewerProps) {
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
  return <FramePlayer frames={frames} focusIndex={focusIndex} contactIndex={contactIndex} />;
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

function FrameStrip({
  frames,
  active,
  focusIndex,
  contactIndex,
  onPick,
}: {
  frames: PlayerFrame[];
  active: number | null;
  focusIndex?: number | null;
  contactIndex?: number | null;
  onPick: (i: number) => void;
}) {
  return (
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
              onClick={() => onPick(i)}
              aria-current={i === active ? "true" : undefined}
              aria-label={frameName(i, f.time_s)}
              title={frameName(i, f.time_s)}
              className={`relative w-28 shrink-0 overflow-hidden rounded-md border-2 transition-transform hover:scale-[1.03] ${
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
                  style={{ height: 76 }}
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
  );
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

  if (failed) {
    return <FramePlayer frames={frames} focusIndex={focusIndex} contactIndex={contactIndex} />;
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

      <div className="relative overflow-hidden rounded-lg bg-navy">
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
      </div>

      {frames.length > 0 && (
        <FrameStrip
          frames={frames}
          active={active}
          focusIndex={focusIndex}
          contactIndex={contactIndex}
          onPick={seekTo}
        />
      )}
    </div>
  );
}

/** Fallback when there is no clip: step through the frames themselves. */
function FramePlayer({
  frames,
  focusIndex,
  contactIndex,
}: {
  frames: PlayerFrame[];
  focusIndex?: number | null;
  contactIndex?: number | null;
}) {
  const [active, setActive] = useState(
    focusIndex != null && focusIndex >= 0 && focusIndex < frames.length ? focusIndex : 0,
  );
  const [playing, setPlaying] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

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
            className="block aspect-video w-full object-contain"
          />
        ) : (
          <div className="aspect-video w-full" />
        )}
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

      <FrameStrip
        frames={frames}
        active={active}
        focusIndex={focusIndex}
        contactIndex={contactIndex}
        onPick={(i) => {
          setPlaying(false);
          setActive(i);
        }}
      />
    </div>
  );
}
