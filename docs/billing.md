# Billing, plans, and analysis allowances

Status: **built and LIVE** (D-078, corrected 2026-07-31; the "switched off"
this header used to claim ended when a real card was charged on 2026-07-31 and
the webhook applied the plan). The code path is complete end to end, from the
allowance in the database to the plan card, the checkout and portal routes, the
signed webhook, and the 402 the client renders as a calm state. In production
today: `BILLING_ENABLED=true`, `ENFORCE_FREE_CAP=true`, all three provider
values set, and the live product, price, and webhook endpoint exist
(`docs/deploy.md` records the full environment). Metering is on, the upgrade
button renders, and money moves.

The decisions behind this design are D-064; the arming sequence that was
followed is `docs/deploy.md` "Billing rollout" plus the verification steps in
`docs/security.md`.

## 0. Two switches (D-066)

Selling Pro and capping the free tier are separate decisions, and separate
variables:

    BILLING_ENABLED    the purchase path exists. Pro becomes buyable.
    ENFORCE_FREE_CAP   the monthly allowance actually refuses a rep.

The launch posture as originally recorded was `BILLING_ENABLED` on and
`ENFORCE_FREE_CAP` off: an open product where Pro is a choice. That window has
closed: **production today runs both flags on** (D-076/D-077, `docs/deploy.md`),
so the monthly allowance genuinely refuses a rep and Pro genuinely buys
capacity. The two variables stay separate because they are separate decisions,
and turning the cap back off remains a one-variable change.

While the cap was off, Pro did not buy more analyses, because free was
unlimited; the plan card said exactly that. The copy discipline survives the
flip: every surface describes the allowance from the same predicates, so what
the card promises is always what the reservation enforces.

Enforcement still requires a payment path: `shouldEnforceFreeTier()` is all
three of the cap flag, the billing flag and an upgrade destination, so a cap can
never engage in a configuration where a player could not buy past it.

## 1. The model

> **Rewritten 2026-08-11.** Every number in this section was stale, and the
> derivations resting on them were wrong by more than an order of magnitude. The
> price was three versions old ($9.99, superseded by D-107), the quota was two
> versions old (24 a month, superseded by the daily wall of D-110), and the
> per-analysis cost was **$0.234 against a measured $0.0164**, which is 14x. A
> margin computed from a 14x cost error is not a conservative estimate, it is a
> different business. `lib/plans.ts` and the newest migration defining
> `plan_daily_allowance` are the authority; this file quotes them.

| Tier | Price | Analyses | Where it is managed |
|---|---|---|---|
| Free | $0 | 3 at signup, once, then 3 completed analyses per day | nothing to manage |
| Pro | $29.99/mo | 18 completed analyses per day | Settings, plan card |

The full ladder is four SKUs, not two (D-107): Free, a **$9.99 non-renewing
week**, **$29.99 a month**, and a **$19.99 downsell** offered on dismiss. The
ladder must stay monotonic. Only the two rows above are allowances; the week
pass buys Pro's rate for seven days and does not renew.

- **Free is two numbers and has to be described as both** (D-076, migration
  040). The 3 are a one-time grant spent against LIFETIME rows in `analyses`,
  not a daily figure: three completed analyses close it permanently, whichever
  days they land in. `signup_grant()` holds the grant, `plan_daily_allowance()`
  holds the rate, and `allowanceSentence()` in `lib/plans.ts` is the single
  place the sentence is built, so no surface can quote half of it.
- **The day is the wall, and the monthly numbers are not a second policy**
  (D-110, migrations 057 through 059). `MONTHLY_ALLOWANCE` is exactly 30x the
  daily rate, 90 free and 540 Pro, and exists only so the two cannot disagree:
  a player who spends their day rate every day must never then meet a monthly
  refusal nobody warned them about. `lib/plans.test.ts` pins the 30x.
- The window is the **UTC calendar month** for free accounts. For a
  subscriber it is the **billing period the provider reports** (D-067,
  migration 035; start read rather than derived since D-086, migration 049):
  `plan_period_start` to `plan_renews_at`, so "resets" means the anniversary,
  not the 1st. A free account's answer to "how many do I have left" still
  never depends on Stripe being reachable; a subscriber's window follows the
  subscription that pays for it.
