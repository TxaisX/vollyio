import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MAX_CLIP_BYTES } from "./analysis-types.ts";
import { FOCUS_LABEL_MAX_CHARS } from "./analyze-request.ts";

/**
 * The path for a clip this browser cannot decode (D-100).
 *
 * A player uploaded a phone recording, the browser could not render a frame
 * from it, and the product told him to go and use a different browser. It was a
 * defect and not a limitation: NOTHING about the analysis needs a local decode.
 * The clip is uploaded whole and read on the other side, where the container it
 * is in decodes fine. Only three things need pixels in the browser, and all
 * three are conveniences: the poster on the framing card, the preview
 * filmstrip, and the trim.
 *
 * Asserted against SOURCE because none of the three pieces exposes a function
 * to call: two are Next route files that export only handlers, and the third is
 * a client component. The source is the contract, as it already is for
 * lib/ai/players.test.ts.
 */

// Line endings differ by checkout, and every multi-line assertion below would
// otherwise pass or fail on that alone.
const normalize = (source: string) => source.replaceAll("\r", "");

const flowSource = normalize(
  await readFile(new URL("../components/analyze-flow.tsx", import.meta.url), "utf8"),
);
const playersSource = normalize(
  await readFile(new URL("../app/api/players/route.ts", import.meta.url), "utf8"),
);
const analyzeSource = normalize(
  await readFile(new URL("../app/api/analyze/route.ts", import.meta.url), "utf8"),
);

// The defect itself. These are the exact strings a player was shown, and every
// one of them told him the problem was his device when the analysis had never
// needed his device at all.
test("no failure on the upload path sends the player to another browser", () => {
  for (const dead of [
    /open Vollyio in Safari/i,
    /on Android try Chrome/i,
    /couldn't read a frame from that clip/i,
    /HEVC/i,
  ]) {
    assert.doesNotMatch(flowSource, dead, `the flow still tells a player ${dead}`);
  }
});

