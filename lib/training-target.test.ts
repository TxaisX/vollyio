import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_TARGET_DAYS,
  TARGET_PHASES,
  currentPhase,
  daysUntil,
  formatEventDate,
  phaseSegments,
  runwayCount,
  runwayLine,
  targetRunway,
  weeksUntil,
} from "./training-target.ts";

test("days are counted on the calendar, across a month and a year boundary", () => {
  assert.equal(daysUntil("2026-08-25", "2026-08-26"), 1);
  assert.equal(daysUntil("2026-08-25", "2026-09-01"), 7);
  assert.equal(daysUntil("2026-12-30", "2027-01-02"), 3);
  assert.equal(daysUntil("2026-08-25", "2026-08-25"), 0);
  assert.equal(daysUntil("2026-08-25", "2026-08-20"), -5);
});

test("the day count survives the spring-forward weekend", () => {
  // Clocks go forward in the US on 2027-03-14. Subtracting timestamps across
  // that boundary loses an hour and rounds to the wrong day; calendar
  // arithmetic cannot.
  assert.equal(daysUntil("2027-03-13", "2027-03-15"), 2);
  assert.equal(daysUntil("2027-03-13", "2027-03-20"), 7);
});

test("the day count survives the fall-back weekend", () => {
  // Clocks go back on 2026-11-01, which makes that day 25 hours long.
  assert.equal(daysUntil("2026-10-31", "2026-11-02"), 2);
});

test("a part-week still counts as a week of work left", () => {
  assert.equal(weeksUntil(1), 1);
  assert.equal(weeksUntil(5), 1);
  assert.equal(weeksUntil(7), 1);
  assert.equal(weeksUntil(8), 2);
  assert.equal(weeksUntil(98), 14);
  assert.equal(weeksUntil(0), 0);
  assert.equal(weeksUntil(-3), 0);
});

test("the segments always add up to the headline", () => {
  for (let weeks = 1; weeks <= 60; weeks++) {
    const total = phaseSegments(weeks).reduce((sum, s) => sum + s.weeks, 0);
    assert.equal(total, weeks, `${weeks} weeks split into ${total}`);
  }
});

test("a full runway is base, build, sharpen, compete in that order", () => {
  const segments = phaseSegments(14);
  assert.deepEqual(
    segments.map((s) => [s.phase, s.weeks]),
    [
      ["base", 6],
      ["build", 5],
      ["sharpen", 2],
      ["compete", 1],
    ],
  );
});

test("a short runway drops phases from the FRONT, never from the event's own week", () => {
  // Six weeks out there is no base phase. The last week is still the event's.
  assert.deepEqual(
    phaseSegments(6).map((s) => [s.phase, s.weeks]),
    [
      ["build", 3],
      ["sharpen", 2],
      ["compete", 1],
    ],
  );
  assert.deepEqual(
    phaseSegments(2).map((s) => [s.phase, s.weeks]),
    [
      ["sharpen", 1],
      ["compete", 1],
    ],
  );
  assert.deepEqual(
    phaseSegments(1).map((s) => [s.phase, s.weeks]),
    [["compete", 1]],
  );
});

test("base appears exactly when the runway is longer than the fixed phases", () => {
  const fixed = TARGET_PHASES.reduce((sum, p) => sum + (p.weeks ?? 0), 0);
  assert.equal(fixed, 8);
  assert.equal(
    phaseSegments(8).some((s) => s.phase === "base"),
    false,
  );
  assert.equal(
    phaseSegments(9).find((s) => s.phase === "base")?.weeks,
    1,
  );
});

test("no phase is ever rendered with zero weeks in it", () => {
  for (let weeks = 1; weeks <= 60; weeks++) {
    for (const segment of phaseSegments(weeks)) {
      assert.ok(segment.weeks > 0, `${segment.phase} was empty at ${weeks} weeks`);
    }
  }
});

