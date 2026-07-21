# Backend: data, state, and platform

The authority on who may call each operation is `docs/security.md`. The authority
on how the system currently works is `docs/decisions.md` D-027 onward. Where an
older narrative disagrees with those, they win. This doc describes the server-side
spine: the Supabase clients, the tables and buckets, the API routes, the
coaching-service call discipline, and the scoring pipeline.

No vendor name reaches a user-visible string. The AI layer is "the coaching
service"; `ANTHROPIC_API_KEY` (server-only) is the sole vendor-named token in the
repo. RLS, not app code, is the tenant boundary. There is no on-device machine
learning: the coaching service (a server-side vision model) does the entire read
(D-033).

## 1. Supabase clients

Three creators, one per execution context, all keyed on the public URL + anon key
only. There is no service-role key anywhere, so every query runs as the signed-in
user under RLS.

| Context | File | Cookies |
|---|---|---|
| Server Components / route handlers / server actions | `lib/supabase/server.ts` | `setAll` is try/caught; Server Components cannot set cookies, so the proxy refreshes the session instead |
| Browser (client components, direct storage upload) | `lib/supabase/client.ts` | managed by the SSR helper |
| Edge middleware | `proxy.ts` | mutates a rolling `NextResponse` so refreshed auth cookies ride back |

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
| `POST /api/coach` | Streaming grounded chat (`text/plain`, `no-store`), session-scoped, persists both turns | Same-origin, verified user, atomic 60/hr, session ownership |
| `POST /api/players` | Coach-spotted candidates (D-036): one frame returns up to six kit-and-position descriptions with torso points; shares the coach quota, fails open to empty | Same-origin, verified user |
| `POST /api/account/delete` | Purge own storage, then `delete_own_account()` cascade | Same-origin, verified user, atomic 3/hr |
| `GET /api/eval` | Dev-only harness replaying `evals/cases/*.json` through the production scoring path | 404 in production, off loopback, or without the `EVAL_TOKEN` bearer |

`GET /auth/callback` exchanges an OAuth code or verifies an OTP, redirecting to
`/dashboard` or `/login?error=`. Server actions (login/signup/logout, goals,
scoreboard, dashboard settings, coach-session delete, onboarding) live on the same
data layer: each re-checks `getAuthUserId`, zod-validates, mutates through RLS, and
`revalidatePath`s. Idempotency rests on semantic guards (`awardXp` dedupes on
`reason`; goal actions guard `status = 'active'`) plus client pending-state, not a
server-side token.

## 4. Coaching-service call discipline

One lazily-cached SDK client (`lib/ai/client.ts`), server-only.

- **Model + effort (D-004 / D-027).** `ANALYZE_MODEL` runs the vision read at
  `ANALYZE_EFFORT = "low"` with adaptive thinking set explicitly (the top tier
  runs with no reasoning if the parameter is absent). `COACH_MODEL` runs chat at
  `COACH_EFFORT = "medium"`, a cap because the conversational tier defaults to high
  and fabricated detail above medium. Both are checked-in constants; the run is
  recorded in `analyses.model` (or `"mock"`).
- **Mock mode.** `AI_MOCK=true` returns deterministic output with no key and no
  spend.
- **Retries.** Both calls pass `{ maxRetries: 4 }`; the SDK honors `Retry-After`.
- **Quotas + entitlement.** Atomic per-endpoint quotas run before the paid call and
  fail closed (503 if the quota store is missing). The analyze entitlement reserves
  atomically and is released in a `finally` on every path.
- **Degraded service (D-043).** `lib/ai/errors.ts` classifies a failure as
  capacity, busy, or unknown. A credit/spend-cap outage refunds the hourly quota
  (`refund_api_quota`, migration `016`) and returns a distinct honest 503 telling
  the player their clip was not counted; the client renders that as a calm
  `unavailable` state, not a failure.
- **Telemetry (D-043).** A server-set `analyses.telemetry` jsonb column records
  real token counts, wall-clock, model, and effort per analysis. It is never read
  by a client surface.
- **Grounding.** Coach context is assembled from parallel reads, history trimmed to
  a valid Messages shape, and the system prompt forbids inventing data or naming a
  vendor.

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
