import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// The nav components are JSX and pull in next/link, and lib/flags.ts reads
// process.env at module load, so all three are asserted against their source.
// Same shape lib/billing.test.ts uses, for the same reason.
const NAV = await readFile(new URL("../components/app-nav.tsx", import.meta.url), "utf8");
const SECTION = await readFile(new URL("../components/section-nav.tsx", import.meta.url), "utf8");
const FLAGS = await readFile(new URL("./flags.ts", import.meta.url), "utf8");

// Coach went live 2026-08-06. The default is ON, and only the exact string
// "false" takes it away, so an unset variable and a typo both leave it running
// rather than silently darkening the feature the way `=== "true"` did.
test("coach chat is on unless someone deliberately turns it off", () => {
  assert.match(FLAGS, /NEXT_PUBLIC_COACH_ENABLED !== "false"/);
  assert.doesNotMatch(FLAGS, /NEXT_PUBLIC_COACH_ENABLED === "true"/);

  // The rule itself, exhaustively, against every value the env can hold.
  const enabled = (v: string | undefined) => v !== "false";
  assert.equal(enabled(undefined), true, "unset must leave coach on");
  assert.equal(enabled(""), true);
  assert.equal(enabled("true"), true);
  assert.equal(enabled("TRUE"), true);
  assert.equal(enabled("False"), true, "only the exact lowercase string disables");
  assert.equal(enabled("false"), false);
});

// THE ASK THIS PINS: coach must appear on BOTH navigations, not just the phone.
// `components/app-nav.tsx` renders the desktop sidebar and the mobile tab bar
// from ONE array through ONE filter, which is what makes that true by
// construction rather than by two lists being kept in step by hand.
test("the sidebar and the tab bar are filtered by the same rule", () => {
  assert.match(NAV, /export function SideNavLinks/);
  assert.match(NAV, /export function TabBar/);
  const filtered = [...NAV.matchAll(/visibleNav\(NAV\)/g)];
  assert.equal(filtered.length, 2, "both navs must map over visibleNav(NAV)");
  // And there is exactly one place that decides what is visible.
  assert.equal([...NAV.matchAll(/function visibleNav/g)].length, 1);
});

test("coach is a primary destination on both navs", () => {
  assert.match(NAV, /href: "\/coach", label: "Coach"/);
  assert.match(NAV, /COACH_ENABLED \? items : items\.filter/);
});

// The weekly plan stays hidden, deliberately. The route still resolves by URL
// and the Train tab still HIGHLIGHTS on it, so someone deep-linked in is not
// left wondering which tab they are inside; there is simply no way in from the
// nav. Restoring it is re-adding a TRAIN_NAV entry and pointing Train at /plan.
test("the weekly plan has no way in from either navigation", () => {
  assert.doesNotMatch(SECTION, /href: "\/plan"/);
  assert.match(NAV, /href: "\/drills", label: "Train"/);
  assert.doesNotMatch(NAV, /href: "\/plan"/);
  // Still highlights when reached directly.
  assert.match(NAV, /match: \["\/plan", "\/drills", "\/learn"\]/);
});

// The library under this chip is about what volleyball injuries are and when to
// stop and get seen, not about rest days. The tab inside it and the back link on
// every entry already said so; this chip was the one place that did not, and it
// sent the wrong player in.
test("the recovery chip says what it actually opens", () => {
  assert.match(SECTION, /label: "Injury & recovery"/);
  assert.doesNotMatch(SECTION, /label: "Recovery"/);
});
