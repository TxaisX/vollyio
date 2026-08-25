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
| `OPENROUTER_API_KEY` | server only | **yes** | **the only model credential in the app** (D-098). Serves every model call there is: the clip read behind `/api/analyze` (D-097), player spotting (D-093), coach chat (D-096) and the weekly plan (D-098). **Ordering hazard: this must exist in the target environment BEFORE the code that reads it**, because serverless env is snapshotted at deploy time. Absent, analyze and spotting fail as a provider outage does and count nothing, while coach chat and the weekly plan return 503 before spending quota. All four draw down ONE prepaid balance, so traffic on any surface can starve the others and the balance is the real ceiling. Never prefix `NEXT_PUBLIC` |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | **yes** | bypasses row security on every table. `lib/supabase/service.ts` is the only reader; its four importers are the Play verify and RTDN routes, the payment webhook and the analyze route's telemetry/refund calls (D-065), each recorded with its reason in `docs/security.md` rule 10. A third importer is a security change, not a refactor. Absent, the webhook fails closed and telemetry stays null |
| `STRIPE_SECRET_KEY` | server only | **yes** | payment provider API key. Read only by `lib/stripe.ts` |
| `STRIPE_WEBHOOK_SECRET` | server only | **yes** | endpoint signing secret. Absent, the webhook returns 500 and applies nothing; there is deliberately no unverified branch |
| `STRIPE_PRICE_ID` | server only | no | the recurring price to charge. Not a secret, deliberately not `NEXT_PUBLIC_`: the browser has no use for it, and a client-visible price id is the shape of the bug where the caller decides what to charge |
| `NEXT_PUBLIC_UPGRADE_URL` | public | no | client-visible by definition, and the only billing value that may be. Points at the Settings plan card anchor |
| `BILLING_ENABLED` | server | no | `true` enforces the monthly allowance. Inert without `NEXT_PUBLIC_UPGRADE_URL`, by design |
| `OWNER_ALERT_EMAIL` | server | no | **READ BY NOTHING since 2026-08-06.** It was the spend-backstop recipient; the backstop and its alert are both gone (see below). Still set in Vercel Production and safe to remove |
| `AI_MOCK` | server | no | `true` runs the full flow with canned coaching-service results at zero cost (used locally and in CI) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | public | no | Cloudflare Turnstile SITE key, public by design. Unset means no widget renders and no token is sent, which is the deliberate default (D-104). The Turnstile SECRET key is NOT here and never should be: it is verified by Supabase Auth and set in the Supabase dashboard under Authentication -> Attack Protection. **Order matters**: ship this key, confirm a token rides along on a real submit, and only then enable CAPTCHA protection in Supabase, because arming Supabase against a client not sending a token rejects every signup AND login. Setting this also widens the CSP to name `https://challenges.cloudflare.com` in script-src, frame-src and connect-src |
| `GOOGLE_PLAY_SA_EMAIL` | server only | no | the Play Developer API service account's address. Paired with the key below; `lib/play-api.ts` refuses to call Google unless BOTH plus `PLAY_PACKAGE_NAME` are set, and `/api/play/verify` then answers 503 rather than granting or eating a purchase (D-125) |
| `GOOGLE_PLAY_SA_KEY` | server only | **yes** | the service account's private key. Server-only, no `NEXT_PUBLIC_` twin ever. Absent, no Play purchase can be verified against Google's own record, which is the only thing that grants Pro on the app |
| `PLAY_PACKAGE_NAME` | server only | no | `com.vollyio.app`. Part of the same three-value gate as the two above |
| `PLAY_RTDN_SECRET` | server only | **yes** | the shared secret on the Pub/Sub push URL for real-time developer notifications. **NOT SET IN PRODUCTION AS OF 2026-08-25, and Google is already pushing.** The runtime log carries one `[play] RTDN secret is not configured; push rejected` from 2026-08-19, which is the fail-closed branch working exactly as designed and also a real notification dropped on the floor. Nothing is broken today only because no Play subscription exists yet; the moment one does, a cancellation, expiry or revocation that arrives here is rejected and the plan stays `pro` forever. Set this before the first purchase, not after |
| `OAUTH_PROVIDERS` | server | no | comma separated, from `google` and `apple`. **Unset means no social buttons render at all**, which is the deliberate default (D-102): a "Continue with Google" button on a project whose Google provider is not configured sends the player down the fastest-looking path to a `validation_failed`, so the list must be turned on only once the provider actually works in the Supabase dashboard. Unknown names are dropped rather than throwing. Server-only on purpose: the browser has no use for the list, and a client-visible one is a step from a client-supplied one, which is why `signInWithProvider` re-validates the submitted provider against this same list |

**The four `PLAY_*` / `GOOGLE_PLAY_*` values above were added to this table on 2026-08-25 and were in NO checklist before that.** D-125 shipped the routes that read them without adding them here or to `.env.example`, which is why production has been rejecting real Google pushes since 2026-08-19 with nobody looking. A variable a route requires and no document names is a variable that does not get set.

Set in Vercel Production today: `OPENROUTER_API_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_UPGRADE_URL`, `OWNER_ALERT_EMAIL`, `BILLING_ENABLED=true`, `ENFORCE_FREE_CAP=true`, `STRIPE_TOS_CONSENT`, plus the Resend and support-email vars. Preview carries `OPENROUTER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` and the two public Supabase vars, and deliberately not the rest.

