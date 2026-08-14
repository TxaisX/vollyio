// The failures these pin are all the same shape: telling a player something
// about their progress that the data does not support. The real corpus is
// sparse (six reps over four days, several on one afternoon), so the sparse
// cases are the normal ones and get the most coverage here.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSeries,
  classifyTrend,
  isChartable,
  progressCopy,
  targetProgress,
  CHARTABLE_MIN_REPS,
  TREND_MIN_REPS,
  TREND_MIN_SPAN_DAYS,
  TREND_FLAT_BAND,
  type ProgressRep,
} from "./progress-series.ts";

const day = (n: number) => new Date(Date.UTC(2026, 6, n, 12, 0, 0)).toISOString();

function rep(
  skill: string,
  discipline: string,
  overall_score: number,
  d: number,
): ProgressRep {
  return { skill, discipline, overall_score, created_at: day(d) };
}

test("indoor and grass are separate series for the same skill", () => {
  // skill_ratings already keys on discipline. Folding them together would
  // average an indoor swing against a grass one and hide both.
  const s = buildSeries([
    rep("attack", "indoor", 42, 20),
    rep("attack", "grass", 65, 20),
    rep("attack", "indoor", 81, 22),
  ]);
  assert.equal(s.length, 2);
  const indoor = s.find((x) => x.discipline === "indoor");
  const grass = s.find((x) => x.discipline === "grass");
  assert.equal(indoor?.reps, 2);
  assert.equal(grass?.reps, 1);
});

test("points come back oldest first whatever order they arrived in", () => {
  const [s] = buildSeries([
    rep("set", "grass", 77, 23),
    rep("set", "grass", 60, 20),
    rep("set", "grass", 68, 21),
  ]);
  assert.deepEqual(
    s.points.map((p) => p.score),
    [60, 68, 77],
  );
  assert.equal(s.delta, 17);
  assert.equal(s.low, 60);
  assert.equal(s.high, 77);
});

test("a single rep has no delta and no trend", () => {
  const [s] = buildSeries([rep("pass", "grass", 87, 23)]);
  assert.equal(s.reps, 1);
  assert.equal(s.delta, null);
  assert.equal(s.trend, null);
  assert.match(progressCopy(s), /one rep/i);
});

test("reps all on the same day are consistency, not progression", () => {
  // The real corpus has exactly this: set/indoor, two reps, both 2026-07-20.
  const [s] = buildSeries([
    rep("set", "indoor", 73, 20),
    rep("set", "indoor", 75, 20),
  ]);
  assert.equal(s.spanDays, 0);
  assert.equal(s.trend, null, "same-day reps must never read as a trend");
});

test("enough reps but not enough days is still not a trend", () => {
  const rows = [0, 0, 0, 0].map((_, i) => rep("serve", "indoor", 50 + i * 10, 20));
  const [s] = buildSeries(rows);
  assert.equal(s.reps, TREND_MIN_REPS);
  assert.equal(s.spanDays, 0);
  assert.equal(s.trend, null);
  assert.match(progressCopy(s), /couple of days/i);
});

test("enough days but not enough reps is still not a trend", () => {
  const [s] = buildSeries([
    rep("dig", "indoor", 40, 1),
    rep("dig", "indoor", 70, 20),
  ]);
  assert.ok(s.spanDays >= TREND_MIN_SPAN_DAYS);
  assert.ok(s.reps < TREND_MIN_REPS);
  assert.equal(s.trend, null, "two reps a month apart is not a trend");
  assert.match(progressCopy(s), /before this is a trend/i);
});

test("a real climb reads as up, with the delta and the span", () => {
  const [s] = buildSeries([
    rep("attack", "grass", 48, 17),
    rep("attack", "grass", 52, 19),
    rep("attack", "grass", 60, 21),
    rep("attack", "grass", 65, 23),
  ]);
  assert.equal(s.trend, "up");
  assert.equal(s.delta, 17);
  assert.equal(s.spanDays, 6);
  const copy = progressCopy(s);
  assert.match(copy, /\+17/);
  assert.match(copy, /6 days/);
  assert.match(copy, /4 reps/);
});

test("a decline is reported as a decline", () => {
  // A product that only reports improvement is not measuring anything.
  const [s] = buildSeries([
    rep("block", "indoor", 80, 10),
    rep("block", "indoor", 74, 13),
    rep("block", "indoor", 70, 16),
    rep("block", "indoor", 62, 19),
  ]);
  assert.equal(s.trend, "down");
  assert.equal(s.delta, -18);
  assert.doesNotMatch(progressCopy(s), /\+/);
});

