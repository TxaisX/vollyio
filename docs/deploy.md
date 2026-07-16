# Deploy & CI (Thomas — Phase 3)

How sideout is gated, built, and shipped. Written to close the Phase 3 documentation gap: the deploy actually happened (recorded in `ORCHESTRATION_STATE.md`) but the dedicated doc and the CI gate did not exist until now.

## Environments

| | Value |
|---|---|
| Vercel project | `sideout` (`prj_Trry0xeajBupSXSXruQoFIk0VKLr`, team `team_4ik4RqLW0j3baDcg95uols99`) |
| Production URL | https://sideout-jet.vercel.app |
| Framework | Next.js 16.2.10 (App Router, React 19.2) |
| Runtime | Node 22+ (Vercel default 24; CI pins 22) |
| Supabase project | `sideout` — ref `tbbievneojaxkkjvcwjp`, us-west-2, Postgres 17 |

## Environment variables

Set in `.env.local` for dev and mirrored to Vercel (`vercel env add <NAME> production` / `preview`):

| Var | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | read client + build time |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | anon/publishable key; RLS enforces access |
| `ANTHROPIC_API_KEY` | server only | the only vendor-named string in the repo; never prefix `NEXT_PUBLIC` |
| `AI_MOCK` | server | `true` runs the full flow with canned coaching-service results at zero cost (used locally and in CI) |
| `BILLING_ENABLED` | server | left empty until a paid tier ships |
| `EVAL_TOKEN` | server | long random bearer token for the local-only eval route; leave unset in hosted environments |

Model routing (D-004) is env-driven server-side: `COACH_MODEL` (fast conversational tier for coach chat) and `ANALYZE_MODEL` (top reasoning tier for frame analysis); `AI_MOCK=true` bypasses both.

## The gates

Four machine gates define the quality floor. Keep the local scripts, CI workflow, and this document in lockstep:

1. **`npm run lint`** — dependency-free policy checks for token purity, player-facing copy, vendor names, and debug code
2. **`npm run typecheck`** — `tsc --noEmit`
3. **`npm run test`** — `node --test`
4. **`npm run build`** — `next build`

Where they run:
- **Locally** — run all four before any deploy.
- **CI** — `.github/workflows/ci.yml` runs all four on every push to `master` and every pull request, with `AI_MOCK=true` and placeholder public Supabase vars so the build never needs real secrets or a paid call. A newer push cancels an in-flight run on the same ref.
- **Vercel** — `next build` runs again on the platform during deploy.

Last full-tree green (2026-07-09 worktree): policy lint pass · `tsc` 0 errors · `next build` 55 routes · `node --test` 18/0.

## Deploy

```
vercel deploy              # preview
vercel deploy --prod       # production
```

Production is pushed from a green tree only. Preview URLs are generated per deploy for review before promotion.

### Security migration order

Use an expand, deploy, contract rollout. First apply `011_security_hardening.sql`, which adds the atomic functions without replacing storage policies. Then deploy the matching application and wait for the previous server deployment to drain. Verify a new analysis and its required frames, then apply `012_security_contract.sql` to revoke broad grants and tighten storage. The paid endpoints fail closed when migration 011 is absent. Finally, publish a baseline per-IP hosting-firewall limit across all public paths, with stricter POST limits for `/login`, `/signup`, and `/api/*`, then run the verification list in `docs/security.md`.

### Production deploy record (2026-07-08)
- Core mission deployed and verified live (middot title, on-page mark, OG image, zero user-facing em dashes).
- After merging the parallel `master` stream (beach discipline, knowledge-core/Learn, frame sampling, eval harness, ball-tracking) into the polish branch and fast-forwarding `master` to the mission tip, the merged tree was redeployed to production (`sideout-5utsbctv0`). Verified live: landing, middot title, and `/learn` (master's new route) all return 200. Both workstreams are live together.

## Post-deploy verification
- Hit the production URL and confirm 200 on landing + the new/changed routes.
- Confirm the middot title separator and OG image render (no em dashes user-facing).
- Spot-check an authed route drives cleanly (session-gated surfaces are not reachable headless).

## Rollback
Vercel keeps every deployment immutable. To roll back, promote the last-good deployment in the Vercel dashboard (or `vercel rollback`), then reconcile the git tip. No destructive git action is required.

## Known deferrals
- **Numeric Lighthouse in CI** — the DoD's ≥90 perf/a11y bar was verified manually (landing 99/100, /login 99/100 on Edge mobile); the CLI was not installed, so Lighthouse is not yet a CI gate. Structural audit passed and every finding was fixed. Adding `@lhci/cli` as a CI job is the natural next step but was left out to keep CI fast and non-flaky.
- **Runtime error monitoring** — no APM/error-tracking wired; production errors surface only via Vercel's built-in logs.

## Build gotcha
`EPERM: unlink .next/...` on Windows means OneDrive locked a build file: `Remove-Item -Recurse -Force .next` and rebuild. (CI on Linux is unaffected.)

## CV Phase 1 (2026-07-10)

- Migrations `005_clips.sql` (verified) and `006_cv_phase1.sql` (applied) are
  live; both are idempotent. 006 must be live before this code deploys (the
  analyze route writes `keypoints_path` / `stored_frame_paths`).
- `public/pose/` ships ~39 MB of WASM runtime + landmarker model as static
  assets, fetched lazily by the analyze flow only. Nothing enters the page
  bundle; first analyze on a device downloads ~11 MB (SIMD wasm) + 5.8 MB
  (model) once, then browser-cached.
- New pinned dependency `@mediapipe/tasks-vision@0.10.35` (Decision Log D-008).
