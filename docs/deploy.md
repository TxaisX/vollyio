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

Model routing (D-004) is env-driven server-side: `COACH_MODEL` (fast conversational tier for coach chat) and `ANALYZE_MODEL` (top reasoning tier for frame analysis); `AI_MOCK=true` bypasses both.

## The gates

Three machine gates define the quality floor. They are identical in three places — keep them in lockstep:

1. **`npm run typecheck`** — `tsc --noEmit`
2. **`npm run test`** — `node --test`
3. **`npm run build`** — `next build`

Where they run:
- **Locally** — the Orchestrator ran all three by hand after every phase; run them before any deploy.
- **CI** — `.github/workflows/ci.yml` runs all three on every push to `master` and every pull request, with `AI_MOCK=true` and placeholder public Supabase vars so the build never needs real secrets or a paid call. A newer push cancels an in-flight run on the same ref.
- **Vercel** — `next build` runs again on the platform during deploy.

Last full-tree green (merged master, e3e81ae): `tsc` 0 errors · `next build` 55 routes · `node --test` 18/0.

## Deploy

```
vercel deploy              # preview
vercel deploy --prod       # production
```

Production is pushed from a green tree only. Preview URLs are generated per deploy for review before promotion.

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
