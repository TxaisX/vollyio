// Reconcile the authored injury library (content/rehab.ts) into the
// `rehab_entries` table.
//
// Git is the source of truth, the table is the queryable projection. This
// script is the only thing that reconciles them, so the two cannot drift by
// accident: an entry edited in the dashboard is overwritten on the next run,
// which is the correct direction. Idempotent, keyed on slug.
//
// Usage:
//   node scripts/seed-rehab.mjs            # show what would change
//   node scripts/seed-rehab.mjs --confirm  # write it
//
// Needs SUPABASE_SERVICE_ROLE_KEY, because the table grants no write to any
// client role by design (migration 039).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { REHAB } from "../content/rehab.ts";

function fromEnvFile(key) {
  try {
    // Strip the BOM. .env.local is written by a Windows editor and carries one,
    // which lands on the FIRST key only: `startsWith("NEXT_PUBLIC_...")` then
    // silently fails for that one variable and reports it missing while every
    // other key in the same file resolves fine.
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf-8").replace(
      /^﻿/,
      "",
    );
    const line = text.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).replace(/^["']|["']$/g, "").trim() : null;
  } catch {
    return null;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fromEnvFile("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? fromEnvFile("SUPABASE_SERVICE_ROLE_KEY");

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase dashboard: Project Settings -> API).",
  );
  process.exit(1);
}

// Fail before touching the network rather than writing half a library. The
// database enforces the same red-flag floor (039), but a local check names the
// offending slug instead of returning a constraint violation.
const problems = [];
const seen = new Set();
for (const e of REHAB) {
  if (seen.has(e.slug)) problems.push(`${e.slug}: duplicate slug`);
  seen.add(e.slug);
  if ((e.red_flags?.length ?? 0) < 2) {
    problems.push(`${e.slug}: needs at least two red flags, has ${e.red_flags?.length ?? 0}`);
  }
  if (!e.phases?.length) problems.push(`${e.slug}: no recovery phases`);
  if (!e.prevention?.length) problems.push(`${e.slug}: no prevention work`);
}
if (problems.length > 0) {
  console.error(`${problems.length} problem(s) in content/rehab.ts:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

const confirm = process.argv.includes("--confirm");
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const rows = REHAB.map((e) => ({
  slug: e.slug,
  name: e.name,
  also_called: e.also_called,
  region: e.region,
  triage: e.triage,
  summary: e.summary,
  what_it_is: e.what_it_is,
  how_it_happens: e.how_it_happens,
  signs: e.signs,
  red_flags: e.red_flags,
  phases: e.phases,
  prevention: e.prevention,
  return_markers: e.return_markers,
  loads: e.loads,
  updated_at: new Date().toISOString(),
}));

const { data: existing, error: readError } = await db
  .from("rehab_entries")
  .select("slug");
if (readError) {
  console.error("Could not read the table:", readError.message);
  process.exit(1);
}

const live = new Set((existing ?? []).map((r) => r.slug));
const adding = rows.filter((r) => !live.has(r.slug)).map((r) => r.slug);
const updating = rows.filter((r) => live.has(r.slug)).map((r) => r.slug);
// Entries pulled from the source but still live in the table. Reported, never
// auto-deleted: removing an injury entry is a decision, not a side effect.
const orphaned = [...live].filter((s) => !seen.has(s));

console.log(`${REHAB.length} authored, ${live.size} live.`);
console.log(`  add:    ${adding.length}`);
console.log(`  update: ${updating.length}`);
if (orphaned.length > 0) {
  console.log(`  in the table but NOT in content/rehab.ts (left alone): ${orphaned.join(", ")}`);
}

if (!confirm) {
  console.log("\nDry run. Re-run with --confirm to write.");
  process.exit(0);
}

const { error } = await db.from("rehab_entries").upsert(rows, { onConflict: "slug" });
if (error) {
  console.error("Write failed:", error.message);
  process.exit(1);
}
console.log(`\nWrote ${rows.length} entries.`);
