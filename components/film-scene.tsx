"use client";

import { useReducedMotion } from "@/components/motion";

// The Vollyio court-vision film: a 10s seamless loop staged for capture at
// 1280x720 (scripts/render-hero-film.mjs) and served as MP4 on the landing
// page. Every animation runs exactly FILM_SECONDS with infinite iterations,
// so the scene state at t equals the state at t + FILM_SECONDS and any
// whole-cycle capture window loops without a seam.
//
// This mirrors the REAL analysis flow (D-033): the player taps their athlete,
// a gold ring marks exactly who to analyze, the coach follows that athlete
// across the clip, scores the checkpoints, and returns one priority fix. Nothing here depicts a capability the product no longer has:
// no skeleton, no detector boxes, no measured units.

export const FILM_SECONDS = 10;

type Variant = "film" | "ambient";
type Point = readonly [number, number];

// The vertical clip panel inside the 1280x720 landscape stage. Its aspect
// (w/h) matches the source frame's 720x1280 portrait, so the plate fills it
// with no distortion. Overlay coordinates are normalized 0..1 within the
// clip and mapped into this rect (exactly how the results player letterboxes
// overlays onto the video content box).
const PANEL = { left: 806, top: 30, w: 371, h: 660 };

const sx = (n: number) => PANEL.left + n * PANEL.w;
const sy = (n: number) => PANEL.top + n * PANEL.h;

// The tapped athlete's torso centre on the real frame: where the user's tap
// lands and the ring draws. Read off the same calibration frame the plate
// image comes from.
const MARK: Point = [0.5373, 0.5341];
const MARK_R = 34;

// Checkpoint chips exactly as the product returns them: each metric scored
// 0-100 with a frame-pinned note, no invented units.
const CHIPS: ReadonlyArray<readonly [string, string]> = [
  ["Approach", "76 · strong tempo"],
  ["Contact", "68 · below full reach"],
  ["Follow-through", "84 · clean snap"],
];

// Generates a pop-in keyframe block pinned to the master loop timeline:
// hidden until `at`%, settled by `at + 3`%, held, then released to the group
// fade (the parent handles the loop-out).
function pop(name: string, at: number) {
  return `@keyframes ${name} {
    0%, ${at}% { opacity: 0; transform: translateY(8px) scale(0.97); }
    ${at + 3}%, 100% { opacity: 1; transform: none; }
  }`;
}

function popCss(names: ReadonlyArray<readonly [string, number]>) {
  return names.map(([name, at]) => pop(name, at)).join("\n");
}

const mark = { x: sx(MARK[0]), y: sy(MARK[1]) };

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
}
.film-panel {
  position: absolute;
  left: ${PANEL.left}px;
  top: ${PANEL.top}px;
  width: ${PANEL.w}px;
  height: ${PANEL.h}px;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid color-mix(in oklab, var(--color-chalk) 12%, transparent);
  box-shadow: var(--shadow-lift);
  background: var(--color-navy);
}
.film-plate {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.94) contrast(1.03);
}
.film-panel-shade {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 80% at 52% 40%, transparent 55%, color-mix(in oklab, var(--color-navy) 42%, transparent) 100%),
    linear-gradient(to top, color-mix(in oklab, var(--color-navy) 34%, transparent), transparent 40%);
}
.film-scan {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 90px;
  opacity: 0;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in oklab, var(--color-gold) 24%, transparent) 62%,
    color-mix(in oklab, var(--color-gold) 80%, transparent) 98%,
    transparent
  );
  animation: film-scan ${FILM_SECONDS}s linear infinite;
}
@keyframes film-scan {
  0%, 5% { transform: translateX(-100px); opacity: 0; }
  7% { opacity: 0.9; }
  15% { opacity: 0.9; }
  17%, 100% { transform: translateX(${PANEL.w + 20}px); opacity: 0; }
}
.film-overlays {
  position: absolute;
  inset: 0;
  animation: film-overlays-out ${FILM_SECONDS}s linear infinite;
}
@keyframes film-overlays-out {
  0%, 95% { opacity: 1; }
  99%, 100% { opacity: 0; }
}
/* The tap: a fingertip pulse where the user chooses their athlete, then the
   ring settles around them. */
