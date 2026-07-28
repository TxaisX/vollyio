# Security and access control

This file is the authority for who may call each Vollyio operation. Update it in the same change whenever an endpoint, server action, table, storage path, role, or paid external call changes.

## The simple version

- Visitors may read public pages and submit login or signup forms. They cannot read app data, with one deliberate exception: a visitor holding a live share link may read that one shared breakdown and stream its clip, and nothing else.
- A signed-in player may read and change only records whose owner ID matches their verified account ID.
- Paid coaching calls happen only after identity, an atomic quota check, and an atomic entitlement reservation pass.
- A player's plan is not theirs to write. Nothing reachable from a browser session can change `profiles.plan`, so nothing a player sends can change what they are entitled to. Only the payment provider's signature-verified webhook can.
- Browser requests never receive the coaching key. Server-only modules own secret access.
- One database-wide admin key now exists in the deployment. It is held by one module, imported by one route, and every other request still runs as the signed-in player under row security.
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
| `POST /api/stripe/checkout` | Denied | Start one subscription for self | None | Same-origin, verified user, then 503 unless the provider secret and price are both set. Reads the caller's own `profiles` row and returns 409 when the stored plan is already `pro`. The session is bound to the verified user ID; the price comes from the server environment and the return URLs from the request origin, so nothing the caller sends decides what is charged or where they land. Returns a URL for the client to navigate to, never a redirect. **No atomic quota**, see the cost-controls section for why and for what that leaves open. The `pro` check is read-then-act, so two clicks seconds apart can open two sessions (D-064) |
| `POST /api/stripe/portal` | Denied | Open a management link for own customer record | None | Same-origin, verified user, then 503 unless the provider is configured. The customer ID comes from the caller's own `profiles` row and never from the request, so there is no ID to substitute; 409 when the row holds none, and no customer record is ever created here. Returns a URL, never a redirect. No atomic quota, same reason as checkout |
| `POST /api/stripe/webhook` | Called by the payment provider, not by a browser | Same | Endpoint secret configured per deployment | **The one route in the app with no same-origin check** (see below). The HMAC over the raw request bytes is the authentication, and it runs before the JSON is parsed and before anything is written. Fails closed with 500 when the endpoint secret or the service credentials are absent; 413 above a 1 MB body cap; 400 for an unreadable body, a bad signature, or unparseable JSON, with no detail about which. Writes only through `set_subscription_plan`, and identifies the player either from the signed event's own reference field, which this app stamped when it created the session, or through `user_id_for_billing_customer`. No unsigned value reaches the write |
| `GET /api/eval` | Denied | Denied | Local developer with bearer token | Returns 404 in production, for every non-loopback host, and without `EVAL_TOKEN` |
| `POST /functions/v1/purge-user-media` | Denied in effect | Denied in effect | Called by the database's delete hook | Gateway `verify_jwt`; then the function refuses any `user_id` whose account still exists, so it can only finish a deletion the policy already requires and can never take a live player's film; `user_id` must be a UUID |
| App server actions | Denied unless the action is authentication | Mutate own resource | None | Framework origin check, verified user inside every action, bounded inputs, ownership filters, row security |
| `proxy.ts` (middleware, all non-static non-API paths) | Public paths pass; protected paths redirect to `/login` | Session verified from the JWT locally, refreshed only when expired | None | Fails closed and never throws: a missing Supabase configuration, a failed verification, and a genuine visitor all resolve to "no verified user", so protected paths redirect while public paths keep rendering. Route decision is `lib/route-guard.ts`, unit-tested (D-060) |

### The one route with no same-origin check

Rule 2 below requires a matching `Origin` on every cookie-authenticated mutation. `POST /api/stripe/webhook` is the single sanctioned exception, and it is an exception because the rule does not describe its threat. The origin check exists to stop another site from riding a player's cookies in a browser. The webhook's caller is a server on the internet that sends no cookies and holds no session, and an `Origin` header from it would be worth exactly what the sender chose to write in it. So the check would deny every real request and admit every forged one.

