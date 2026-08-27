// Fill analysis_embeddings for rows that predate migration 067.
//
// Owner-run, one-shot, resumable: it skips analyses that already have a vector,
// so an interrupted run costs nothing to repeat. Uses the SERVICE key rather
// than a user session because there is no session here and the rows belong to
// seven different players; that bypasses the owner policy in 067 by design, and
// is the reason this is a script the owner runs rather than an endpoint.
//
//   node scripts/backfill-embeddings.mjs [--limit N] [--dry]

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { analysisSourceText } from "../lib/ai/retrieval-text.ts";

const args = {};
{
  const rest = process.argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--dry") args.dry = true;
    else if (rest[i]?.startsWith("--")) args[rest[i].slice(2)] = rest[++i];
  }
}

function loadEnv(file = ".env.local") {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.replace(/^\ufeff/, "").match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, "").trim();
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}
loadEnv();

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tbbievneojaxkkjvcwjp.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
  console.error("backfill-embeddings: SUPABASE_SERVICE_ROLE_KEY is required.");
  process.exit(1);
}

const supabase = createClient(URL_, KEY, { auth: { persistSession: false } });

const { data: done, error: doneErr } = await supabase
  .from("analysis_embeddings")
  .select("analysis_id");
if (doneErr) {
  console.error("backfill-embeddings: could not read the index:", doneErr.message);
  process.exit(1);
}
const already = new Set((done ?? []).map((r) => r.analysis_id));

const { data: rows, error } = await supabase
  .from("analyses")
  .select("id, user_id, skill, overall_score, result")
  .not("result", "is", null)
  .order("created_at", { ascending: true });
if (error) {
  console.error("backfill-embeddings: could not read analyses:", error.message);
  process.exit(1);
}

const limit = args.limit ? Number(args.limit) : Infinity;
const queue = rows.filter((r) => !already.has(r.id)).slice(0, limit);
console.log(`backfill-embeddings: ${rows.length} analyses, ${already.size} indexed, ${queue.length} to do`);

let ok = 0;
let failed = 0;
for (const row of queue) {
  const sourceText = analysisSourceText(row.skill, {
    overall_score: row.overall_score,
    summary: row.result?.summary,
    strengths: row.result?.strengths,
    improvements: row.result?.improvements,
  });
  if (args.dry) {
    console.log(`[dry] ${row.id} ${row.skill} ${sourceText.length} chars`);
    continue;
  }
  try {
    const res = await fetch(`${URL_}/functions/v1/embed`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: sourceText }),
    });
    const body = await res.json();
    if (!res.ok || !Array.isArray(body.embedding)) {
      throw new Error(body.error ?? `embed returned ${res.status}`);
    }
    const { error: upsertErr } = await supabase.from("analysis_embeddings").upsert(
      {
        analysis_id: row.id,
        user_id: row.user_id,
        source_text: sourceText,
        embedding: body.embedding,
        embed_model: "gte-small",
      },
      { onConflict: "analysis_id" },
    );
    if (upsertErr) throw new Error(upsertErr.message);
    ok++;
    console.log(`[${ok + failed}/${queue.length}] ${row.id} ${row.skill} indexed`);
  } catch (err) {
    failed++;
    console.error(`[${ok + failed}/${queue.length}] ${row.id} FAILED: ${err.message}`);
  }
}
console.log(`backfill-embeddings: ${ok} indexed, ${failed} failed`);
