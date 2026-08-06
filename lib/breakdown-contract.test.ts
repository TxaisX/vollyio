import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  checkpointStanding,
  isKnownCheckpoint,
  workedItems,
} from "../components/breakdown-shape.ts";
import type { AnalysisResult } from "./analysis-types.ts";

// THE ASK THIS FILE PINS: there are two stored result shapes and both must
// render forever (D-097). A v1 row (38 of them, result_version absent) carries
// metrics, per-pointer verdicts and a timeline and NOTHING ELSE explains its
// score. A v2 row carries strengths, changes, checkpoints and a confidence, and
// will never carry the other three. Nobody can log in to check, so the two
// shapes are proved by construction: the branch itself is a plain module and is
// exercised with real rows below, and the section gating is asserted against
// the component source, which is the shape lib/nav-contract.test.ts and
// lib/security-contract.test.ts already use for components that cannot be
// imported under `node --test`.
//
// The last block pins the reps list on /history by the same technique, because
// it is the other half of one ask: the breakdown shows less per rep, and the
// list shows less per row, so that more of either fits on a phone.
const BODY = await readFile(
  new URL("../components/breakdown-body.tsx", import.meta.url),
  "utf8",
);
const CHECKPOINTS = await readFile(
  new URL("../components/checkpoint-list.tsx", import.meta.url),
  "utf8",
);
const SWITCH = await readFile(
  new URL("../components/detail-level.tsx", import.meta.url),
  "utf8",
);

/** The source of one section, from its presence guard onward. Windowed rather
 *  than brace-matched so a reordered section or a changed reveal delay does not
 *  fail the test for the wrong reason. */
function section(src: string, guard: string, chars = 320) {
  const at = src.indexOf(guard);
  assert.notEqual(at, -1, `no section guarded by \`${guard}\``);
  return src.slice(at, at + chars);
}

const V1: AnalysisResult = {
  skill: "set",
  discipline: "indoor",
  overall_score: 71,
  coverage_pct: 88,
  metrics: [
    {
      key: "hand_shape",
      score: 74,
      note: "Hands form late.",
      weight: 24,
      pointers: [{ key: "window_above_forehead", status: "met" }],
    },
  ],
  contact_frame_index: 9,
  focus: { frame_index: 9, label: "Contact", why: "The ball leaves flat.", time_s: 1.2 },
  insights: [
    { frame_index: 4, time_s: 0.6, type: "strength", observation: "Feet beat the ball." },
    { frame_index: 9, time_s: 1.2, type: "issue", observation: "Elbows collapse." },
  ],
  changes: [
    {
      title: "Set the hands earlier",
      detail: "Shape the window before the ball arrives.",
      target_metric: "hand_shape",
      expected_gain: 6,
      difficulty: "quick",
      timeframe: "This week",
    },
  ],
  priority_fix: { title: "Set the hands earlier", detail: "Shape the window earlier.", frame_index: 9 },
  drill_slugs: [],
  summary: "A repeatable set with a late window.",
};

const V2: AnalysisResult = {
  skill: "set",
  discipline: "indoor",
  overall_score: 78,
  result_version: 2,
  confidence: "Good view of the release, less of the footwork.",
  strengths: [
    { title: "Square to target", detail: "Hips face the antenna.", key: "body_alignment" },
    { title: "Quiet release", detail: "The ball leaves clean.", key: "release" },
    { title: "Early feet", detail: "Under the ball in time.", key: "footwork" },
  ],
  changes: [
    {
      title: "Shape the window sooner",
      detail: "Hands up before the ball is over you.",
      difficulty: "quick",
      timeframe: "This week",
      key: "hand_shape",
    },
    {
      title: "Hold the tempo",
      detail: "Same rhythm on every ball.",
      difficulty: "moderate",
      timeframe: "Two weeks",
      key: "tempo_decision",
    },
  ],
  priority_fix: { title: "Shape the window sooner", detail: "Hands up earlier." },
  drill_slugs: [],
  summary: "A calm set that arrives a beat late.",
  checkpoints: [
    { key: "hand_shape", visible: true, observation: "The window forms over the forehead." },
    { key: "footwork", visible: true, observation: "Feet arrive before the ball." },
    { key: "body_alignment", visible: false, observation: "" },
  ],
};

