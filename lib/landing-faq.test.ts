import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

// The landing page holds two FAQ lists: the React one a person reads, and the
// plain one that becomes FAQPage structured data for search and answer
// engines. Two lists is a drift risk, and the drift that matters is not
// wording, it is a machine-read answer quoting a price or an allowance the
// product no longer charges. These tests pin the parts that can become FALSE.
const PAGE = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

function questionsOf(constName: string): string[] {
  // Both arrays are literals in the same file, so read them textually rather
  // than importing a React module into node:test.
  const start = PAGE.indexOf(`const ${constName}`);
  assert.ok(start > -1, `${constName} not found`);
  const end = PAGE.indexOf("\n];", start);
  const body = PAGE.slice(start, end);
  return [...body.matchAll(/q:\s*"([^"]+)"/g)].map((m) => m[1]);
}

test("the human FAQ and the structured-data FAQ ask the same questions, in order", () => {
  const rendered = questionsOf("FAQ:");
  const plain = questionsOf("FAQ_PLAIN:");
  assert.ok(plain.length >= 5, "the structured FAQ should not quietly shrink");
  assert.deepEqual(
    plain,
    rendered,
    "FAQ_PLAIN drifted from FAQ; an answer engine would quote a question the page does not answer",
  );
});

test("the structured answers quote the price and allowance constants, never literals", () => {
  const start = PAGE.indexOf("const FAQ_PLAIN");
  const body = PAGE.slice(start, PAGE.indexOf("\n];", start));

  // The cost answer is the one that can become a false statement about money,
  // so it has to interpolate rather than hardcode. A bare "$" in it means
  // somebody typed a price.
  //
  // Sliced on the template literal's own backticks rather than on the next
  // "}," , which lands INSIDE `${PRO_PRICE},` and truncates the very thing
  // this test exists to look for.
  const cost = body.slice(body.indexOf("What does it cost"));
  const open = cost.indexOf("`");
  const costAnswer = cost.slice(open + 1, cost.indexOf("`", open + 1));
  // The ALLOWANCE comes through allowanceSentence rather than a raw constant,
  // because the honest answer is a day rate and that helper is where the day
  // rate is phrased (D-110). The signup grant is deliberately absent: it is
  // vestigial since the recurring limit became daily, and naming it would
  // promise a first day different from every other one.
  assert.match(
    costAnswer,
    /\$\{allowanceSentence\("free"\)\}/,
    "the free allowance must come from allowanceSentence",
  );
  assert.doesNotMatch(
    costAnswer.replace(/\$\{[^}]+\}/g, ""),
    /\$\d/,
    "a literal dollar amount was typed into the structured FAQ",
  );
});

test("the structured FAQ does not claim precision the scoring path cannot produce", () => {
  const start = PAGE.indexOf("const FAQ_PLAIN");
  const body = PAGE.slice(start, PAGE.indexOf("\n];", start));
  // Same claim family the landing hero is held to: no cited instant, no
  // per-image analysis. This copy reaches an answer engine, so it is the copy
  // most worth holding to it.
  for (const [pattern, why] of [
    [/frame[- ]by[- ]frame/i, "the read samples about one image a second"],
    [/frame[- ]level/i, "there is no per-image output on the video path"],
    [/exact frame/i, "no single sample is identified as the one"],
    [/timestamp/i, "the analyze route returns no instant at all"],
  ] as const) {
    assert.doesNotMatch(body, pattern, why);
  }
});
