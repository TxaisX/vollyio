# Billing runbook: switching it on, and switching it off

For the owner, alone, possibly at speed. Every step is one command or one click,
with the output you should see and what to do when you see something else.

`docs/billing.md` is why the system is shaped this way. `docs/security.md`
section "Billing verification" (B0 to B10) is the security proof and should be
run against staging before any of this. This file is neither. It is the
operational sequence for the live site.

Two things here are not reversible by unsetting a variable: a charge, and a
subscription. Read section 6 before section 3 if you are switching on for the
first time.

**Budget:** about 30 minutes, plus one real charge of $14.99 on a card you own.

## Consoles you will need

| What | Where |
|---|---|
| Database | Supabase project `tbbievneojaxkkjvcwjp`, SQL editor |
| Payments | Stripe dashboard, live mode, account `acct_1NMwN5JOFP4i3BqJ` |
| Hosting and env vars | Vercel project `vollyio`, or the `vercel` CLI from the repo root |
| Runtime logs | Vercel, project `vollyio`, Logs, filter on `[billing]`, `[checkout]`, `[portal]` |

If `vercel` is not linked, run `vercel link` in the repo root and pick the
`vollyio` project. `vercel whoami` should name your account before you touch
anything.

## The variables, and who can set them

| Variable | Set in production today | Who can read the value |
|---|---|---|
| `STRIPE_PRICE_ID` | yes | anyone with dashboard access |
| `STRIPE_WEBHOOK_SECRET` | yes | anyone with dashboard access |
| `NEXT_PUBLIC_UPGRADE_URL` | yes | public by definition |
| `OWNER_ALERT_EMAIL` | yes | you |
| `ANALYZE_MONTHLY_BUDGET_USD` | yes, `25` | you |
| `STRIPE_SECRET_KEY` | **no, section 2** | only you |
| `SUPABASE_SERVICE_ROLE_KEY` | **no, section 2** | only you |
| `BILLING_ENABLED` | **no, deliberately, section 3** | you |

---

## 1. Preconditions

Do not skip these. Every one of them has a failure mode that looks like
something else once money is moving.

### 1.1 Migrations 026, 027 and 028 are applied

Supabase SQL editor. Run this first, because the grant check below errors
outright if a function is missing.

```sql
select
  to_regprocedure('public.plan_monthly_allowance(text)')          is not null as m026_allowance,
  to_regprocedure('private.allowance_window(timestamptz)')        is not null as m026_window,
  to_regprocedure('public.analysis_allowance()')                  is not null as m026_counter,
  to_regprocedure('public.reserve_analysis_entitlement(boolean)') is not null as m026_reserve,
  to_regprocedure(
    'public.set_subscription_plan(uuid,text,timestamptz,text,text,timestamptz)'
  ) is not null as m027_writer,
  to_regprocedure('public.user_id_for_billing_customer(text)')    is not null as m027_lookup,
  public.plan_monthly_allowance('free') as free_allowance,
  public.plan_monthly_allowance('pro')  as pro_allowance;
```

Expected: six `true` columns, then `3` and `18`.

If `m027_writer` is false but `m027_lookup` is true, the five-argument version of
the writer may still exist from an older attempt. Migration 027 drops it on
purpose. Do not re-add it; that shape has no staleness guard.

Then the grants. This is the whole security boundary in one query.

```sql
select
  has_function_privilege('service_role',
    'public.set_subscription_plan(uuid,text,timestamptz,text,text,timestamptz)',
    'execute') as writer_service_role,
  has_function_privilege('authenticated',
    'public.set_subscription_plan(uuid,text,timestamptz,text,text,timestamptz)',
    'execute') as writer_authenticated,
  has_function_privilege('anon',
    'public.set_subscription_plan(uuid,text,timestamptz,text,text,timestamptz)',
    'execute') as writer_anon,
  has_function_privilege('service_role',
    'public.user_id_for_billing_customer(text)', 'execute') as lookup_service_role,
  has_function_privilege('authenticated',
    'public.user_id_for_billing_customer(text)', 'execute') as lookup_authenticated,
  has_function_privilege('authenticated',
    'public.analysis_allowance()', 'execute') as counter_authenticated,
  has_function_privilege('anon',
    'public.analysis_allowance()', 'execute') as counter_anon;
```

Expected, in order: `t f f t f t f`.

