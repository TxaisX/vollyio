import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// THE INSTALL OFFER, and the two ways it silently stops existing.
//
// vollyio.com has met every Chrome installability criterion for a long time
// (HTTPS, a manifest with 192 and 512 icons, display:standalone, a service
// worker with a fetch handler). None of that was reachable, because nothing on
// the page offered it. These tests guard the offer, not the criteria.

const LAYOUT = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const BUTTON = await readFile(
  new URL("../components/install-app.tsx", import.meta.url),
  "utf8",
);

test("the install event is captured before hydration, not in a component", () => {
  // FAILURE MODE THIS EXISTS FOR: `beforeinstallprompt` fires once, early, and
  // usually BEFORE React hydrates. A listener added inside a component effect
  // misses it on most visits, so the button never renders and nothing errors -
  // the feature just quietly does not exist. It has to be in the head script.
  assert.match(LAYOUT, /beforeinstallprompt/);
  assert.match(LAYOUT, /window\.__installPrompt/);

  // Without preventDefault, Chrome shows its own mini-infobar and the page
  // stops owning where the offer appears.
  const script = LAYOUT.slice(
    LAYOUT.indexOf("beforeinstallprompt"),
    LAYOUT.indexOf("appinstalled"),
  );
  assert.match(script, /preventDefault/);

  // The component reads the stash rather than racing the event.
  assert.match(BUTTON, /window\.__installPrompt/);
});

test("an installed app, and a browser that cannot install, are offered nothing", () => {
  // Showing "Install" to someone already inside the installed app is the
  // clearest possible signal that a product does not know what it is doing.
  assert.match(BUTTON, /display-mode: standalone/);
  // Safari's own non-standard flag, which is the only signal iOS gives.
  assert.match(BUTTON, /standalone.*===\s*true/);
  // Everything that is neither installable nor iOS Safari renders nothing: a
  // dead Install button is worse than no button.
  assert.match(BUTTON, /if \(mode === "none"\) return null;/);
});

test("iOS gets instructions, and only in the browser where they are true", () => {
  // iOS Safari NEVER fires beforeinstallprompt and exposes no API, so the only
  // honest thing is to name where Add to Home Screen lives.
  assert.match(BUTTON, /Add to Home Screen/);
  // But Chrome, Firefox and Edge on iOS have no Add to Home Screen at all.
  // Telling their users to look in the share sheet sends them somewhere the
  // item does not exist, so those UA strings are excluded by name.
  for (const ua of ["CriOS", "FxiOS", "EdgiOS", "OPiOS"]) {
    assert.ok(BUTTON.includes(ua), `${ua} must be excluded from the iOS branch`);
  }
  // iPadOS 13+ reports itself as a Mac; without this it is never offered.
  assert.match(BUTTON, /maxTouchPoints/);
});

test("the banner and the fixed nav do not fight for the top edge", async () => {
  const nav = await readFile(
    new URL("../components/landing-nav.tsx", import.meta.url),
    "utf8",
  );

  // FAILURE MODE THIS EXISTS FOR: the nav is `fixed` to the top edge and the
  // banner pins itself to the same edge. Left at `top-0` the two occupy one
  // strip and the loser is simply invisible, decided by z-index. The banner
  // publishes its own height and the nav reads it, so there is no second
  // source of truth about whether a banner is on screen.
  assert.match(nav, /top-\[var\(--install-banner-h,0px\)\]/);
  assert.match(BUTTON, /--install-banner-h/);
  // The fallback matters as much as the variable: every page whose nav is not
  // under a banner must still sit flush at the top.
  assert.match(BUTTON, /"0px"/);

  // STICKY, NOT FIXED. Fixed took the ribbon out of flow, so it covered the
  // first 45px of the page - the wordmark and the top of the hero - which is
  // the whole complaint it was rebuilt to answer. Sticky occupies real height,
  // so everything below starts underneath it. z-50 clears the nav's z-40.
  assert.match(BUTTON, /sticky top-0 z-50/);
  assert.doesNotMatch(
    BUTTON,
    /fixed inset-x-0 top-0 z-50/,
    "a fixed ribbon overlays the page instead of making room for itself",
  );

  // A bar that returns on every visit is an ad, not an offer.
  assert.match(BUTTON, /localStorage/);
  assert.match(BUTTON, /Dismiss install offer/);
});

test("the landing page offers the install instead of describing it", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /<InstallApp \/>/);
  // Top of the page, and BEFORE the nav in source order.
  assert.match(page, /<InstallApp variant="banner" \/>/);
  assert.ok(
    page.indexOf('variant="banner"') < page.indexOf("<LandingNav />"),
    "the banner must render above the nav",
  );
  // The old copy mentioned installing in one clause of one FAQ answer and left
  // the reader to find Chrome's overflow menu, which is the same as not
  // shipping it. That sentence must not come back as the only mention.
  assert.doesNotMatch(page, /you can install it like an app/);
});
