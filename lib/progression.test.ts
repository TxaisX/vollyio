import { test } from "node:test";
import assert from "node:assert/strict";
import {
  levelFromXp,
  shiftDayKey,
  streakFromDates,
  todayKey,
} from "./progression.ts";

// The two instants where a fixed 24-hour step disagrees with the calendar in
// America/Los_Angeles, which is the zone the streak is pinned to.
//
// SPRING is 00:30 PDT on the morning after the clocks went forward (2026-03-08
// was 23 hours long). Stepping back 86,400,000ms from here lands at 23:30 PST
// on 2026-03-07, so the previous day never appears at any offset.
const SPRING = Date.parse("2026-03-09T07:30:00Z");
// FALL is 23:30 PST on the evening the clocks went back (2026-11-01 was 25
// hours long). Stepping back 86,400,000ms from here lands at 00:30 PDT on the
// same local day, so today appears twice.
const FALL = Date.parse("2026-11-02T07:30:00Z");

test("day keys step by the calendar, not by 24 hours of elapsed time", () => {
  assert.equal(todayKey(0, SPRING), "2026-03-09");
  // The old arithmetic answered 2026-03-07 here and dropped 03-08 entirely.
  assert.equal(todayKey(1, SPRING), "2026-03-08");
  assert.equal(todayKey(2, SPRING), "2026-03-07");

  assert.equal(todayKey(0, FALL), "2026-11-01");
  // The old arithmetic answered 2026-11-01 again, repeating the day.
  assert.equal(todayKey(1, FALL), "2026-10-31");
  assert.equal(todayKey(2, FALL), "2026-10-30");
});

test("a streak across the spring-forward boundary is not cut short", () => {
  // Two consecutive days of work, the second one being the day after the
  // clocks went forward. The skipped-day bug scored this as 1.
  assert.equal(
    streakFromDates(new Set(["2026-03-09", "2026-03-08"]), SPRING),
    2,
  );
  assert.equal(
    streakFromDates(new Set(["2026-03-09", "2026-03-08", "2026-03-07"]), SPRING),
    3,
  );
  // A genuine gap still breaks it: 03-08 is missing.
  assert.equal(
    streakFromDates(new Set(["2026-03-09", "2026-03-07"]), SPRING),
    1,
  );
});

test("a streak across the fall-back boundary does not count a day twice", () => {
  // One single day of work. The repeated-day bug scored this as 2.
  assert.equal(streakFromDates(new Set(["2026-11-01"]), FALL), 1);
  assert.equal(
    streakFromDates(new Set(["2026-11-01", "2026-10-31"]), FALL),
    2,
  );
});

test("a streak that ended yesterday still counts; one that ended earlier does not", () => {
  // Nothing logged today, so the walk starts at yesterday and the run holds.
  assert.equal(
    streakFromDates(new Set(["2026-03-08", "2026-03-07"]), SPRING),
    2,
  );
  // Nothing today and nothing yesterday is a broken streak, not a shifted one.
  assert.equal(
    streakFromDates(new Set(["2026-03-07", "2026-03-06"]), SPRING),
    0,
  );
  assert.equal(streakFromDates(new Set(), SPRING), 0);
});

test("stepping back crosses month and year boundaries", () => {
  assert.equal(shiftDayKey("2026-03-01", 1), "2026-02-28");
  assert.equal(shiftDayKey("2024-03-01", 1), "2024-02-29");
  assert.equal(shiftDayKey("2026-01-01", 1), "2025-12-31");
  assert.equal(shiftDayKey("2026-01-01", 31), "2025-12-01");
  assert.equal(shiftDayKey("2026-07-28", 0), "2026-07-28");
});

test("levels come off the cumulative curve", () => {
  assert.deepEqual(levelFromXp(0), { level: 1, into: 0, span: 250 });
  assert.equal(levelFromXp(250).level, 2);
  assert.equal(levelFromXp(249).level, 1);
  assert.equal(levelFromXp(750).level, 3);
});