Any `true` in `writer_authenticated`, `writer_anon` or `lookup_authenticated`
means a player can write their own plan. Stop. Do not configure a key. Re-apply
the revoke and grant block at the bottom of `027_subscription_plan.sql` and run
this query again.

Columns and the plan constraint from 027:

```sql
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('plan', 'plan_renews_at', 'stripe_customer_id',
                      'stripe_subscription_id', 'last_billing_event_at')
order by column_name;

select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname = 'profiles_plan_check';
```

Expected: five rows, then one row reading
`CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text])))`.

The column grant that keeps entitlement out of player hands:

```sql
select string_agg(column_name, ', ' order by column_name) as players_may_update
from information_schema.column_privileges
where grantee = 'authenticated' and table_schema = 'public'
  and table_name = 'profiles' and privilege_type = 'UPDATE';
```

Expected: a short list of profile fields. It must not contain `plan`,
`plan_renews_at`, `stripe_customer_id`, `stripe_subscription_id` or
`last_billing_event_at`. If it does, that is the same stop condition as above.

Migration 028, the billing quota scope and the telemetry ceiling:

```sql
select
  (select pg_get_constraintdef(oid) from pg_constraint
     where conrelid = 'private.api_rate_limits'::regclass
       and conname = 'api_rate_limits_scope_check') as quota_scopes,
  (select conname from pg_constraint
     where conrelid = 'public.analyses'::regclass
       and conname = 'analyses_telemetry_bounds_check') as telemetry_bound;
```

Expected: `quota_scopes` contains `'billing'`, and `telemetry_bound` reads
`analyses_telemetry_bounds_check`. Without the `billing` scope both payment
routes answer 503 on every call, because `consume_api_quota` raises on an
unknown scope and the routes fail closed.

026, 027 and 028 are already applied to production. If any check above fails,
the fix is a **new** migration numbered 029 or higher. Do not edit an applied
file.

### 1.2 The product and price exist

Dashboard: Products, `Vollyio Pro` (`prod_UxvNH2y52Rmz5o`). Confirm the price
`price_1TxzWVJOFP4i3BqJ9th7pH9v` is active, $14.99 USD, recurring monthly,
lookup key `vollyio_pro_monthly`.

Once you hold the secret key (section 2), the exact check is:

```sh
curl -s https://api.stripe.com/v1/prices/price_1TxzWVJOFP4i3BqJ9th7pH9v \
  -u "$STRIPE_SECRET_KEY:"
```

Expected in the JSON: `"active": true`, `"livemode": true`,
`"currency": "usd"`, `"unit_amount": 1499`, `"recurring": {"interval": "month"`,
`"lookup_key": "vollyio_pro_monthly"`, `"product": "prod_UxvNH2y52Rmz5o"`.

Then confirm `STRIPE_PRICE_ID` in Vercel Production is exactly that price id.
Reveal it in the Vercel dashboard under Settings, Environment Variables. A stale
or archived price id does not fail at deploy time. It fails at the moment a
player presses upgrade, as a 502 and a `[billing] checkout returned 400` line in
the logs.

### 1.3 The webhook endpoint exists and is enabled

Dashboard: Developers, Webhooks, endpoint `we_1TxzXyJOFP4i3BqJ00R4qHTm`.

```sh
curl -s https://api.stripe.com/v1/webhook_endpoints/we_1TxzXyJOFP4i3BqJ00R4qHTm \
  -u "$STRIPE_SECRET_KEY:"
```

Expected: `"status": "enabled"`, `"url": "https://vollyio.com/api/stripe/webhook"`,
and `enabled_events` containing exactly `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`invoice.payment_failed`.

What a missing event costs you:

- `checkout.session.completed` missing: nobody ever becomes Pro, and no customer
  id is ever recorded, so the management page can never open either.
- `customer.subscription.updated` missing: `plan_renews_at` is never written, and
  a subscription that lapses to `unpaid` never downgrades.
- `customer.subscription.deleted` missing: cancelled players keep Pro forever.
- `invoice.payment_failed` missing: no behaviour change today. The handler is a
  deliberate no-op, because the provider retries a failed card for days and most
  retries succeed. Keep it subscribed anyway so the shape does not drift.

Extra events beyond the four are harmless. Anything unrecognised is answered
`200 {"received":true}` and nothing is written.

`STRIPE_WEBHOOK_SECRET` in Vercel must be **this endpoint's** signing secret. If
the secret was ever rotated at the provider without updating Vercel, every event
returns 400 and no plan is ever written. Section 4 catches this, but late.

### 1.4 The customer portal has a saved live configuration

Dashboard: Settings, Billing, Customer portal. Live mode has its own
configuration, separate from test mode, and it must be saved at least once.
Cancellation at period end on, payment method updates on, plan switching off
(there is only one plan).

Without a saved live configuration the portal API rejects the request and the
app answers `502 Couldn't open your plan settings. Try again.` That reads like an
outage and is actually an unsaved form.

