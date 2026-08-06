import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Same shape as lib/nav-contract.test.ts, for the same reason: section-nav.tsx
// is JSX and imports next/link, so it cannot be imported into node --test. The
// claims below are structural claims about the markup, so the markup is the
// thing asserted. lib/nav-contract.test.ts already pins WHAT is in the strip
// (no weekly plan, "Injury & recovery"); this file pins HOW it is presented.
const SECTION = await readFile(new URL("../components/section-nav.tsx", import.meta.url), "utf8");
const LAYOUT = await readFile(
  new URL("../app/(app)/layout.tsx", import.meta.url),
  "utf8",
);

// THE ASK: "more of a left-to-right scroll rather than pasting them all at
// once". A wrapping strip becomes two rows on a phone and shoves the page
// content down, which is the thing being complained about, so flex-wrap must
// not come back.
test("the section strip is one scrolling row, not a wrapping block", () => {
  assert.doesNotMatch(SECTION, /flex-wrap/, "wrapping is the behaviour being replaced");
  assert.match(SECTION, /overflow-x-auto/);
  assert.match(SECTION, /shrink-0/, "chips must not compress to fit instead of scrolling");
  assert.match(SECTION, /whitespace-nowrap/, "a label must not wrap inside its own chip");
});

// A naive overflow-x scroller stops wherever the finger let go. Snapping is
// what makes it rest on a chip boundary instead of halfway through a label.
test("the row snaps to whole chips", () => {
  assert.match(SECTION, /snap-x/);
  assert.match(SECTION, /snap-mandatory/);
  assert.match(SECTION, /snap-start/);
  // The snap position has to account for the gutter padding below, or the
  // first chip snaps flush to the screen edge with no breathing room.
  assert.match(SECTION, /scroll-px-5/);
});

// THE BLEED. The strip has to run past the page gutter so a chip is visibly
// cut by the screen edge; a row that stops neatly at the gutter looks complete
// and nobody scrolls it. The offset is only correct if it matches the shell,
// so the shell is read rather than the number being trusted.
test("the bleed is exactly the app shell's mobile gutter, and only on mobile", () => {
  const main = LAYOUT.match(/<main[\s\S]*?className="([^"]+)"/)?.[1];
  assert.ok(main, "app/(app)/layout.tsx must still style main with a className");
  const gutter = main.match(/(?:^|\s)px-(\d+)(?:\s|$)/)?.[1];
  assert.equal(gutter, "5", "mobile gutter changed; the section strip's bleed must follow it");

  assert.match(SECTION, new RegExp(`-mx-${gutter}(?![\\d.])`), "pull out by one gutter");
  assert.match(SECTION, new RegExp(`[\\s"]px-${gutter}(?![\\d.])`), "and pad it straight back");
  // Desktop has a wider gutter and a sidebar, and the row fits there anyway,
  // so both halves are dropped at md rather than bleeding under the chrome.
  assert.match(SECTION, /md:mx-0/);
  assert.match(SECTION, /md:px-0/);
});

// The scrollbar is a stripe of noise under a 44px control on a phone, but
// hiding it must not cost the ability to scroll, and hiding it takes two
// declarations because the engines disagree.
test("the scrollbar is hidden in both engines without disabling scrolling", () => {
  assert.match(SECTION, /\[scrollbar-width:none\]/, "Firefox and Chromium");
  assert.match(SECTION, /::-webkit-scrollbar\]:hidden/, "WebKit");
  assert.doesNotMatch(SECTION, /overflow-x-hidden/, "hiding the bar must not hide the overflow");
});

// THE ORDER IS STABLE, and this pins that it stays stable.
//
// The strip briefly hoisted the active chip to the front, so a scroll container
// that opens at offset 0 would open on the page you are already on. It worked,
// and it cost more than it bought: the chips then sit in different slots on
// different pages of the hub, so nobody can learn that Technique is the middle
// one. Positional memory beats never having to drag, especially at three
// entries where the row barely overflows and the heading already says where you
// are. If a hub grows past a handful, the answer is a stable order PLUS a
// client effect that scrolls the active chip into view, never a reorder.
test("the chips render in their authored order on every page of a hub", () => {
  assert.match(SECTION, /\{items\.map\(\(item\) =>/, "the strip must render `items` as authored");
  assert.doesNotMatch(
    SECTION,
    /items\.filter\(\(item\) => item\.key === active\)/,
    "the active-first hoist must not come back: it breaks positional memory",
  );
  // The active chip is still identifiable, which is the part that actually
  // matters for orientation.
  assert.match(SECTION, /aria-current=\{item\.key === active \? "page" : undefined\}/);
  assert.match(SECTION, /item\.key === active \? "chip-active" : ""/);
});

// The strip got a scroll container and a reordering; none of that may cost the
// keyboard or screen reader behaviour that was already there.
test("keyboard and assistive-tech behaviour survives the scroller", () => {
  assert.match(SECTION, /<nav aria-label=\{label\}/, "still a named navigation landmark");
  assert.match(
    SECTION,
    /aria-current=\{item\.key === active \? "page" : undefined\}/,
    "the active chip is still the current page",
  );
  assert.match(SECTION, /min-h-11/, "44px tap target floor");
  // Chromium does not make a scroll container focusable on its own, so without
  // this the strip is unscrollable by keyboard once it overflows.
  assert.match(SECTION, /tabIndex=\{0\}/, "the scroll region must be reachable by keyboard");
  // overflow-x clips vertically too, so the focus ring needs room inside the
  // container or it is sliced off the top and bottom of a focused chip.
  assert.match(SECTION, /\bpy-1\b/, "room for the 2px focus ring plus its 2px offset");
});
