import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * The calibration harness measures what production ships, or it measures
 * nothing.
 *
 * `npm run eval:run` pointed at `scripts/run-evals.mjs` for weeks after the
 * route that script drives was deleted, so the repo's own documented command
 * posted into a 404 and the suite silently measured nothing at all. Nothing
 * failed, because nothing was watching the wiring. These tests watch the
 * wiring.
 *
 * Asserted against SOURCE TEXT rather than by importing either side: the
 * harness is an `.mjs` script that opens a network connection at module scope,
 * and `lib/ai/client.ts` is `server-only` and throws outside a Next runtime.
 * Neither can be imported into a unit test, which is exactly why the drift
 * between them was invisible.
 */

const harness = await readFile(
  new URL("../scripts/video-eval.mjs", import.meta.url),
  "utf8",
);
const client = await readFile(
  new URL("./ai/client.ts", import.meta.url),
  "utf8",
);
const pkg = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts?: Record<string, string> };

// The harness hardcodes the model because it cannot import the module that
// declares it. That copy is fine; a copy nothing compares is not. Change the
// model in one place and this test names the other place.
test("the harness reads the same vision model production ships", () => {
  const shipped = client.match(/export const VISION_MODEL\s*=\s*"([^"]+)"/)?.[1];
  const measured = harness.match(/^const MODEL\s*=\s*"([^"]+)"/m)?.[1];
  assert.ok(shipped, "lib/ai/client.ts must declare VISION_MODEL");
  assert.ok(measured, "scripts/video-eval.mjs must declare MODEL");
  assert.equal(
    measured,
    shipped,
    `the harness measures ${measured} while production ships ${shipped}`,
  );
});

// The prompt is IMPORTED by the harness rather than copied, and it has to stay
// that way. A harness holding its own copy of the rubric grades a prompt the
// product does not send, which is the failure this whole file exists to catch,
// one level deeper.
test("the harness imports the live rubric instead of carrying its own", () => {
  assert.match(harness, /from "\.\.\/lib\/ai\/simple-rubric\.ts"/);
  assert.match(harness, /simpleRubric\(/);
  assert.doesNotMatch(
    harness,
    /const\s+(RUBRIC|SYSTEM_PROMPT)\s*=\s*`/,
    "the harness must not hold a rubric of its own",
  );
});

test("the documented eval command runs the harness that is wired to something", () => {
  const run = pkg.scripts?.["eval:run"];
  assert.ok(run, "package.json must define eval:run");
  assert.match(run, /scripts\/video-eval\.mjs/);
});

// The dead harness drove `/api/eval`, a route that no longer exists. Nothing
// may quietly point back at either one: an npm script is the thing people run
// without reading it first.
test("no npm script drives the deleted eval route", () => {
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    assert.doesNotMatch(command, /run-evals\.mjs/, `${name} runs the dead harness`);
  }
});
