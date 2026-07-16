# Backend: data, state, and platform (the Dave layer)

The authoritative access-control and abuse-prevention contract is `docs/security.md`. Where this older architecture narrative differs, the security matrix and migrations `011_security_hardening.sql` and `012_security_contract.sql` control.

The server-side spine under Jerry's components: the two Supabase clients, the seven tables + two storage buckets they read, the three API route handlers, the coaching-service call discipline (section 3), signed-URL handling, and every route boundary. No vendor name reaches a user-visible string — the AI layer is "the coaching service"; `ANTHROPIC_API_KEY` (server-only) is the sole vendor-named token in the repo. RLS, not app code, is the security boundary.

## 1. Supabase client architecture

Three creators, one per execution context, all keyed on the public URL + anon key only. There is no service-role key anywhere — every query runs as the signed-in user and is filtered by RLS.

| Context | File | Client | Cookie handling |
|---|---|---|---|
| Server Components / route handlers / server actions | `lib/supabase/server.ts` | `createServerClient` over `next/headers` `cookies()` | `setAll` is wrapped in try/catch — Server Components can't set cookies, so the write is swallowed and the proxy refreshes the session instead (`server.ts:20-22`) |
| Browser (client components, direct storage upload) | `lib/supabase/client.ts` | `createBrowserClient` | managed by the SSR helper |
| Edge middleware | `proxy.ts` | `createServerClient` over `NextRequest` cookies | mutates a rolling `NextResponse` so refreshed auth cookies ride back on the response (`proxy.ts:20-30`) |

- **Middleware is `proxy.ts`, not `middleware.ts`** (Next 16). It calls `supabase.auth.getUser()` on every matched request, redirects unauthenticated hits on the `PROTECTED` prefixes (`/dashboard`, `/analyze`, `/analysis`, `/history`, `/drills`, `/coach`, `/scoreboard`, `/goals`) to `/login`, and bounces authenticated users off `/`, `/login`, `/signup` to `/dashboard` (`proxy.ts:14-49`).
- **The matcher excludes `api/`** plus static/asset/PWA paths (`proxy.ts:52-55`), so route handlers are *not* gated by the proxy — each API route re-checks `getUser()` itself and owns its own 401.
- **RLS reliance is total.** Every table has `enable row level security` + an `own …` policy scoped to `user_id = auth.uid()` (or `id = auth.uid()` on `profiles`). App queries add `.eq("user_id", user.id)` defensively, but correctness does not depend on it — a missing filter still can't cross tenants.

## 2. Data model — 7 tables + 2 buckets

Schema lives in `supabase/migrations/`. `skill` is a Postgres enum of the six skills (`serve, pass, set, attack, block, dig`); `discipline` is a text-check of `indoor | beach`.

| Table | Migration | Purpose | Written by | Read by |
|---|---|---|---|---|
| `profiles` | `001_core` | 1:1 with `auth.users`; `display_name`, `level`, legacy `xp`, `plan`, `stripe_customer_id` | `handle_new_user()` trigger on signup; player updates are column-limited | entitlements (`plan`), analyze/coach (`level`, `display_name`), dashboard |
| `analyses` | `002_analysis` (+`discipline` in `004`, +`clip_path` in `005`) | one row per scored rep; full `result` jsonb + score + frame/clip paths | `POST /api/analyze` | `/analysis/[id]`, `/history`, dashboard recent, coach `recent_analyses`, entitlement + hourly-limit counts |
| `skill_ratings` | `002_analysis` (re-keyed in `004`) | rolling EWMA rating per `(user, skill, discipline)` | `POST /api/analyze` upsert | dashboard, `/scoreboard`, coach context (indoor only) |
| `goals` | `003_phase2` | player goals w/ `status` (`active/done/abandoned`) | `goals/actions.ts` (`createGoal`/`completeGoal`/`abandonGoal`) | `/goals`, coach `active_goals` |
| `games` | `003_phase2` | saved scoreboard matches (`sets` jsonb, winner, duration) | `scoreboard/actions.ts` `saveGame` | `/scoreboard` |
| `chat_messages` | `003_phase2` | coach transcript (`role`, `content`) | `POST /api/coach` (user turn + persisted assistant reply) | `/coach`, coach history window (last 20), hourly-limit count |
| `xp_events` | `003_phase2` (+ index in `004_xp_events_index`) | append-only XP ledger; `reason` is the idempotency key | `awardXp` (analysis / challenge / goal) | `getProgress` (xp, level, streak, daily-challenge state) |

