import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * THE ANDROID APP IS A SECOND CLIENT OF THESE ROUTES, and nothing in this repo
 * knew that until it cost a morning.
 *
 * `/api/analyze` returns `analysisId`. The app's wire model declared `id`, so
 * the field decoded to null on every successful analysis and the app showed
 * "That analysis didn't finish. Try again." while the server had scored the
 * rep, written the row, moved the clip out of the pending prefix and returned
 * 200. Invisible from the server: the logs showed no errors at all, because
 * there were none.
 *
 * A test on this side is the right place for it. The Android repo cannot see
 * these routes, but this repo IS where the field would be renamed, so this is
 * the file that will fail when somebody does it. It reads the route source
 * rather than calling it, so it needs no server, no keys and no network.
 */
function routeSource(path: string): string {
  return readFileSync(new URL(`../app/api/${path}`, import.meta.url), "utf8");
}

test("/api/analyze still returns the field name the Android client decodes", () => {
  const src = routeSource("analyze/route.ts");
  // The success return, as the app's AnalyzeResponse expects to find it.
  assert.match(
    src,
    /return NextResponse\.json\(\{\s*analysisId,/,
    "the analyze success payload no longer leads with `analysisId`; " +
      "native/src/main/java/com/vollyio/android/data/Models.kt decodes that exact name " +
      "and shows a failure to the player when it is missing",
  );
  assert.match(src, /clipPath,/, "clipPath is part of the same payload the app reads");
});

test("/api/coach still answers with the header the Android client adopts a session from", () => {
  const src = routeSource("coach/route.ts");
  // The app reads x-coach-session to learn the id of a conversation it just
  // started; without it every message opens a new thread.
  assert.match(
    src,
    /x-coach-session/i,
    "the coach route stopped sending x-coach-session; the app adopts a new " +
      "session id from that header and will otherwise start a fresh " +
      "conversation on every message",
  );
});

test("/api/play/verify still takes the body key the Android client sends", () => {
  const src = routeSource("play/verify/route.ts");
  assert.match(
    src,
    /purchase_token/,
    "the verify route stopped reading `purchase_token`; the app posts exactly that key",
  );
});

test("/api/app/content still serves the shape the Android client models", () => {
  const src = readFileSync(new URL("../lib/app-content.ts", import.meta.url), "utf8");
  // Each of these is a field name ContentModels.kt declares. A rename here is
  // silent on the web and empties a library in the app.
  for (const key of [
    "version",
    "skills",
    "drills",
    "technique",
    "rehab",
    "discipline_labels",
    "score_bands",
    "analyze_disciplines",
  ]) {
    assert.match(
      src,
      new RegExp(`(^|\\s|\\{)${key}:`, "m"),
      `app content no longer exposes \`${key}\`, which ContentModels.kt decodes`,
    );
  }
});
