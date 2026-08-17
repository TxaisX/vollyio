// Sync tester comps against the vollyio-testers Google Group (D-124).
//
// Consumer Google Groups has no membership API, so the member list arrives by
// hand: open https://groups.google.com/g/vollyio-testers/members as the owner,
// copy the email addresses, and pass them in. Everything after that is
// mechanical: members with a free account and no prior comp get Pro for 30
// days; marked comps are revoked when the member leaves the group or the 30
// days run out; real subscriptions are never touched. WHO moves is decided by
// lib/tester-comp.ts, which is the tested part.
//
// The marker lives in auth app_metadata (`tester_comp_until`), which no player
// can write, and it survives revocation on purpose: one comp per account,
// ever, so leave-and-rejoin farms nothing.
//
// DRY RUN BY DEFAULT. Pass --apply to write.
//
// Usage:
//   node scripts/tester-comps.mjs [--apply]
//     (reads scripts/testers-members.txt, the list the session assistant
//      scrapes from the group's members page; refused once its `# generated:`
//      stamp is older than 7 days, because a stale list reads as "everyone
//      left" and would mass-revoke)
//   node scripts/tester-comps.mjs --members a@x.com,b@y.com [--apply]
//   node scripts/tester-comps.mjs --members-file members.txt [--apply]
//     (one address per line; blank lines and # comments ignored)

import { readFileSync, existsSync } from "node:fs";
import { TESTER_COMP_DAYS, testerCompActions } from "../lib/tester-comp.ts";

const args = {};
{
  const rest = process.argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--apply") args.apply = true;
    else if (rest[i]?.startsWith("--")) args[rest[i].slice(2)] = rest[++i];
  }
}

const DEFAULT_MEMBERS_FILE = "scripts/testers-members.txt";
const MEMBERS_FILE_MAX_AGE_DAYS = 7;