- **No top-up packs, no credit purchases.** Out of analyses means wait for the
  reset or, for a free player, upgrade. Selling analyses by the pack would
  anchor the plan price against a marginal cost of roughly 19 cents and turn
  every subscription decision into arithmetic.
- Settings holds exactly two actions: upgrade to Pro, and cancel Pro. There is
  no separate upgrade tab.

Economics at these numbers, measured rather than derived. **A completed analysis
costs $0.0164** (D-106), read from `analyses.telemetry` in production rather
than estimated. **Output is roughly 70% of that cost**, which is why the lever
on unit cost is response length and not input size. The $0.234 this section
carried until 2026-08-11 came from a 12-row sample under a different model on a
different path, and every margin figure that rested on it was wrong by 14x in
the flattering direction.

At $0.0164 and Stripe's 2.9% plus 30 cents:

| | Per month |
|---|---|
| Pro charge | $29.99 |
| Net of processing | $28.82 |
| Cost at FULL use, 540 analyses | $8.86 |
| Clears | **$19.96, about 69% gross margin** |

Full utilization is the worst case, not the norm. Nobody has yet run 18 a day
for 30 days. At half use the same subscription clears $24.39.

A fully-used free account costs about **$1.48** a month, 90 analyses at
$0.0164. One Pro subscriber at full use therefore carries roughly **13 fully
used free accounts**, and far more in practice because a free account that
finishes its 3-a-day every day for a month does not exist yet either. The
one-time grant costs about **$0.05** per account.

**These are gross margins on inference only.** They do not carry the prepaid
inference balance, which is the constraint that actually binds: one balance
serves four surfaces, the app cannot read it, and per-account quotas bound a
single player and never the aggregate. Section 6 is about the accounts that
never convert; the spend backstop in section 5 is about the wall none of this
arithmetic can see.

**Coach is untiered and is the largest line on a free account.** 30 a day for
everyone regardless of plan, about $0.54 a month against $0.30 of analysis.
Tiering `coach_daily` to 5 or 10 a day is proposed and undecided.

## 2. Three separate walls. Do not merge them.

1. **Per-user monthly allowance** (this document). Lives in
   `reserve_analysis_entitlement`. Answers "has this player used their share."
2. **Platform spend backstop** (D-054, `lib/ai/budget.ts`). One dollar ceiling
   across every user, so a runaway month degrades the app to a calm 503 instead
   of killing it the way 2026-07-20 did. It is **not** a per-user counter and
   must never become one, or one player's exhaustion becomes everyone's outage.
   Unchanged by this work except for the alert in section 5.
3. **Abuse quota** (migration 011 plus the insert trigger). 20 per hour,
   atomic. Unchanged. It stops scripts, not spending.

## 3. What already exists and what is missing

Written before the build. Every item below is now closed except the provider
account objects, which are owner work rather than code. The markers say how.

Built and atomic since D-012, needed one behavior change:

- **Done, migration 026.** `reserve_analysis_entitlement(p_enforce_free)`
  (migration 011) refused a `free` plan if **any** analysis row existed, that
  is lifetime-one. It now resolves the caller's plan to an allowance and
  compares against their completed analyses inside the current UTC month. The
  advisory lock and the five-minute reservation are unchanged.
- **Unchanged, as intended.** `lib/billing.ts` deliberately refuses to enforce
  the free cap unless `BILLING_ENABLED=true` **and** an upgrade destination
  exists. Pointing `NEXT_PUBLIC_UPGRADE_URL` at the Settings plan card
  satisfies it honestly. Keep the predicate; do not bypass it.

Was missing entirely:

- **Done, migration 027.** A writer for `profiles.plan`. Migration 012 revoked
  it from the authenticated role and there was no server-side setter, so
  nothing in the codebase could make anyone a paying customer. There is now
  exactly one writer, `set_subscription_plan`, granted to `service_role` only
  and called only by the signed webhook.
- **Code done, account objects still missing.** Checkout, webhook, and portal
  routes exist and are tested. No product, price, webhook endpoint, or key
  exists in the provider account, so `stripeConfigured()` is false and every
  paid path answers 503 by design. See 4.3.
- **Done.** The remaining-count surface on the dashboard and the analyze page,
  reading `analysis_allowance()`.