### 1.5 The code is deployed

```sh
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Content-Type: application/json" -d '{}' \
  https://vollyio.com/api/stripe/webhook
```

Expected: `400`. That single number proves two things at once: the billing code
is in the running deployment, and it holds an endpoint secret.

- `500` means the route is deployed but `STRIPE_WEBHOOK_SECRET` is not in that
  deployment. It is failing closed, which is correct, but no event will ever
  apply.
- `404` means the billing code is not live. Deploy it before going further.

And the checkout route:

```sh
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://vollyio.com/api/stripe/checkout
```

Expected: `403`. No `Origin` header means no trusted origin, which is the
same-origin check working. A `404` here means the same thing as above.

Confirm which deployment is live and when it was built:

```sh
vercel ls vollyio
```

Note the age of the production deployment. You will compare it against the
environment variable timestamps in section 3.

---

## 2. The two secrets only you can supply

Nobody else can read either of these. They go to **Vercel Production only**, not
preview, not development.

### 2.1 The payment provider API key

Dashboard: Developers, API keys, live mode. Reveal the secret key (`sk_live_...`).

```sh
vercel env add STRIPE_SECRET_KEY production
```

The CLI prompts `What's the value of STRIPE_SECRET_KEY?`. Paste, press Enter.
Expected: `Added Environment Variable STRIPE_SECRET_KEY to Project vollyio`.

Do not pipe it in with `echo`, that writes the live key into your shell history.
Clear the terminal afterwards.

**What breaks without it:** `stripeConfigured()` in `lib/stripe.ts` requires the
key, the price and the endpoint secret together. Without the key it is false, so
no upgrade button renders at all. The plan card shows `Upgrading is not open yet.`
and a direct POST to `/api/stripe/checkout` answers 503. Nobody can pay. The
webhook is unaffected, it never reads this key.

Note: `docs/security.md` B0 says the gate reads the key and the price only. The
code now also requires the endpoint secret. The code is the authority.

### 2.2 The database service-role key

Supabase: project `tbbievneojaxkkjvcwjp`, Project Settings, API. Reveal the
`service_role` secret. This key bypasses row security on every table.

```sh
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

Expected: `Added Environment Variable SUPABASE_SERVICE_ROLE_KEY to Project vollyio`.

**What breaks without it:** `createServiceClient()` returns null, so the webhook
logs `[billing] service credentials unavailable; plan change not applied` and
returns 500. The provider retries for about three days and then gives up. Meanwhile
`profiles.plan` is never written: a player who has paid $14.99 sits on the free
allowance of 3, and because `stripe_customer_id` is also never recorded they
cannot even open the management page to cancel. This is the worst state in the
whole system and nothing in the app detects it.

Recovery if it happens: add the key, redeploy, then Stripe dashboard, Developers,
Events, find each failed delivery and press Resend. The plan writer is idempotent
and refuses to move a plan backwards on a stale event, so replaying is safe.

There must never be a `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`. That prefix is
what puts a value in the browser bundle.

### 2.3 Confirm both landed

```sh
vercel env ls production
```

Expected: both names listed, `Encrypted`, environment `Production`. Values are
never printed, which is the point.

### 2.4 Redeploy now, before the flip

This is a safe half step and worth taking. With the secrets present but
`BILLING_ENABLED` still unset, nothing changes for any player: the plan card
still reads `Monthly limits are not switched on yet, so nothing is counting
against you.`, and the upgrade button still does not render, because the card
requires metering to be on before it will show an offer. Redeploy (section 3.2
has the command), then re-run the 1.5 probe and confirm `400`.

You have now proved the secrets are installed without exposing a purchase.

---

## 3. The flip

### 3.1 Set the flag

```sh
vercel env add BILLING_ENABLED production
```

Value: exactly `true`, lowercase. `lib/billing.ts` compares against the string
`"true"` and anything else, including `True` or `1`, reads as off.

Expected: `Added Environment Variable BILLING_ENABLED to Project vollyio`.

`NEXT_PUBLIC_UPGRADE_URL` is the second key and is already set to
`https://vollyio.com/settings#plan`. Both are required. Setting the flag alone
would cap free accounts at 3 a month with nowhere to go, and the code refuses
that combination on purpose.

