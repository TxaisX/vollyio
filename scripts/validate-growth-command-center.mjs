import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const dashboardUrl = new URL("../docs/vollyio-growth-command-center.html", import.meta.url);
const html = await readFile(dashboardUrl, "utf8");
const match = html.match(/\/\* MODEL_START \*\/([\s\S]*?)\/\* MODEL_END \*\//);

assert.ok(match, "dashboard must contain an extractable model block");

const sandbox = { console };
vm.runInNewContext(match[1], sandbox, { filename: "growth-command-center-model.js" });

const { DEFAULT_SCENARIO, sanitizeScenario, calculateScenario } = sandbox.__growthModel;
const defaults = sanitizeScenario(DEFAULT_SCENARIO);
const result = calculateScenario(defaults);

assert.ok(Math.abs(result.weekly.contributionPerCharge - 7.31429) < 0.00001);
assert.ok(Math.abs(result.annual.contributionPerCharge - 31.61829) < 0.00001);
assert.ok(result.organic.customers > 0, "organic plan must produce customers");
assert.ok(result.paid.customers > 0, "paid plan must produce customers");
assert.ok(Number.isFinite(result.paid.cac), "paid CAC must be finite");
assert.ok(Number.isFinite(result.business.operatingProfit), "profit must be finite");
assert.ok(result.target.requiredMonthlyCustomers > 0, "target solver must require customers");

const hostile = sanitizeScenario({
  pricing: { weeklyPrice: -99, annualRenewalRate: 500 },
  paid: { budget: "not a number", cpm: 0 },
  funnel: { visitorToSignup: Infinity },
});
const hostileResult = calculateScenario(hostile);
assert.equal(hostile.pricing.weeklyPrice, 0);
assert.equal(hostile.pricing.annualRenewalRate, 95);
assert.ok(Object.values(hostileResult.paid).every((value) =>
  typeof value !== "number" || Number.isFinite(value)
));

function assertFiniteNumbers(value, path = "result") {
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), `${path} must be finite`);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) assertFiniteNumbers(child, `${path}.${key}`);
}

assertFiniteNumbers(hostileResult);

for (const id of [
  "overview", "assumptions", "funnel", "organic", "paid", "pricing", "decisions",
  "scenario-select", "save-scenario", "duplicate-scenario", "export-scenario",
  "import-scenario", "reset-scenario",
]) {
  assert.ok(html.includes(`id="${id}"`), `missing required interface id: ${id}`);
}

assert.ok(html.includes("vollyio:growth-command-center:v1"), "missing versioned storage key");
assert.ok(!html.includes("repeating-linear-gradient"), "background grids are prohibited");
assert.ok(!/anthropic|openai|stripe/i.test(html), "dashboard must not expose vendor names");

console.log("Growth command center validation passed.");
