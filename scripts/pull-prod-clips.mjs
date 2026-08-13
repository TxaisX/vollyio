// Build a local calibration corpus out of the clips real players uploaded.
//
// The eval suite that exists (evals/cases-pro-regression) is 18 professional
// frame sets. The product's own footage is the population it actually has to
// score, and every row already carries the skill, the discipline and the score
// production gave it, so a corpus and its "what we shipped" column come from
// one query.
//
// PRIVATE. The clips are players' own film: they land in evals/corpus/, which
// is gitignored, and they never leave this machine.
//
// Usage:
//   node scripts/pull-prod-clips.mjs [--out evals/corpus] [--limit N] [--skill attack]

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const args = {};
{
  const rest = process.argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i]?.startsWith("--")) args[rest[i].slice(2)] = rest[++i];
  }
}
const OUT = args.out ?? "evals/corpus";

function loadEnv(file = ".env.local") {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.replace(/^﻿/, "").match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) {
  console.error("pull-prod-clips: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const headers = { apikey: KEY, authorization: `Bearer ${KEY}` };

// PostgREST rather than supabase-js: two GETs do not earn a client.
const select = new URLSearchParams({
  select: "id,skill,discipline,duration_s,overall_score,clip_path,created_at,result",
  clip_path: "not.is.null",
  order: "created_at.asc",
});
if (args.skill) select.set("skill", `eq.${args.skill}`);
if (args.limit) select.set("limit", args.limit);

const res = await fetch(`${URL_BASE}/rest/v1/analyses?${select}`, { headers });
if (!res.ok) {
  console.error(`pull-prod-clips: query failed ${res.status} ${await res.text()}`);
  process.exit(1);
}
const rows = await res.json();
mkdirSync(OUT, { recursive: true });

const manifest = [];
let downloaded = 0;
let missing = 0;
for (const row of rows) {
  const ext = (path.extname(row.clip_path) || ".mp4").toLowerCase();
  const id = `prod-${row.id.slice(0, 8)}`;
  const file = `${id}${ext}`;
  const dest = path.join(OUT, file);
  if (!existsSync(dest)) {
    const obj = await fetch(
      `${URL_BASE}/storage/v1/object/clips/${row.clip_path.split("/").map(encodeURIComponent).join("/")}`,
      { headers },
    );
    if (!obj.ok) {
      missing++;
      console.log(`  miss ${id}: storage ${obj.status}`);
      continue;
    }
    writeFileSync(dest, Buffer.from(await obj.arrayBuffer()));
    downloaded++;
  }
  manifest.push({
    id,
    file,
    skill: row.skill,
    discipline: row.discipline,
    duration_s: row.duration_s ?? null,
    // What production actually told this player. The comparison column, never
    // a label: it is the number under suspicion, not ground truth.
    shipped_score: row.overall_score,
    shipped_version: row.result?.result_version ?? "1",
    source: `supabase:${row.id}`,
  });
}

writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
const bySkill = {};
for (const m of manifest) bySkill[m.skill] = (bySkill[m.skill] ?? 0) + 1;
console.log(
  `pull-prod-clips: ${manifest.length} clips in ${OUT} (${downloaded} downloaded, ${missing} missing in storage)`,
);
console.log(`  by skill: ${Object.entries(bySkill).map(([k, v]) => `${k}=${v}`).join(" ")}`);
