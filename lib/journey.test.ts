import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkpointHistory,
  hasJourney,
  journeySummary,
  stuckCheckpoints,
  type JourneyRow,
} from "./journey.ts";

// Newest last on purpose: the module sorts, and a caller handing rows in
// database order (newest first) or chart order (oldest first) must get the same
// answer. A journey that depends on how the query happened to be ordered is a
// bug waiting for someone to add an ORDER BY.
function row(
  date: string,
  strengthKeys: string[],
  changeKeys: string[],
  extra: Partial<JourneyRow> = {},
): JourneyRow {
  return { skill: "attack", created_at: date, strengthKeys, changeKeys, ...extra };
}

test("a checkpoint told to a player three analyses running is stuck", () => {
  const rows = [
    row("2026-08-01", ["contact_height"], ["arm_swing"]),
    row("2026-08-03", ["contact_height"], ["arm_swing"]),
    row("2026-08-05", ["jump_timing"], ["arm_swing"]),
  ];
  const stuck = stuckCheckpoints(checkpointHistory(rows, "attack"));
  assert.equal(stuck.length, 1);
  assert.equal(stuck[0].key, "arm_swing");
  assert.equal(stuck[0].changeStreak, 3);
});

// Twice is a coincidence a coach would not remark on. The threshold exists so
// the product does not start lecturing on the second occurrence.
test("twice is not yet stuck", () => {
  const rows = [
    row("2026-08-03", [], ["arm_swing"]),
    row("2026-08-05", [], ["arm_swing"]),
  ];
  assert.deepEqual(stuckCheckpoints(checkpointHistory(rows, "attack")), []);
});

// THE ORDER TRAP. The streak counts back from the NEWEST analysis, so a
// checkpoint that was a problem long ago and has been fine since is not stuck.
test("an old run of fixes does not count once the player has moved it", () => {
  const rows = [
    row("2026-08-01", [], ["arm_swing"]),
    row("2026-08-02", [], ["arm_swing"]),
    row("2026-08-03", [], ["arm_swing"]),
    row("2026-08-05", ["arm_swing"], ["jump_timing"]),
  ];
  const history = checkpointHistory(rows, "attack");
  const arm = history.find((h) => h.key === "arm_swing")!;
  assert.equal(arm.changeStreak, 0, "the newest analysis called it a strength");
  assert.equal(arm.changeCount, 3, "but the history is still counted");
  assert.deepEqual(stuckCheckpoints(history), []);
});

// The earned statement, and the only one this data supports about progress.
test("a checkpoint that was a fix and is now a strength reads as improving", () => {
  const rows = [
    row("2026-08-01", [], ["release"]),
    row("2026-08-05", ["release"], ["footwork"]),
  ];
  const release = checkpointHistory(rows, "attack").find((h) => h.key === "release")!;
  assert.equal(release.standing, "improving");
});

// Crediting improvement with no history of the fault would tell a player they
// have progressed on something nothing ever observed them failing.
test("a checkpoint that was always a strength is not improvement", () => {
  const rows = [
    row("2026-08-01", ["release"], ["footwork"]),
    row("2026-08-05", ["release"], ["footwork"]),
  ];
  const release = checkpointHistory(rows, "attack").find((h) => h.key === "release")!;
  assert.equal(release.standing, "strength");
});

// SILENCE IS NOT CONTINUED FAILURE. A clip that did not show the mechanic must
// break the streak, or a player gets told they are stuck on something their
// last two clips never captured.
test("an analysis that did not mention the checkpoint breaks the streak", () => {
  const rows = [
    row("2026-08-01", [], ["arm_swing"]),
    row("2026-08-02", [], ["arm_swing"]),
    row("2026-08-05", ["contact_height"], ["jump_timing"]),
  ];
  const arm = checkpointHistory(rows, "attack").find((h) => h.key === "arm_swing")!;
  assert.equal(arm.changeStreak, 0);
  assert.equal(arm.changeCount, 2);
});

// A read the player told us was wrong is not evidence about the player. Letting
// it into a trend is worse than having no trend: it is a confident statement
// built on a row they have already disputed.
test("a disputed analysis is dropped, not down-weighted", () => {
  const rows = [
    row("2026-08-01", [], ["arm_swing"]),
    row("2026-08-03", [], ["arm_swing"], { disputed: true }),
    row("2026-08-05", [], ["arm_swing"]),
  ];
  const arm = checkpointHistory(rows, "attack").find((h) => h.key === "arm_swing")!;
  assert.equal(arm.changeCount, 2, "the disputed row must not be counted");
  const summary = journeySummary(rows, "attack");
  assert.equal(summary.analyses, 2);
  assert.equal(summary.excluded, 1, "and the coach must be able to say so");
});

test("skills do not bleed into each other", () => {
  const rows = [
    row("2026-08-01", [], ["arm_swing"]),
    { ...row("2026-08-03", [], ["arm_swing"]), skill: "serve" },
    row("2026-08-05", [], ["arm_swing"]),
  ];
  const arm = checkpointHistory(rows, "attack").find((h) => h.key === "arm_swing")!;
  assert.equal(arm.changeCount, 2);
});

test("row order in does not change the answer out", () => {
  const rows = [
    row("2026-08-01", [], ["arm_swing"]),
    row("2026-08-03", [], ["arm_swing"]),
    row("2026-08-05", ["arm_swing"], []),
  ];
  const forward = checkpointHistory(rows, "attack");
  const reversed = checkpointHistory([...rows].reverse(), "attack");
  assert.deepEqual(reversed, forward);
});

// One analysis is a point, not a journey. A product that announces a trend off
// a single rep is the same failure as a model inventing the other end of a
// range from one score.
test("one analysis is not a journey", () => {
  assert.equal(hasJourney(journeySummary([row("2026-08-05", ["a"], ["b"])], "attack")), false);
  assert.equal(
    hasJourney(journeySummary([row("2026-08-01", [], ["b"]), row("2026-08-05", ["a"], [])], "attack")),
    true,
  );
});

// NOTHING HERE RETURNS A SCORE OR A DELTA, and that is deliberate. Rank
// correlation held at 0.708 across a re-anchor while the median moved 55, 78
// and 97: ordering survives what absolute level does not, so a point delta is
// mostly noise wearing a number.
test("the summary carries no scores and no deltas", () => {
  const rows = [
    row("2026-08-01", ["contact_height"], ["arm_swing"]),
    row("2026-08-05", ["contact_height"], ["arm_swing"]),
  ];
  const summary = journeySummary(rows, "attack");
  const json = JSON.stringify(summary);
  assert.doesNotMatch(json, /score|delta|points|improvement_pct/i);
  assert.deepEqual(Object.keys(summary).sort(), [
    "analyses",
    "excluded",
    "improved",
    "skill",
    "stuck",
    "working",
  ]);
});

test("an empty history says nothing rather than guessing", () => {
  const summary = journeySummary([], "attack");
  assert.equal(summary.analyses, 0);
  assert.deepEqual(summary.working, []);
  assert.deepEqual(summary.stuck, []);
  assert.equal(hasJourney(summary), false);
});
