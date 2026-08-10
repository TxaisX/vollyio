"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The rep, looping at the top of the breakdown and staying there as you read.
 *
 * WHY AN EXCERPT, AND WHY THE CENTRE. A player reading a fix wants to see the
 * thing the fix is about without scrubbing for it, so this loops a short cut
 * rather than the whole clip. The cut is taken from the MIDDLE, and that is a
 * deliberate choice rather than a lazy one: this product cannot honestly say
 * when anything happened. The video path samples about one image a second, and
 * on a clip whose contact was hand-verified at 3.42s six runs answered between
 * 0.27s and 0.60s (see lib/ai/vision.ts). So there is no trustworthy "moment"
 * to centre on, and inventing one would be the same failure D-094 and D-099
 * exist to prevent. The middle of a rep is where the rep is, and it claims
 * nothing the model did not measure.
 *
 * The whole clip is always one tap away, so nothing is hidden by the crop.
 */

// Long enough to read an approach and a contact, short enough that the loop
// comes back around before attention leaves. Production clips average 10.0s,
// so this is roughly the middle 40% of a typical rep.
const EXCERPT_S = 4;

// Under this there is no meaningful middle to cut to, so the clip plays whole.
const MIN_CROPPABLE_S = 6;

export function StickyClip({
  src,
  poster,
  label,
}: {
  src: string;
  poster?: string | null;
  /** "Serve breakdown . Aug 9", the line that says which rep this is. It rides
   *  INSIDE the sticky block rather than above it, because a label that
   *  scrolls away from the clip it names stops being a label a third of the
   *  way down the page. */
  label?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [full, setFull] = useState(false);
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);
  // Autoplay is a motion decision, not a playback one. A rep looping forever at
  // the top of the page is exactly the kind of movement `prefers-reduced-motion`
  // exists to stop, so that reader gets a paused video with controls instead of
  // a quieter animation.
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(q.matches);
    const onChange = () => setReduced(q.matches);
    q.addEventListener("change", onChange);
    return () => q.removeEventListener("change", onChange);
  }, []);

  // The crop is derived from the real duration, which is only known once
  // metadata lands. Deriving it here rather than taking it as a prop keeps this
  // correct for a stored row whose duration was never recorded.
  function onLoadedMetadata() {
    const v = ref.current;
    if (!v || !Number.isFinite(v.duration)) return;
    if (v.duration <= MIN_CROPPABLE_S) {
      setRange(null);
      return;
    }
    const mid = v.duration / 2;
    const half = EXCERPT_S / 2;
    setRange({ start: Math.max(0, mid - half), end: Math.min(v.duration, mid + half) });
    v.currentTime = Math.max(0, mid - half);
  }

  // `loop` alone would replay the WHOLE clip, so the excerpt is held by hand:
  // rewind as soon as playback passes the end of the cut.
  function onTimeUpdate() {
    const v = ref.current;
    if (!v || full || !range) return;
    if (v.currentTime >= range.end || v.currentTime < range.start - 0.25) {
      v.currentTime = range.start;
    }
  }

  function playWhole() {
    const v = ref.current;
    setFull(true);
    if (v) {
      v.currentTime = 0;
      v.controls = true;
      void v.play().catch(() => {});
    }
  }

  const cropping = !full && range != null;

  return (
    // Sticky to the viewport, which is the scroll container: the app shell's
    // only overflow-hidden is on a decorative sibling, not an ancestor.
    //
    // THE OFFSET IS NOT ZERO EVERYWHERE. app/(app)/layout.tsx pins a mobile top
    // bar at `sticky top-0 z-30` that is md:hidden, so a clip pinned at top-0
    // parks its label and the top of the frame underneath it there, while the
    // share page has no such bar. Both numbers come from the host shell as
    // --clip-top and --clip-bleed (app/globals.css), because this component
    // renders under both and a literal would be right in only one. z-20 keeps
    // it under that bar rather than over it, so the two never fight.
    <div className="sticky top-[var(--clip-top)] z-20 -mx-[var(--clip-bleed)] bg-navy/95 px-[var(--clip-bleed)] pb-2.5 pt-2 backdrop-blur-md">
      {label && (
        <p className="mb-1.5 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-gold">
          {label}
        </p>
      )}
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        muted
        playsInline
        // Muted + playsInline is what makes autoplay permitted at all; without
        // both, mobile browsers refuse and the element sits on a black frame.
        autoPlay={!reduced}
        controls={reduced || full}
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        className="max-h-[34vh] w-full rounded-card border border-line bg-navy-light object-contain"
      />
      {cropping && (
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
            Looping the middle {EXCERPT_S}s
          </p>
          <button
            type="button"
            onClick={playWhole}
            className="min-h-9 font-mono text-[10px] uppercase tracking-wide text-teal"
          >
            Play the whole clip
          </button>
        </div>
      )}
    </div>
  );
}