### 3.2 Then redeploy

```sh
vercel ls vollyio
vercel redeploy <the production deployment url from the line above>
```

Prefer `vercel redeploy` over `vercel deploy --prod`. It rebuilds exactly the
code that is already live rather than shipping whatever is in your working tree.
If you have no CLI, the Vercel dashboard has a Redeploy button on the production
deployment.

### 3.3 Why this order and not the other one

Environment variables bind to a deployment when that deployment is built. The
deployment already serving traffic keeps the environment it was built with, so
adding a variable changes nothing until a new deployment is created.
`NEXT_PUBLIC_UPGRADE_URL` is stronger still: it is compiled into the client
bundle in `components/analyze-flow.tsx`, so it can only ever change at build
time.

Redeploy first and then set the flag and you get a deployment without the flag,
plus a variable nothing reads. The site behaves exactly as if the flip failed,
and the obvious next move is to redeploy, which is the step you should have taken
first. You lose the time, not the data.

### 3.4 Confirm the flip took

Sign in and open `https://vollyio.com/settings#plan`. On a free account expect:

- `3 analyses a month.`
- a counter reading `N of 3 left this month`
- an `Upgrade to Pro` button

The dashboard and `/analyze` show the same remaining count. If the card still
reads `Monthly limits are not switched on yet`, the deployment predates the
variable. Compare the deployment time from `vercel ls vollyio` against when you
added the flag, and redeploy.

### 3.5 Timing: the flip is retroactive within the month

The allowance counts rows in `analyses` since the start of the current UTC
calendar month, including every analysis run while enforcement was off. A player
who has already run 9 this month is exhausted the instant the flip lands, and
sees a 402 until the 1st.

Flip on the 1st of a UTC month if you can. If you cannot, run this first to see
who you are about to lock out:

```sql
select count(*) as accounts_over_free_allowance
from (
  select a.user_id, count(*) as used
  from public.analyses a
  where a.created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc')
  group by a.user_id
) t
join public.profiles p on p.id = t.user_id
where t.used >= public.plan_monthly_allowance(p.plan);
```

Expected on a quiet month: `0`. Any other number is people who will hit a paywall
mid-session, and it is not a number you can undo by switching back off.

---

## 4. Verification, end to end, with a real card

Live mode, your own card, your own account. Roughly ten minutes plus one $14.99
charge you can refund afterwards.

Get your user id once and reuse it:

```sql
select id from auth.users where email = 'your@email.address';
```

### 4.1 Baseline

```sql
select plan, plan_renews_at, stripe_customer_id, stripe_subscription_id,
       last_billing_event_at
from public.profiles where id = '<your-uuid>';
```

Expected: `free`, and the other four null. If `plan` is already `pro`, checkout
answers `409 You're already on Pro.` and you cannot run this test on this
account.

### 4.2 Upgrade

On `/settings#plan` press `Upgrade to Pro`. The button POSTs, gets back a URL,
and navigates. Pay. You land back on
`https://vollyio.com/settings?checkout=complete#plan`.

Honest note: nothing reads that `checkout=complete` marker today. The card is
simply re-rendered, and if the webhook has not landed in the second or two since
payment it still says Free. Reload once before concluding anything.

### 4.3 The plan flipped, and only the webhook flipped it

```sql
select plan, plan_renews_at, stripe_customer_id, stripe_subscription_id,
       last_billing_event_at
from public.profiles where id = '<your-uuid>';
```

Expected: `plan` = `pro`; `stripe_customer_id` = `cus_...`;
`stripe_subscription_id` = `sub_...`; `last_billing_event_at` within the last
minute; **`plan_renews_at` still null**.

That null is correct, not a fault. `checkout.session.completed` carries a session
expiry, not a billing period, so `lib/billing-events.ts` deliberately writes no
renewal date from it. The date arrives with the first
`customer.subscription.updated` event, which for a brand new subscription is
usually the cancellation in 4.6 or the first monthly renewal. Nothing in the UI
renders `plan_renews_at` today, so a null there is invisible to players.