What replaces it is stronger, not weaker: an HMAC over the exact raw bytes, keyed on a secret only the deployment and the provider hold, with a timestamp inside the signed payload so a captured body cannot be replayed later. Three properties keep it that way and must survive any future edit to that file.

1. The signature is verified **before** `JSON.parse` and before any database call. Parsing first would mean acting on attacker-shaped data to decide whether to trust it.
2. The bytes are read from the stream with a 1 MB cap applied as they arrive, not after buffering, because this is the one route where an unauthenticated caller controls how much the server reads before it can tell whether the caller is genuine at all.
3. A missing endpoint secret returns 500 and applies nothing. There is deliberately no "skip verification when unconfigured" branch, because that branch is where a fail-open bug would eventually live.

Do not add an origin check to this route, do not move the signature check below the parse, and do not add a second route that skips the origin check without first adding it to this document with its own answer to "then what authenticates the sender".

## Database matrix

Anonymous access to every application table is revoked. The signed-in role has only the grants below, and row security narrows every grant to the current account.

| Resource | Player permissions | Ownership rule | Protected authority |
|---|---|---|---|
| `profiles` | Read own; update display name, level, consent, discipline, position, frequency, timestamps | `id = auth.uid()` | Player cannot update plan, renewal date, billing IDs, or XP total. The update grant is a fixed column allowlist (migration 012), so `plan_renews_at` and `stripe_subscription_id`, added later by migration 027, are outside it by construction rather than by anyone remembering to exclude them. Every one of those columns is written only by `set_subscription_plan` running as `service_role`. A check constraint bounds `plan` to `free` or `pro`, so an unrecognized value fails loudly instead of falling through to the free allowance |
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
| `set_subscription_plan` function | None | Acts on the user ID the webhook resolved, not on one any caller named | The only writer of `profiles.plan` in the product. `security definer`, `search_path = ''`, execute revoked from `public`, `anon`, and `authenticated`, granted to `service_role` only, so a signed-in player calling it through the data API is denied before any argument is read. Rejects a plan outside `free` and `pro`, and coalesces the provider IDs so an event carrying only one cannot blank the other (migration 027) |
| `user_id_for_billing_customer` function | None | Reverse lookup from a provider customer ID | Same posture: `service_role` only, `security definer`, `stable`. It exists because subscription and invoice events carry a customer ID and no user ID. There is no unique index on `profiles.stripe_customer_id`, so two profiles holding the same customer ID would resolve to an arbitrary one of them (D-064) |
| `analysis_allowance` function | Execute as signed-in user | Keys on `auth.uid()` | Takes no argument, so there is nothing to point at another account. Read-only: returns the caller's plan, allowance, used count, remaining, and the reset instant, which is what lets the app say "2 of 3 left" before a player films rather than after. Revoked from `public` and `anon` (migration 026) |
| `plan_monthly_allowance` function | Execute as signed-in user | Not account-scoped | A pure `immutable` mapping from a plan name to a number. Knowing it grants nothing, because the allowance that binds is the one `reserve_analysis_entitlement` derives from the caller's own stored plan inside the lock. Revoked from `public` and `anon` |
| `private.allowance_window` function | None | Derived from the server clock | Revoked from `public`, `anon`, and `authenticated`. The month boundary is computed server-side and never accepted as an argument from a caller, so no request can widen its own window |
| Private quota table | None | Internal function derives `auth.uid()` | No direct role access; security-definer function accepts a fixed scope list only, and none of those scopes is a billing scope |
| Private analysis reservations | None | Internal function derives `auth.uid()` | Analysis requests serialize behind an opaque five-minute reservation; the monthly allowance is checked inside the same lock when billing is enabled. Migration 026 replaced 011's lifetime-one free rule with a per-plan count over the current UTC calendar month, reading completed analysis ROWS and never attempts or reservations (D-064) |
| Account deletion function | Execute as signed-in user | Function deletes `auth.uid()` only | Anonymous and public execution revoked |
| Media purge hook | None | Fires on any `auth.users` delete, for that row only | AFTER DELETE trigger calls the `purge-user-media` edge function over pg_net (D-024), because `storage.protect_delete` forbids deleting storage rows in SQL. Covers deletions that skip the app. Missing Vault config no-ops: removing the account must never fail. `scripts/purge-orphaned-media.mjs` is the backstop sweep |

