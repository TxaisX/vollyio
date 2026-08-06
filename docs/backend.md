# Backend: data, state, and platform

The authority on who may call each operation is `docs/security.md`. The authority
on how the system currently works is `docs/decisions.md` D-027 onward. Where an
older narrative disagrees with those, they win. This doc describes the server-side
spine: the Supabase clients, the tables and buckets, the API routes, the
coaching-service call discipline, and the scoring pipeline.

No vendor name reaches a user-visible string. The AI layer is "the coaching
service", and the half of it that reads pixels is "the vision provider";
`OPENROUTER_API_KEY` (server-only), the two model ids in `lib/ai/client.ts`, and
the gateway endpoint, which appears twice, in `lib/ai/vision.ts` for the clip
and frame reads (D-093, D-097) and in `lib/ai/chat.ts` for coach chat and the
weekly plan (D-096, D-098), are the only vendor-named tokens in the repo. All three
modules are `server-only`, so a client import is a build error. RLS, not app
code, is the tenant boundary. There is no on-device machine learning: a
server-side vision model does the entire read (D-033), on the provider D-093
splits it out to.

## 1. Supabase clients

Four creators, one per execution context. Three are keyed on the public URL plus
the anon key, so every query they make runs as the signed-in user under RLS. The
fourth is the service-role client, and it exists for exactly one caller.

| Context | File | Cookies |
|---|---|---|
| Server Components / route handlers / server actions | `lib/supabase/server.ts` | `setAll` is try/caught; Server Components cannot set cookies, so the proxy refreshes the session instead |
| Browser (client components, direct storage upload) | `lib/supabase/client.ts` | managed by the SSR helper |
| Edge middleware | `proxy.ts` | mutates a rolling `NextResponse` so refreshed auth cookies ride back |
| Payment webhook only | `lib/supabase/service.ts` | none; no session, no cookies |

The service-role client is the one place in the repo that bypasses RLS, and its
only legitimate caller is `POST /api/stripe/webhook`. It exists because
`set_subscription_plan` and `user_id_for_billing_customer` (migration 027) are
granted to `service_role` alone: the player must not be able to write their own
plan, so the writer cannot be reachable by the authenticated role. The creator
returns null when `SUPABASE_SERVICE_ROLE_KEY` is absent, so a deployment without
the key fails closed instead of throwing at import. Do not import it anywhere
else, and in particular never from a path whose request body a player controls
without a verified signature in front of it.

Middleware is `proxy.ts`, not `middleware.ts` (Next 16). It resolves identity
local-first via `getClaims()` (JWT verified against the project keys, cached per
instance) and falls back to `getUser()` only on a missing or expired token. It
redirects unauthenticated hits on the protected prefixes (`/dashboard`,
`/analyze`, `/analysis`, `/history`, `/drills`, `/coach`, `/scoreboard`, `/goals`)
to `/login`, and bounces authenticated users off `/`, `/login`, `/signup` to
`/dashboard`. The matcher excludes `api/`, so every route handler owns its own
auth. `lib/supabase/user.ts` `getAuthUserId` is the shared identity helper.

## 2. Data model: 8 tables, 2 private, 3 buckets

Schema lives in `supabase/migrations/`. `skill` is an enum of the six skills
(serve, pass, set, attack, block, dig). `discipline` stores `indoor | grass`
(`beach` is a legacy value new captures no longer produce; grass and sand are
judged together as one outdoor group, D-035). RLS is on every table with an
ownership policy scoped to `auth.uid()`; anonymous access is fully revoked and the
signed-in role has only column-limited grants (migration `012`).

| Table | Purpose | Ownership |
|---|---|---|
| `profiles` | 1:1 with `auth.users`; display name, level, discipline, position, consent; protected `plan` / `stripe_customer_id` / `xp` | `id = auth.uid()`; player may not write plan, billing id, or XP |
| `analyses` | one row per scored rep: full `result` jsonb, score, media paths, server-set `telemetry` | `user_id`; insert-only (immutable), 20/hr insert trigger |
| `skill_ratings` | rolling EWMA rating per `(user, skill, discipline)` | `user_id` |
| `goals` | player goals with `status` active/done/abandoned | `user_id` |
| `games` | saved scoreboard matches (sets jsonb, winner, duration) | `user_id` |
| `coach_sessions` | chat sessions (title, timestamps) | `user_id`; delete cascades its messages |
| `chat_messages` | coach transcript (role, content, session_id FK) | `user_id`; API verifies session ownership before insert |
| `xp_events` | append-only XP ledger; `reason` is the idempotency key | `user_id` |