**Storage buckets** (both private): `frames` (`002_analysis`) and `clips` (`005_clips`, 100 MB `file_size_limit`). Object RLS keys ownership on the first path segment — `(storage.foldername(name))[1] = auth.uid()::text` — so every object path is `${user.id}/${analysisId}/…`.

Hot-path composite indexes exist on every high-read table: `(user_id, created_at desc)` on `analyses`, `chat_messages`, `xp_events`, plus `(user_id, skill, …)` and `(user_id, discipline, …)` variants.

## 3. API route inventory

All three are `runtime = "nodejs"`. The proxy does not cover them; each owns its auth.

| Route | Method | Purpose | Auth boundary | Error handling |
|---|---|---|---|---|
| `/api/analyze` | POST | Validate a bounded frame sequence, reserve quota and entitlement, call the coaching service, then persist analysis, required frames, rating, and XP | Verified user required; atomic free entitlement when enabled; 20 per hour quota | Bad body returns 400/413/415; entitlement or quota storage fails closed; required-frame failure discards the new analysis. `maxDuration = 120` |
| `/api/coach` | POST | Streaming chat: validate → `getUser` → hourly cap → persist user turn → build grounded context → stream reply as `text/plain` (`Cache-Control: no-store`); assistant reply persisted in `finally` if non-empty | `getUser` → 401; ≥60 user msgs/hour → 429 | bad body → 400; insert failure → 500; a mid-stream throw is swallowed so a partial reply still saves and the stream closes (`route.ts:204-214`). `maxDuration = 60` |
| `/api/eval` | GET | Dev-only harness: replays labeled `evals/cases/*.json` through the production scoring path | Returns 404 in production, on non-loopback hosts, or without the server-side `EVAL_TOKEN` bearer token | Missing cases return a JSON hint; per-case throws are captured. `maxDuration = 300` |

**Auth route:** `/auth/callback` (`GET`) exchanges an OAuth `code` or verifies an OTP `token_hash`, redirecting to `/dashboard` on success or `/login?error=…` on failure.

**Server actions** (not API routes, but the same data layer): `(auth)/actions.ts` (`login`/`signup`/`logout`), `dashboard/actions.ts` (`completeChallenge`), `goals/actions.ts`, `scoreboard/actions.ts` (`saveGame`). Every action re-checks `getUser`, zod-validates input, mutates through RLS, and calls `revalidatePath`. Idempotency is enforced where it matters: `awardXp` dedupes on `reason` (`progression.ts:83-89`), `completeGoal`/`abandonGoal` guard on `status = 'active'`.

## 4. Coaching-service call discipline

The single client is a lazily-cached coaching-service SDK client (`lib/ai/client.ts:9-16`).