### The service-role key: where it lives and what may use it

Every request that carries a player's cookies runs as that player, under row security. There is now exactly one exception, and it is not a request a player can make.

`lib/supabase/service.ts` builds a client from `SUPABASE_SERVICE_ROLE_KEY`. It exists because `set_subscription_plan` and `user_id_for_billing_customer` are granted to `service_role` only, and the webhook that calls them has no player session to run as: its caller is the payment provider, not a browser. That key bypasses row security on every table, so its blast radius is not bounded by the database at all. It is bounded by these rules:

- It lives in the deployed server environment. It has no `NEXT_PUBLIC_` twin and must never acquire one, because that prefix is what puts a value in the client bundle.
- `lib/supabase/service.ts` is the only module that reads it, it is marked server-only so a client import is a build error rather than a review catch, and it builds the client per call so nothing is cached at module scope.
- `app/api/stripe/webhook/route.ts` is its only importer. Adding a second importer is a change to this document, not a refactor. Rule 10 below states the test any candidate has to pass.
- It is never used on a route whose body a player controls. A route that accepts a user ID and then acts on it with this client has no ownership check left anywhere in the stack, because there is no RLS underneath to catch the mistake.

The session-client posture still holds everywhere else, which means a technical user can call the data API directly to alter their own ratings or XP ledger. They still cannot cross accounts, change their plan, exceed the analysis insert limit, or trigger a paid coaching call without the app's atomic quota. If leaderboard or billing decisions ever trust XP or ratings, move those writes behind a narrowly scoped server credential or a database function that proves the source event.

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

`POST /api/stripe/checkout` and `POST /api/stripe/portal` are the only mutating cookie-authenticated routes in the app with no atomic quota, and that is a known gap rather than an oversight. `consume_api_quota` accepts a fixed scope list written into a check constraint, and none of those scopes is a billing scope. Borrowing `analyze` would charge a player analyses for pressing upgrade, which is worse than the problem it solves: the player would burn the allowance they are trying to buy more of, and cancelling would cost them a rep. So both routes are held by the same-origin check and a verified session only, and a signed-in player can loop either one to create provider-side records and outbound requests without limit. Neither route spends money by itself and neither can act on another account, which is why this was accepted rather than blocking. Closing it means a migration that adds a `billing` scope to both `consume_api_quota` and `refund_api_quota`, widening `ApiQuotaScope`, and updating the scope pin in `lib/security-contract.test.ts` in the same change.

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
10. The service-role client has one caller. A second one needs a row here first and an answer to why the operation cannot run as the signed-in player. "It was easier than writing the policy" is the wrong answer every time, because the policy is the tenant boundary and the key is what turns it off.
11. Entitlement is written by the system that took the money, never by the account it describes. A plan, an allowance, a credit, or any other thing that decides what a player may spend gets a writer granted to `service_role` and reached only from a route that authenticated its caller cryptographically.
12. A route that cannot be same-origin checked must prove its sender some other way, before it parses the body. There is one such route today and there should not be a second without a decision entry.

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

## Billing verification: proving a player cannot write their own plan

Run these against a staging project, in order, before any provider key is configured in production. Steps B2 through B5 are the ones that matter: they are the difference between "the plan column is protected" being true and being believed. Every one of them is a thing an attacker would try, so run them as a signed-in test player with a real session, not as the owner.

