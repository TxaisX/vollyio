"use client";

import { useReducedMotion } from "@/components/motion";

// The Sideout court-vision film: a 10s seamless loop staged for capture at
// 1280x720 (scripts/render-hero-film.mjs) and served as MP4 on the landing
// page. Every animation runs exactly FILM_SECONDS with infinite iterations,
// so the scene state at t equals the state at t + FILM_SECONDS and any
// whole-cycle capture window loops without a seam.
//
// The photo is placed at its cover-crop geometry with explicit pixels
// (1774x888 source scaled to 720 tall, centered) so the skeleton overlay
// coordinates below are deterministic stage pixels, not object-fit guesses.

export const FILM_SECONDS = 10;

type Variant = "film" | "ambient";

type Point = readonly [number, number];

// Stage-pixel joints for the jump-serve player in volleyball-hero.webp,
// calibrated against the un-drifted 1280x720 composition (?debug=1).
const J = {
  head: [856, 166] as Point,
  neck: [874, 198] as Point,
  shoulderR: [895, 206] as Point,
  elbowR: [943, 182] as Point,
  handR: [997, 153] as Point,
  shoulderL: [858, 212] as Point,
  elbowL: [836, 194] as Point,
  handL: [846, 164] as Point,
  hip: [917, 340] as Point,
  kneeR: [928, 426] as Point,
  ankleR: [856, 506] as Point,
  kneeL: [900, 398] as Point,
  ankleL: [812, 448] as Point,
};

const BALL: Point = [925, 48];

const BONES: ReadonlyArray<readonly [Point, Point]> = [
  [J.neck, J.shoulderR],
  [J.shoulderR, J.elbowR],
  [J.elbowR, J.handR],
  [J.neck, J.shoulderL],
  [J.shoulderL, J.elbowL],
  [J.elbowL, J.handL],
  [J.neck, J.hip],
  [J.hip, J.kneeR],
  [J.kneeR, J.ankleR],
  [J.hip, J.kneeL],
  [J.kneeL, J.ankleL],
];

const TRACER = `M ${BALL[0]} ${BALL[1]} Q 1120 64 1276 268`;

const CHIPS: ReadonlyArray<readonly [string, string]> = [
  ["Contact height", "1.42 body heights"],
  ["Elbow angle at contact", "158°"],
  ["Shoulder-hip separation", "38° apart"],
];

// Generates a pop-in keyframe block pinned to the master loop timeline:
// hidden until `at`%, settled by `at + 3`%, held, then released to the
// group fade (the parent handles the loop-out).
function pop(name: string, at: number) {
  return `@keyframes ${name} {
    0%, ${at}% { opacity: 0; transform: translateY(10px) scale(0.96); }
    ${at + 3}%, 100% { opacity: 1; transform: none; }
  }`;
}

function popCss(names: ReadonlyArray<readonly [string, number]>) {
  return names.map(([name, at]) => pop(name, at)).join("\n");
}

const JOINT_ORDER: ReadonlyArray<readonly [string, Point, boolean]> = [
  ["head", J.head, true],
  ["neck", J.neck, false],
  ["shoulder-r", J.shoulderR, false],
  ["elbow-r", J.elbowR, false],
  ["hand-r", J.handR, true],
  ["shoulder-l", J.shoulderL, false],
  ["elbow-l", J.elbowL, false],
  ["hand-l", J.handL, false],
  ["hip", J.hip, true],
  ["knee-r", J.kneeR, false],
  ["ankle-r", J.ankleR, false],
  ["knee-l", J.kneeL, false],
  ["ankle-l", J.ankleL, false],
];

