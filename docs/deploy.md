# Deploy & CI (Thomas - Phase 3)

How vollyio is gated, built, and shipped. Written to close the Phase 3 documentation gap: the deploy actually happened (recorded in `ORCHESTRATION_STATE.md`) but the dedicated doc and the CI gate did not exist until now.

## Environments

| | Value |
|---|---|
| Vercel project | `vollyio` (`prj_Trry0xeajBupSXSXruQoFIk0VKLr`, team `team_4ik4RqLW0j3baDcg95uols99`) |
| Production URL | https://vollyio.com |
| Framework | Next.js 16.2.12 (App Router, React 19.2) |
| Runtime | Node 22+ (Vercel default 24; CI pins 22) |
| Supabase project | `vollyio` - ref `tbbievneojaxkkjvcwjp`, us-west-2, Postgres 17 |

## Environment variables

Set in `.env.local` for dev and mirrored to Vercel (`vercel env add <NAME> production` / `preview`):

| Var | Scope | Secret | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | no | read client + build time |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | no | anon/publishable key; RLS enforces access |
| `ANTHROPIC_API_KEY` | server only | **yes** | the coaching service; never prefix `NEXT_PUBLIC` |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | **yes** | bypasses row security on every table. `lib/supabase/service.ts` is the only reader; its two importers are the payment webhook and the analyze route's telemetry/refund calls (D-065), each recorded with its reason in `docs/security.md` rule 10. A third importer is a security change, not a refactor. Absent, the webhook fails closed and telemetry stays null |
| `STRIPE_SECRET_KEY` | server only | **yes** | payment provider API key. Read only by `lib/stripe.ts` |
| `STRIPE_WEBHOOK_SECRET` | server only | **yes** | endpoint signing secret. Absent, the webhook returns 500 and applies nothing; there is deliberately no unverified branch |
| `STRIPE_PRICE_ID` | server only | no | the recurring price to charge. Not a secret, deliberately not `NEXT_PUBLIC_`: the browser has no use for it, and a client-visible price id is the shape of the bug where the caller decides what to charge |
| `NEXT_PUBLIC_UPGRADE_URL` | public | no | client-visible by definition, and the only billing value that may be. Points at the Settings plan card anchor |
| `BILLING_ENABLED` | server | no | `true` enforces the monthly allowance. Inert without `NEXT_PUBLIC_UPGRADE_URL`, by design |
| `OWNER_ALERT_EMAIL` | server | no | recipient of the spend-backstop alert. Unset silences the mail; it does not disable the backstop |
| `ANALYZE_MONTHLY_BUDGET_USD` | server | no | platform-wide monthly ceiling in dollars. Unset disables the guard, as does a value that is not a positive number (logged once). Once set, a usage total that cannot be read is treated as tripped, so the guard fails closed to a calm 503 |
| `AI_MOCK` | server | no | `true` runs the full flow with canned coaching-service results at zero cost (used locally and in CI) |
| `EVAL_TOKEN` | server | **yes** | long random bearer token for the local-only eval route; leave unset in hosted environments |

Set in Vercel Production today: `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_UPGRADE_URL`, `OWNER_ALERT_EMAIL`, `BILLING_ENABLED=true`, `ENFORCE_FREE_CAP=true`, `STRIPE_TOS_CONSENT`.

**`ANALYZE_MONTHLY_BUDGET_USD` IS DELIBERATELY UNSET (D-077).** It was 25, which at the measured $0.234 an analysis is 107 analyses a month across every user combined, or six Pro subscribers at full use. That is a ceiling a paying customer can hit through no fault of their own, and the guard fails CLOSED, so the symptom is a calm 503 for everybody. The owner removed it rather than raising it. **The guard code stays** (`lib/ai/budget.ts`): unset means disabled, so restoring a ceiling is one env var and no deploy-time code change. If it is ever set again, set it above `18 x 0.234 x expected_subscribers` with real headroom, and remember D-054's original point, which was that an unbounded bill killed production once.

Model routing (D-004) is a set of checked-in server-side constants in `lib/ai/client.ts`, NOT environment variables: `COACH_MODEL` (fast conversational tier for coach chat) and `ANALYZE_MODEL` (top reasoning tier for frame analysis); `AI_MOCK=true` bypasses both. Reasoning effort is pinned per tier alongside them (D-027): `ANALYZE_EFFORT` low, `COACH_EFFORT` medium. Changing any of these is a code change and goes through review.

## The gates

Four machine gates define the quality floor. Keep the local scripts, CI workflow, and this document in lockstep:

1. **`npm run lint`** - dependency-free policy checks for token purity, player-facing copy, vendor names, and debug code
2. **`npm run typecheck`** - `tsc --noEmit`
3. **`npm run test`** - `node --test`
4. **`npm run build`** - `next build`

