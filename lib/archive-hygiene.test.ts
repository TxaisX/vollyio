import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

// ARCHIVED CODE MUST NOT RUN, AND "REMEMBER TO RENAME IT" IS NOT A MECHANISM.
//
// `tsconfig.json` excludes `archive/`, so nothing in there is typechecked, and
// that is easy to mistake for "archive/ is out of the build". It is not out of
// the TEST run. `npm test` is a bare `node --test`, whose default discovery
// walks the entire repository, `archive/` included.
//
// This bit on 2026-08-11. `lib/owner-alert.ts` and its 17 tests were archived
// with `git mv`, and all 17 kept running from their new home against a module
// no request could reach. The tell was that the suite total did not move: 632
// before, 632 after. A green suite that is green about deleted code is worse
// than a red one, because it reads as coverage.
//
// The fix at the time was to rename the file off the discovery pattern
// (`owner-alert.tests-archived.ts`) and write the rule in `archive/README.md`.
// That worked and it is still the convention, but a convention in a README is
// enforced by whoever remembers to read it, which is the same kind of guarantee
// that just failed. This test is the enforcement.
//
// Deliberately NOT solved by narrowing the runner to explicit globs. A positive
// include list silently drops any future directory nobody thought to add, and a
// test that never runs is a worse failure than a test that runs in the wrong
// place, because nothing at all reports it.

const ARCHIVE = new URL("../archive/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// Node's default test-file discovery, transcribed from its documentation.
// Anything matching ANY of these is collected and executed, wherever it lives.
const RUNNABLE_EXT = String.raw`\.(?:[cm]?js|[cm]?ts)$`;
const COLLECTED_FILE = [
  new RegExp(String.raw`\.test${RUNNABLE_EXT}`),
  new RegExp(String.raw`-test${RUNNABLE_EXT}`),
  new RegExp(String.raw`_test${RUNNABLE_EXT}`),
  new RegExp(String.raw`^test${RUNNABLE_EXT}`),
  new RegExp(String.raw`^test-.*${RUNNABLE_EXT}`),
];
// Node also treats every file inside a directory named `test` as a test.
const COLLECTED_DIR = new Set(["test", "__tests__"]);

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      if (COLLECTED_DIR.has(name)) out.push(full + "/");
      walk(full, out);
    } else if (COLLECTED_FILE.some((re) => re.test(name))) {
      out.push(full);
    }
  }
  return out;
}

test("nothing under archive/ matches node --test discovery", () => {
  const offenders = walk(ARCHIVE).map((p) => relative(ARCHIVE, p).replace(/\\/g, "/"));

  assert.deepEqual(
    offenders,
    [],
    offenders.length === 0
      ? ""
      : `These archived paths are being COLLECTED AND RUN by \`npm test\`:\n` +
          offenders.map((o) => `  archive/${o}`).join("\n") +
          `\n\nArchived code must not run. Rename each file off node's discovery\n` +
          `patterns, the way archive/owner-alert-d102/owner-alert.tests-archived.ts\n` +
          `was renamed: keep the .ts extension so it stays readable and greppable,\n` +
          `just stop it being called a test. See archive/README.md.`,
  );
});

test("the discovery patterns this guard checks are the ones node actually uses", () => {
  // If node's defaults ever change, this test is checking the wrong thing while
  // still passing, which is the exact failure mode it exists to prevent
  // elsewhere. Pin a sample of each pattern so the transcription above is
  // itself asserted rather than trusted.
  const shouldMatch = [
    "thing.test.ts", "thing.test.js", "thing.test.mjs", "thing.test.cts",
    "thing-test.ts", "thing_test.js", "test.ts", "test-thing.mjs",
  ];
  for (const name of shouldMatch) {
    assert.ok(
      COLLECTED_FILE.some((re) => re.test(name)),
      `${name} is collected by node --test but this guard would not flag it`,
    );
  }

  // The rename the convention prescribes must NOT match, or the fix does not fix.
  const shouldNotMatch = [
    "owner-alert.tests-archived.ts",
    "owner-alert.ts",
    "notes-about-testing.md",
    "latest.ts",
  ];
  for (const name of shouldNotMatch) {
    assert.ok(
      !COLLECTED_FILE.some((re) => re.test(name)),
      `${name} would be flagged by this guard but node does not collect it`,
    );
  }
});