const FILM_CSS = `
.film-stage {
  position: relative;
  width: 1280px;
  height: 720px;
  overflow: hidden;
  background: var(--color-navy);
  font-variant-numeric: tabular-nums;
}
.film-world {
  position: absolute;
  inset: 0;
  transform-origin: 72% 28%;
  animation: film-drift ${FILM_SECONDS}s linear infinite;
}
.film-photo {
  position: absolute;
  left: -79px;
  top: 0;
  width: 1438px;
  height: 720px;
  max-width: none;
  filter: saturate(0.88) contrast(1.05);
}
@keyframes film-drift {
  0%, 100% { transform: scale(1.03); }
  50% { transform: scale(1.055); }
}
.film-vignette {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 90% at 62% 34%, transparent 52%, color-mix(in oklab, var(--color-navy) 78%, transparent) 100%),
    linear-gradient(to top, color-mix(in oklab, var(--color-navy) 62%, transparent), transparent 34%);
}
.film-scan {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 120px;
  opacity: 0;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in oklab, var(--color-gold) 26%, transparent) 62%,
    color-mix(in oklab, var(--color-gold) 85%, transparent) 98%,
    transparent
  );
  animation: film-scan ${FILM_SECONDS}s linear infinite;
}
@keyframes film-scan {
  0%, 5% { transform: translateX(-140px); opacity: 0; }
  7% { opacity: 0.95; }
  15% { opacity: 0.95; }
  17%, 100% { transform: translateX(1340px); opacity: 0; }
}
.film-overlays {
  position: absolute;
  inset: 0;
  animation: film-overlays-out ${FILM_SECONDS}s linear infinite;
}
@keyframes film-overlays-out {
  0%, 91% { opacity: 1; }
  96%, 100% { opacity: 0; }
}
.film-bone {
  stroke: var(--color-teal);
  stroke-width: 2.5;
  stroke-linecap: round;
  fill: none;
  opacity: 0;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: film-bone ${FILM_SECONDS}s linear infinite;
  filter: drop-shadow(0 0 6px color-mix(in oklab, var(--color-teal) 55%, transparent));
}
@keyframes film-bone {
  0%, 14% { stroke-dashoffset: 1; opacity: 0; }
  15% { opacity: 0.9; }
  26%, 100% { stroke-dashoffset: 0; opacity: 0.9; }
}
.film-joint {
  fill: var(--color-chalk);
  opacity: 0;
}
.film-joint-key {
  fill: var(--color-gold);
}
.film-ball-ring {
  fill: none;
  stroke: var(--color-gold);
  stroke-width: 2;
  opacity: 0;
  animation: film-ball-ring ${FILM_SECONDS}s linear infinite;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes film-ball-ring {
  0%, 26% { opacity: 0; transform: scale(1.6); }
  30% { opacity: 0.95; transform: scale(1); }
  91% { opacity: 0.95; transform: scale(1); }
  96%, 100% { opacity: 0; transform: scale(1); }
}
.film-tracer {
  fill: none;
  stroke: var(--color-gold);
  stroke-width: 2;
  stroke-dasharray: 0.03 0.022;
  stroke-dashoffset: 1.052;
  opacity: 0;
  animation: film-tracer ${FILM_SECONDS}s linear infinite;
}
@keyframes film-tracer {
  0%, 28% { stroke-dashoffset: 1.052; opacity: 0; }
  30% { opacity: 0.85; }
  42%, 100% { stroke-dashoffset: 0; opacity: 0.85; }
}
.film-comet {
  position: absolute;
  left: -7px;
  top: -7px;
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  background: var(--color-gold);
  box-shadow: var(--shadow-glow);
  opacity: 0;
  offset-path: path("${TRACER}");
  offset-rotate: 0deg;
  animation: film-comet ${FILM_SECONDS}s linear infinite;
}
@keyframes film-comet {
  0%, 29% { offset-distance: 0%; opacity: 0; }
  31% { opacity: 1; }
  42% { offset-distance: 100%; opacity: 1; }
  44%, 100% { offset-distance: 100%; opacity: 0; }
}
.film-hud {
  position: absolute;
}
.film-chip-card {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  width: fit-content;
  border: 1px solid color-mix(in oklab, var(--color-chalk) 14%, transparent);
  border-left: 2px solid var(--color-gold);
  border-radius: 0.625rem;
  padding: 0.65rem 1rem;
  background: color-mix(in oklab, var(--color-navy) 82%, transparent);
  backdrop-filter: blur(10px);
}
.film-score-ring {
  fill: none;
  stroke: color-mix(in oklab, var(--color-chalk) 16%, transparent);
  stroke-width: 5;
}
.film-score-arc {
  fill: none;
  stroke: var(--color-gold);
  stroke-width: 5;
  stroke-linecap: round;
  stroke-dasharray: 0.82 1;
  stroke-dashoffset: 0.82;
  animation: film-score-arc ${FILM_SECONDS}s linear infinite;
}
@keyframes film-score-arc {
  0%, 52% { stroke-dashoffset: 0.82; }
  63%, 100% { stroke-dashoffset: 0; }
}
${popCss([
  ["film-caption-in", 8],
  ["film-joint-a", 16],
  ["film-joint-b", 18],
  ["film-joint-c", 20],
  ["film-joint-d", 22],
  ["film-joint-e", 24],
  ["film-chip-a", 34],
  ["film-chip-b", 40],
  ["film-chip-c", 46],
  ["film-score-in", 52],
  ["film-fix-in", 62],
])}
.film-joint-pop {
  transform-box: fill-box;
  transform-origin: center;
}
.film-debug * {
  animation: none !important;
}
.film-debug .film-bone { stroke-dashoffset: 0; opacity: 0.9; }
.film-debug .film-joint-pop { opacity: 1; transform: none; }
.film-debug .film-tracer { stroke-dashoffset: 0; opacity: 0.85; }
.film-debug .film-ball-ring { opacity: 0.95; transform: scale(1); }
.film-debug .film-comet { opacity: 1; offset-distance: 100%; }
.film-debug .film-scan { opacity: 0; }
.film-debug .film-world { transform: none; }
.film-debug .film-hud-pop { opacity: 1; transform: none; }
`;