Two private tables (`private` schema, no direct role access, reached only through
security-definer functions): `api_rate_limits` (atomic fixed-window quotas, three
fixed scopes) and `analysis_entitlement_reservations` (an opaque five-minute
reservation linked to its analysis by an AFTER INSERT trigger, migration `013`).

**The folder names are the authorization, not a label.** The storage policies in
migration 012 read `(storage.foldername(name))[1] = auth.uid()::text` for
ownership and `(storage.foldername(name))[2] = analysis.id` to tie an object to
its row, so `${user.id}/${analysisId}/` is a check rather than a naming
convention. Renaming either segment to something human-readable, a display name
for instance, does not relabel the folder; it deletes the check. `display_name`
is also player-editable (012 grants UPDATE on it), so keying on it would let a
player rename themselves into another player's folder, which is precisely the
"player-editable metadata never decides authorization" rule in AGENTS.md.

To find a person's film without renaming anything, use the operator index in
migration 031: `select * from private.find_player_storage('name or email or id')`
returns the display name, email, folder, declared and stored frame counts, and
size per analysis. It lives in `private` because it joins `auth.users`, so it is
readable from the SQL editor and from nothing else. Never grant it to a client
role.

Three storage buckets: `frames` and `clips` are private and owner-scoped by the
first path segment (`${user.id}/${analysisId}/...`), create-only, MIME- and
size-bounded. `models` is public-read, operator-write (pinned filenames). Account
deletion purges film on every path via an `auth.users` AFTER DELETE trigger to a
`purge-user-media` edge function (D-024), because `storage.protect_delete` forbids
deleting storage rows in SQL.

## 3. API routes

All are `runtime = "nodejs"`; the proxy does not cover them, so each self-auths.

| Route | Purpose | Boundary |
|---|---|---|
| `POST /api/analyze` | Validate the frame sequence, consume the hourly quota, reserve the entitlement, call the coaching service, derive scores, persist the analysis + frames + rating + XP + telemetry | Same-origin, verified user, atomic 20/hr, atomic entitlement, 4 MB body |
| `POST /api/coach` | Streaming grounded chat (`text/plain`, `no-store`), session-scoped, persists both turns; runs on `CHAT_MODEL` through the gateway (`lib/ai/chat.ts`, D-096) | Same-origin, verified user, atomic 20/hr plus 30/24h, 16 KB body, 600-char message, session ownership |
| `POST /api/players` | Coach-spotted candidates (D-036): one frame returns up to six kit-and-position descriptions with torso points; shares the coach quota, fails open to empty | Same-origin, verified user |
| `POST /api/account/delete` | Purge own storage, then `delete_own_account()` cascade | Same-origin, verified user, atomic 3/hr |

`GET /auth/callback` exchanges an OAuth code or verifies an OTP, redirecting to
`/dashboard` or `/login?error=`. Server actions (login/signup/logout, goals,
scoreboard, dashboard settings, coach-session delete, onboarding) live on the same
data layer: each re-checks `getAuthUserId`, zod-validates, mutates through RLS, and
`revalidatePath`s. Idempotency rests on semantic guards (`awardXp` dedupes on
`reason`; goal actions guard `status = 'active'`) plus client pending-state, not a
server-side token.

## 4. Coaching-service call discipline

Three call paths, not one. The lazily-cached SDK client (`lib/ai/client.ts`,
server-only) is now reached only by the weekly plan and the dev eval route; the
frame read goes through `lib/ai/vision.ts` (D-093) and coach chat through
`lib/ai/chat.ts` (D-096), both plain fetch against the gateway. The two gateway
modules are deliberately separate files: `vision.ts` reads pixels and binds every
request to a JSON schema, `chat.ts` streams prose with no schema at all.

- **Model (D-004 / D-093 / D-096 / D-097 / D-098).** Two ids, both on the
  gateway, and nothing else. `VISION_MODEL` reads pixels: the whole clip for
  `/api/analyze` (D-097) and one frame for `/api/players`. `CHAT_MODEL` writes
  text: coach chat and the weekly plan (D-098). Neither takes an effort
  parameter, because effort was a parameter only the coaching service had;
  `ANALYZE_EFFORT` and `COACH_EFFORT` went with the SDK. The run is recorded in
  `analyses.model` (or `"mock"`); chat and the weekly plan record nothing, so
  their spend is invisible to `/api/usage` and to the budget guard.
- **One id is not one behaviour.** The gateway resolves each id across several
  upstreams that differ measurably, and reasoning bills against `max_tokens`
  BEFORE any content, so every ceiling here is sized for the worst observed
  reasoning draw rather than for the answer (D-096). Measured on the frame read:
  the same id drew both `Google` and `Google AI Studio` across 19 runs, pricing
  the identical image at 1418 and 1236 input tokens. The video read is the one
  path that pins its upstream, because that upstream choice decides whether a
  base64 clip is accepted at all.
