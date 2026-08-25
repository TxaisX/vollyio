import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// The dashboard is a server component full of JSX, so it is asserted against
// its source, the same shape lib/nav-contract.test.ts uses for the same reason.
const PAGE = await readFile(
  new URL("../app/(app)/dashboard/page.tsx", import.meta.url),
  "utf8",
);

/**
 * THE BUG THIS PINS, because nothing else in the suite can see it.
 *
 * A grid item's `min-width` defaults to `auto`, so a track sized `auto` is at
 * least as wide as its item's MIN-CONTENT. Tailwind's `truncate` sets
 * `white-space: nowrap`, which makes the min-content of a one-line card the
 * whole unwrapped sentence. The action-card grid declared its columns only at
 * `sm:` and above, so below 640px it fell back to one implicit `auto` track:
 * measured at 390px on 2026-08-25, that track computed to 450px inside a 335px
 * container and the dashboard scrolled sideways on every phone.
 *
 * The `min-w-0` already inside the card cannot fix it. That bounds the FLEX
 * child; the overflow is the GRID TRACK above it, and the two are sized by
 * different algorithms.
 *
 * Typecheck, lint, the unit suite and `next build` were all green while this
 * shipped, because it is a layout property and none of them lay anything out.
 * So the guard is this: every grid on the page states a base track, and the
 * base track is `minmax(0,1fr)` rather than the implicit `auto`.
 */
/** Every `className` value in the file, template literals included. Scanning
 *  these rather than the raw text is what keeps the word "grid" in a comment
 *  from being counted as a layout container. */
function classBlobs(source: string): string[] {
  return source.match(/className=(?:\{`[^`]*`[^}]*\}|"[^"]*")/g) ?? [];
}

/** Does this class list turn the element into a grid? The standalone `grid`
 *  utility, never `grid-cols-*` or `grid-flow-*`. */
function isGridContainer(blob: string): boolean {
  return /(?:^|[\s"`{])grid(?![-\w])/.test(blob);
}

test("every dashboard grid constrains its BASE column, not just the breakpoint", () => {
  const containers = classBlobs(PAGE).filter(isGridContainer);

  assert.equal(
    containers.length,
    3,
    `expected 3 grid containers on the dashboard, found ${containers.length}. ` +
      "A new one needs a base track of its own before this count moves.",
  );
  for (const blob of containers) {
    assert.match(
      blob,
      /\bgrid-cols-\[minmax\(0,1fr\)\]/,
      `grid container with an unconstrained base track: ${blob.slice(0, 90)}`,
    );
  }
});

test("no responsive grid track is declared without a base track beside it", () => {
  // Each responsive `grid-cols-` variant has to sit in a class list that also
  // carries the base one. Checked per class-attribute blob rather than over the
  // whole file, so a base track in one component cannot vouch for another.
  for (const blob of classBlobs(PAGE)) {
    if (!/(?:sm|md|lg|xl|2xl):grid-cols-/.test(blob)) continue;
    assert.match(
      blob,
      /\bgrid-cols-\[minmax\(0,1fr\)\]/,
      `a responsive grid track with no base track: ${blob.slice(0, 90)}`,
    );
  }
});

/**
 * The season target renders ABOVE the two action cards (D-127).
 *
 * The whole argument for the band is that it frames the work: a countdown
 * underneath "Film a rep" is a countdown nobody reads before they act. Cheap to
 * reorder by accident in a file this long, so the order is asserted rather than
 * left to whoever edits next.
 */
test("the target band sits above the standing actions", () => {
  const band = PAGE.indexOf("<TargetBand");
  const film = PAGE.indexOf('title="Film a rep"');
  assert.ok(band > 0, "the dashboard no longer renders TargetBand");
  assert.ok(film > 0, "the dashboard no longer renders the film action card");
  assert.ok(band < film, "TargetBand must render before the Film a rep card");
});

/**
 * The target read must stay OUT of the page's error aggregation.
 *
 * `fetchError` throws the whole dashboard away. Migration 063 lands after the
 * deploy, so for the length of that window the query answers with an error, and
 * folding it in would take the entire page down for every player rather than
 * rendering one fewer card. Same fail-soft posture the badge shelf takes for
 * migration 050.
 */
test("a missing training_targets table cannot throw the dashboard away", () => {
  assert.match(PAGE, /\{ data: targetData \}/, "the target read must not bind an error");
  const aggregation = PAGE.match(/const fetchError =[^;]+;/)?.[0] ?? "";
  assert.doesNotMatch(
    aggregation,
    /target/i,
    "the target query's error must not join fetchError",
  );
});