.film-tap {
  fill: none;
  stroke: var(--color-chalk);
  stroke-width: 2;
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: film-tap ${FILM_SECONDS}s linear infinite;
}
@keyframes film-tap {
  0%, 14% { opacity: 0; transform: scale(0.4); }
  16% { opacity: 0.9; transform: scale(0.7); }
  20% { opacity: 0; transform: scale(1.35); }
  21%, 100% { opacity: 0; }
}
.film-ring-halo {
  fill: none;
  stroke: color-mix(in oklab, var(--color-navy) 60%, transparent);
  stroke-width: 9;
  opacity: 0;
  animation: film-ring-in ${FILM_SECONDS}s linear infinite;
}
.film-ring {
  fill: none;
  stroke: var(--color-gold);
  stroke-width: 5;
  filter: drop-shadow(0 0 8px color-mix(in oklab, var(--color-gold) 45%, transparent));
  opacity: 0;
  animation: film-ring-in ${FILM_SECONDS}s linear infinite;
}
@keyframes film-ring-in {
  0%, 18% { opacity: 0; }
  22%, 100% { opacity: 1; }
}
.film-watch {
  position: absolute;
  left: ${mark.x - 33}px;
  top: ${mark.y - MARK_R - 30}px;
  padding: 2px 7px;
  border-radius: 5px;
  background: var(--color-gold);
  color: var(--color-navy);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0;
  animation: film-ring-in ${FILM_SECONDS}s linear infinite;
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
  padding: 0.6rem 1rem;
  background: color-mix(in oklab, var(--color-navy) 80%, transparent);
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
  ["film-caption-in", 4],
  ["film-chip-a", 40],
  ["film-chip-b", 46],
  ["film-chip-c", 52],
  ["film-score-in", 54],
  ["film-fix-in", 64],
])}
.film-debug * { animation: none !important; }
.film-debug .film-ring,
.film-debug .film-ring-halo,
.film-debug .film-watch,
.film-debug .film-hud-pop { opacity: 1; transform: none; }
.film-debug .film-tap { opacity: 0; }
.film-debug .film-score-arc { stroke-dashoffset: 0; }
.film-debug .film-scan { opacity: 0; }
`;

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
      aria-label="Vollyio court vision. A real two-player rep is read by the coaching service: the player taps their athlete, a gold ring marks who to analyze, and the checkpoints, score, and one priority fix appear."
      className="grid min-h-svh place-items-center bg-navy"
    >
      <style dangerouslySetInnerHTML={{ __html: FILM_CSS }} />
      <div className={`film-stage${debug ? " film-debug" : ""}`} aria-hidden="true">
        <div className="film-world">
          {/* The vertical clip being analyzed. Deterministic pixel placement
              (not next/image) keeps the overlay registration exact. */}
          <div className="film-panel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/film-court.webp" alt="" className="film-plate" />
            <div className="film-panel-shade" />
            {!reducedMotion && <div className="film-scan" />}
          </div>

          {!reducedMotion && (
            <div className="film-overlays">
              <svg viewBox="0 0 1280 720" width="1280" height="720" className="absolute inset-0">
                {/* The tap pulse, then the ring that marks the chosen athlete. */}
                <circle cx={mark.x} cy={mark.y} r={MARK_R * 0.7} className="film-tap" />
                <circle cx={mark.x} cy={mark.y} r={MARK_R} className="film-ring-halo" />
                <circle cx={mark.x} cy={mark.y} r={MARK_R} className="film-ring" />

              </svg>

              <span className="film-watch font-mono">watching</span>
            </div>
          )}
        </div>

        {!reducedMotion && showStory && (
          <div className="film-overlays">
            <div className="film-hud font-mono left-16 top-1/2 -translate-y-1/2 space-y-5">
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
                    Spike analysis
                  </p>
                  <p className="mt-1 font-display text-lg font-bold tracking-normal text-chalk">
                    Approach to contact, read in full
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
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

              <div
                className="film-hud-pop max-w-xs rounded-control border-l-2 border-gold bg-navy/80 p-3.5 backdrop-blur-md"
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

            <div className="film-hud font-mono bottom-12 left-16">
              <p
                className="film-hud-pop text-[11px] uppercase tracking-[0.24em] text-chalk-dim"
                style={{ animation: `film-caption-in ${FILM_SECONDS}s linear infinite` }}
              >
                Vollyio <span className="text-gold">&middot;</span> film room
              </p>
            </div>
          </div>
        )}

        <div className="film-vignette pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, color-mix(in oklab, var(--color-navy) 55%, transparent), transparent 30%)",
          }}
        />
      </div>
    </main>
  );
}
