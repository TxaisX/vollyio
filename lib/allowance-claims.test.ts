import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { MONTHLY_ALLOWANCE, DAILY_ALLOWANCE, allowanceSentence } from "./plans.ts";

/**
 * THE HIDDEN ASTERISK D-110 EXISTS TO REFUSE.
 *
 * The wall a player meets is DAILY: 3 a day on Free, 18 a day on Pro. The
 * monthly numbers are those day rates times thirty, kept only so the two
 * cannot disagree. `allowanceSentence` has encoded the honest phrasing since
 * D-110 and says so in its own comment: "540 a month is true and unreachable,
 * 18 a day is true and is what a player will actually meet."
 *
 * The landing page was not using it. It advertised "540 a month" and "90 a
 * month" in the pricing block, in the FAQ, and in the JSON-LD offer, which is
 * the version that reaches a search result and an answer engine. Someone
 * reading it would reasonably plan to film a tournament on Saturday and
 * discover at rep 19 that they cannot.
 *
 * These tests hold the marketing surfaces to the day rate. The Terms are
 * deliberately exempt: that document states the contractual monthly allowance
 * and explains the daily wall in its own section, which is the right shape for
 * a legal text and the wrong shape for a headline.
 */
const MARKETING = ["../app/page.tsx"] as const;

/**
 * Comments are stripped before scanning, unlike the claim-family guards in
 * landing-cinematic.test.ts.
 *
 * The difference is what each rule is protecting. There, the banned words must
 * not exist anywhere, because a comment containing one is how the phrase gets
 * copied back into markup. Here the rule is about what a PLAYER is shown, and
 * the comment explaining why the monthly figure is not the headline is exactly
 * the documentation that keeps it from coming back. A guard that forbids
 * writing down its own reason is a guard nobody can maintain.
 */
function shipped(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

for (const rel of MARKETING) {
  const file = shipped(readFileSync(new URL(rel, import.meta.url), "utf8"));
  const name = rel.replace("../", "");

  test(`${name} never advertises a monthly allowance as the headline number`, () => {
    // The literal figures, in the shapes a marketing sentence uses them.
    for (const n of [MONTHLY_ALLOWANCE.free, MONTHLY_ALLOWANCE.pro]) {
      const patterns = [
        new RegExp(`\\b${n}\\s+(?:analyses\\s+)?a\\s+month`, "i"),
        new RegExp(`\\b${n}\\s+(?:analyses|breakdowns)\\s+per\\s+month`, "i"),
      ];
      for (const p of patterns) {
        assert.doesNotMatch(
          file,
          p,
          `${name} states ${n} a month as a headline. The wall is daily; use allowanceSentence().`,
        );
      }
    }
  });

  test(`${name} quotes the day rate through allowanceSentence`, () => {
    assert.match(
      file,
      /allowanceSentence\("free"\)/,
      "the free plan's allowance must come from allowanceSentence",
    );
    assert.match(
      file,
      /allowanceSentence\("pro"\)/,
      "the pro plan's allowance must come from allowanceSentence",
    );
  });
}

test("allowanceSentence still states a day rate for both plans", () => {
  // If this ever stops being true the tests above are enforcing the wrong
  // thing, so the guard is pinned to the helper rather than to a string.
  assert.match(allowanceSentence("free"), /a day/);
  assert.match(allowanceSentence("pro"), /a day/);
  assert.ok(allowanceSentence("free").includes(String(DAILY_ALLOWANCE.free)));
  assert.ok(allowanceSentence("pro").includes(String(DAILY_ALLOWANCE.pro)));
});

test("the monthly figures are exactly thirty days of the daily ones", () => {
  // The whole reason the monthly numbers are allowed to exist. If this drifts,
  // one of the two is lying to somebody.
  assert.equal(MONTHLY_ALLOWANCE.free, DAILY_ALLOWANCE.free * 30);
  assert.equal(MONTHLY_ALLOWANCE.pro, DAILY_ALLOWANCE.pro * 30);
});
