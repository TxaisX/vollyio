# Security and access control

This file is the authority for who may call each Vollyio operation. Update it in the same change whenever an endpoint, server action, table, storage path, role, or paid external call changes.

## The simple version

- Visitors may read public pages and submit login or signup forms. They cannot read app data, with one deliberate exception: a visitor holding a live share link may read that one shared breakdown and stream its clip, and nothing else.
- A signed-in player may read and change only records whose owner ID matches their verified account ID.
- Paid coaching calls happen only after identity, an atomic quota check, and an atomic entitlement reservation pass.
- Browser requests never receive the coaching key. Server-only modules own secret access.
- Uploads must be an allowed file type, under a fixed size, in a fixed filename under an existing analysis owned by the player.
- Database row security is the tenant boundary. Route filters repeat the ownership check as defense in depth.

## Endpoint matrix

| Surface | Visitor | Signed-in player | System or operator | Enforcement |
|---|---|---|---|---|
| Public pages | Read | Read | Deploy | Static or public content only; hosting-firewall baseline per-IP limit |
| Login and signup actions | Submit bounded form | Submit or sign out | Configure auth rate limits and bot protection | Framework origin check, server input schema, auth provider rate limits, generic errors |
| `GET /auth/callback` | Present one-time code or token | Same | Configure allowed redirect URLs | Fixed redirect target, known token types, bounded query values, provider verification |
| `POST /api/analyze` | Denied | Create analysis for self | Configure entitlement policy | Same-origin, verified user, atomic entitlement reservation, atomic 20 per hour quota, 4 MB JSON cap, 2 to 12 JPEG-signature-checked frames, database insert trigger, server-set telemetry column; a coaching credit/capacity outage refunds the hourly quota and returns 503 |
| `POST /api/coach` | Denied | Read and append own conversation | None | Same-origin, verified user, atomic 60 per hour quota, 16 KB JSON cap, 2,000 character message cap, session ownership check |
| `POST /api/players` | Denied | Spot candidate athletes in one own frame | None | Same-origin, verified user, atomic quota on the `coach` scope (so spotting shares coach chat's 60 per hour budget), one 1.5 MB JPEG-signature-checked frame, bounded base64 length, at most six candidates; labels are kit-and-position descriptions and never names (D-036) |
| `GET /api/usage` | Denied | Denied in production | Local developer with a signed-in session | Returns 404 when `NODE_ENV` is production (same posture as `/api/eval`); the aggregate RPCs are granted to `authenticated` only, so an anonymous caller gets nothing; every dollar figure is an estimate from checked-in rates, never billing truth |
| `GET /share/[token]` | Read one live shared breakdown | Same | None | Anonymous read goes only through the `analysis_by_share_token` SECURITY DEFINER function, which requires the link to be unrevoked and inside its 30-day expiry. Carries the breakdown and the clip; raw frames are never shared (D-049) |
| `GET /share/[token]/clip` | Stream one live shared clip | Same | None | Same function gate. The signed storage URL stays server-side and the bytes are proxied, because the storage path embeds the owner's user ID and must never reach the viewer; `Range` is forwarded so scrubbing works |
| `POST /api/account/delete` | Denied | Delete own account | Support fallback | Same-origin, verified user, atomic 3 per hour quota, own-folder storage policies, self-delete database function |
| `GET /api/eval` | Denied | Denied | Local developer with bearer token | Returns 404 in production, for every non-loopback host, and without `EVAL_TOKEN` |
| `POST /functions/v1/purge-user-media` | Denied in effect | Denied in effect | Called by the database's delete hook | Gateway `verify_jwt`; then the function refuses any `user_id` whose account still exists, so it can only finish a deletion the policy already requires and can never take a live player's film; `user_id` must be a UUID |
| App server actions | Denied unless the action is authentication | Mutate own resource | None | Framework origin check, verified user inside every action, bounded inputs, ownership filters, row security |
| `proxy.ts` (middleware, all non-static non-API paths) | Public paths pass; protected paths redirect to `/login` | Session verified from the JWT locally, refreshed only when expired | None | Fails closed and never throws: a missing Supabase configuration, a failed verification, and a genuine visitor all resolve to "no verified user", so protected paths redirect while public paths keep rendering. Route decision is `lib/route-guard.ts`, unit-tested (D-060) |

## Database matrix

Anonymous access to every application table is revoked. The signed-in role has only the grants below, and row security narrows every grant to the current account.

| Resource | Player permissions | Ownership rule | Protected authority |
|---|---|---|---|
| `profiles` | Read own; update display name, level, consent, discipline, position, frequency, timestamps | `id = auth.uid()` | Player cannot update plan, billing ID, or XP total |
| `analyses` | Read and create own through explicit columns | `user_id = auth.uid()` | Insert trigger forces database time, validates declared media paths, and serializes creation at 20 per hour. No update grant, so a row is immutable after creation. The server-set `telemetry` column (token counts, duration, model, effort) is operational-only: like `result` and `model` the owner could set it at insert via the Data API, and it gates no authorization or billing decision |
| `skill_ratings` | Read, create, and update own | `user_id = auth.uid()` | No cross-account access |
| `goals` | Read, create, and update own | `user_id = auth.uid()` | No cross-account access |
| `games` | Read and create own | `user_id = auth.uid()` | No cross-account access |
| `coach_sessions` | Read, create, update, and delete own | `user_id = auth.uid()` | Deleting a session cascades only its messages |
| `chat_messages` | Read and create own | `user_id = auth.uid()` | API verifies session ownership before inserting |
| `xp_events` | Read and create own | `user_id = auth.uid()` | Server flows deduplicate reasons |
| `share_links` | Read own; create through `analysis_id`, `user_id`, `token_hash`; update `revoked_at` | `user_id = auth.uid()` | Only the token HASH is stored, never the token itself, so the database cannot reveal a live link. No delete grant: revoking is an update, and the row survives as a record. No anon grants; anonymous readers reach shared data only through the function below (D-049, migration 019) |
| `analysis_feedback` | Read, create, and update own | `user_id = auth.uid()` | Writes additionally require an `exists()` check that the parent analysis belongs to the caller, so a forged `analysis_id` is rejected at the RLS boundary and not only in the app. Upserts on `analysis_id`: one row per analysis, because the player may change their mind. Advisory only, it gates no authorization, billing, or scoring decision (D-055, migration 022) |
| `analysis_by_share_token` function | Execute as anonymous or signed-in | Function narrows to a live, unrevoked, unexpired link | The one anonymous data surface. SECURITY DEFINER is load-bearing, not convenience: RLS policy subqueries run with the caller's privileges and anonymous has no table grants under 012, so the original policy-only design could never pass (D-049, migration 020) |
| Private quota table | None | Internal function derives `auth.uid()` | No direct role access; security-definer function accepts three fixed scopes only |
| Private analysis reservations | None | Internal function derives `auth.uid()` | Analysis requests serialize behind an opaque five-minute reservation; the free-plan rule is checked inside the same lock when billing is enabled |
| Account deletion function | Execute as signed-in user | Function deletes `auth.uid()` only | Anonymous and public execution revoked |
| Media purge hook | None | Fires on any `auth.users` delete, for that row only | AFTER DELETE trigger calls the `purge-user-media` edge function over pg_net (D-024), because `storage.protect_delete` forbids deleting storage rows in SQL. Covers deletions that skip the app. Missing Vault config no-ops: removing the account must never fail. `scripts/purge-orphaned-media.mjs` is the backstop sweep |

The server currently uses the player's session client instead of a database-wide admin key. That keeps blast radius small. It also means a technical user can call the data API directly to alter their own ratings or XP ledger. They still cannot cross accounts, change their plan, exceed the analysis insert limit, or trigger a paid coaching call without the app's atomic quota. If leaderboard or billing decisions ever trust XP or ratings, move those writes behind a narrowly scoped server credential or a database function that proves the source event.

## Storage matrix

| Bucket | Read | Write | Limits |
|---|---|---|---|
| `frames` | Owner only through authenticated download or one-hour signed URL | Owner only, exact paths declared by an existing owned analysis | JPEG or JSON only, 5 MB per object, at most 12 sent frames, 22 stored frames, and one keypoints file per analysis |
| `clips` | Owner through authenticated download or one-hour signed URL; anyone holding a live share link, proxied, never as a URL | Owner only, exact path declared by an existing owned analysis | WebM, MP4, or QuickTime only, 100 MB per object, at most one clip per analysis. The shared read is gated by a SECURITY DEFINER predicate that dies with the link on revoke or expiry (D-049, migration 020) |
| `models` | Public read | Operator only | Pinned filenames and client hash verification |

Client uploads use create-only semantics. Replacement is not granted. The path, filename, and MIME type must match the media fields recorded on the owned analysis. Required server-uploaded frames are checked, and a partial upload discards the new analysis so broken media references are not retained.

## Request and cost controls

| Control | Analyze | Coach | Account deletion |
|---|---:|---:|---:|
| Verified account | Required | Required | Required |
| Same-origin POST | Required | Required | Required |
| Atomic reservation | Always; also enforces the free plan when billing is enabled | Not applicable | Not applicable |
| Atomic fixed window | 20 per hour | 60 per hour | 3 per hour |
| Body limit | 4 MB | 16 KB | No body |
| External spend after quota | Yes | Yes | Not applicable |

Quota storage fails closed. If the quota function or migration is missing, expensive endpoints return 503 before calling the coaching service.

A coaching capacity or credit outage (the external service refusing before any billable work) refunds the analyze quota via `refund_api_quota` (migration 016). The refund only decrements inside the active window and never below the floor, so it cannot escape the rate limit: the window still expires on schedule and no paid work happened during the outage.

Public authentication endpoints use the authentication service's own rate limits. Production must also have a hosting-firewall baseline per-IP limit across all public paths, plus stricter POST limits for `/login`, `/signup`, and `/api/*`, before requests reach application compute. Enable managed bot protection on login and signup before a public marketing push.

## Rules for future changes

0. Default-privilege and revoke statements use `all`, never a list of privilege names. A named list is a denylist and stops being correct the moment Postgres has a privilege the list forgot: 012 revoked `select, insert, update, delete` by default and thereby handed `TRUNCATE` to `anon` on every table created after it (D-059, migration 023). TRUNCATE bypasses row security, which is this product's tenant boundary.
1. Treat every route handler and server action as directly callable. Authenticate and authorize inside it.
2. For cookie-authenticated route handlers that mutate state, require a matching `Origin`. Server Actions receive the framework's built-in origin check but still need app authentication.
3. Validate content type and byte size before parsing. Validate structure, bounds, and ownership again after parsing.
4. Consume an atomic quota before any paid or high-amplification operation. A read-then-count query is not a quota.
5. Every exposed table needs explicit grants and row security. `authenticated` alone is not authorization.
6. Never use user-editable metadata for authorization. Derive identity from the verified session.
7. Never place a secret in a `NEXT_PUBLIC_` variable, browser component, response, or client-visible error.
8. Keep uploads private unless public access is the product requirement. Restrict owner, path, filename, MIME type, and size.
9. Update both matrices when the surface changes. A missing matrix row means the change is incomplete.

## Deployment order and verification

1. Apply the expand migration `011_security_hardening.sql`. It adds the quota, entitlement, cleanup, and analysis-insert controls without replacing the old storage policies.
1b. Apply `013_reservation_link_after_insert.sql` in the same window. Migration 011 shipped a defect: it linked the entitlement reservation to its analysis from inside the BEFORE INSERT trigger, pointing `analysis_entitlement_reservations.analysis_id` at a row Postgres had not written yet. That foreign key is not deferrable, so the check fired immediately and aborted every insert with SQLSTATE 23503, and every save returned "Couldn't save your analysis." 013 moves the link to an AFTER INSERT trigger, where the row exists and the constraint stays strict. Never apply 011 without 013.
2. Deploy the matching application code. The new paid endpoints intentionally fail closed if migration 011 is absent.
3. Wait for the previous server deployment to drain, then verify one new analysis completes with all required frames.
4. Apply the contract migration `012_security_contract.sql` to revoke broad grants and replace the storage policies.
5. Confirm anonymous table access is denied and signed-in users can still read their own rows.
6. Confirm a signed-in user may update `profiles.level` but cannot update `profiles.plan` or supply `analyses.created_at`.
7. Call each quota in a test account through its limit and verify the next request returns 429 without an external call. Launch parallel free-analysis requests and verify only one reservation succeeds.
8. Upload one valid frame and clip, then try an undeclared path, wrong filename, mismatched MIME type, oversized object, and another account's path. Only the valid declared owned files may succeed.
9. Publish the baseline and stricter hosting-firewall IP rules and verify blocked requests do not invoke application functions.
10. Run `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test`, and `npm.cmd run build`.

Do not apply migration 012 before the matching server deployment is active. The previous route uploads media before creating its analysis row, which the contract policy correctly rejects.

Step 3 is not optional. It is the only step that exercises an insert end to end, and it is the step that catches a trigger that cannot write. Skipping it on 2026-07-17 let the 011 reservation-link defect reach production, where it broke every save until 013 landed. A green schema probe is not a completed analysis.