function jointAnim(index: number) {
  const cycle = ["film-joint-a", "film-joint-b", "film-joint-c", "film-joint-d", "film-joint-e"];
  return cycle[index % cycle.length];
}

export function FilmScene({
  variant = "film",
  debug = false,
}: {
  variant?: Variant;
  debug?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const showStory = variant === "film";

  return (
    <main
      aria-label="Sideout court vision film. A jump serve is read by the coaching service: the player's motion is traced, the ball path is projected, and the measured checkpoints and score appear."
      className="grid min-h-svh place-items-center bg-navy"
    >
      <style dangerouslySetInnerHTML={{ __html: FILM_CSS }} />
      <div className={`film-stage${debug ? " film-debug" : ""}`} aria-hidden="true">
        <div className="film-world">
          {/* Deterministic pixel placement for overlay registration; the
              next/image pipeline would reintroduce object-fit ambiguity. The
              tracking overlay lives inside the same drifting container so it
              stays locked to the player through the whole cycle. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/volleyball-hero.webp" alt="" className="film-photo" />
          {!reducedMotion && (
            <div className="film-overlays">
              <svg viewBox="0 0 1280 720" width="1280" height="720" className="absolute inset-0">
                {BONES.map(([a, b], i) => (
                  <line
                    key={i}
                    x1={a[0]}
                    y1={a[1]}
                    x2={b[0]}
                    y2={b[1]}
                    pathLength={1}
                    className="film-bone"
                  />
                ))}
                <circle
                  cx={J.head[0]}
                  cy={J.head[1] - 4}
                  r={17}
                  pathLength={1}
                  fill="none"
                  className="film-bone"
                />
                {JOINT_ORDER.map(([key, p, isKey], i) => (
                  <circle
                    key={key}
                    cx={p[0]}
                    cy={p[1]}
                    r={isKey ? 5 : 3.5}
                    className={`film-joint film-joint-pop ${isKey ? "film-joint-key" : ""}`}
                    style={{ animation: `${jointAnim(i)} ${FILM_SECONDS}s linear infinite` }}
                  />
                ))}
                <circle cx={BALL[0]} cy={BALL[1]} r={30} className="film-ball-ring" />
                <path d={TRACER} pathLength={1} className="film-tracer" />
              </svg>
              <div className="film-comet" />
            </div>
          )}
        </div>
        <div className="film-vignette" />
        {!reducedMotion && <div className="film-scan" />}

        {!reducedMotion && (
          <div className="film-overlays">
            {showStory && (
              <>
                <div className="film-hud font-mono left-16 top-14">
                  <div
                    className="film-hud-pop flex items-center gap-4"
                    style={{ animation: `film-score-in ${FILM_SECONDS}s linear infinite` }}
                  >
                    <svg viewBox="0 0 76 76" width="76" height="76">
                      <circle cx="38" cy="38" r="33" pathLength={1} className="film-score-ring" />
                      <circle
                        cx="38"
                        cy="38"
                        r="33"
                        pathLength={1}
                        className="film-score-arc"
                        transform="rotate(-90 38 38)"
                      />
                      <text
                        x="38"
                        y="45"
                        textAnchor="middle"
                        fill="var(--color-gold)"
                        fontFamily="var(--font-display)"
                        fontSize="24"
                        fontWeight="700"
                      >
                        82
                      </text>
                    </svg>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-chalk-dim">
                        Serve analysis
                      </p>
                      <p className="mt-1 font-display text-lg font-bold tracking-normal text-chalk">
                        Jump serve, read in full
                      </p>
                    </div>
                  </div>
                  <div
                    className="film-hud-pop mt-5 max-w-xs rounded-control border-l-2 border-gold bg-navy/80 p-3.5 backdrop-blur-md"
                    style={{ animation: `film-fix-in ${FILM_SECONDS}s linear infinite` }}
                  >
                    <p className="text-[10px] uppercase tracking-[0.16em] text-gold">
                      Priority fix &middot; frame 12
                    </p>
                    <p className="mt-1.5 font-sans text-sm leading-snug normal-case text-chalk">
                      Meet the ball six inches farther into the court.
                    </p>
                  </div>
                </div>

                <div className="film-hud font-mono bottom-14 left-16 space-y-2.5">
                  {CHIPS.map(([label, value], i) => (
                    <div
                      key={label}
                      className="film-chip-card film-hud-pop"
                      style={{
                        animation: `film-chip-${["a", "b", "c"][i]} ${FILM_SECONDS}s linear infinite`,
                      }}
                    >
                      <span className="text-[10px] uppercase tracking-[0.16em] text-chalk-dim">
                        {label}
                      </span>
                      <span className="text-sm font-medium text-gold">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="film-hud font-mono bottom-14 right-16">
                  <p
                    className="film-hud-pop text-[11px] uppercase tracking-[0.24em] text-chalk-dim"
                    style={{ animation: `film-caption-in ${FILM_SECONDS}s linear infinite` }}
                  >
                    Sideout <span className="text-gold">&middot;</span> film room
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
