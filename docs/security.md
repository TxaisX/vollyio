# Security and access control

This file is the authority for who may call each Sideout operation. Update it in the same change whenever an endpoint, server action, table, storage path, role, or paid external call changes.

## The simple version

- Visitors may read public pages and submit login or signup forms. They cannot read app data.
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
| `POST /api/analyze` | Denied | Create analysis for self | Configure entitlement policy | Same-origin, verified user, atomic entitlement reservation, atomic 20 per hour quota, 4 MB JSON cap, 2 to 12 JPEG-signature-checked frames, database insert trigger |
| `POST /api/coach` | Denied | Read and append own conversation | None | Same-origin, verified user, atomic 60 per hour quota, 16 KB JSON cap, 2,000 character message cap, session ownership check |
| `POST /api/account/delete` | Denied | Delete own account | Support fallback | Same-origin, verified user, atomic 3 per hour quota, own-folder storage policies, self-delete database function |
| `GET /api/eval` | Denied | Denied | Local developer with bearer token | Returns 404 in production, for every non-loopback host, and without `EVAL_TOKEN` |
| App server actions | Denied unless the action is authentication | Mutate own resource | None | Framework origin check, verified user inside every action, bounded inputs, ownership filters, row security |

## Database matrix

Anonymous access to every application table is revoked. The signed-in role has only the grants below, and row security narrows every grant to the current account.

| Resource | Player permissions | Ownership rule | Protected authority |
|---|---|---|---|
| `profiles` | Read own; update display name, level, consent, discipline, position, frequency, timestamps | `id = auth.uid()` | Player cannot update plan, billing ID, or XP total |
| `analyses` | Read and create own through explicit columns | `user_id = auth.uid()` | Insert trigger forces database time, validates declared media paths, and serializes creation at 20 per hour |
| `skill_ratings` | Read, create, and update own | `user_id = auth.uid()` | No cross-account access |
| `goals` | Read, create, and update own | `user_id = auth.uid()` | No cross-account access |
| `games` | Read and create own | `user_id = auth.uid()` | No cross-account access |
| `coach_sessions` | Read, create, update, and delete own | `user_id = auth.uid()` | Deleting a session cascades only its messages |
| `chat_messages` | Read and create own | `user_id = auth.uid()` | API verifies session ownership before inserting |
| `xp_events` | Read and create own | `user_id = auth.uid()` | Server flows deduplicate reasons |
| Private quota table | None | Internal function derives `auth.uid()` | No direct role access; security-definer function accepts three fixed scopes only |
| Private analysis reservations | None | Internal function derives `auth.uid()` | Analysis requests serialize behind an opaque five-minute reservation; the free-plan rule is checked inside the same lock when billing is enabled |
| Account deletion function | Execute as signed-in user | Function deletes `auth.uid()` only | Anonymous and public execution revoked |

The server currently uses the player's session client instead of a database-wide admin key. That keeps blast radius small. It also means a technical user can call the data API directly to alter their own ratings or XP ledger. They still cannot cross accounts, change their plan, exceed the analysis insert limit, or trigger a paid coaching call without the app's atomic quota. If leaderboard or billing decisions ever trust XP or ratings, move those writes behind a narrowly scoped server credential or a database function that proves the source event.

## Storage matrix

| Bucket | Read | Write | Limits |
|---|---|---|---|
| `frames` | Owner only through authenticated download or one-hour signed URL | Owner only, exact paths declared by an existing owned analysis | JPEG or JSON only, 5 MB per object, at most 12 sent frames, 22 stored frames, and one keypoints file per analysis |
| `clips` | Owner only through authenticated download or one-hour signed URL | Owner only, exact path declared by an existing owned analysis | WebM, MP4, or QuickTime only, 100 MB per object, at most one clip per analysis |
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

Public authentication endpoints use the authentication service's own rate limits. Production must also have a hosting-firewall baseline per-IP limit across all public paths, plus stricter POST limits for `/login`, `/signup`, and `/api/*`, before requests reach application compute. Enable managed bot protection on login and signup before a public marketing push.

## Rules for future changes

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