**`ANALYZE_MONTHLY_BUDGET_USD` AND ITS GUARD ARE GONE (D-104).** The variable was unset from D-077 onward and `lib/ai/budget.ts` was deleted on 2026-08-06. The reasoning is worth keeping because it is the reason not to rebuild it: a platform-wide dollar ceiling does nothing to whatever is spending the money, it waits until the money is spent and then serves a calm 503 to **everyone at once**, paying subscribers included, while the abuser is unaffected. One abuser became everybody's outage. The per-user allowance (D-064) is the bound that actually discriminates, and spend is now defended at ACCOUNT CREATION via Turnstile (`lib/captcha.ts`) rather than at the analysis. `OWNER_ALERT_EMAIL` and `lib/owner-alert.ts` were orphaned by the same change. **The cleanup ran on 2026-08-11**: the module and its 17 tests moved to `archive/owner-alert-d102/`, where the interval and claim logic stay readable if a credits-exhausted alert is ever built. `OWNER_ALERT_EMAIL` is still set in Vercel Production and is now read by nothing; removing it changes no behaviour. **Nothing warns the owner about spend today**, and the prepaid balance the app cannot read is the wall that actually binds.

Model routing (D-004) is a pair of checked-in server-side constants in `lib/ai/client.ts`, NOT environment variables: `VISION_MODEL` reads pixels (the clip read and player spotting) and `CHAT_MODEL` writes text (coach chat and the weekly plan). `AI_MOCK=true` bypasses both. There is no effort setting any more: `ANALYZE_EFFORT` and `COACH_EFFORT` were parameters only the coaching SDK had, and they went with it (D-098). Changing either id is a code change and goes through review.

**An id is not an upstream.** The gateway resolves one id across several backends that behave differently, and reasoning bills against `max_tokens` before any content, so a ceiling sized to the expected answer returns an empty string on exactly the backends that think hardest (D-096). Every ceiling in the app is therefore set from the worst observed reasoning draw, and `telemetry.provider` plus `telemetry.reasoning_tokens` on the analyses row record which backend actually answered. If a surface starts returning empty replies, read those two columns before assuming an outage.

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

Applied to production: everything through `051`, except `018_coach_quota.sql` (superseded in practice: `028` carries its `consume_api_quota` body, and `030`/`033` rewrote `refund_api_quota` past what `018` held; apply or retire it with any coach re-enable). Verified live 2026-08-03 by reading the deployed functions directly: `signup_grant()` returns 6, `plan_monthly_allowance('pro')` returns 24, and `set_subscription_plan` carries the seven-argument signature (`p_event_at`, `p_period_start` included), so the deployed webhook and the database agree. `050` (achievements, D-089), `051` (the window start clamp, D-090) and `052` (the claim's variable-conflict fix, D-089 correction) were applied the same day, ahead of or beside the code that calls them, in the 036 additive mold. Applied migrations must not be rewritten; any further change is a new file numbered `053` and up.

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

### Coach chat, after D-096
Coach chat is auth-gated and streams, so a curl of the route proves nothing. Log
in, open `/coach`, send one message, and watch it. Three outcomes and what each
means:

- **Text streams in progressively.** Working.
- **503, rendered as the calm unavailable state.** `hasChatKey()` fired: the
  gateway key is missing from that environment. This is the designed failure and
  it costs the player nothing, because the check runs before either quota is
  consumed.
- **"The coach didn't answer."** The stream opened and produced zero content.
  The key is present, so this is the provider: either the upstream refused, or
  the reply spent its whole `max_tokens` budget on reasoning before emitting
  text. Note that both quota units are already spent here and there is no refund
  on this route. Check `maxTokens` in `app/api/coach/route.ts` against D-096
  before assuming an outage.

## Rollback
Vercel keeps every deployment immutable. To roll back, promote the last-good deployment in the Vercel dashboard (or `vercel rollback`), then reconcile the git tip. No destructive git action is required.

## Known deferrals
- **Numeric Lighthouse in CI** - the DoD's ≥90 perf/a11y bar was verified manually (landing 99/100, /login 99/100 on Edge mobile); the CLI was not installed, so Lighthouse is not yet a CI gate. Structural audit passed and every finding was fixed. Adding `@lhci/cli` as a CI job is the natural next step but was left out to keep CI fast and non-flaky.
- **Runtime error monitoring** - no APM/error-tracking wired; production errors surface only via Vercel's built-in logs.

## Build gotcha
`EPERM: unlink .next/...` on Windows means OneDrive locked a build file: `Remove-Item -Recurse -Force .next` and rebuild. (CI on Linux is unaffected.)

## CV Phase 1 (2026-07-10) - HISTORICAL

D-033 removed the on-device pose engine entirely after two blind kill gates;
the coaching service reads frames directly now. Kept as deployment history:

- Migrations `005_clips.sql` and `006_cv_phase1.sql` are live and idempotent;
  006's columns (`keypoints_path` / `stored_frame_paths`) remain in use by the
  analyze route's storage bookkeeping.
- `public/pose/` (the ~39 MB WASM runtime + landmarker model) and the pinned
  `@mediapipe/tasks-vision` dependency were removed with D-033. Neither exists
  in the repo or the bundle today; if either reappears, that is a regression
  against a two-gate kill decision, not a restore.
