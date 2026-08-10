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

test("the landing page offers the install instead of describing it", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /<InstallApp \/>/);
  // The old copy mentioned installing in one clause of one FAQ answer and left
  // the reader to find Chrome's overflow menu, which is the same as not
  // shipping it. That sentence must not come back as the only mention.
  assert.doesNotMatch(page, /you can install it like an app/);
});