// Three ways in, and all three used to end the upload. A browser with no
// recorder, a clip that yields no opening frame, and a cut that fails after the
// athlete was already marked.
test("every local decode failure falls through instead of stopping", () => {
  assert.match(flowSource, /if \(!canTrimVideo\(\)\) \{\s*await startNoPreview\(file\);/);
  assert.match(flowSource, /if \(!opening\) \{[\s\S]{0,400}?await startNoPreview\(file\);/);
  // The cut is attempted in its own try so its failure can be told apart from
  // the extraction's, and it carries the mark the player already placed.
  assert.match(flowSource, /await startNoPreview\(blob, target\)/);
});

// A fourth way in, and the subtlest: the cut SUCCEEDED, so the thing the read is
// performed on is already in hand, and only the preview strip failed to render.
// That used to end the upload too, which threw away a good clip and a good mark
// over a picture nothing analyses.
test("a preview strip that fails to render does not cost the analysis", () => {
  assert.match(
    flowSource,
    /THE FILMSTRIP IS A PREVIEW[\s\S]{0,900}?setNoPreview\(\{[\s\S]{0,200}?marked: true,\s*whole: false,/,
  );
  // And the message that used to be shown instead is gone from the flow.
  assert.doesNotMatch(flowSource, /Close other tabs or apps/);
});

// The strings in lib/frames.ts still name browsers, and they must stay where a
// player cannot see them.
test("the browser-blaming strings are internal and stay internal", async () => {
  const frames = normalize(await readFile(new URL("./frames.ts", import.meta.url), "utf8"));
  assert.match(frames, /THESE STRINGS NO LONGER REACH A PLAYER/);
  // Every one of them is the text of a thrown Error or a message the caller
  // catches, never a value this module hands back for rendering.
  assert.doesNotMatch(flowSource, /videoErrorMessage/);
});

// The rich path is better and must survive untouched: a real poster, a real
// tap, a real trim. The fallback is only ever reached by failing into it.
test("the framing card, the tap and the trim are still the primary path", () => {
  for (const kept of [
    /cut = await trimClip\(blob, \{/,
    /await openingFrame\(file\)/,
    /setOpeningPick\(pick\)/,
    /focusRef\.current = target/,
    /await burnMark\(f, target\)/,
  ]) {
    assert.match(flowSource, kept);
  }
});

// The one refusal left on this path, and the reason it is honest: there is no
// decoder here, so nothing in this browser could shorten the file for them.
// Telling them to change browser would send them somewhere equally unable to.
test("the only remaining refusal is size, and it asks for a shorter clip", () => {
  assert.match(flowSource, /file\.size > MAX_CLIP_BYTES/);
  const message = flowSource.match(/const CLIP_TOO_LARGE_MESSAGE =([\s\S]*?);\n/)?.[1] ?? "";
  assert.notEqual(message, "", "the too-large message must exist");
  assert.match(message, /MAX_CLIP_BYTES \/ 1_000_000/);
  assert.match(message, /shorter/i);
  assert.match(message, /one rep/i);
  for (const blame of [/Safari/i, /Chrome/i, /browser/i, /device/i, /MP4/i]) {
    assert.doesNotMatch(message, blame, `the too-large message blames ${blame}`);
  }
});

// The upload is bounded before it is attempted, against the same constant the
// storage policy and the route both enforce. A clip that clears the client and
// is refused by the policy costs the player their whole upload first.
test("the client bound is the same one storage and the route enforce", () => {
  assert.match(flowSource, /import \{ MAX_CLIP_BYTES \} from "@\/lib\/analysis-types"/);
  assert.match(playersSource, /clip\.byteLength > MAX_CLIP_BYTES/);
  assert.match(analyzeSource, /clipBytes\.byteLength > MAX_CLIP_BYTES/);
  // The number itself is not pinned here: lib/security-contract.test.ts already
  // ties it to the storage policy, and pinning it twice would mean two files to
  // edit every time the measured ceiling moves. What is pinned is that all
  // three checks read the same constant rather than a literal of their own.
  assert.ok(MAX_CLIP_BYTES > 0);
});

// Only the three containers the storage policy admits are ever forwarded. The
// extension decides the MIME the upload declares, so an unrecognised file is
// refused rather than relabelled as something it is not.
test("an untrimmed clip is forwarded only in a container the policy admits", () => {
  assert.match(flowSource, /function uploadExtOf\(file: File \| Blob\)/);
  assert.match(flowSource, /const CLIP_MIME: Record<ClipExt, string> = \{/);
  assert.match(flowSource, /contentType: CLIP_MIME\[ext\]/);
  // The fallback to the filename is bounded to the same closed set.
  assert.match(flowSource, /name\.endsWith\("\.mov"\)/);
  assert.match(flowSource, /return null;/);
});

// D-062 made marking mandatory because an unmarked read of multi-person footage
// analyses whoever the model picks and never says who. That guard is not
// dropped here, it is MOVED to the side that can decode the clip.
test("marking moves to the server rather than being dropped", () => {
  assert.match(playersSource, /pending_clip_id: z\.uuid\(\)/);
  assert.match(playersSource, /clip_ext: z\.enum\(\["mp4", "webm", "mov"\]\)/);
  assert.match(playersSource, /await readVideo\(\{/);
  assert.match(playersSource, /instructions: \[CLIP_INSTRUCTION\]/);
  // The path is composed from the VERIFIED user id and a schema-proved UUID, so
  // no request can name a segment of it.
  assert.match(
    playersSource,
    /const pendingPath = `\$\{user\.id\}\/pending\/\$\{fromClip\.pending_clip_id\}\/clip\.\$\{fromClip\.clip_ext\}`/,
  );
  // Read as the player, never the service role: the owner-scoped select policy
  // stays the tenant boundary (docs/security.md rule 10).
  assert.doesNotMatch(playersSource, /createServiceClient/);
});

// Every guard the frame mode has, the clip mode has. They are one handler for
// exactly this reason: a second endpoint is a second place to forget one.
test("the clip mode inherits every guard the frame mode already had", () => {
  for (const guard of [
    /authenticateMutation\(req\)/,
    /if \(!auth\.ok\) return auth\.response;/,
    /consumeApiQuota\(supabase, "coach"\)/,
    /!hasVisionKey\(\)/,
  ]) {
    assert.match(playersSource, guard);
  }
  // Both modes cap the list at six and both fail open to an empty one.
  assert.equal(playersSource.match(/\.max\(6\)/g)?.length, 2);
  assert.match(playersSource, /\{ players: \[\] \}, \{ status: 200 \}/);
});

// D-036: descriptions, never names. The clip mode has the extra burden that its
// reader cannot see the clip, so a vague label is not survivable the way it is
// beside a numbered pin on a picture.
test("clip candidates are descriptions that stand alone as text", () => {
  const instruction =
    playersSource.match(/const CLIP_INSTRUCTION =([\s\S]*?);\n/)?.[1] ?? "";
  assert.notEqual(instruction, "", "the clip instruction must exist");
  assert.match(instruction, /Never a name/i);
  assert.match(instruction, /CANNOT see this clip/i);
  assert.match(instruction, /up to six/i);
  assert.match(instruction, /empty list is a valid answer/i);
  // No coordinates: there is no picture to place one on, so asking for one
  // spends tokens on a number nothing could use.
  assert.doesNotMatch(instruction, /normalized image coordinates/i);
  assert.match(
    playersSource,
    new RegExp(`label: z\\.string\\(\\)\\.max\\(FOCUS_LABEL_MAX_CHARS\\)`),
  );
});

// A video read is slower than one JPEG. An attempt plus its retry has to finish
// inside the platform budget or the function is killed after the quota unit has
// already been spent, which is the failure both numbers exist to prevent.
test("the clip read and its retry fit inside the route's deadline", () => {
  const duration = Number(playersSource.match(/maxDuration\s*=\s*(\d+)/)?.[1]);
  const clipTimeout = Number(
    playersSource.match(/SPOT_CLIP_TIMEOUT_MS\s*=\s*([\d_]+)/)?.[1]?.replaceAll("_", ""),
  );
  assert.ok(duration > 0 && clipTimeout > 0);
  assert.ok(
    (2 * clipTimeout) / 1000 < duration,
    `two attempts of ${clipTimeout}ms exceed maxDuration ${duration}s`,
  );
});

// The chosen description reaches the prompt, and it is the LAST thing that may
// arrive unbounded: it is a string the player's device sends that gets
// interpolated into an instruction.
test("the chosen description is bounded before it reaches a prompt", () => {
  assert.match(analyzeSource, /focusLabelInstruction\(focus_label\)/);
  // The tap wins when both arrive, so the subject can never be ambiguous.
  assert.match(analyzeSource, /focus_point[\s\S]{0,200}focusInstruction\([\s\S]{0,120}focus_label/);
  assert.equal(FOCUS_LABEL_MAX_CHARS, 80);
  // And the client only ever offers a label the route would accept, so a
  // candidate the schema refuses is never a button on screen.
  assert.match(flowSource, /label\.length >= 3 && label\.length <= 80/);
});

// The player is told what is happening and what it costs them, in ordinary
// words. An unmarked read is the one outcome here that is genuinely worse
// coaching, so it is said out loud rather than discovered in the analysis.
test("the no-preview card explains itself without blaming the device", () => {
  assert.match(flowSource, /No preview, full analysis/);
  assert.match(flowSource, /the coach reads the clip itself/);
  assert.match(flowSource, /Nobody could be picked out of this clip/);
  assert.match(flowSource, /Pick the player you want analyzed/);
  // Tap targets stay reachable on a phone.
  const buttons = flowSource.match(/className=\{?`?[^`"]*btn-primary[^`"]*`?\}?/g) ?? [];
  for (const cls of buttons) {
    assert.match(cls, /min-h-11/, `a primary button drops below the tap target: ${cls}`);
  }
});