Where they run:
- **Locally** - run all four before any deploy.
- **CI** - `.github/workflows/ci.yml` runs all four on every push to `master` and every pull request, with `AI_MOCK=true` and placeholder public Supabase vars so the build never needs real secrets or a paid call. A newer push cancels an in-flight run on the same ref.
- **Vercel** - `next build` runs again on the platform during deploy.

Last full-tree green (2026-08-01, this session): policy lint pass · `tsc` 0 errors · `next build` clean · `node --test` 360 tests.

## Deploy

```
vercel deploy              # preview
vercel deploy --prod       # production
```

Production is pushed from a green tree only. Preview URLs are generated per deploy for review before promotion.

### Security migration order

Use an expand, deploy, contract rollout. First apply `011_security_hardening.sql`, which adds the atomic functions without replacing storage policies. Then deploy the matching application and wait for the previous server deployment to drain. Verify a new analysis and its required frames, then apply `012_security_contract.sql` to revoke broad grants and tighten storage. The paid endpoints fail closed when migration 011 is absent. Finally, publish a baseline per-IP hosting-firewall limit across all public paths, with stricter POST limits for `/login`, `/signup`, and `/api/*`, then run the verification list in `docs/security.md`.

### Migration state

Applied to production: everything through `040`, except `018_coach_quota.sql` (superseded in practice: `028` carries its `consume_api_quota` body, and `030`/`033` rewrote `refund_api_quota` past what `018` held; apply or retire it with any coach re-enable). `041_rls_auto_enable_is_not_callable.sql` is committed and **not yet applied**: it adopts the platform's RLS auto-enable event trigger into the migration history and revokes the pointless client EXECUTE grant the linter flags. Applied migrations must not be rewritten; any further change is a new file numbered `042` and up.

The telemetry gap `028` used to leave is closed: since `029` (D-065) the analyze route writes `analyses.telemetry` through the service-role client, so a player's own credentials can no longer shape their cost record, and `028`'s check constraint bounds what the column may hold.

### Billing rollout

The paid path is built and LIVE (D-078: a real card was charged 2026-07-31 and the webhook applied the plan). `docs/billing.md` is the model, `docs/security.md` is the proof obligation, and this was the order followed; it stands as the record and as the template for any future re-arm.

1. Migrations `026`, `027`, `028`: applied.
2. Provider account objects: the live product (`prod_UxvNH2y52Rmz5o`), the $9.99 monthly price (`price_1TzKG5JOFP4i3BqJC2z0xklp`, lookup key `vollyio_pro_monthly`, D-077; the superseded $14.99 `price_1TxzWVJOFP4i3BqJ9th7pH9v` is left ACTIVE on purpose because a live subscription is attached to it, and archiving a price stops new checkouts without migrating the old ones), and the webhook endpoint (`we_1TxzXyJOFP4i3BqJ00R4qHTm`) at `https://vollyio.com/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. None of these is a secret. The customer portal settings cannot be read from the repo and want confirming in the dashboard: cancel at period end, payment method updates, no plan switching.
3. Environment, in this order. `STRIPE_WEBHOOK_SECRET` first, `STRIPE_SECRET_KEY` last, with `STRIPE_PRICE_ID`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_UPGRADE_URL` alongside. The gate that renders an upgrade button reads the key, the price, and the endpoint secret together, but a deployment that acquires a key before an endpoint secret would be able to take a payment it can never apply: the plan is never written, the customer reference is never stored, and the player cannot even reach the portal to cancel. Configuring the endpoint secret first is the ordering that cannot strand a paying player.
4. Run the billing verification `B0` through `B10` in `docs/security.md` against staging. `B2` through `B5` are the ones that prove a player cannot write their own plan, and nothing in the test suite can stand in for them: the grants, the row security, and the signature are properties of a live database and a live endpoint.
5. Set `BILLING_ENABLED=true`. Until this and `NEXT_PUBLIC_UPGRADE_URL` are both present, nothing is metered, no upgrade button renders, and checkout refuses.

Three routes carry this: `POST /api/stripe/checkout`, `POST /api/stripe/portal`, and `POST /api/stripe/webhook`. The webhook is the one route in the app with no same-origin check, because its caller is a server rather than a browser and the HMAC over the raw bytes is what authenticates it. That exception is documented in `docs/security.md` and must not be copied to a second route without its own entry there.

### Database advisor notes