- **Done.** The 402 reason code and the client routing that reads it. See 4.5.

## 4. Build order

### 4.1 Migration 026, the allowance

**Built and applied to production**, plus `analysis_allowance()` for the read
that 4.6 needs and `private.allowance_window()` so the month boundary is
derived from the server clock and can never be supplied by a caller.

```
plan_monthly_allowance(p_plan text) returns int   -- 'pro' -> 24, else 1
```

Rewrite `reserve_analysis_entitlement` so that, when enforcing:

1. Read `profiles.plan` (unchanged, still under the advisory lock).
2. Count `analyses` for the caller where
   `created_at >= date_trunc('month', now() at time zone 'utc')`.
3. If the count is at or above the allowance, return
   `{allowed:false, reason:'month_exhausted'}`.

`lib/entitlements.ts` widens its reason union to include `month_exhausted`, and
`lib/security-contract.test.ts` gains a pin so the allowance numbers in SQL and
in TypeScript cannot drift apart.

**Counting rule: completed analyses only.** The count reads rows in `analyses`,
and a row is only ever inserted after the coaching call returned and parsed. A
clip that fails, times out, or hits a capacity outage costs the player nothing
and needs no refund path. This falls out of the existing design rather than
being bolted on, and it must stay that way: never count attempts, reservations,
or requests.

### 4.2 Migration 027, the plan writer

**Built.** Shipped with two more arguments than specified here, because the
webhook has to record which subscription and which customer a plan came from
or later events cannot be matched back to a player:

```
set_subscription_plan(p_user_id uuid, p_plan text, p_renews_at timestamptz,
                      p_subscription_id text, p_customer_id text,
                      p_event_at timestamptz, p_period_start timestamptz)
user_id_for_billing_customer(p_customer_id text) returns uuid
```

Two arguments grew in later migrations and this snippet records the shipped
shape: `p_event_at` is the out-of-order guard (delivery is unordered, and a
stale "still active" event must not restore a cancelled subscription), and
`p_period_start` is the provider-reported window start (D-086, migration 049;
seven arguments total since then). The checkout events pass their dates
through the webhook's preserve step first, so their nulls can never blank an
anchor a same-burst subscription event already stored (D-090).

Both are `service_role` only. The migration also adds
`profiles.stripe_subscription_id` and a check constraint bounding `plan` to
`free` or `pro`, so an unrecognized plan fails loudly rather than falling
through to the free allowance. Applied to production.

`security definer`, `search_path = ''`, revoked from `public`, `anon`, and
`authenticated`, granted to `service_role` only. The webhook is the sole
caller. Adds `profiles.plan_renews_at`; `stripe_customer_id` already exists.

This is the first thing in the codebase to need the service-role key. It lives
in the webhook route's environment and nowhere else, and it never reaches a
client bundle. That held: `lib/supabase/service.ts` is the only module that
reads it, the webhook route is its only importer, and `docs/security.md` now
records the rule that a second importer is a security change rather than a
refactor.

### 4.3 The provider account objects

**Built, in the provider dashboard.** The product (`prod_UxvNH2y52Rmz5o`), the
$9.99 price, and the webhook endpoint all exist and the keys are set in
production (`docs/deploy.md` records the objects and the environment). The list
below stands as the record of what was created and why.

Account `acct_1NMwN5JOFP4i3BqJ`, display name Vollyio. It previously held only
dormant products from another business. Created for this app:

- **Product** `Vollyio Pro`, type service, metadata `plan=pro`,
  `monthly_analyses=18`. Stale since D-085: the dashboard metadata still says
  18 while the product sells 24; update it on the next console visit. Metadata
  is display-only and decides nothing.
- **Price** $9.99 USD, recurring monthly, lookup key `vollyio_pro_monthly`.
  Live object is `price_1TzKG5JOFP4i3BqJC2z0xklp` (D-077). The superseded $14.99
  price `price_1TxzWVJOFP4i3BqJ9th7pH9v` is deliberately left ACTIVE: a live
  subscription is attached to it, and archiving a price does not migrate the
  subscriptions on it, it only stops new checkouts. **Prices are immutable in
  Stripe, so a price change is always a NEW object plus a lookup-key transfer,
  never an edit.**