If `plan` is still `free` after a minute, go to Stripe, Developers, Events, open
the `checkout.session.completed` event and read the delivery response:

- `400` : the signing secret in Vercel does not match this endpoint. Fix
  `STRIPE_WEBHOOK_SECRET`, redeploy, resend the event.
- `500` : missing `SUPABASE_SERVICE_ROLE_KEY`, or the plan write failed. Check
  Vercel logs for `[billing] plan write failed`. Fix, redeploy, resend.
- `200` with the plan still free: no profile matched. Look for
  `[billing] no profile matches the event customer; ignored` in the logs.

### 4.4 The counter reads 18

In the UI, `/settings#plan` should now read `Pro`, `18 analyses a month.` and
`18 of 18 left this month` (fewer if you already ran some this month, which is
the retroactive counting from 3.5 working as designed).

In SQL:

```sql
select p.plan,
       public.plan_monthly_allowance(p.plan) as allowance,
       (select count(*) from public.analyses a
         where a.user_id = p.id
           and a.created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc')
       ) as used_this_month
from public.profiles p
where p.id = '<your-uuid>';
```

Expected: `pro | 18 | <however many you have run>`.

You cannot call `analysis_allowance()` from the SQL editor. It derives
`auth.uid()`, which is null there, and raises `authentication required`. That is
the function protecting itself. The query above is the same arithmetic run
explicitly.

### 4.5 The portal opens

Press `Manage plan`. Expected: the provider's hosted management page, showing the
$14.99 per month subscription with a cancel option.

- `409 There's nothing to manage yet. Upgrade to Pro first.` means
  `stripe_customer_id` is null, which means the webhook never landed. Go back to
  4.3.
- `502 Couldn't open your plan settings. Try again.` is almost always precondition
  1.4, an unsaved live portal configuration. Confirm with
  `[portal] session creation failed` in the Vercel logs.
- `429 Too many attempts.` means you pressed the two billing buttons more than 10
  times in an hour. That is the `billing` quota from migration 028. Wait it out.

### 4.6 Cancel, and confirm access holds

In the portal, cancel **at the end of the billing period**, not immediately. This
is the step that proves the product does not take away time somebody paid for.

Within seconds the provider sends `customer.subscription.updated` with status
still `active` and `cancel_at_period_end` true.

```sql
select plan, plan_renews_at, stripe_subscription_id, last_billing_event_at
from public.profiles where id = '<your-uuid>';
```

Expected: `plan` is **still `pro`**, and `plan_renews_at` is now set, to the end
of the period you paid for. Re-run the 4.4 query and confirm the allowance is
still 18, and that the plan card still shows Pro with `Manage plan`.

If `plan` flipped to `free` the moment you clicked cancel, stop and treat it as a
defect. The mapping reads subscription status, never the cancel flag, precisely so
this cannot happen. A player being cut off for days they already bought is a
refund conversation and a support conversation at the same time.

### 4.7 Finish the loop

Either wait for the period to end, or force it: in the Stripe dashboard open the
subscription and cancel immediately. Either way the provider sends
`customer.subscription.deleted`.

```sql
select plan, plan_renews_at, last_billing_event_at
from public.profiles where id = '<your-uuid>';
```

Expected: `free`, `plan_renews_at` null, `last_billing_event_at` updated. The
plan card returns to the free copy and the counter reads out of 3.

Refund your own charge from the payment page in the dashboard if you want the
money back. The refund is a provider-side record and touches nothing in the
database.

---

## 5. Rollback

```sh
vercel env rm BILLING_ENABLED production --yes
vercel ls vollyio
vercel redeploy <the production deployment url>
```

Expected: `Removed Environment Variable BILLING_ENABLED from Project vollyio`,
then a new production deployment. Without the redeploy nothing changes, for the
same reason as 3.3.

**What this undoes, on the new deployment, immediately:**

- The analyze route stops enforcing anything. Every account is unlimited again
  and no 402 can be returned.
- `POST /api/stripe/checkout` answers 503. No new subscription can start.
- The remaining-count line disappears from the dashboard, the analyze page and
  the plan card, and the card goes back to `Monthly limits are not switched on
  yet`.

**What this does not undo:**

- Money already taken. Refunds are a separate action at the provider.
- Subscriptions already created. They keep charging $14.99 every month until they
  are cancelled at the provider, one at a time. The flag lives in your app; the
  recurring charge lives at the provider. **Rollback is not refund.**
