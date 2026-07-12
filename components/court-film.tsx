"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/motion";

// In-page player for the project-rendered court films (see
// scripts/render-hero-film.mjs). Poster-first and data-frugal: the video
// only loads and plays while on screen, never with sound, and never for
// reduced-motion or data-saver visitors, who get the still poster instead.
// Auto-playing film longer than five seconds needs a user-reachable stop
// (WCAG 2.2.2), so a pause toggle ships with every instance.

type CourtFilmProps = {
  src: string;
  /** VP9 companion, listed first so capable browsers take the smaller file. */
  srcWebm?: string;
  poster: string;
  /** Describes the film for assistive tech; omit only for pure backdrop use. */
  label?: string;
  className?: string;
  /** Corner offset classes for the pause control, e.g. "bottom-3 right-3". */
  controlCorner?: string;
  /** Alt text for the reduced-motion poster; decorative posters pass "". */
  posterAlt?: string;
  sizes?: string;
  /** Cover-crop focus, e.g. "72% 50%" to keep the player in frame on narrow screens. */
  objectPosition?: string;
};

function saveDataRequested() {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

export function CourtFilm({
  src,
  srcWebm,
  poster,
  label,
  className = "",
  controlCorner = "bottom-3 right-3",
  posterAlt = "",
  sizes = "100vw",
  objectPosition,
}: CourtFilmProps) {
  const reducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [stillOnly, setStillOnly] = useState(false);

  useEffect(() => {
    setStillOnly(saveDataRequested());
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (userPaused) {
      video.pause();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.2 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [userPaused, reducedMotion, stillOnly]);

  const showVideo = !reducedMotion && !stillOnly;

  // Callers position the root themselves (e.g. "absolute inset-0" inside a
  // sized frame) so the fill video/poster always has a containing block.
  return (
    <div className={className}>
      {showVideo ? (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="none"
          poster={poster}
          aria-label={label}
          aria-hidden={label ? undefined : true}
          tabIndex={label ? undefined : -1}
          className="absolute inset-0 h-full w-full object-cover"
          style={objectPosition ? { objectPosition } : undefined}
        >
          {srcWebm && <source src={srcWebm} type="video/webm" />}
          <source src={src} type="video/mp4" />
        </video>
      ) : (
        <Image
          src={poster}
          alt={posterAlt}
          fill
          sizes={sizes}
          className="object-cover"
          style={objectPosition ? { objectPosition } : undefined}
        />
      )}
      {showVideo && (
        <button
          type="button"
          onClick={() => setUserPaused((paused) => !paused)}
          aria-label={userPaused ? "Play the film" : "Pause the film"}
          aria-pressed={userPaused}
          className={`icon-btn absolute z-10 border border-line bg-navy/70 backdrop-blur-md ${controlCorner}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden
            focusable="false"
          >
            {userPaused ? (
              <path d="M8 5.5v13l11-6.5z" />
            ) : (
              <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
            )}
          </svg>
        </button>
      )}
    </div>
  );
}
