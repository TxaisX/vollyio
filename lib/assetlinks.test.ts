import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// DIGITAL ASSET LINKS, which is the file that decides whether the Android app
// opens as an app or as a browser tab with an address bar over every screen.
//
// TWO FINGERPRINTS, AND BOTH ARE LOAD-BEARING. This is the single easiest thing
// in the repo to "tidy up" into a bug, because the two lines look like a
// duplicate and are not:
//
//   17:00:CA... is OUR upload key (~/.android-keys/vollyio-upload.keystore).
//               It signs vollyio-sideload.apk, the build a phone installs
//               directly from the GitHub release. Remove it and every sideload
//               tester gets the address bar.
//
//   B5:F2:99... is GOOGLE'S app signing key, read from Play Console ->
//               Test and release -> App signing on 2026-08-10, after the first
//               bundle upload made it exist. Play App Signing STRIPS our
//               signature and re-signs with this one, so the build Play hands a
//               tester is signed by a key we never held. Remove it and every
//               Play install gets the address bar.
//
// Why the address bar is not a cosmetic problem: Chrome 86+ treats a Digital
// Asset Links failure at TWA launch as a crash, and a crash on launch is a
// Play policy violation, not just an ugly screen.
//
// The array is the correct shape for this. Google verifies a match against ANY
// entry, which is exactly why both distribution channels can share one file.
const UPLOAD_KEY =
  "17:00:CA:A6:33:3C:CE:8A:FC:69:81:20:F7:08:FA:04:A0:18:FD:A1:A6:39:4F:6A:80:B3:AB:32:0E:39:31:95";
const PLAY_APP_SIGNING_KEY =
  "B5:F2:99:ED:14:F4:C5:F2:52:01:4C:43:B7:E2:13:A1:5F:D3:3E:9A:FB:CE:79:A6:12:2D:8E:BF:85:EC:0E:F8";

const RAW = await readFile(
  new URL("../public/.well-known/assetlinks.json", import.meta.url),
  "utf8",
);

test("the app is claimed for the package we actually shipped", () => {
  const links = JSON.parse(RAW);
  assert.equal(links.length, 1);
  const [entry] = links;
  assert.deepEqual(entry.relation, ["delegate_permission/common.handle_all_urls"]);
  assert.equal(entry.target.namespace, "android_app");
  // Permanent, and it cost a deleted Play Console app to get right: the console
  // entry was created as com.vollyio.myapp and a package name cannot be changed
  // once an app exists, so the app was deleted and remade to match this.
  assert.equal(entry.target.package_name, "com.vollyio.app");
});

test("both signing keys are claimed, so sideload AND Play both verify", () => {
  const [entry] = JSON.parse(RAW);
  const prints: string[] = entry.target.sha256_cert_fingerprints;

  assert.ok(
    prints.includes(UPLOAD_KEY),
    "dropping the upload key breaks every sideloaded install",
  );
  assert.ok(
    prints.includes(PLAY_APP_SIGNING_KEY),
    "dropping Google's app signing key breaks every Play install, because Play " +
      "re-signs the bundle with a key we never held",
  );

  // Uppercase, colon-separated, 32 bytes. Google's matcher is not forgiving
  // about shape, and a lowercase paste fails silently: the file still serves
  // 200, the app just quietly stops verifying.
  for (const print of prints) {
    assert.match(print, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/, print);
  }
});