test("movement inside the flat band is not called progress", () => {
  const [s] = buildSeries([
    rep("set", "indoor", 70, 10),
    rep("set", "indoor", 72, 13),
    rep("set", "indoor", 69, 16),
    rep("set", "indoor", 70 + TREND_FLAT_BAND, 19),
  ]);
  assert.equal(s.trend, "flat");
  assert.match(progressCopy(s), /steady/i);
});

test("classifyTrend is exact at each boundary", () => {
  assert.equal(classifyTrend(TREND_MIN_REPS - 1, 10, 20), null);
  assert.equal(classifyTrend(TREND_MIN_REPS, TREND_MIN_SPAN_DAYS - 1, 20), null);
  assert.equal(classifyTrend(TREND_MIN_REPS, TREND_MIN_SPAN_DAYS, TREND_FLAT_BAND), "flat");
  assert.equal(classifyTrend(TREND_MIN_REPS, TREND_MIN_SPAN_DAYS, TREND_FLAT_BAND + 1), "up");
  assert.equal(classifyTrend(TREND_MIN_REPS, TREND_MIN_SPAN_DAYS, -(TREND_FLAT_BAND + 1)), "down");
  assert.equal(classifyTrend(9, 9, null), null);
});

test("unusable rows are dropped, never plotted as zero", () => {
  // A zero on a technique chart is a claim about the player. A missing rep is
  // just missing.
  const s = buildSeries([
    rep("serve", "indoor", 70, 20),
    { skill: "serve", discipline: "indoor", overall_score: NaN, created_at: day(21) },
    { skill: "serve", discipline: "indoor", overall_score: 80, created_at: "not a date" },
  ] as ProgressRep[]);
  assert.equal(s.length, 1);
  assert.equal(s[0].reps, 1);
  assert.equal(s[0].low, 70);
});

test("an empty history produces no series rather than an empty chart", () => {
  assert.deepEqual(buildSeries([]), []);
});

test("series are ordered by how much the player has worked them", () => {
  const s = buildSeries([
    rep("dig", "indoor", 50, 20),
    rep("set", "grass", 60, 20),
    rep("set", "grass", 70, 21),
    rep("set", "grass", 72, 22),
  ]);
  assert.equal(s[0].skill, "set");
});

test("target progress clamps and refuses nonsense", () => {
  assert.equal(targetProgress(50, 100), 0.5);
  assert.equal(targetProgress(120, 100), 1, "passing the target fills the bar, never overflows");
  assert.equal(targetProgress(-5, 100), 0);
  assert.equal(targetProgress(50, 0), null, "a zero target is not a target");
  assert.equal(targetProgress(null, 100), null);
  assert.equal(targetProgress(50, undefined), null);
});

// D-117. /progress splits on this rather than charting everything: a one-rep
// series used to reach ProgressChart and render a 120px framed box holding one
// number and one date, which is the shape D-116 demoted everywhere else. The
// rule lives here so the split is tested arithmetic rather than a `>= 2` typed
// into a page, and so "these stopped being charted" cannot be mistaken for
// "these stopped being shown" in a diff a month later.
test("a single rep is not chartable, and two reps are", () => {
  assert.equal(CHARTABLE_MIN_REPS, 2);
  assert.equal(isChartable({ reps: 0 }), false);
  assert.equal(isChartable({ reps: 1 }), false);
  assert.equal(isChartable({ reps: 2 }), true);
  assert.equal(isChartable({ reps: 40 }), true);
});

test("splitting a real corpus loses no series", () => {
  const rows = [
    rep("serving", "indoor", 60, 1),
    rep("serving", "indoor", 68, 4),
    rep("serving", "indoor", 71, 6),
    // One rep, and the only one on this skill: the common case on this page.
    rep("blocking", "indoor", 55, 2),
    // Same skill, different environment, so a series of its own with one rep.
    rep("serving", "grass", 49, 3),
  ];
  const series = buildSeries(rows);
  const charted = series.filter(isChartable);
  const sparse = series.filter((s) => !isChartable(s));

  assert.equal(charted.length + sparse.length, series.length);
  assert.equal(charted.length, 1);
  assert.equal(sparse.length, 2);
  // Every rep is still accounted for on one side or the other.
  assert.equal(
    [...charted, ...sparse].reduce((n, s) => n + s.reps, 0),
    rows.length,
  );
});
