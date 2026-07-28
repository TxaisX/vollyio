import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  TELEMETRY_CEILINGS,
  TELEMETRY_MAX_JSON_LENGTH,
  recordAnalysisTelemetry,
  resetAnalysisTelemetryWarningForTests,
  telemetryViolation,
  type TelemetryClient,
} from "./analysis-telemetry.ts";

const ANALYSIS_ID = "6d0a2f1e-1b3c-4a55-9d21-2f0e5c7a8b91";

// A real run, from the shape the analyze route builds out of the coaching
// reply. Roughly 40k input and 2k output tokens is the measured norm.
const REAL: Record<string, unknown> = {
  input_tokens: 41200,
  output_tokens: 2100,
  cache_read_input_tokens: 38000,
  cache_creation_input_tokens: 0,
  duration_ms: 24500,
  model: "claude-opus-4-8",
  effort: "low",
};

// These paths log on purpose, so the assertions below run without filling the
// test output with lines that are the expected behavior rather than a problem.
async function quiet<T>(work: () => Promise<T> | T): Promise<T> {
  const { error, warn } = console;
  console.error = () => {};
  console.warn = () => {};
  try {
    return await work();
  } finally {
    console.error = error;
    console.warn = warn;
  }
}

beforeEach(() => {
  resetAnalysisTelemetryWarningForTests();
});

test("a real measurement is storable", () => {
  assert.equal(telemetryViolation(REAL), null);
});

test("absent and null fields are storable, because the bound reads them as zero", () => {
  assert.equal(telemetryViolation({ model: "mock" }), null);
  assert.equal(telemetryViolation({ input_tokens: null, output_tokens: undefined }), null);
  assert.equal(telemetryViolation({ input_tokens: 0, duration_ms: 0 }), null);
});

test("every bounded field is refused above its ceiling", () => {
  for (const [field, ceiling] of Object.entries(TELEMETRY_CEILINGS)) {
    assert.equal(
      telemetryViolation({ ...REAL, [field]: ceiling + 1 }),
      field,
      `${field} above its ceiling must be refused`,
    );
    assert.equal(
      telemetryViolation({ ...REAL, [field]: ceiling }),
      null,
      `${field} exactly at its ceiling is still a legal value`,
    );
  }
});

test("a value that is not a whole non-negative number is refused", () => {
  // The database casts through bigint, so a fractional value fails there as a
  // cast error rather than as a bounds message. Refusing it here keeps the
  // failure legible.
  assert.equal(telemetryViolation({ ...REAL, input_tokens: 1.5 }), "input_tokens");
  assert.equal(telemetryViolation({ ...REAL, input_tokens: -1 }), "input_tokens");
  assert.equal(telemetryViolation({ ...REAL, input_tokens: "40000" }), "input_tokens");
  assert.equal(telemetryViolation({ ...REAL, duration_ms: Number.NaN }), "duration_ms");
  assert.equal(telemetryViolation({ ...REAL, duration_ms: Infinity }), "duration_ms");
});

test("an oversized document is refused before it reaches the column", () => {
  const fat = { ...REAL, model: "x".repeat(TELEMETRY_MAX_JSON_LENGTH) };
  assert.equal(telemetryViolation(fat), "size");
});

test("the ceilings here are the ceilings the database enforces", async () => {
  // Three copies of these numbers exist: this map, migration 028's check
  // constraint, and the re-check inside record_analysis_telemetry. Drift
  // between them is silent in production, so it fails here instead.
  const bounds = await readFile(
    new URL("../supabase/migrations/028_billing_quota_and_telemetry_bounds.sql", import.meta.url),
    "utf8",
  );
  const writer = await readFile(
    new URL("../supabase/migrations/029_server_telemetry.sql", import.meta.url),
    "utf8",
  );
  for (const [field, ceiling] of Object.entries(TELEMETRY_CEILINGS)) {
    const pattern = new RegExp(`${field}.*between 0 and ${ceiling}\\b`, "i");
    assert.match(bounds, pattern, `028 must bound ${field} at ${ceiling}`);
    assert.match(writer, pattern, `029 must re-check ${field} at ${ceiling}`);
  }
  // The bound stays a constraint as well as a function check. A migration that
  // dropped it would leave the ceiling enforced only by whoever remembered to
  // call the function.
  assert.doesNotMatch(writer, /drop constraint[^\n]*analyses_telemetry_bounds_check/i);
});

test("migration 029 takes the column off the player and gives it to nobody else", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/029_server_telemetry.sql", import.meta.url),
    "utf8",
  );
  // The header quotes the grant it is removing, so the "no such statement"
  // assertions below read the statements alone.
  const statements = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  // The hole itself: migration 016's column-level insert grant.
  assert.match(sql, /revoke all \(telemetry\) on table public\.analyses from authenticated/i);
  // The replacement writer is reachable by exactly one role.
  assert.match(
    sql,
    /grant execute on function public\.record_analysis_telemetry\(uuid, jsonb\)\s*to service_role/i,
  );
  assert.match(
    sql,
    /revoke all on function public\.record_analysis_telemetry\(uuid, jsonb\)\s*from public, anon, authenticated/i,
  );
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = ''/i);
  // analyses is insert-only for players and must stay that way: no update
  // privilege on the table, and no second grant of the column to authenticated.
  assert.doesNotMatch(statements, /grant update[^\n]*on table public\.analyses/i);
  assert.doesNotMatch(statements, /grant insert \(telemetry\)/i);
  assert.doesNotMatch(statements, /to authenticated/i);
  // Write-once: the update may only fill a row that has no telemetry yet, so
  // the function cannot rewrite a stored analysis even for the role that holds
  // it.
  assert.match(sql, /update public\.analyses[\s\S]*?and telemetry is null/i);
});