- **Model routing (D-004 / CS-5).** Cheapest capable tier per call: coach chat is high-frequency → `COACH_MODEL` (fast conversational tier); analyze is low-frequency, vision + structured scoring → `ANALYZE_MODEL` (top reasoning tier) (`client.ts:6-7`). Both are env-driven server-side constants; the persisted `analyses.model` records which ran (or `"mock"`). See `decisions.md` D-004.
- **`AI_MOCK` mode.** With `AI_MOCK=true`, analyze returns a deterministic `mockResult` (`lib/ai/mock.ts`) and coach streams a canned `mockReply` chunk-by-chunk — no key, no spend. Copy stays vendor-neutral ("enable the coaching service for real feedback").
- **Retries.** Both live calls pass `{ maxRetries: 4 }` to the SDK; the SDK honors `Retry-After` and jitters on 429/5xx (CS-7). This is separate from the app's own hourly caps.
- **Cost / call controls.** Conservative `max_tokens` (analyze 4096, coach 1024). Structured output is enforced via `zodOutputFormat(analysisSchema(skill))` so responses parse without re-prompting. Analyze marks its two system blocks (`getRubric`, `outputSpec`) for prompt caching. Atomic database quotas enforce 20 analyses per hour and 60 coach messages per hour. When `BILLING_ENABLED=true`, the free analysis is reserved atomically before the paid call and entitlement-store errors fail closed.
- **Grounding.** Coach context is assembled from five parallel reads (`Promise.all`), history is trimmed to a valid Messages shape (first turn user, no trailing assistant), and the system prompt forbids inventing data or naming any vendor (`lib/ai/coach-prompt.ts:39`).

## 5. Signed-URL / storage handling

- **Frames** are uploaded server-side inside `/api/analyze` after the analysis row declares their exact paths. Uploads are create-only. A required-frame failure removes uploaded partials and discards the new analysis.
- **Clips** are uploaded client-side from `analyze-flow.tsx:203-214` (browser client → `clips` bucket, RLS-scoped by path) *after* the analyze response returns the intended `clipPath`. Failure is non-fatal — the results page falls back to the frame player. The extension is sanitized server-side to 2-4 `[a-z0-9]` chars, default `webm` (`route.ts:39-42`).
- **Read-back** signs on demand in `/analysis/[id]/page.tsx`: `createSignedUrls(frame_paths, 3600)` and, if present, `createSignedUrl(clip_path, 3600)` — 1-hour TTLs, `dynamic = "force-dynamic"`. The failure guard triggers on a **partial** sign failure, not just an all-fail (`page.tsx:101-103`), rendering a "frames couldn't load" card instead of empty-string `img` sources; scores and notes still render below.

## 6. Route error / loading boundaries

- **Error:** `app/global-error.tsx` (full `<html>` shell, reload button) is the last-resort root boundary; `app/(app)/error.tsx` is the in-shell segment boundary (Try again → `reset()`, plus a dashboard link). Both `console.error` in non-production only.
- **Not-found:** dedicated `not-found.tsx` for `analysis/[id]` and `drills/[slug]`, each in brand voice with a recovery link. Analyze/drill detail call `notFound()` on a missing or non-owned row.
- **Loading:** nine `loading.tsx` skeletons — one per app route plus the `(app)` root (`analysis/[id]`, `analyze`, `coach`, `dashboard`, `drills`, `goals`, `history`, `scoreboard`, and the group root). These are the Suspense fallbacks the section-7 view-transition reveal dissolves (see `docs/motion.md`).
- **Offline:** `app/offline/page.tsx` is the hand-rolled service worker's fallback (excluded from the proxy matcher).

## 7. Scripts / operational notes

- **`package.json` scripts** closed the tooling hole: `typecheck` (`tsc --noEmit`), `test` (`node --test`, exercises `lib/*.test.ts`), plus a `lint` placeholder (no ESLint config this phase — type safety is the gate). `dev`/`build`/`start` unchanged.
- **`next.config.ts`** sets `turbopack.root` and `experimental.viewTransition: true` (the flag the section-7 motion layer depends on; progressive enhancement, never a hard dependency).
- **Env** (`.env.example`, no secret committed): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public), `ANTHROPIC_API_KEY` (server-only), `NEXT_PUBLIC_SITE_URL`, and two optional flags — `AI_MOCK`, `BILLING_ENABLED`.
- **Ratings math** is an EWMA with `ALPHA = 0.35` (`lib/ratings.ts`); XP levels use a quadratic cumulative curve and streaks are pinned to `America/Los_Angeles` so a server region change can't reset one (`lib/progression.ts:23-35`).
- **Migrations** apply in filename order; note there are two `004_` files (`004_discipline.sql`, `004_xp_events_index.sql`) — a duplicate ordinal that is order-independent (one adds columns/re-keys, the other adds an index) but worth folding into a single ordinal if the sequence is ever rebased. Note also that `list_migrations` on the live project returns empty: the schema was applied out-of-band (SQL editor / MCP), not through tracked migrations, and `005_clips.sql` was verified applied to the live project on 2026-07-10 (clips bucket, `clip_path`, and all three object policies present); `006_cv_phase1.sql` was applied the same day (`profiles.training_consent`, `profiles.training_consent_at`, `analyses.keypoints_path`, `analyses.stored_frame_paths`).