- `profiles.plan` rows already written. Anyone the webhook made `pro` stays `pro`,
  with their renewal date and customer id intact. Nothing resets them.
- The webhook. It keeps running and keeps writing plans, deliberately: it does
  not read `BILLING_ENABLED`, because events for subscriptions that already exist
  must keep landing or the database drifts away from what the provider believes.
- The `Manage plan` button. It stays on the plan card for anyone on `pro`, even
  with metering off, because somebody who is paying always gets a way to stop
  paying.

**Leave `STRIPE_SECRET_KEY` in place during a rollback.** Removing it makes
`stripeConfigured()` false, which turns that button into `Plan changes are not
available right now. Nothing about your plan has changed.` and strands paying
players with no self-service cancel while they are still being charged.

If the goal is to stop the money rather than stop the metering, do it at the
provider: Subscriptions, cancel each active one, then refund what you owe. Only
after the last subscription is cancelled is it safe to remove the keys.

---

## 6. The one-way doors

Things no environment variable can take back.

1. **Charges.** A live charge is real money that has moved. Only a refund
   reverses it, and the refund is its own record on the customer's statement.
2. **Subscriptions.** A subscription renews until somebody cancels it at the
   provider. There is no app-side switch for this and there should not be one.
3. **Plan rows already written.** `plan`, `plan_renews_at`,
   `stripe_customer_id`, `stripe_subscription_id` persist. The only writer is
   `set_subscription_plan`, granted to `service_role` alone, so undoing them by
   hand means running the service-role key against production, which is
   deliberately hard and should be a last resort.
4. **This month's counted analyses.** The count is rows in `analyses` since the
   start of the UTC month. Flipping on makes every row already written that month
   count, and flipping back off does not give the month back to anyone who hit
   the wall. Only the 1st of the next UTC month clears it.
5. **The live price.** A price that has been used can be archived but not
   deleted, and archiving does not move existing subscribers off it.
6. **The webhook endpoint.** It keeps delivering to production whatever your app
   flag says. Disabling it at the provider while subscriptions are live means
   cancellations stop being recorded, so cancelled players silently keep Pro.
7. **Provider email.** Receipts, invoices and failed-payment notices are sent by
   the provider the moment the event happens. There is no unsend.
8. **The schema.** Migrations 026, 027 and 028 are applied. They changed the free
   rule from lifetime-one to 3 per month in the database itself, independent of
   the flag, and 027 revoked and re-granted the plan writer. Changing any of it
   needs a new migration, 029 or higher. Never edit an applied file.

Item 4 is the one that surprises people, and item 2 is the one that costs money.

---

## Appendix: symptom to cause

| Symptom | Most likely cause | Check | Fix |
|---|---|---|---|
| Card still says limits are not switched on | The running deployment predates `BILLING_ENABLED` | `vercel ls vollyio` against the env timestamp | Redeploy |
| Card says `Upgrading is not open yet.` | `stripeConfigured()` false: key, price or endpoint secret missing from that deployment | `vercel env ls production` | Add the missing one, redeploy |
| `Couldn't start the upgrade. Try again.` (502) | Provider rejected the session: wrong or archived price id, or a test key against live objects | Logs, `[billing] checkout returned 4xx` | Correct the value, redeploy |
| `Upgrades aren't available right now.` (503) | `shouldEnforceFreeTier()` or `stripeConfigured()` false in that deployment | Section 3.4 | Redeploy, or add the missing variable |
| Paid, still on free | Webhook not landing | Provider Events, delivery response | 400 wrong signing secret, 500 missing service-role key, 200 means no profile matched |
| `There's nothing to manage yet.` (409) | `stripe_customer_id` null | 4.3 query | Fix the webhook, resend the checkout event |
| `Couldn't open your plan settings.` (502) | Live portal configuration never saved | Precondition 1.4 | Save the portal configuration |
| `429` on either billing button | 10 per hour `billing` quota, migration 028 | Nothing to fix | Wait an hour |
| 402 immediately after the flip | Retroactive counting within the month | Section 3.5 query | Nothing undoes it; the month rolls on the 1st |
| Webhook probe returns 500 | `STRIPE_WEBHOOK_SECRET` absent from the deployment | Precondition 1.5 | Add it, redeploy |
| Webhook probe returns 404 | Billing code not in the live deployment | `vercel ls vollyio` | Deploy the current code |