test("a v1 row fills the what-worked column out of its timeline", () => {
  const worked = workedItems(V1);
  assert.equal(worked.length, 1, "only the strength insight, never the issue");
  assert.equal(worked[0].title, "Feet beat the ball.");
  // A timeline insight is one sentence with no title, so there is no second
  // paragraph to render underneath it.
  assert.equal(worked[0].detail, null);
  assert.equal(worked[0].key, undefined);
});

test("a v2 row fills the same column directly, three against two", () => {
  const worked = workedItems(V2);
  assert.equal(worked.length, 3);
  assert.equal((V2.changes ?? []).length, 2);
  assert.deepEqual(
    worked.map((w) => w.key),
    ["body_alignment", "release", "footwork"],
  );
  assert.equal(worked[0].detail, "Hips face the antenna.");
});

// A v2 row that carries BOTH would double-render the same point; strengths win
// the column and the timeline never becomes the source when a row named them.
test("strengths, not the timeline, when a row somehow has both", () => {
  const both: AnalysisResult = { ...V2, insights: V1.insights };
  assert.equal(workedItems(both).length, 3);
  assert.equal(workedItems(both)[0].title, "Square to target");
});

test("every column entry ties back to a checkpoint, and the two halves agree", () => {
  const standing = checkpointStanding("set", V2);
  assert.deepEqual(standing, {
    body_alignment: "worked",
    release: "worked",
    footwork: "worked",
    hand_shape: "change",
    tempo_decision: "change",
  });
});

// EVERY ROW IN PRODUCTION TODAY IS ONE OF THESE. `key` shipped after them, so
// the labels must simply not appear rather than appearing empty.
test("a row with no checkpoint keys renders no labels rather than blank ones", () => {
  const keyless: AnalysisResult = {
    ...V2,
    strengths: (V2.strengths ?? []).map(({ title, detail }) => ({ title, detail })),
    changes: (V2.changes ?? []).map(({ key: _dropped, ...rest }) => rest),
  };
  assert.deepEqual(checkpointStanding("set", keyless), {});
  assert.deepEqual(checkpointStanding("set", V1), {}, "a v1 row has none either");
  assert.equal(isKnownCheckpoint("set", undefined), false);
});

test("a key the catalog does not name is dropped, never printed raw", () => {
  const invented: AnalysisResult = {
    ...V2,
    changes: [{ ...(V2.changes ?? [])[0], key: "wrist_snap_velocity" }],
  };
  assert.equal(isKnownCheckpoint("set", "wrist_snap_velocity"), false);
  assert.equal("wrist_snap_velocity" in checkpointStanding("set", invented), false);
  // And the real ones still resolve, for all five of the skill's checkpoints.
  for (const key of ["hand_shape", "footwork", "body_alignment", "release", "tempo_decision"]) {
    assert.equal(isKnownCheckpoint("set", key), true, key);
  }
});

// A checkpoint the model put in both columns resolves to the actionable half.
test("a checkpoint claimed by both columns reads as one to change", () => {
  const clash: AnalysisResult = {
    ...V2,
    changes: [{ ...(V2.changes ?? [])[0], key: "release" }],
  };
  assert.equal(checkpointStanding("set", clash).release, "change");
});

// ---------------------------------------------------------------------------
// What each shape renders. Every section that only ONE shape can fill sits
// behind a presence guard on the field that shape carries, so a row without it
// renders no empty shell and a row with it is unchanged.
// ---------------------------------------------------------------------------