function readMembersFile(file, enforceFreshness) {
  const body = readFileSync(file, "utf8");
  if (enforceFreshness) {
    // The default file is a scraped SNAPSHOT of the group, and this sync
    // treats absence from the list as "left the group". A week-old snapshot
    // is a list of who WAS there, so acting on it would revoke people who
    // never left. The stamp is written by the scrape; no stamp = no trust.
    const stamp = body.match(/^# generated: (.+)$/m)?.[1];
    const at = stamp ? Date.parse(stamp) : NaN;
    if (!Number.isFinite(at)) {
      console.error(
        `tester-comps: ${file} has no readable "# generated:" stamp. ` +
          "Re-scrape the member list before syncing.",
      );
      process.exit(1);
    }
    const ageDays = (Date.now() - at) / (24 * 60 * 60 * 1000);
    if (ageDays > MEMBERS_FILE_MAX_AGE_DAYS) {
      console.error(
        `tester-comps: ${file} is ${ageDays.toFixed(1)} days old ` +
          `(limit ${MEMBERS_FILE_MAX_AGE_DAYS}). A stale snapshot reads as ` +
          "'everyone left' and would mass-revoke; re-scrape the member list first.",
      );
      process.exit(1);
    }
  }
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

let members = [];
if (args.members) {
  members = args.members.split(",");
} else if (args["members-file"]) {
  if (!existsSync(args["members-file"])) {
    console.error(`tester-comps: no such file: ${args["members-file"]}`);
    process.exit(1);
  }
  members = readMembersFile(args["members-file"], false);
} else if (existsSync(DEFAULT_MEMBERS_FILE)) {
  members = readMembersFile(DEFAULT_MEMBERS_FILE, true);
  console.log(`tester-comps: using ${DEFAULT_MEMBERS_FILE}`);
}
if (members.length === 0) {
  console.error(
    "tester-comps: pass the group's CURRENT member emails via --members or --members-file,\n" +
      `or keep ${DEFAULT_MEMBERS_FILE} freshly scraped.\n` +
      "An empty list would read as 'everyone left' and revoke every live comp, so it is refused.",
  );
  process.exit(1);
}

// TRIMMED for the same reason as purge-anonymous.mjs: .env.local has held a
// leading space inside a value, and a space inside a bearer token reads as a
// revoked key.
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
    "tester-comps: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
  process.exit(1);
}
const headers = {
  apikey: KEY,
  authorization: `Bearer ${KEY}`,
  "content-type": "application/json",
};

async function listAllUsers() {
  const rows = [];
  for (let page = 1; page <= 200; page++) {
    const res = await fetch(
      `${URL_BASE}/auth/v1/admin/users?page=${page}&per_page=200`,
      { headers },
    );
    if (!res.ok) {
      console.error(`tester-comps: user listing failed, HTTP ${res.status}`);
      process.exit(1);
    }
    const body = await res.json();
    const users = Array.isArray(body?.users) ? body.users : [];
    rows.push(...users);
    if (users.length === 0) break;
  }
  return rows;
}

async function listProfiles() {
  const res = await fetch(
    `${URL_BASE}/rest/v1/profiles?select=id,plan,stripe_subscription_id`,
    { headers },
  );
  if (!res.ok) {
    console.error(`tester-comps: profile listing failed, HTTP ${res.status}`);
    process.exit(1);
  }
  return res.json();
}

const nowIso = new Date().toISOString();
const [users, profiles] = await Promise.all([listAllUsers(), listProfiles()]);
const profileById = new Map(profiles.map((p) => [p.id, p]));

const rows = users.map((u) => {
  const p = profileById.get(u.id);
  return {
    id: u.id,
    email: u.email ?? null,
    isAnonymous: u.is_anonymous === true,
    plan: p?.plan ?? null,
    hasSubscription: typeof p?.stripe_subscription_id === "string" && p.stripe_subscription_id.length > 0,
    testerCompUntil:
      typeof u.app_metadata?.tester_comp_until === "string"
        ? u.app_metadata.tester_comp_until
        : null,
  };
});

const { grant, revoke } = testerCompActions(rows, members, nowIso);

console.log(
  `tester-comps: ${members.length} members given, ${rows.length} accounts, ` +
    `${grant.length} to grant, ${revoke.length} to revoke.`,
);
for (const r of grant) console.log(`  grant  ${r.email} (${TESTER_COMP_DAYS} days)`);
for (const { row: r, reason } of revoke) console.log(`  revoke ${r.email} (${reason})`);

if (grant.length + revoke.length === 0) {
  console.log("Nothing to change.");
  process.exit(0);
}
if (!args.apply) {
  console.log("\nDry run. Pass --apply to write these changes.");
  process.exit(0);
}

// `p_event_at: null` matches supabase/admin/set-plan.sql: a comp must not set
// the billing watermark, or a later REAL webhook for this account looks stale.
async function setPlan(userId, plan, renewsAtIso) {
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/set_subscription_plan`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      p_user_id: userId,
      p_plan: plan,
      p_renews_at: renewsAtIso,
      p_subscription_id: null,
      p_customer_id: null,
      p_event_at: null,
    }),
  });
  if (!res.ok) throw new Error(`set_subscription_plan HTTP ${res.status}`);
}

async function mark(userId, untilIso) {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ app_metadata: { tester_comp_until: untilIso } }),
  });
  if (!res.ok) throw new Error(`app_metadata write HTTP ${res.status}`);
}

const until = new Date(
  Date.now() + TESTER_COMP_DAYS * 24 * 60 * 60 * 1000,
).toISOString();

let granted = 0;
let revoked = 0;
for (const r of grant) {
  // Marker FIRST: if the plan write then fails, the account is marked but
  // still free, which the next run repairs toward nothing (marked + free is
  // never re-granted, and the owner sees it in the dry run). The other order
  // would leave an unmarked comp the revoke pass can never take back.
  await mark(r.id, until);
  await setPlan(r.id, "pro", until);
  granted++;
  console.log(`granted ${r.email} until ${until}`);
}
for (const { row: r, reason } of revoke) {
  await setPlan(r.id, "free", null);
  revoked++;
  console.log(`revoked ${r.email} (${reason}); marker kept, no re-grant`);
}
console.log(`tester-comps: done. ${granted} granted, ${revoked} revoked.`);