test("the current phase is the earliest one still standing", () => {
  assert.equal(currentPhase(14)?.phase, "base");
  assert.equal(currentPhase(8)?.phase, "build");
  assert.equal(currentPhase(3)?.phase, "sharpen");
  assert.equal(currentPhase(1)?.phase, "compete");
  assert.equal(currentPhase(0), null);
});

test("the runway keeps the date on the page once it has passed", () => {
  const past = targetRunway("2026-08-25", "2026-08-20");
  assert.equal(past.state, "past");
  assert.equal(past.days, -5);

  const today = targetRunway("2026-08-25", "2026-08-25");
  assert.equal(today.state, "today");
});

test("a runway ahead carries a phase and segments that agree", () => {
  const runway = targetRunway("2026-08-25", "2026-12-01");
  assert.equal(runway.state, "ahead");
  if (runway.state !== "ahead") return;
  assert.equal(runway.days, 98);
  assert.equal(runway.weeks, 14);
  assert.equal(runway.phase.phase, runway.segments[0].phase);
  assert.equal(
    runway.segments.reduce((sum, s) => sum + s.weeks, 0),
    runway.weeks,
  );
});

test("the countdown switches from weeks to days inside a fortnight", () => {
  assert.equal(runwayLine(targetRunway("2026-08-25", "2026-12-01")), "14 weeks out");
  assert.equal(runwayLine(targetRunway("2026-08-25", "2026-09-08")), "2 weeks out");
  assert.equal(runwayLine(targetRunway("2026-08-25", "2026-09-07")), "13 days out");
  assert.equal(runwayLine(targetRunway("2026-08-25", "2026-08-26")), "Tomorrow");
  assert.equal(runwayLine(targetRunway("2026-08-25", "2026-08-25")), "Today");
  assert.equal(runwayLine(targetRunway("2026-08-25", "2026-08-24")), "Was yesterday");
  assert.equal(runwayLine(targetRunway("2026-08-25", "2026-08-18")), "Was 7 days ago");
});

test("the date formats the same on both sides of hydration", () => {
  // A lookup table, not a locale formatter: the assertion is the exact string,
  // because the bug this guards is the server and the browser disagreeing.
  assert.equal(formatEventDate("2026-12-05"), "Sat 5 Dec");
  assert.equal(formatEventDate("2027-01-01"), "Fri 1 Jan");
  assert.equal(formatEventDate("2026-08-25"), "Tue 25 Aug");
});

test("nothing in the runway claims a readiness percentage", () => {
  // The one rule this module exists to hold (D-127). If a field ever appears
  // that scores the player against the date, this fails and somebody has to
  // argue for it in the ledger rather than ship it quietly.
  const runway = targetRunway("2026-08-25", "2026-12-01");
  const keys = Object.keys(runway).join(" ").toLowerCase();
  for (const banned of ["ready", "readiness", "percent", "pct", "projected", "forecast"]) {
    assert.equal(keys.includes(banned), false, `runway exposes "${banned}"`);
  }
  const blurbs = TARGET_PHASES.map((p) => p.blurb).join(" ").toLowerCase();
  for (const banned of ["% ready", "you will", "guarantee", "predict"]) {
    assert.equal(blurbs.includes(banned), false, `phase copy promises "${banned}"`);
  }
});

test("the horizon is capped at a year", () => {
  assert.equal(MAX_TARGET_DAYS, 365);
});

test("the big number and the sentence agree about the unit", () => {
  assert.deepEqual(runwayCount(targetRunway("2026-08-25", "2026-12-01")), {
    value: 14,
    unit: "weeks out",
  });
  assert.deepEqual(runwayCount(targetRunway("2026-08-25", "2026-09-07")), {
    value: 13,
    unit: "days out",
  });
  assert.deepEqual(runwayCount(targetRunway("2026-08-25", "2026-08-26")), {
    value: 1,
    unit: "day out",
  });
  assert.equal(runwayCount(targetRunway("2026-08-25", "2026-08-25")), null);
  assert.equal(runwayCount(targetRunway("2026-08-25", "2026-08-01")), null);
});
