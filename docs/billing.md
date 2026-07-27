# Billing, plans, and analysis allowances

Status: **planned, not built.** Nothing in this file is live. `BILLING_ENABLED`
is unset, `NEXT_PUBLIC_UPGRADE_URL` is unset, and no Stripe object exists for
Vollyio yet. This is the spec the build follows, so the numbers and the failure
behavior are settled before any money moves.

## 1. The model

| Tier | Price | Analyses | Where it is managed |
|---|---|---|---|
| Free | $0 | 3 completed analyses per calendar month | nothing to manage |
| Pro | $14.99/mo | 18 completed analyses per calendar month | Settings, plan card |

- The window is the **UTC calendar month**, resetting on the 1st, not the
  subscription anniversary. It matches `analyze_usage_month()` and it means the
  answer to "how many do I have left" never depends on Stripe being reachable.
- **No top-up packs, no credit purchases.** Out of analyses means wait for the
  reset or, for a free player, upgrade. Selling analyses by the pack would
  anchor the plan price against a marginal cost of roughly 19 cents and turn
  every subscription decision into arithmetic.
- Settings holds exactly two actions: upgrade to Pro, and cancel Pro. There is
  no separate upgrade tab.

Economics at these numbers: measured cost is about $0.15 to $0.20 per analysis
(`docs/post-cap-validation.md`). Pro at 18 costs about $3.42 against $14.99,
roughly 77% gross margin. A free account costs up to about $0.57 a month and
returns nothing, which is what section 6 is about.

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

Built and atomic since D-012, needs one behavior change:

- `reserve_analysis_entitlement(p_enforce_free)` (migration 011) currently
  refuses a `free` plan if **any** analysis row exists, that is lifetime-one.
  It must instead resolve the caller's plan to an allowance and compare against
  their completed analyses inside the current UTC month. The advisory lock and
  the five-minute reservation stay exactly as they are.
- `lib/billing.ts` deliberately refuses to enforce the free cap unless
  `BILLING_ENABLED=true` **and** an upgrade destination exists. Pointing
  `NEXT_PUBLIC_UPGRADE_URL` at the Settings plan card satisfies it honestly.
  Keep the predicate; do not bypass it.

Missing entirely:

- **A writer for `profiles.plan`.** Migration 012 revoked it from the
  authenticated role and there is no server-side setter, so today nothing in
  the codebase can make anyone a paying customer. This is the real gap.
- Stripe: no products, no prices, no checkout, no webhook, no portal.
- The remaining-count surface on the dashboard and the analyze page.
- The 402 reason code and the client routing that reads it.

## 4. Build order

### 4.1 Migration 026, the allowance

```
plan_monthly_allowance(p_plan text) returns int   -- 'pro' -> 18, else 3
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

```
set_subscription_plan(p_user_id uuid, p_plan text, p_renews_at timestamptz)
```

`security definer`, `search_path = ''`, revoked from `public`, `anon`, and
`authenticated`, granted to `service_role` only. The webhook is the sole
caller. Adds `profiles.plan_renews_at`; `stripe_customer_id` already exists.

This is the first thing in the codebase to need the service-role key. It lives
in the webhook route's environment and nowhere else, and it never reaches a
client bundle.

### 4.3 Stripe objects

Account `acct_1NMwN5JOFP4i3BqJ`, display name Vollyio. It currently holds only
dormant products from a previous business, nothing for this app. Create:

- **Product** `Vollyio Pro`, type service, metadata `plan=pro`,
  `monthly_analyses=18`.
- **Price** $14.99 USD, recurring monthly, lookup key `vollyio_pro_monthly`.
- Optional and recommended later, not v1: $99/yr, lookup key
  `vollyio_pro_annual`, which is where a 30-day trial belongs if one ships.
- **Customer portal**: allow cancellation at period end, allow payment method
  updates, disable plan switching (there is only one plan).
- **Webhook** to `POST /api/stripe/webhook`, subscribing to
  `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_failed`.

Environment: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`NEXT_PUBLIC_STRIPE_PRICE_ID`, and
`NEXT_PUBLIC_UPGRADE_URL=https://vollyio.com/settings#plan`.

The webhook verifies the signature before reading the body, is the only route
allowed to skip the same-origin check (Stripe is not same-origin), and maps
`customer.subscription.deleted` to `plan='free'` at period end, not on the
cancel click. A cancelled player keeps Pro until the period they paid for runs
out.

### 4.4 Settings plan card

One card, one of two states:

- **Free:** "3 analyses a month. You've used 2." plus an upgrade button that
  opens Stripe Checkout.
- **Pro:** "18 analyses a month. You've used 7. Resets Aug 1." plus a link into
  the Stripe customer portal for cancel and payment method.

### 4.5 The 402 contract

The route returns `402` with `{error, reason, resets_at}` where reason is
`free_month_exhausted` or `plan_month_exhausted`. `analyzeFailureStatus` reads
the reason and produces the calm state, never the coral error state, because
running out is not a failure. Free routes to the Settings plan card; Pro shows
the reset date and nothing to buy. Do not HTTP-redirect a `fetch`.

### 4.6 Show the count before the upload, not after

The dashboard and the analyze page both show remaining analyses. A player who
films, uploads, marks a player, waits, and only then learns they are out has
been made to do 90 seconds of work for a paywall. `/api/usage` cannot serve
this (it is dev-only owner spend reporting), so this is a small new per-user
read.

## 5. The owner alert

When the spend backstop trips, or the provider reports credits exhausted, email
the owner through the existing Resend path (`lib/email.ts`). Fire **once per
trip**, claimed the same way `welcome_email_sent_at` claims the welcome mail, or
a busy hour sends hundreds of identical alerts. Players continue to see the
existing calm "temporarily out of capacity, your clip wasn't counted" 503.

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
