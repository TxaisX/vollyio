# Vollyio - setup

## 1. Supabase
1. Create a project at supabase.com.
2. Project Settings → API: copy the **Project URL** and the **anon/publishable key**. The **service role key** is on the same page; it is needed only when billing is armed (section 4) and is the one key that bypasses row security, so treat it like the coaching key, not like the anon key.
3. Apply every file in `supabase/migrations/` in numeric order - either reconnect the Supabase MCP to this project, or paste each file into the SQL editor. Three ordering rules are load-bearing:
   - Never apply `011_security_hardening.sql` without `013_reservation_link_after_insert.sql` in the same window; 011 alone aborts every analysis insert.
   - Apply `012_security_contract.sql` only once the matching server deployment is live (`docs/security.md`, deployment order).
   - Apply `026_monthly_allowance.sql` before `027_subscription_plan.sql`; 027's plan check constraint assumes 026 already resolves plans.
4. Authentication → URL Configuration: set the Site URL and add the deployed domain as a redirect URL.
5. Authentication → Policies: enable leaked-password protection. It is **off** in production today, the database advisor flags it, and it is one toggle (`HANDOFF.md` open items).

Production migration state: everything through `028` is applied, except `018_coach_quota.sql`. See `docs/deploy.md` for the caveat there - `028` already carries `018`'s `consume_api_quota` body, so what 018 still holds is its `refund_api_quota` rewrite.

## 2. Environment
Copy `.env.example` to `.env.local` and fill in. **Secret** below means: never carries a `NEXT_PUBLIC_` prefix, never reaches a client bundle, never gets committed. Everything that is not secret is still server-only unless its name starts with `NEXT_PUBLIC_`.

| Var | Secret | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | no | public by design |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | anon/publishable key; row security is what enforces access |
| `ANTHROPIC_API_KEY` | **yes** | the coaching service; server-side only |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | bypasses row security on every table. Read by `lib/supabase/service.ts` alone, imported by the payment webhook alone. Absent means the webhook fails closed |
| `STRIPE_SECRET_KEY` | **yes** | the payment provider API key |
| `STRIPE_WEBHOOK_SECRET` | **yes** | the endpoint signing secret. Absent means every event is rejected and no plan is ever written |
| `STRIPE_PRICE_ID` | no, but server-only | the recurring price to charge. Not a secret and deliberately not `NEXT_PUBLIC_`: the browser has no use for it, and a client-visible price id is the shape of the bug where the caller decides what to charge |
| `NEXT_PUBLIC_UPGRADE_URL` | no | client-visible by definition and the only billing value that may be. Set it to the Settings plan card (`https://vollyio.com/settings#plan`) |
| `BILLING_ENABLED` | no | `true` enforces the monthly allowance. Inert on its own: enforcement needs an upgrade destination too |
| `OWNER_ALERT_EMAIL` | no | where the spend-backstop alert goes. Unset means the alert is silent, not that the backstop is off |
| `ANALYZE_MONTHLY_BUDGET_USD` | no | platform-wide monthly spend ceiling in dollars. Unset disables the guard; a value that is not a positive number also disables it and logs once. Once set, a usage total that cannot be read is treated as tripped and returns the calm capacity 503 |
| `AI_MOCK` | no | `true` runs the whole flow on canned coaching results at no cost |
| `EVAL_TOKEN` | **yes** | bearer token for the local-only eval route; leave unset in hosted environments |

`.env.example` predates the billing work and does not list the billing variables yet; this table is the complete list.

Mirror the same variables to Vercel: `vercel env add <NAME> production` (and `preview`). Model routing and reasoning effort are **not** environment variables - they are checked-in constants in `lib/ai/client.ts` (D-004, D-027).

## 3. Run
```
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
node --test lib/ratings.test.ts
```

If a build fails with `EPERM: unlink .next/...`, OneDrive locked a build file - `Remove-Item -Recurse -Force .next` and rebuild.

## 4. Turning billing on
Billing is built and inert. Nothing is metered and no upgrade button renders until both keys below are present, so this is a several-step operation rather than a flag.

1. Migrations `026`, `027`, and `028` are applied to production already.
2. In the payment provider dashboard: the live product, the $14.99 monthly price, and the webhook endpoint for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed` all exist (IDs recorded in `docs/deploy.md`). The customer portal settings - cancel at period end, payment method updates, no plan switching, since there is only one plan - cannot be read from the repo; confirm them in the dashboard before arming, because the portal route is the player's only way to cancel.
3. Set `STRIPE_WEBHOOK_SECRET` **first** and `STRIPE_SECRET_KEY` **last**, with `STRIPE_PRICE_ID`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_UPGRADE_URL` alongside. The ordering matters: a deployment holding a key and a price but no endpoint secret would take payments it can never apply.
4. Run the billing verification steps `B0` through `B10` in `docs/security.md` against a staging project. `B2` through `B5` are the ones a green build will tempt you to skip, and they are the only proof that a player cannot write their own plan. No test in the suite can stand in for them.
5. Only then set `BILLING_ENABLED=true`.

## 5. Deploy
The Vercel project is connected to `github.com/TxaisX/vollyio` - any push to `master` auto-deploys to production (vollyio.com). The CLI is only needed for ad-hoc previews:
```
vercel deploy              # preview
vercel deploy --prod       # production (equivalent to pushing master)
```

## 6. Agent sessions (cloud / mobile)
`.mcp.json` connects two MCP servers on session start (each prompts an OAuth grant on first use):
- **supabase** - bound to project `tbbievneojaxkkjvcwjp` (database, logs, advisors, migrations).
- **vercel** - deployment status and logs for the connected project (D-011).

Cloud sessions (claude.ai/code from a phone or browser) get the full repo but no `.env.local`, so anything needing live keys can't run in-session - use `AI_MOCK=true` for the coaching flow, and rely on unit tests + `npm run typecheck`, then verify on the live site after the auto-deploy. Production env vars live in Vercel, not the repo.