B0. **Set all three provider values together, or none.** The gate that decides whether an upgrade button renders reads the API key and the price only. It does not read the endpoint secret. So a deploy holding a key and a price but no endpoint secret shows a working upgrade button, takes the payment, and then rejects every event the provider sends: the plan is never written, the customer reference is never recorded, and the player cannot even reach the management portal to cancel, because that route keys on the customer reference the webhook was supposed to store. Nothing in the app detects this state. Until the gate is widened, configuring the endpoint secret first and the key last is the ordering that cannot strand a paying player.

B1. Apply migration 026, then 027. In that order: 027's plan check constraint assumes 026's allowance function is already resolving plans.

B2. **Direct column write.** With the test player's own access token, `PATCH` the data API at `profiles?id=eq.<their own id>` with `{"plan":"pro"}`. It must fail. The failure should be a privilege error on the column, not a row-security miss, because the update grant is an allowlist that never included `plan`. Repeat with `plan_renews_at`, `stripe_subscription_id`, and `stripe_customer_id`, one at a time so a single rejection cannot mask three. Then repeat the whole set against **another** account's ID and confirm those fail too, on ownership as well as privilege.

B3. **Direct function call.** As the same player, call `set_subscription_plan` and `user_id_for_billing_customer` through the data API's RPC path, with valid-looking arguments. Both must be denied. `authenticated` holds no execute grant, so the expected answer is a permission or unknown-function error and never a result. A success here means the grants in 027 did not apply and the whole boundary is open.

B4. **Own-row-only reads.** Call `analysis_allowance()` as the test player and confirm the numbers are that player's. Confirm there is no argument to supply, so no version of the call names another account. Then confirm the same call as an anonymous caller is denied.

B5. **Webhook forgery.** Against the deployed webhook, POST a well-formed event body with: no signature header; a signature computed with the wrong secret; a valid signature whose timestamp is outside the tolerance window; and a valid signature over different bytes than the ones sent. All four must return 400 and leave `profiles.plan` untouched. Then send one genuine signed event and confirm it does apply, so the test proves rejection rather than a route that rejects everything.

B6. **Fail-closed on missing configuration.** Remove the endpoint secret from the deployment and POST a genuine signed event. It must return 500 and write nothing. Do the same with the service-role key absent. A deploy missing either must apply no plan changes at all, never fall back to trusting the body.

B7. **Key containment.** Confirm `SUPABASE_SERVICE_ROLE_KEY` is set only in the server environment, has no `NEXT_PUBLIC_` variant, and appears nowhere in the built client output: search `.next/static` for the key's literal value and expect no hit. Confirm the same for the provider secret key and the endpoint secret.

B8. **End to end, in the provider's test mode.** Upgrade a test account and confirm `profiles.plan` becomes `pro` only after the webhook lands, never on the redirect back from the hosted page. Then cancel from the management portal and confirm the plan stays `pro` and the reset date still reads, until the subscription-deleted event arrives at period end and flips it to `free`.

B9. **The allowance itself.** With `BILLING_ENABLED=true` and an upgrade destination set, run a free test account to its third completed analysis of the month and confirm the fourth returns 402 with a reset date, not a 500 and not a silent success. Launch several requests in parallel at the boundary and confirm only one gets through, which is the advisory lock doing its job. Confirm a clip that fails mid-analysis leaves the used count unchanged, because the count reads rows and a failed run writes none.

B10. **Cross-origin and anonymous.** POST to both `/api/stripe/checkout` and `/api/stripe/portal` with a foreign `Origin` (expect 403) and with no session (expect 401), and confirm neither reaches the provider.

B2 through B5 are the ones a green deploy will tempt you to skip, and they are the reason this section exists. Nothing in the test suite can run them: the grants, the RLS, and the signature are all properties of a live database and a live endpoint, and the same-shaped gap is what let the 011 reservation-link defect reach production. A passing typecheck is not a denied write.