test("a mock run records nothing and calls nothing", async () => {
  let calls = 0;
  const client: TelemetryClient = {
    rpc: async () => {
      calls += 1;
      return { data: true, error: null };
    },
  };
  assert.equal(await recordAnalysisTelemetry(client, ANALYSIS_ID, null), "nothing_to_record");
  assert.equal(calls, 0);
});

test("no service key leaves telemetry unwritten and the analysis unharmed", async () => {
  // This is the production deployment's state as this ships:
  // SUPABASE_SERVICE_ROLE_KEY is unset, createServiceClient() returns null, and
  // the route must still answer the player normally.
  const outcome = await quiet(() => recordAnalysisTelemetry(null, ANALYSIS_ID, REAL));
  assert.equal(outcome, "no_service_client");
});

test("the missing-credentials warning is one line per instance, not one per rep", async () => {
  const { warn } = console;
  const lines: unknown[] = [];
  console.warn = (...args: unknown[]) => {
    lines.push(args[0]);
  };
  try {
    await recordAnalysisTelemetry(null, ANALYSIS_ID, REAL);
    await recordAnalysisTelemetry(null, ANALYSIS_ID, REAL);
    await recordAnalysisTelemetry(null, ANALYSIS_ID, REAL);
  } finally {
    console.warn = warn;
  }
  assert.equal(lines.length, 1);
});

test("an out-of-bounds payload is never offered to the database", async () => {
  let calls = 0;
  const client: TelemetryClient = {
    rpc: async () => {
      calls += 1;
      return { data: true, error: null };
    },
  };
  const outcome = await quiet(() =>
    recordAnalysisTelemetry(client, ANALYSIS_ID, { ...REAL, output_tokens: 9e9 }),
  );
  assert.equal(outcome, "invalid");
  assert.equal(calls, 0);
});

test("a good write reaches the one function that may perform it", async () => {
  let name = "";
  let args: unknown;
  const client: TelemetryClient = {
    rpc: async (fn: string, value?: Record<string, unknown>) => {
      name = fn;
      args = value;
      return { data: true, error: null };
    },
  };
  assert.equal(await recordAnalysisTelemetry(client, ANALYSIS_ID, REAL), "recorded");
  assert.equal(name, "record_analysis_telemetry");
  assert.deepEqual(args, { p_analysis_id: ANALYSIS_ID, p_telemetry: REAL });
});

test("every database failure resolves to an outcome instead of throwing", async () => {
  const failures: [string, TelemetryClient][] = [
    ["error reply", { rpc: async () => ({ data: null, error: { message: "denied" } }) }],
    [
      "rejected call",
      {
        rpc: (): Promise<never> => Promise.reject(new Error("connection reset")),
      },
    ],
    [
      "synchronous throw",
      {
        rpc: (): never => {
          throw new Error("client unusable");
        },
      },
    ],
  ];
  for (const [label, client] of failures) {
    const outcome = await quiet(() => recordAnalysisTelemetry(client, ANALYSIS_ID, REAL));
    assert.equal(outcome, "failed", `${label} must resolve, not reject`);
  }
});

test("a write that matched no row is reported rather than counted as recorded", async () => {
  const client: TelemetryClient = { rpc: async () => ({ data: false, error: null }) };
  assert.equal(
    await quiet(() => recordAnalysisTelemetry(client, ANALYSIS_ID, REAL)),
    "not_applied",
  );
});

test("a hung connection gives up on its own bound", async () => {
  // Without this, a database that accepts the connection and never answers
  // would hold a scored rep behind a measurement nobody reads.
  const client: TelemetryClient = { rpc: () => new Promise(() => {}) };
  const startedAt = Date.now();
  const outcome = await quiet(() =>
    recordAnalysisTelemetry(client, ANALYSIS_ID, REAL, { timeoutMs: 20 }),
  );
  assert.equal(outcome, "failed");
  assert.ok(Date.now() - startedAt < 1000, "the timeout must be the thing that ended the wait");
});

test("the analyze route cannot let a telemetry failure change its answer", async () => {
  const route = await readFile(
    new URL("../app/api/analyze/route.ts", import.meta.url),
    "utf8",
  );
  // The insert runs as the player and must no longer name the column, or the
  // revoke in 029 turns every save into a 403.
  const insert = route.match(/from\("analyses"\)\.insert\(\{([\s\S]*?)\}\);/);
  assert.ok(insert, "the analyze route must still insert the analysis row");
  assert.doesNotMatch(insert[1], /telemetry/i);
  // The telemetry write is a statement whose result is discarded: nothing reads
  // it, nothing branches on it, so no failure inside it can reach the response.
  assert.match(route, /^\s*await recordAnalysisTelemetry\(createServiceClient\(\)/m);
  assert.doesNotMatch(route, /(?:=|return|if\s*\()\s*await recordAnalysisTelemetry/);
  // It happens after the row exists and before the response.
  const call = route.indexOf("await recordAnalysisTelemetry");
  assert.ok(call > route.indexOf('from("analyses").insert'), "write after the row exists");
  assert.ok(call < route.lastIndexOf("return NextResponse.json"), "write before the response");
});
