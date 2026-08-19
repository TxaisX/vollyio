"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The rep, looping at the top of the breakdown and staying there as you read.
 *
 * THE WHOLE CLIP, not an excerpt. This briefly looped a four-second cut from
 * the middle, which was wrong for a plain reason: the analysis is of the whole
 * clip. Every fix below this player was written against the entire rep, so a
 * crop showed the player less than the words were talking about, and a centre
 * cut is an arbitrary window besides - the video path samples about one frame a
 * second and cannot say when anything happened, so there was never a moment
 * worth centring on. Looping all of it means what is on screen and what is
 * being said are the same rep.
 *
 * Native `loop` does the repeating, so there is no timeupdate handler firing
 * several times a second to hold a window that no longer exists.
 */
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
  const box = useRef<HTMLDivElement>(null);
  // Autoplay is a motion decision, not a playback one. A rep looping forever at
  // the top of the page is exactly the kind of movement `prefers-reduced-motion`
  // exists to stop, so that reader gets a paused player instead of a quieter
  // animation. The controls are on either way, so they lose nothing but the
  // motion.
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(q.matches);
    const onChange = () => setReduced(q.matches);
    q.addEventListener("change", onChange);
    return () => q.removeEventListener("change", onChange);
  }, []);

  // HOW FAR DOWN THE PAGE THIS BLOCK REACHES, published for anything that
  // scrolls to an anchor underneath it. The value chips at the top of the
  // analysis page jump to #strengths, #changes and #drills, and those headings
  // carried a flat scroll-mt-24 (96px) that was correct when nothing was
  // pinned. This block is taller than that on every phone, so without this the
  // heading you asked for lands behind the player. Measured rather than
  // estimated because the height moves with the viewport.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () =>
      root.style.setProperty("--clip-lane", `${Math.round(el.getBoundingClientRect().height)}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--clip-lane");
    };
  }, []);

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
    <div
      ref={box}
      className="sticky top-[var(--clip-top)] z-20 -mx-[var(--clip-bleed)] bg-navy/95 px-[var(--clip-bleed)] pb-2.5 pt-2 backdrop-blur-md"
    >
      {label && (
        <p className="mb-1.5 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-gold-ink">
          {label}
        </p>
      )}
      <video
        src={src}
        poster={poster ?? undefined}
        muted
        playsInline
        // Muted + playsInline is what makes autoplay permitted at all; without
        // both, mobile browsers refuse and the element sits on a black frame.
        autoPlay={!reduced}
        loop
        controls
        preload="metadata"
        className="max-h-[34vh] w-full rounded-card border border-line bg-navy-light object-contain"
      />
    </div>
  );
}