The database linter reports every `SECURITY DEFINER` function as callable by `authenticated`. **That is expected for this project and is not a finding to chase.** Those functions are the mechanism by which a player is scoped to their own rows: each one derives `auth.uid()` itself and acts only on the caller, which is exactly why they are definer functions rather than direct table grants. `analysis_allowance`, `consume_api_quota`, `refund_api_quota`, `reserve_analysis_entitlement`, `release_analysis_entitlement`, `discard_new_analysis`, and `delete_own_account` are all in this category, and `analysis_by_share_token` is deliberately reachable anonymously because a live share link is the product requirement. (`plan_monthly_allowance` is granted to `authenticated` too but is a plain immutable mapping from a plan name to a number, not a definer function; knowing it grants nothing, because the allowance that binds is the one the reservation derives from the caller's own stored plan inside the lock.)

Two things about that list do matter:

- `set_subscription_plan` and `user_id_for_billing_customer` are **`service_role` only**. Execute is revoked from `public`, `anon`, and `authenticated`. If the advisor ever shows either of those as callable by `authenticated`, the billing boundary is open and that is an incident, not a warning. `docs/security.md` step `B3` is the live check.
- **Leaked-password protection is still disabled** in the auth dashboard. The advisor flags it, it checks new passwords against a breach corpus, and it is one toggle from the owner. It matters more now than it did: the monthly reset replaced the lifetime-one free rule, so a farmed account is worth 3 analyses a month forever rather than one ever (`docs/billing.md` section 6). Managed bot protection and the hosting-firewall rules belong in the same pass.

### Auth email configuration (D-075)

**Signup works. It was proven end to end on 2026-07-30** and the earlier claim in
this section that it was broken was wrong; see D-075 for the correction and the
reasoning error behind it.

The confirmation email uses a **custom template** that builds the link as
`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`. That
targets the callback route directly and is verified by `verifyOtp`, so it does
not depend on `redirect_to` or on `emailRedirectTo`. **That template lives in the
Supabase dashboard and is not version-controlled**, which is the actual fragility
here: if it is ever reset to the default, delivery silently falls back to the
`{{ .ConfirmationURL }}` path and `emailRedirectTo` becomes load-bearing. The
code now passes it for exactly that reason.

Three settings have to agree, and only one of them lives in the repo:

| Where | Setting | Required value |
|---|---|---|
| `app/(auth)/actions.ts` | `emailRedirectTo` | `${SITE_URL}/auth/callback` |
| Supabase, Authentication, URL Configuration | Site URL | `https://vollyio.com` |
| Supabase, Authentication, URL Configuration | Redirect URLs | must include `https://vollyio.com/auth/callback` |

The allow-list entry is not optional and its failure is silent: a `redirect_to`
that is not on the list is **rewritten back to Site URL**, which reproduces the
original bug with the fix apparently in place.

**`node scripts/auth-preflight.mjs` checks all three against the live project.**
It uses `auth.admin.generateLink`, so it reads the exact URL a new player would
receive without sending anyone an email, and deletes the probe user it creates.
Run it after any auth or domain change. It is the only way to see this class of
bug, because the broken state looks identical to nobody signing up.

Still owner-only in the dashboard, and both matter before recruiting:

- **Custom SMTP.** The default sender is rate limited to a handful of emails per
  hour for the whole project. `friendlySignupError` already handles
  `over_email_send_rate_limit`, which is what onboarding ten players courtside
  in one evening will hit.
- **Leaked-password protection**, below.

### Production deploy record (2026-07-08)
- Core mission deployed and verified live (middot title, on-page mark, OG image, zero user-facing em dashes).
- After merging the parallel `master` stream (beach discipline, knowledge-core/Learn, frame sampling, eval harness, ball-tracking) into the polish branch and fast-forwarding `master` to the mission tip, the merged tree was redeployed to production (`vollyio-5utsbctv0`). Verified live: landing, middot title, and `/learn` (master's new route) all return 200. Both workstreams are live together.

## Post-deploy verification
- Hit the production URL and confirm 200 on landing + the new/changed routes.
- Confirm the middot title separator and OG image render (no em dashes user-facing).
- Spot-check an authed route drives cleanly (session-gated surfaces are not reachable headless).

## Rollback
Vercel keeps every deployment immutable. To roll back, promote the last-good deployment in the Vercel dashboard (or `vercel rollback`), then reconcile the git tip. No destructive git action is required.

## Known deferrals
- **Numeric Lighthouse in CI** - the DoD's ≥90 perf/a11y bar was verified manually (landing 99/100, /login 99/100 on Edge mobile); the CLI was not installed, so Lighthouse is not yet a CI gate. Structural audit passed and every finding was fixed. Adding `@lhci/cli` as a CI job is the natural next step but was left out to keep CI fast and non-flaky.
- **Runtime error monitoring** - no APM/error-tracking wired; production errors surface only via Vercel's built-in logs.

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
