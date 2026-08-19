import { SKILL_LABEL, type Skill } from "@/lib/skills";
import {
  isChartable,
  progressCopy,
  type ProgressSeries,
} from "@/lib/progress-series";

// One skill's scores over time. Hand-rolled SVG rather than a chart library:
// the dependency gate (D-001 section 10.5) keeps chart libraries out, and the
// landing showcase already established the trace/point/grid classes this reuses,
// so this adds no CSS either.
//
// The hard part is not drawing the line, it is refusing to draw one that
// flatters. The real corpus is three to six reps over about a week, sometimes
// all on one afternoon, so the sparse states below are the common path.

const W = 560;
const H = 180;
const PAD_X = 34;
const PAD_TOP = 16;
const PAD_BOTTOM = 26;

// Fixed 0-100, never auto-scaled to the data. An auto-scaled axis turns a
// three-point wobble into a dramatic climb, which is exactly the lie this view
// exists to avoid.
const MIN_SCORE = 0;
const MAX_SCORE = 100;

function x(i: number, n: number) {
  if (n <= 1) return W / 2;
  return PAD_X + (i / (n - 1)) * (W - PAD_X * 2);
}

function y(score: number) {
  const t = (score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE);
  return PAD_TOP + (1 - t) * (H - PAD_TOP - PAD_BOTTOM);
}

const dayLabel = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function ProgressChart({
  series,
  target,
}: {
  series: ProgressSeries;
  /** The player's own target for this skill, if they set one. */
  target?: number | null;
}) {
  const { points, reps } = series;
  const label = SKILL_LABEL[series.skill as Skill] ?? series.skill;
  const copy = progressCopy(series);

  // One rep is a dot, not a line. Drawing a "trend" through it would be the
  // first thing a player learns not to trust.
  //
  // /progress no longer sends one here: it splits on `isChartable` and renders
  // these as compact rows instead (D-117), because the branch below used to be
  // a 120px framed box holding one number and one date. This stays as a GUARD
  // rather than being deleted with that box - the hazard it exists for is a
  // future caller charting a single point, and a guard that has stopped being
  // reachable is not the same as a guard that has stopped being needed. What
  // it draws now is one line of text at the size the rest of the card uses,
  // not a reserved 120px of emptiness.
  if (!isChartable(series)) {
    return (
      <figure className="card p-5">
        <Header label={label} discipline={series.discipline} copy={copy} />
        <p className="mt-3 font-mono text-xs text-chalk-dim">
          {points[0]?.score ?? "--"} on {points[0] ? dayLabel(points[0].at) : "--"}
        </p>
      </figure>
    );
  }

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i, reps).toFixed(1)} ${y(p.score).toFixed(1)}`)
    .join(" ");

  const targetY = typeof target === "number" && target > 0 ? y(target) : null;

  return (
    <figure className="card p-5">
      <Header label={label} discipline={series.discipline} copy={copy} />

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${label}, ${series.discipline}. ${copy} Scores from ${series.low} to ${series.high} across ${reps} reps.`}
      >
        {[0, 50, 100].map((s) => (
          <g key={s}>
            <line
              x1={PAD_X}
              x2={W - PAD_X}
              y1={y(s)}
              y2={y(s)}
              stroke="var(--color-line)"
              strokeWidth="1"
            />
            <text
              x={PAD_X - 8}
              y={y(s) + 4}
              textAnchor="end"
              className="fill-chalk-dim font-mono"
              fontSize="10"
            >
              {s}
            </text>
          </g>
        ))}

        {targetY !== null && (
          <>
            <line
              x1={PAD_X}
              x2={W - PAD_X}
              y1={targetY}
              y2={targetY}
              stroke="var(--color-teal)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x={W - PAD_X}
              y={targetY - 6}
              textAnchor="end"
              className="fill-teal-ink font-mono"
              fontSize="10"
            >
              target {target}
            </text>
          </>
        )}

        {/* pathLength normalises the draw-on animation regardless of geometry;
            the reduced-motion block in globals.css settles it instantly. */}
        <path
          d={path}
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="analytics-trace"
        />

        {points.map((p, i) => (
          <circle
            key={`${p.at}-${i}`}
            cx={x(i, reps)}
            cy={y(p.score)}
            r="3.5"
            fill="var(--color-navy)"
            stroke="var(--color-gold)"
            strokeWidth="2"
            className="analytics-point"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}

        <text
          x={PAD_X}
          y={H - 6}
          className="fill-chalk-dim font-mono"
          fontSize="10"
        >
          {dayLabel(series.first)}
        </text>
        <text
          x={W - PAD_X}
          y={H - 6}
          textAnchor="end"
          className="fill-chalk-dim font-mono"
          fontSize="10"
        >
          {dayLabel(series.last)}
        </text>
      </svg>

      {/* The numbers, for anyone the chart does not serve. */}
      <details className="mt-3">
        <summary className="cursor-pointer font-mono text-xs uppercase tracking-wide text-chalk-dim">
          Every rep
        </summary>
        <ul className="mt-2 space-y-1">
          {points.map((p, i) => (
            <li key={`${p.at}-row-${i}`} className="text-body text-chalk-dim">
              {dayLabel(p.at)}: {p.score}
            </li>
          ))}
        </ul>
      </details>
    </figure>
  );
}

function Header({
  label,
  discipline,
  copy,
}: {
  label: string;
  discipline: string;
  copy: string;
}) {
  return (
    <figcaption>
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-lg font-bold">{label}</h2>
        <span className="font-mono text-xs uppercase tracking-wide text-chalk-dim">
          {discipline}
        </span>
      </div>
      <p className="mt-1 text-body text-chalk-dim">{copy}</p>
    </figcaption>
  );
}
