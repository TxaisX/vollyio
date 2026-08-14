// Remove anonymous sessions that outlived their free read, and their film.
//
// D-118 gives a stranger a real auth.users row so they can be scored without an
// account. Most never come back, and nothing else in the product ever removes
// them, so their footage would sit on our storage forever: film belonging to
// somebody who never gave us an email address, against a Privacy Policy that
// promises the film goes when the account goes (D-024).
//
// Deleting the auth row is the whole job. `profiles` cascades from it,
// `analyses` cascades from `profiles`, and migration 015's trigger calls the
// purge-user-media edge function on delete, which is the same path
// /api/account/delete relies on. scripts/purge-orphaned-media.mjs remains the
// backstop if that hook is misconfigured.
//
// DRY RUN BY DEFAULT. It prints what it would delete and exits. Pass --apply to
// actually delete, which is irreversible.
//
// WHICH rows is decided by lib/anonymous-retention.ts, not here, because that
// is the part worth unit testing: every uncertainty in it resolves to "keep",
// and a converted account is never selected by either signal.
//
// Usage:
//   node scripts/purge-anonymous.mjs [--days 30] [--limit N] [--apply]

import { readFileSync, existsSync } from "node:fs";
import {
  ANONYMOUS_RETENTION_DAYS,
  expiredAnonymousIds,
} from "../lib/anonymous-retention.ts";

const args = {};
{
  const rest = process.argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--apply") args.apply = true;
    else if (rest[i]?.startsWith("--")) args[rest[i].slice(2)] = rest[++i];
  }
}

function bounded(name, value, fallback, lo, hi) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    console.error(`purge-anonymous: --${name} needs a number, got "${value}".`);
    process.exit(1);
  }
  return Math.max(lo, Math.min(hi, n));
}

const DAYS = bounded("days", args.days, ANONYMOUS_RETENTION_DAYS, 1, 3650);
const LIMIT = bounded("limit", args.limit, Infinity, 1, Infinity);

// TRIMMED, and that is not tidiness. `.env.local` currently holds
// `SUPABASE_SERVICE_ROLE_KEY= eyJ...` with a leading space, and the version of
// this helper that only strips quotes sends that space inside the bearer token.
// The API answers 401, which reads exactly like a rotated or revoked key, and
// the hour that follows is spent in the dashboard rather than on the one
// character responsible. Same trap in scripts/pull-prod-clips.mjs and
// scripts/video-eval.mjs.
function loadEnv(file = ".env.local") {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.replace(/^﻿/, "").match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "").trim();
    }
  }
}
loadEnv();

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) {
  console.error(
    "purge-anonymous: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
  process.exit(1);
}

const headers = { apikey: KEY, authorization: `Bearer ${KEY}` };
const now = new Date().toISOString();

// The admin listing pages at 50 by default and caps at 1000 per page. Walk it
// to the end rather than judging the first page: the oldest rows are the ones
// that matter and there is no ordering guarantee that puts them first.
async function listAllUsers() {
  const rows = [];
  for (let page = 1; page <= 200; page++) {
    const res = await fetch(
      `${URL_BASE}/auth/v1/admin/users?page=${page}&per_page=200`,
      { headers },
    );
    if (!res.ok) {
      console.error(`purge-anonymous: listing failed, HTTP ${res.status}`);
      process.exit(1);
    }
    const body = await res.json();
    const users = Array.isArray(body?.users) ? body.users : [];
    rows.push(...users);
    if (users.length === 0) break;
  }
  return rows;
}

const all = await listAllUsers();
const expired = expiredAnonymousIds(all, now, DAYS).slice(0, LIMIT);

const anonymousTotal = all.filter((u) => u?.is_anonymous === true).length;
console.log(
  `purge-anonymous: ${all.length} users, ${anonymousTotal} anonymous, ` +
    `${expired.length} older than ${DAYS} days.`,
);

if (expired.length === 0) {
  console.log("Nothing to remove.");
  process.exit(0);
}

if (!args.apply) {
  for (const id of expired) console.log(`would delete ${id}`);
  console.log("\nDry run. Pass --apply to delete these, which cannot be undone.");
  process.exit(0);
}

let deleted = 0;
for (const id of expired) {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    console.error(`  FAILED ${id}: HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
    continue;
  }
  deleted++;
  console.log(`  deleted ${id}`);
}
console.log(`\npurge-anonymous: removed ${deleted} of ${expired.length}.`);