- **Mock mode.** `AI_MOCK=true` returns deterministic output with no key and no
  spend, on the chat path as well.
- **Retries.** Per call site: the frame read passes `maxRetries: 1`, the weekly
  plan `2` (SDK, honors `Retry-After`), chat `3`. Chat's retries stop at the first
  byte by construction, because the route streams each chunk to the player and
  concatenates the same chunks into what it stores, so resuming a started answer
  would splice two replies together and then save the result. A stream that
  produced nothing falls through to the client's existing "the coach didn't
  answer" path, and both quota units stay spent (see `docs/security.md`).
- **Quotas + entitlement.** Atomic per-endpoint quotas run before the paid call and
  fail closed (503 if the quota store is missing). The analyze entitlement reserves
  atomically and is released in a `finally` on every path.
- **Degraded service (D-043).** `lib/ai/errors.ts` classifies a failure as
  capacity, busy, or unknown. A credit/spend-cap outage refunds the hourly quota
  (`refund_api_quota`, migration `016`) and returns a distinct honest 503 telling
  the player their clip was not counted; the client renders that as a calm
  `unavailable` state, not a failure. The refund is analyze-only: migration `033`
  narrowed `refund_api_quota` to that scope and to `service_role`, so a coach turn
  that fails keeps both spent quota units (D-096).
- **Telemetry (D-043).** A server-set `analyses.telemetry` jsonb column records
  real token counts, wall-clock, model, and effort per analysis. It is never read
  by a client surface.
- **Grounding.** Coach context is assembled from parallel reads, history trimmed to
  a valid Messages shape, and the system prompt forbids inventing data or naming a
  vendor. Player-authored text (display name, goal titles) sits inside the
  `PLAYER_DATA` markers and everything between them is data, never instructions;
  `lib/ai/coach-prompt.test.ts` asserts both markers survive a refactor, because a
  fence that quietly stops being emitted looks exactly like one that works. The
  `COACHING_CRAFT` block (D-096) sits above the markers, and its range-framing
  rule ships with a guard forbidding a range, trend, high or low inferred from a
  single score; the test asserts the guard follows the rule and keeps its stated
  reason.

## 5. Scoring pipeline

The model never free-scores. For each of the six skills it judges a checklist of
concrete pointer cues as met / partial / missed / not_visible (`lib/ai/pointers.ts`,
D-039). The number is derived in code (`lib/ai/derive.ts` `deriveResult`, shared by
the analyze and eval routes):

1. Each of the five metrics per skill derives an uncurved score from its met/partial
   fraction over visible cues (D-040), and is observed only if at least one cue was
   visible (D-038).
2. The overall is the weighted mean over observed metrics, using per-metric weights
   that sum to 100 (`lib/ai/metrics.ts`, D-045). `coverage_pct` is the observed
   weight; below 60 the read is flagged `low_confidence`.
3. One scoring standard applies to every account (D-037); the rolling rating
   (`lib/ratings.ts`, EWMA `ALPHA = 0.35`) scales its step by coverage, so a
   low-coverage rep moves the trend less.

Frames come from uniform dense coverage of the whole trim window at up to 6 fps
(`lib/frames.ts`, D-041); the tapped subject instant is always included. The model
binds to the ringed athlete via `marker_frame_index` and reports `subject_check`.

## 6. Signed URLs, boundaries, operations

- **Storage.** Frames upload server-side inside `/api/analyze` after the row
  declares their exact paths (create-only; a failure discards the new analysis).
  Clips upload client-side after the response returns the intended path (non-fatal;
  the results page falls back to the frame player). Read-back signs on demand in
  `/analysis/[id]` with one-hour TTLs and guards a partial sign failure.
- **Error / loading.** `app/global-error.tsx` is the root boundary and
  `app/(app)/error.tsx` the in-shell one; dedicated `not-found.tsx` for
  `analysis/[id]` and `drills/[slug]`; nine `loading.tsx` skeletons back the
  Suspense reveals.
- **Migrations** apply in filename order; the live schema was applied out-of-band
  (SQL editor / MCP), so `list_migrations` may read empty. Key ones: `010` models
  bucket, `011`-`013` the security hardening (quotas, entitlements, grants, the
  reservation-link fix), `015` the media-purge trigger, `016` the quota refund +
  telemetry column. `next.config.ts` sets `experimental.viewTransition`; functions
  are pinned to `pdx1` in `vercel.json` to colocate with the us-west-2 database.
