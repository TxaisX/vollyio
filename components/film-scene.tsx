"use client";

import { useReducedMotion } from "@/components/motion";

// The Sideout court-vision film: a 10s seamless loop staged for capture at
// 1280x720 (scripts/render-hero-film.mjs) and served as MP4 on the landing
// page. Every animation runs exactly FILM_SECONDS with infinite iterations,
// so the scene state at t equals the state at t + FILM_SECONDS and any
// whole-cycle capture window loops without a seam.
//
// This mirrors the REAL analysis tool (D-021): a vertical clip is read
// full-frame, EVERY player is detected and boxed, the one you tap is tracked
// with a live skeleton, and the ball is measured. The skeleton topology,
// player boxes, and joint positions below are the actual RTMPose output for
// a real two-player rep (frame 0225 of the calibration clip), so the film
// shows what the product literally draws — not a stylized approximation.

export const FILM_SECONDS = 10;

type Variant = "film" | "ambient";
type Point = readonly [number, number];

// The vertical clip panel inside the 1280x720 landscape stage. Its aspect
// (w/h) matches the source frame's 720x1280 portrait, so the plate fills it
// with no distortion. Overlay coordinates are normalized 0..1 within the
// clip and mapped into this rect (exactly how the results player letterboxes
// keypoints onto the video content box).
const PANEL = { left: 806, top: 30, w: 371, h: 660 };

const sx = (n: number) => PANEL.left + n * PANEL.w;
const sy = (n: number) => PANEL.top + n * PANEL.h;

// Real RTMPose keypoints (normalized to the clip frame) for the tracked
// player: the jump-serving athlete. Only the slots the model actually
// produces are here; the tool draws no head node and no feet, so neither
// does the film.
const K = {
  lSho: [0.5682, 0.4965] as Point,
  rSho: [0.4854, 0.516] as Point,
  lElb: [0.5968, 0.4787] as Point,
  rElb: [0.4523, 0.5405] as Point,
  lWri: [0.6058, 0.466] as Point,
  rWri: [0.4553, 0.5354] as Point,
  lHip: [0.5892, 0.5684] as Point,
  rHip: [0.5381, 0.5718] as Point,
  lKne: [0.6254, 0.6294] as Point,
  rKne: [0.4974, 0.6268] as Point,
  lAnk: [0.6359, 0.6429] as Point,
  rAnk: [0.4568, 0.692] as Point,
};

// Bone graph = the exact set the results player renders (torso, both arms,
// both legs to the ankles, plus the hip line). No feet: RTMPose emits no
// heels, so those bones never draw in the product either.
const BONES: ReadonlyArray<readonly [keyof typeof K, keyof typeof K]> = [
  ["lSho", "rSho"],
  ["lSho", "lElb"],
  ["lElb", "lWri"],
  ["rSho", "rElb"],
  ["rElb", "rWri"],
  ["lSho", "lHip"],
  ["rSho", "rHip"],
  ["lHip", "rHip"],
  ["lHip", "lKne"],
  ["lKne", "lAnk"],
  ["rHip", "rKne"],
  ["rKne", "rAnk"],
];

const JOINTS = Object.keys(K) as (keyof typeof K)[];

// Detected player boxes (normalized xyxy), real detector output. Person 0 is
// the tracked athlete (gold, "watching"); person 1 is the other player on
// the court (thin chalk box), the multi-player detection the tool now does.
const TRACKED_BOX = [0.3624, 0.412, 0.6987, 0.7587] as const;
const OTHER_BOX = [0.6318, 0.5748, 0.825, 0.8341] as const;

// The ball, measured. A crosshair sits on it; a short trail of prior measured
// positions rises behind it from the toss (the tracked path, not a
// projection). Coordinates read off the real frame.
const BALL: Point = [0.565, 0.367];
const BALL_TRAIL: ReadonlyArray<Point> = [
  [0.599, 0.454],
  [0.589, 0.423],
  [0.579, 0.398],
  [0.571, 0.381],
];

const CHIPS: ReadonlyArray<readonly [string, string]> = [
  ["Contact height", "1.42 body heights"],
  ["Elbow angle at contact", "158°"],
  ["Shoulder-hip separation", "38° apart"],
];

function boxRect(b: readonly [number, number, number, number]) {
  return {
    x: sx(b[0]),
    y: sy(b[1]),
    w: (b[2] - b[0]) * PANEL.w,
    h: (b[3] - b[1]) * PANEL.h,
  };
}

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