## Spec deltas

Gaps between what the orchestration spec (section 3 discipline + Dave's DoD, prompt lines 75-85, 178) expected this doc to cover and what the code actually does:

- **`D-004` model split — now recorded.** Code and grading reference "D-004 (CS-5)" for the split (`client.ts:3`, `reportcards.md`, acceptance CS-5); the binding Decision Log entry was missing and has been written this pass (`decisions.md` D-004).
- **No 500ms debounce.** Section 3 lists "Debounce user input at 500ms." The coach chat instead prevents concurrent sends with an in-flight `streaming` boolean (`coach-chat.tsx:145`); there is no timed debounce anywhere. In-flight de-dupe is present; the 500ms debounce is not.
- **"Cache deterministic responses" / "Batch requests where possible" are only partially real.** Caching is prompt-level (ephemeral `cache_control` on the analyze system blocks) — there is no full-response cache. The only batching is DB context reads via `Promise.all` in `/api/coach`; model calls themselves are not batched.
- **Server-action double-submit is guarded client-side, not server-side.** The DoD says "no server action can double-submit"; in practice that rests on pending submit buttons (`useFormStatus`) plus semantic guards (`awardXp` reason-dedupe, goal `status='active'` filters). There is no server-side idempotency token on `createGoal` or `saveGame`.
- **Billing is scaffolded but dormant.** `profiles.plan` and the billing customer field exist, but no payment integration ships. When `BILLING_ENABLED=true`, a database function atomically reserves the one free analysis; the whole gate is off otherwise.
- **MCP / `tooling.md` is out of scope for this doc.** Dave's section-10 half (MCP installs into `.mcp.json`, documented in `docs/tooling.md`) shipped nothing (none earned the gate), so `backend.md` has no MCP surface to document — tracked in `tooling.md`, intentionally empty.

## 8. CV Phase 1 additions (2026-07-10)

Companion spec: `docs/cv-phase1-spec.md` (HTML twin `cv-phase1-spec.html`).

- **Schema** (`006_cv_phase1.sql`, applied live): `profiles.training_consent`
  (boolean, default false) + `training_consent_at`; `analyses.keypoints_path`
  (text) + `stored_frame_paths` (text[], default `{}`). No new buckets or
  policies; `keypoints.json` and extra frames `x12.jpg`..`x23.jpg` live under
  the existing `frames` bucket per-analysis prefix.
- **`POST /api/analyze` contract additions** (all optional; requests without
  them are byte-identical to the pre-CV contract): `measurements` (validated by
  `lib/ai/measurements-schema.ts`; invalid blocks are dropped, never 400),
  `frame_keypoints` (per-sent-frame flat landmark arrays), `has_keypoints`,
  `extra_frame_count` (0-12). The route appends one measured-data text block to
  the user turn when measurements are present (system blocks stay byte-stable
  and cached), persists `measurements` + `frame_keypoints` +
  `ball_track_source: "model_estimate"` inside `result`, predetermines
  `keypoints_path` / `stored_frame_paths`, and returns `keypointsPath` +
  `storedFramePaths` for the client's background uploads.
- **Client uploads**: after the response, `analyze-flow.tsx` fire-and-forgets
  `keypoints.json` and the extra frames to the returned paths through the
  browser client (same own-folder RLS as the clip upload; navigation does not
  wait).
- **Consent**: first analysis triggers a blocking opt-in/opt-out dialog that
  writes `training_consent(_at)`; the dashboard Settings card
  (`setTrainingConsent` server action) can flip it any time. Corpus queries
  must join `profiles` and filter on `training_consent = true`.
- **Eval harness**: cases may carry a `measurements` block;
  `GET /api/eval?measurements=off` replays every case vision-only for grounded
  vs ungrounded comparison. The debug-mode "Download eval case" button now
  embeds the captured block. No labeled cases are recorded yet: capture real
  footage at `/analyze?debug` to seed `evals/cases/`.
- **On-device pipeline** (client only): `lib/pose/engine.ts` (lazy loader,
  worker + main-thread fallback, null on unsupported), `lib/pose/pose-worker.ts`
  (WASM landmarker), `lib/pose/kinematics.ts` + `lib/pose/metrics.ts` (pure,
  node-tested: rep detectors, metric catalog, confidence gating with
  omit-below-threshold), assets self-hosted under `public/pose/`.
  Spec deviations, both recorded here deliberately: stage 1 keeps the luminance
  scan as the peak finder (inter-probe wrist speed is aliased at ~1.8s probe
  spacing; pose refines peaks to measured contact instants instead), and
  `keypoints.json` uploads uncompressed (rounded to 3 decimals) so the results
  page can read it without a decompression path.

## 9. Navigation performance (2026-07-10)

- **Middleware auth is local-first**: `proxy.ts` and page/server-action code
  resolve identity via `getClaims()` (JWT verified against the project's
  public ES256 keys, cached per instance) and only fall back to `getUser()`
  when the token is missing or expired, which is also the session-refresh
  path. Before this, every navigation and every link prefetch paid an
  auth-server round trip in middleware plus a second one in the page.
  RLS still enforces every query; the money-spending API routes
  (`/api/analyze`, `/api/coach`) intentionally keep `getUser()` for
  server-side revocation checks. Helper: `lib/supabase/user.ts`.
- **Functions colocated with the database**: `vercel.json` pins serverless
  functions to `pdx1` (Oregon), matching the Supabase project region
  (us-west-2). Default was `iad1`, putting ~70ms of cross-country RTT on
  every auth and database round trip.
- Measured locally (prod build, authenticated): full-stream server time for
  the heaviest tabs is 85-204ms; warm client-side tab switches land ~50ms.

## 10. Coach sessions (2026-07-10)

`coach_sessions` (`007_coach_sessions.sql`, applied live): id, user_id, title,
created_at, updated_at; own-row RLS; `chat_messages.session_id` FK (cascade)
with a per-session index. Existing messages were backfilled into one
"Earlier conversations" session per user. `POST /api/coach` accepts an
optional `session_id` (ownership-verified, 404 otherwise); absent means a new
session titled from the first message, returned in the `x-coach-session`
response header so a fresh chat adopts it mid-stream. Chat history sent to
the coaching service is scoped to the session. `/coach?s=<id>` opens a
session, `?s=new` a fresh one; `deleteCoachSession` server action removes a
session and its messages.

## 11. Focus-player tracking, Phase 3 MVP (2026-07-10)

Multi-player footage: the pose worker detects up to 4 athletes per frame
(`numPoses: 4`); `lib/pose/kinematics.ts buildTracks()` associates detections
across frames by hip-center distance + body-size similarity into
`PersonTrack`s, ranked by motion energy (0.45), prominence (0.25), centering
(0.15), and coverage (0.15). Extraction follows the top track by default; all
tracks return to the flow, and when more than one person is visible
in the opening seconds the flow pauses BEFORE analysis with a tap-your-player
frame (detectOpeningPlayers + pose.target anchors track selection to the tap);
after extraction a tap-to-switch picker remains as the correction path (gold
box = analyzed).
Switching recomputes measurements client-side from the chosen track with no
re-extraction. `player_selection {candidates, selected_rank, auto}` rides the
analyze request and persists inside `result`. Remembering a player across
uploads (appearance embedding) is the planned follow-up.
