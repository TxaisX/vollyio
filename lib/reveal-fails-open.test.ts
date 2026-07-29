// A decorative entrance must never be able to hide content permanently.
//
// This is a regression guard for a production incident: a view transition
// aborted with "InvalidStateError: Transition was aborted because of invalid
// state", the IntersectionObserver behind `Reveal` never fired for the incoming
// document, and a signed-in player got a fully rendered dashboard they could
// not see. The heading, the ratings, the goals and the recent list were all in
// the DOM the whole time, held at opacity 0 by `:root.js .reveal:not(.in)`.
//
// Reduced-motion users were never affected, because the global reduce block
// forces opacity 1. That is why it presented as intermittent and
// machine-specific rather than as a total outage.
//
// The invariant is not "the observer works". It is that the hidden state is
// BOUNDED, whatever goes wrong: an aborted transition, an element observed
// inside a detached subtree, a throttled tab, an observer that never gets a
// frame. These assertions pin that the bound exists and that the CSS it defends
// against still behaves the way the bound assumes.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");

test("a reveal that is never observed still shows its content", () => {
  const motion = read("components/motion.tsx");
  assert.notEqual(motion, "", "components/motion.tsx is missing");

  // A timer that flips the element visible regardless of the observer.
  assert.match(
    motion,
    /REVEAL_FAILSAFE_MS/,
    "no failsafe constant: an observer that never fires would hide content forever",
  );
  assert.match(
    motion,
    /setTimeout\(\s*\(\)\s*=>\s*\{[\s\S]{0,120}setInView\(true\)/,
    "the failsafe must actually set the element in-view",
  );
  // And it must be cleaned up, or every reveal leaks a timer per mount.
  assert.match(motion, /clearTimeout\(/, "the failsafe timer is never cleared");
});

test("the failsafe is short enough to be a blink, not a blank page", () => {
  const motion = read("components/motion.tsx");
  const found = motion.match(/REVEAL_FAILSAFE_MS\s*=\s*(\d+)/);
  assert.ok(found, "could not read the failsafe duration");
  const ms = Number(found[1]);
  assert.ok(ms > 0, "a zero failsafe defeats the entrance entirely");
  assert.ok(
    ms <= 2000,
    `content may stay hidden for ${ms}ms; anything past ~2s reads as a broken page`,
  );
});

test("the CSS the failsafe defends against is still the hiding mechanism", () => {
  // If this rule is ever removed or changed, the failsafe above is guarding
  // nothing and this test should be revisited rather than silently passing.
  const css = read("app/globals.css");
  assert.match(
    css,
    /:root\.js \.reveal:not\(\.in\)/,
    "the JS-gated hidden state moved; re-check that Reveal still fails open",
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.reveal:not\(\.in\)[\s\S]*opacity: 1/,
    "reduced motion must keep forcing content visible",
  );
});