- Optional and recommended later, not v1: $99/yr, lookup key
  `vollyio_pro_annual`, which is where a 30-day trial belongs if one ships.
- **Customer portal**: allow cancellation at period end, allow payment method
  updates, disable plan switching (there is only one plan).
- **Webhook** to `POST /api/stripe/webhook`, subscribing to
  `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_failed`.

Environment, corrected to the names the built code actually reads. Everything
here is server-only except the last one, which is client-visible by definition
and is the only billing value that may be:

```
STRIPE_SECRET_KEY            the API key
STRIPE_WEBHOOK_SECRET        the endpoint signing secret
STRIPE_PRICE_ID              the recurring price to charge
SUPABASE_SERVICE_ROLE_KEY    so the webhook can call the plan writer
NEXT_PUBLIC_UPGRADE_URL=https://vollyio.com/settings#plan
```

This document previously named the price `NEXT_PUBLIC_STRIPE_PRICE_ID`. It is
`STRIPE_PRICE_ID` and server-only. The price is not a secret, but the browser
has no use for it, and a client-visible price id is the shape of the bug where
the caller gets to say what to charge. Provisioning from the old name leaves
`stripeConfigured()` false forever, which fails closed and silently: no upgrade
button, a 503 on any direct call, and nothing in the logs distinguishing that
from billing simply not being switched on yet.

**Built, on the app side.** The webhook verifies the signature over the raw
bytes before parsing the body, is the only route allowed to skip the
same-origin check (the provider is not same-origin, and `docs/security.md`
records why the HMAC is the stronger substitute rather than a weaker one), and
maps `customer.subscription.deleted` to `plan='free'` at period end, not on the
cancel click. A cancelled player keeps Pro until the period they paid for runs
out.

### 4.4 Settings plan card

**Built,** as `components/plan-card.tsx` carrying the `#plan` anchor every
return URL points at. It has four states rather than two, because the two
written here both assume metering is on and a provider is reachable, and
neither is true today: a not-metered state that names the plan and says limits
are not switched on, and a provider-unavailable state that says so plainly
instead of offering a button that would 503.

One card, one of the two live states:

- **Free:** "3 analyses a month. You've used 2." plus an upgrade button that
  opens Stripe Checkout.
- **Pro:** "24 analyses a month. You've used 7. Resets on your renewal date." plus a link into
  the Stripe customer portal for cancel and payment method.

### 4.5 The 402 contract

**Built.** Both buttons POST and then navigate to the returned URL, because a
management or checkout link is minted per request and cannot be an `<a href>`.

The route returns `402` with `{error, reason, resets_at}` where reason is
`free_month_exhausted` or `plan_month_exhausted`. `analyzeFailureStatus` reads
the reason and produces the calm state, never the coral error state, because
running out is not a failure. Free routes to the Settings plan card; Pro shows
the reset date and nothing to buy. Do not HTTP-redirect a `fetch`.

### 4.6 Show the count before the upload, not after

**Built,** on both surfaces plus the plan card, reading `analysis_allowance()`
(migration 026). The line renders only when the cap is genuinely enforced, so
the read is not even issued in a build where nothing is metered, and a read
that fails renders nothing rather than a wrong number.

The dashboard and the analyze page both show remaining analyses. A player who
films, uploads, marks a player, waits, and only then learns they are out has
been made to do 90 seconds of work for a paywall. `/api/usage` cannot serve
this (it is dev-only owner spend reporting), so this is a small new per-user
read.

## 4A. Payment methods: a dashboard decision, not a code one

`buildCheckoutBody` deliberately does NOT set `payment_method_types`. Omitting it
means the hosted checkout page uses the account's automatic payment methods
configuration, so which methods a player sees is a toggle in the provider
dashboard and enabling one never needs a deploy. Pinning a list here would mean
a code change every time we wanted to accept something new, and would silently
exclude anything the list forgot.

What that gives us today:

| Method | How it appears | Notes |
|---|---|---|
| Card | Always | The baseline every other wallet rides on. |
| Apple Pay | Automatically, on a supporting device | Not a separate method. It is a card in a wallet, so enabling card enables it. Hosted checkout is served from the provider's own domain, so the domain-verification step that self-hosted payment forms need does not apply. |
| Google Pay | Automatically, on a supporting browser | Same as above. |
| Link | Automatically when enabled | The provider's own saved-payment wallet. Supports subscriptions. |
| Cash App Pay | Only after enabling it in the dashboard | Worth enabling for this audience. Confirm in the dashboard that it is active for recurring, not only one-time. |
| Bank debit | Only after enabling it in the dashboard | Delayed settlement. Read section 4B before switching it on. |

Nobody can enable these from code, and the API surface available to this repo
does not expose the account's active set, so the enabled list must be read from
the dashboard rather than inferred from here.

## 4B. Delayed settlement, and why the async events exist

A card settles while the player is still on the page. A bank debit, and some
wallets and redirects, do not: the session closes, the player believes they have
paid, and the money confirms minutes or days later.

That is why `planChangeFromEvent` grants on `payment_status` rather than on the
event name, and why the endpoint subscribes to all three checkout outcomes:

    checkout.session.completed                 the player finished the page
    checkout.session.async_payment_succeeded   the money actually arrived
    checkout.session.async_payment_failed      it never did

One rule covers all three: grant if and only if the session says the money
settled. `completed` with `payment_status: unpaid` grants nothing, which is what
stops a bank debit handing out a month of Pro before it clears. The success
event is the other half of that decision, and without it a player who paid by a
delayed method would sit on Free until some later subscription event happened to
land.

The useful property of keying on `payment_status` rather than on the event type:
a method nobody here has ever tested behaves correctly the first time someone
uses it. Since the enabled set is a dashboard toggle, that is the only way this
stays true.

## 5. The owner alert

**NOT BUILT, and the half that used to exist is gone.** This section described a
spend-backstop alert as firing. It did not fire, and it could not: D-104 deleted
`lib/ai/budget.ts` on 2026-08-06, which was the only thing that ever called it,
and `lib/owner-alert.ts` sat orphaned from that day until it was archived on
2026-08-11 to `archive/owner-alert-d102/`. Do not read the paragraph below as a
description of the system; it is a specification for something that has never
run.

**Nothing currently warns the owner about spend.** The prepaid model balance is
the wall that actually binds, one balance serves four surfaces, and **the app
cannot read it**. Per-account quotas bound one player and never the aggregate.
The first signal of exhaustion will be every analysis failing at once.

If it is rebuilt: fire when the provider reports credits exhausted, through the
Resend path (`lib/email.ts`). Fire **once per trip**, claimed in a ROW the way
`welcome_email_sent_at` claims the welcome mail, not in process memory, because
a serverless deployment gives every instance its own copy of the claim and the
archived module's own comment records that as its known limit. Players continue
to see the calm "temporarily out of capacity, your clip wasn't counted" 503.

No user-facing "you're out of analyses" email in v1. They find out in the app,
at the moment it matters.

## 6. The free-tier exposure, and the owner's call on it

A monthly-resetting free tier plus unrestricted signup is a metered coaching
API. Signup today has no captcha, no managed bot protection, no hosting
firewall, and leaked-password protection is off (`docs/security.md` section on
public endpoints; HANDOFF open item 8). Lifetime-one is currently what makes
that safe, because a farmed account is worth exactly one analysis.

At 3 a month, a farmed account is worth 3 a month forever. Five hundred
scripted accounts is roughly $285 a month of coaching spend, recurring.

The owner's position, recorded: the friction of needing a fresh inbox each time
and losing a single unified history is enough to keep ordinary players honest.
That is right, and it is the case that matters for conversion. It is not
friction for a script, which wants neither the history nor the account.

So this is a recommendation, not a blocker: turn on managed bot protection and
the hosting firewall rules alongside the monthly reset. They are already wanted
before any public marketing push (`docs/security.md`), so the work is not new,
only earlier. If it slips, watch signups per day and analyses per account for
the first month, because the failure mode is quiet.

## 7. Open questions

- Annual price at $99 with a 30-day trial: yes or no. Not required for v1.
- A player who cancels mid-month drops to 3 at period end, and their Pro-era
  analyses that month already count against that 3. Acceptable, but it should
  be stated in the cancel confirmation rather than discovered.
- Whether an unused month rolls over. Recommendation: no. Rollover is a credit
  balance wearing a different hat, and section 1 rejected credit balances.
