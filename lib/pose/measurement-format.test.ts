import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clockStamp,
  formatMeasurement,
  measurementLabel,
} from "./measurement-format.ts";
import { MEASUREMENT_CATALOG } from "./metrics.ts";

test("every cataloged checkpoint has a human label", () => {
  for (const defs of Object.values(MEASUREMENT_CATALOG)) {
    for (const { key } of defs) {
      const label = measurementLabel(key);
      assert.ok(label.length > 0);
      assert.ok(!label.includes("_"), `label for ${key} leaks snake_case: ${label}`);
    }
  }
});

test("units format for humans", () => {
  assert.equal(formatMeasurement(142, "deg"), "142°");
  assert.equal(formatMeasurement(1.31, "body_heights"), "1.31 body heights");
  assert.equal(formatMeasurement(0.42, "s"), "0.42s");
  assert.equal(formatMeasurement(12, "deg_from_vertical"), "12° off vertical");
  assert.equal(formatMeasurement(true, "bool"), "Yes");
  assert.equal(formatMeasurement("shuffle", "pattern"), "Shuffle");
  assert.equal(formatMeasurement([0.42, 0.31], "s_between_steps"), "0.42 · 0.31 s");
});

test("clock stamps read like video time", () => {
  assert.equal(clockStamp(2.31), "0:02.3");
  assert.equal(clockStamp(65.05), "1:05.0");
  assert.equal(clockStamp(null), "–");
});