test("a v1 row keeps its metrics, its verdicts and its timeline", () => {
  assert.match(BODY, /\{metrics\.length > 0 && \(/);
  assert.match(BODY, /\{insights\.length > 0 && \(/);
  // The per-pointer verdicts, which are the only account of a v1 metric score.
  assert.match(BODY, /pointerCue\(skill, m\.key, p\.key\)/);
  assert.match(BODY, /<MetricBar/);
  assert.match(BODY, /id="timeline"/);
});

test("a v1 row renders no checkpoints section and no confidence line", () => {
  assert.match(BODY, /\{checkpoints\.length > 0 && \(/);
  assert.match(BODY, /\{result\.confidence && \(/);
  assert.match(BODY, /const checkpoints = result\.checkpoints \?\? \[\]/);
});

// The checkpoints moved behind Advanced on 2026-08-06. They render all five
// catalog rows on every rep whatever the clip showed, so at Basic they were a
// fixed five cards of standing teaching content between the fixes and the
// drills, which was most of what made a phone scroll. Moved, never dropped, so
// both halves are pinned: the section still renders on a v2 row, and it renders
// Advanced-only.
test("a v2 row renders checkpoints, and they sit behind Advanced", () => {
  const cp = section(BODY, "{checkpoints.length > 0 && (");
  assert.match(
    cp,
    /className=\{ADVANCED_ONLY\}/,
    "the named checkpoints are reference material, not tonight's change",
  );
  assert.match(cp, /<h2/);
  // And the list itself is still rendered, so "behind Advanced" never quietly
  // became "deleted".
  assert.match(BODY, /<CheckpointList/);
});

// WHAT BASIC IS, pinned as a list rather than one section at a time, because
// the owner's ask was about the total height of the page and any one section
// drifting back undoes it. Basic is four things: the summary, what worked,
// what to change, the drills.
test("Basic is the summary, both columns and the drills", () => {
  // The summary shares its Reveal with the switch, so nothing can gate it
  // without gating the control that ungates everything else.
  const summary = section(BODY, "<Reveal delay={140}>", 200);
  assert.match(summary, /\{result\.summary\}/);
  assert.match(summary, /<DetailSwitch \/>/);
  assert.doesNotMatch(summary, /ADVANCED_ONLY/);

  for (const anchor of ['id="strengths"', 'id="changes"']) {
    const at = BODY.indexOf(anchor);
    assert.notEqual(at, -1, anchor);
    // Nothing between the grid and the heading hides it.
    assert.doesNotMatch(BODY.slice(at - 320, at), /ADVANCED_ONLY/, anchor);
  }

  const drills = section(BODY, "{result.drill_slugs.length > 0 && (");
  assert.match(drills, /id="drills"/);
  assert.doesNotMatch(drills, /ADVANCED_ONLY/, "drills are the thing to do tonight");
});

test("the metric bars and the timeline are moved behind Advanced, not dropped", () => {
  assert.match(section(BODY, "{metrics.length > 0 && ("), /className=\{ADVANCED_ONLY\}/);
  assert.match(section(BODY, "{insights.length > 0 && ("), /className=\{ADVANCED_ONLY\}/);
  assert.match(section(BODY, "{result.confidence && ("), /className=\{ADVANCED_ONLY\}/);
});

// The one place a v2 row has anything to put behind the switch, so if this
// stops being Advanced-gated the switch does nothing at all on a v2 row.
test("the scoring ladder under a checkpoint is the v2 Advanced half", () => {
  assert.match(CHECKPOINTS, /ADVANCED_ONLY/);
  assert.match(CHECKPOINTS, /anchors\.developing/);
  assert.match(CHECKPOINTS, /anchors\.solid/);
  assert.match(CHECKPOINTS, /anchors\.advanced/);
});

// ---------------------------------------------------------------------------
// The switch itself, the checkpoints, and the layout.
// ---------------------------------------------------------------------------

test("basic is the default and the switch is a real control", () => {
  assert.match(SWITCH, /<fieldset/);
  assert.match(SWITCH, /<legend className="sr-only">How much detail to show<\/legend>/);
  assert.match(SWITCH, /type="radio"/);
  assert.match(SWITCH, /defaultChecked/);
  // Advanced carries the hook the reveal selects on; Basic must not, or every
  // Advanced section would be open at rest.
  assert.match(SWITCH, /className="detail-advanced sr-only"/);
  assert.equal([...SWITCH.matchAll(/detail-advanced sr-only/g)].length, 1);
  // Tap target, on both options.
  assert.equal([...SWITCH.matchAll(/chip min-h-11/g)].length, 2);
});

// No client component, no useState: on a v1 row the Advanced half is the only
// account of where the score came from, so hiding it behind hydration would
// mean a failed hydration takes a player's whole scorecard with it.
test("the switch needs no JavaScript to work", () => {
  assert.doesNotMatch(SWITCH, /"use client"/);
  assert.doesNotMatch(SWITCH, /useState\(/);
  assert.match(SWITCH, /hidden group-has-\[\.detail-advanced:checked\]:block/);
  assert.match(SWITCH, /group-has-\[\.detail-advanced:checked\]:hidden/);
  // The reveal resolves against an ancestor `.group`, so the body must wrap
  // both the control and everything it governs in one.
  assert.match(BODY, /className=\{DETAIL_SCOPE\}/);
  assert.match(SWITCH, /export const DETAIL_SCOPE = "group"/);
});

test("all five checkpoints render from the catalog, in catalog order", () => {
  assert.match(CHECKPOINTS, /metricKeys\(skill\)\.map\(/);
  // Never from the stored result: the teaching prose is authored content.
  assert.match(CHECKPOINTS, /metricKnowledge\(skill, discipline, key\)/);
  assert.match(CHECKPOINTS, /knowledge\.elite_marker/);
  assert.match(CHECKPOINTS, /What 90 looks like/);
  // And the expansion is native, so it is keyboard and screen-reader correct
  // with nothing shipped to make it so.
  assert.match(CHECKPOINTS, /<details/);
  assert.match(CHECKPOINTS, /<summary/);
  assert.match(CHECKPOINTS, /min-h-11/);
});

test("a checkpoint the clip did not show says so, and blames the clip", () => {
  assert.match(CHECKPOINTS, /found\?\.visible \? found\.observation\.trim\(\) : ""/);
  // The CLIP is the subject of that sentence, not the player, and it is the
  // only copy the row falls back to. A checkpoint carries no verdict and no
  // number, so there is nothing here for a player to have failed at (D-099).
  assert.match(CHECKPOINTS, /This clip didn’t show this one well enough to call it\./);
  const copy = [...CHECKPOINTS.matchAll(/"([A-Z][^"]{12,})"/g)].map((m) => m[1]);
  for (const line of copy) {
    assert.doesNotMatch(line, /\bmissed\b|\bfailed\b|\bweak\b|\bpoor\b/i, line);
  }
});

test("the columns sit side by side on width they actually have", () => {
  // A container query, not a viewport one: the analysis page gives up to 30rem
  // of its width to the clip, so `sm:grid-cols-2` would have split a sub-30rem
  // column into two unreadable strips on a laptop.
  assert.match(BODY, /className="@container/);
  assert.match(BODY, /@xl:grid-cols-2/);
  assert.doesNotMatch(BODY, /sm:grid-cols-2 ?"[\s\S]{0,40}strengths/);
  // Three against two is permanent, so neither column is stretched to match.
  assert.match(BODY, /grid items-start/);
  // And an empty column renders no heading at all.
  assert.match(BODY, /\{worked\.length > 0 && \(/);
});

// THE THREE NUMBERS THAT DECIDE WHETHER THE COLUMNS ACTUALLY SPLIT.
//
// "What worked" and "what to change" go side by side at 36rem of CONTAINER
// width, not viewport width, because the analysis page hands this component
// only what the clip column leaves it. So the breakpoint and the clip cap are
// one setting expressed in two files, and reading either alone tells you
// nothing. Before 2026-08-06 they disagreed: a 30rem clip cap left the
// breakdown under 36rem until roughly a 1536px viewport, so the layout that
// exists to stop scrolling stacked on every ordinary laptop.
//
// Arithmetic this pins, at a 1280px viewport: 1280px, less the 14rem sidebar
// and 2 x 2.5rem of page padding, is about 59rem of row; less the 2rem gap and
// a 22rem clip leaves about 35rem... which is why the cap is 22 and not 24.
test("the clip cap leaves the breakdown enough room to split its columns", async () => {
  const page = await readFile(
    new URL("../app/(app)/analysis/[id]/page.tsx", import.meta.url),
    "utf8",
  );
  const body = await readFile(
    new URL("../components/breakdown-body.tsx", import.meta.url),
    "utf8",
  );

  const cap = page.match(/md:grid-cols-\[minmax\(0,1fr\)_minmax\(0,(\d+)rem\)\]/);
  assert.ok(cap, "the analysis page must cap the clip column in rem");
  const split = body.match(/@\[(\d+)rem\]:grid-cols-2|@xl:grid-cols-2/);
  assert.ok(split, "the breakdown must declare a container-query split");

  // The row a 1280px viewport actually offers this component.
  const ROW_REM = (1280 - 14 * 16 - 2 * 2.5 * 16) / 16;
  const GAP_REM = 2;
  const remaining = ROW_REM - GAP_REM - Number(cap[1]);
  const threshold = split[1] ? Number(split[1]) : 36; // @xl is 36rem
  assert.ok(
    remaining >= threshold - 1,
    `a 1280px viewport leaves the breakdown ${remaining.toFixed(1)}rem but the columns need ${threshold}rem; ` +
      "either lower the clip cap or lower the container breakpoint, but do not let them drift",
  );
});

// ---------------------------------------------------------------------------
// The reps list. One line per rep, because how many reps fit on a phone screen
// is the whole value of the page.
// ---------------------------------------------------------------------------

const HISTORY = await readFile(
  new URL("../app/(app)/history/page.tsx", import.meta.url),
  "utf8",
);

test("a rep in the list is one line: when, what, where, how it scored", () => {
  // The fix used to be the row's second line. It is gone from the markup AND
  // from the query, so the result blob no longer crosses the wire for up to
  // 100 rows to print one string. Someone who wants to know what to change
  // opens the rep, which is where all of it already is.
  assert.doesNotMatch(HISTORY, /priority_fix/);
  assert.doesNotMatch(
    HISTORY,
    /select\("[^"]*\bresult\b/,
    "nothing on this row needs the result JSON any more",
  );

  // BOTH remaining facts stay. The list mixes environments (Trends splits
  // them), so an outdoor 62 next to an indoor 78 has to read as two facts
  // rather than as a regression; that is why the environment is on the row.
  assert.match(HISTORY, /SKILL_LABEL\[r\.skill\]/);
  assert.match(HISTORY, /disciplineGroup\(r\.discipline\)/);
  assert.match(HISTORY, /DISCIPLINE_LABEL\.indoor/);
  assert.match(HISTORY, /DISCIPLINE_LABEL\.grass/);

  // The score is the source of a shared-element morph into the breakdown's
  // score ring. Dropping the ViewTransition to save a wrapper would break the
  // open animation, not just this row.
  assert.match(HISTORY, /<ViewTransition\s+name=\{`rep-\$\{r\.id\}`\}/);
  assert.match(HISTORY, /share="morph"/);

  // Shorter row, same target. A one-line row is under 44px on its own, so the
  // floor is what holds it there.
  assert.match(HISTORY, /className="group flex min-h-11/);
});

// The /history header was about 200px before the first rep: a kicker, a 32px
// title, the hub strip, and seven filter chips that WRAPPED to two rows on any
// phone. It was taller than the slice of the list it introduced, which is the
// opposite of what a list header is for. The chips cannot shrink (they are the
// tap targets), so the row scrolls sideways instead, matching the hub strips in
// components/section-nav.tsx. Two scrolling chip rows that behaved differently
// would read as two different controls.
test("the history filter chips scroll sideways rather than wrapping", async () => {
  const page = await readFile(
    new URL("../app/(app)/history/page.tsx", import.meta.url),
    "utf8",
  );
  // The wrap is the bug. It must not come back.
  assert.doesNotMatch(page, /flex-wrap/);
  assert.match(page, /overflow-x-auto/);
  assert.match(page, /snap-x snap-mandatory/);
  // Bleeding past the shell gutter is what signals there is more to the right.
  assert.match(page, /-mx-5/);
  assert.match(page, /md:mx-0/);
  // Smaller type is fine on this page; smaller tap targets are not.
  const chipClasses = [...page.matchAll(/className=\{`chip ([^`]*)`/g)].map((m) => m[1]);
  assert.ok(chipClasses.length >= 2, "expected the All chip and the per-skill chips");
  for (const cls of chipClasses) {
    assert.match(cls, /min-h-11/, `a filter chip lost its 44px target: ${cls}`);
    assert.match(cls, /shrink-0/, `a filter chip can be squeezed by the row: ${cls}`);
  }
});