const trackedRect = boxRect(TRACKED_BOX);
const otherRect = boxRect(OTHER_BOX);

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
.film-box {
  fill: none;
  animation: film-box-in ${FILM_SECONDS}s linear infinite;
  opacity: 0;
}
.film-box-other {
  stroke: color-mix(in oklab, var(--color-chalk-dim) 60%, transparent);
  stroke-width: 1.5;
}
.film-box-tracked {
  stroke: var(--color-gold);
  stroke-width: 2.5;
  filter: drop-shadow(0 0 7px color-mix(in oklab, var(--color-gold) 45%, transparent));
  animation: film-pick-in ${FILM_SECONDS}s linear infinite;
}
@keyframes film-box-in {
  0%, 11% { opacity: 0; }
  15%, 100% { opacity: 0.9; }
}
@keyframes film-pick-in {
  0%, 18% { opacity: 0; }
  22%, 100% { opacity: 1; }
}
.film-watch {
  position: absolute;
  left: ${trackedRect.x}px;
  top: ${trackedRect.y - 22}px;
  padding: 2px 7px;
  border-radius: 5px;
  background: var(--color-gold);
  color: var(--color-navy);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0;
  animation: film-pick-in ${FILM_SECONDS}s linear infinite;
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
}
@keyframes film-bone {
  0%, 15% { stroke-dashoffset: 1; opacity: 0; }
  17% { opacity: 0.9; }
  30%, 100% { stroke-dashoffset: 0; opacity: 0.9; }
}
.film-joint {
  fill: var(--color-chalk);
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
}
.film-ball-halo {
  fill: none;
  stroke: color-mix(in oklab, var(--color-navy) 55%, transparent);
  stroke-width: 5.5;
  opacity: 0;
  animation: film-ball-in ${FILM_SECONDS}s linear infinite;
}
.film-ball-ring {
  fill: none;
  stroke: var(--color-gold);
  stroke-width: 2.5;
  opacity: 0;
  animation: film-ball-in ${FILM_SECONDS}s linear infinite;
}
.film-ball-dot {
  fill: var(--color-gold);
  opacity: 0;
  animation: film-ball-in ${FILM_SECONDS}s linear infinite;
}
@keyframes film-ball-in {
  0%, 30% { opacity: 0; }
  34%, 100% { opacity: 1; }
}
.film-trail {
  fill: var(--color-gold);
  opacity: 0;
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
  ["film-trail-a", 24],
  ["film-trail-b", 26],
  ["film-trail-c", 28],
  ["film-trail-d", 30],
  ["film-joint-a", 20],
  ["film-joint-b", 22],
  ["film-joint-c", 24],
  ["film-joint-d", 26],
  ["film-chip-a", 40],
  ["film-chip-b", 46],
  ["film-chip-c", 52],
  ["film-score-in", 54],
  ["film-fix-in", 64],
])}
.film-debug * { animation: none !important; }
.film-debug .film-box,
.film-debug .film-box-tracked,
.film-debug .film-watch,
.film-debug .film-ball-halo,
.film-debug .film-ball-ring,
.film-debug .film-ball-dot,
.film-debug .film-trail,
.film-debug .film-joint,
.film-debug .film-hud-pop { opacity: 1; transform: none; }
.film-debug .film-bone { stroke-dashoffset: 0; opacity: 0.9; }
.film-debug .film-score-arc { stroke-dashoffset: 0; }
.film-debug .film-scan { opacity: 0; }
`;

const TRAIL_ANIM = ["film-trail-a", "film-trail-b", "film-trail-c", "film-trail-d"];
const JOINT_ANIM = ["film-joint-a", "film-joint-b", "film-joint-c", "film-joint-d"];

export function FilmScene({
  variant = "film",
  debug = false,
}: {
  variant?: Variant;
  debug?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const showStory = variant === "film";
  const ball = { x: sx(BALL[0]), y: sy(BALL[1]) };

  return (
    <main
      aria-label="Sideout court vision. A real two-player rep is read by the coaching service: every player is detected and boxed, the tapped athlete is tracked with a live skeleton, the ball is measured, and the checkpoints and score appear."
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
                {/* Other detected player: thin chalk box, no skeleton. */}
                <rect
                  x={otherRect.x}
                  y={otherRect.y}
                  width={otherRect.w}
                  height={otherRect.h}
                  rx={7}
                  className="film-box film-box-other"
                />
                {/* Tracked player: gold selection box. */}
                <rect
                  x={trackedRect.x}
                  y={trackedRect.y}
                  width={trackedRect.w}
                  height={trackedRect.h}
                  rx={7}
                  className="film-box film-box-tracked"
                />

                {/* Skeleton on the tracked player. */}
                {BONES.map(([a, b], i) => (
                  <line
                    key={i}
                    x1={sx(K[a][0])}
                    y1={sy(K[a][1])}
                    x2={sx(K[b][0])}
                    y2={sy(K[b][1])}
                    pathLength={1}
                    className="film-bone"
                  />
                ))}
                {JOINTS.map((key, i) => (
                  <circle
                    key={key}
                    cx={sx(K[key][0])}
                    cy={sy(K[key][1])}
                    r={3.2}
                    className="film-joint"
                    style={{ animation: `${JOINT_ANIM[i % JOINT_ANIM.length]} ${FILM_SECONDS}s linear infinite` }}
                  />
                ))}

                {/* Measured ball: trailing samples arc into the crosshair. */}
                {BALL_TRAIL.map((p, i) => (
                  <circle
                    key={i}
                    cx={sx(p[0])}
                    cy={sy(p[1])}
                    r={2.4}
                    className="film-trail"
                    style={{
                      animation: `${TRAIL_ANIM[i % TRAIL_ANIM.length]} ${FILM_SECONDS}s linear infinite`,
                    }}
                  />
                ))}
                <circle cx={ball.x} cy={ball.y} r={12} className="film-ball-halo" />
                <circle cx={ball.x} cy={ball.y} r={12} className="film-ball-ring" />
                <circle cx={ball.x} cy={ball.y} r={3} className="film-ball-dot" />
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
                    Serve analysis
                  </p>
                  <p className="mt-1 font-display text-lg font-bold tracking-normal text-chalk">
                    Jump serve, read in full
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
                Sideout <span className="text-gold">&middot;</span> film room
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
