# Legal review handoff: Terms of Service and Privacy Policy

**No lawyer has reviewed these pages.** They were written and edited in-house
against the code and the database, by people who are not lawyers. Nothing on
`/terms` or `/privacy` is legal advice, neither page claims to have been
reviewed, and this document exists to hand counsel the shortest possible path
to the parts that matter.

Files under review:

- `app/(legal)/terms/page.tsx`, effective July 28, 2026
- `app/(legal)/privacy/page.tsx`, effective July 28, 2026

Both are server components. Every allowance number and the price string are
imported from `lib/plans.ts` rather than typed into the copy, so the pages
cannot drift from the product by a stale edit. `lib/plans.test.ts` pins those
allowances against the SQL in `supabase/migrations/026_monthly_allowance.sql`
that actually enforces them.

House rule on both pages: no payment, hosting, email, or model vendor is named
in user-visible copy. Counsel should assume "the payment provider" and "the
coaching service" are single named third parties under contract, and tell us if
any disclosure obligation requires naming them.

---

## 1. What the pages now claim

### The commercial terms

| Claim | Where it comes from |
|---|---|
| Free is 3 completed analyses per UTC calendar month, no card | `MONTHLY_ALLOWANCE.free`, migration 026 |
| Pro is 18 completed analyses per UTC calendar month | `MONTHLY_ALLOWANCE.pro`, migration 026 |
| Pro costs $9.99 a month, in US dollars | `PRO_PRICE_LABEL`; the authority is the provider price object |
| Nothing is added on top of that amount at checkout | `buildCheckoutBody` in `lib/stripe.ts` sets no `automatic_tax` |
| The allowance window resets on the 1st, UTC, for everyone | `private.allowance_window`, migration 026 |
| The charge falls on the subscription's own monthly date, not the 1st | Provider behaviour; the two clocks are now stated side by side |
| Only completed analyses count | The count reads saved rows in `public.analyses`, migration 026 |
| Changing plan does not reset the count, in either direction | The count has no plan filter, migration 026 |
| A separate short-term limit of 20 analyses an hour, one at a time | `consume_api_quota` scope `analyze`, migration 028; the 5 minute reservation in migration 026 |
| Cancelling keeps Pro to the end of the paid period, no proration | `PAID_STATUSES` and the `customer.subscription.deleted` mapping, `lib/billing-events.ts` |
| A failed renewal keeps Pro alive while the provider retries | `past_due` is in `PAID_STATUSES`; `invoice.payment_failed` is a deliberate no-op |
| Deletion is refused while a Pro subscription is on file, including the run-out period | `app/api/account/delete/route.ts` refuses on `plan === "pro" && stripe_subscription_id` |
| Monthly limits are not switched on at all times | `ENFORCE_FREE_CAP` in `lib/billing.ts`; the launch posture in `docs/billing.md` section 0 |

### The commitments this edit newly makes

These are business promises the pages did not carry before. They were added
because the board found the previous silence or vagueness indefensible. **Each
one needs the owner to confirm it can be honoured before ship.**

1. **30 days' emailed notice before a price change binds an existing
   subscriber.** Previously "we will tell you before" with no period and no
   channel. Email is the channel because email is the only notice channel the
   product has (`lib/email.ts`); there is no in-app change-notice surface, and
   the previous promise to "note the change in the app" was unbacked. Both
   pages now say email instead. `docs/billing-runbook.md` has no price-change
   procedure yet, and should get one.
2. **Support answers within two business days**, and asks customers to write
   before disputing with their bank.
3. **Support will cancel for you if the billing page will not open.** Required,
   because there are real states with no in-app cancel control:
   `components/plan-card.tsx` renders "Plan changes are not available right
   now" with no button when the provider is unconfigured, and
   `app/api/stripe/portal/route.ts` has three 503 branches, a 502 and a 429.
4. **Support will delete a cancelled account before the run-out period ends, on
   request.** Required, because the delete route blocks a cancelled subscriber
   for up to a month while their plan is still `pro`.
5. **If we close a paid account for a terms violation, we cancel the
   subscription and refund the unused part of the paid period.** Previously
   unstated, and read against a closed refund list it implied the opposite.
6. **A subscription started by someone under 18 on an adult's payment method
   without permission is refunded on request.** Added to the refund list.
7. **A parent or guardian must be the one who starts the subscription and
   authorizes the payment for an under-18 account.** Stated in the auto-renewal
   section. There is no code gate enforcing it.

### Privacy

- Billing storage is now described without a count. The old copy said "four
  things" and the schema holds five: `profiles.plan`, `plan_renews_at`,
  `stripe_customer_id`, `stripe_subscription_id`, and `last_billing_event_at`
  (migration 027).
- The third-party analytics denial was false and is corrected. `app/layout.tsx`
  mounts `<Analytics />` from the hosting provider on every page including the
  legal pages themselves, for signed-out visitors. The page now discloses
  page-view counts from the hosting provider and denies only advertising
  trackers and profiling.
- The email provider is added to the exhaustive list of processors. It receives
  the player's email address (`lib/email.ts`, `supabase/functions/send-welcome`).
- Coach chat is described conditionally on both pages. As of 2026-08-06 it is
  LIVE for every account: `NEXT_PUBLIC_COACH_ENABLED` defaults on, and setting
  it to `false` is what closes the nav entry, the page and `/api/coach`
  together. The conditional wording stays because that switch still exists.

---

## 2. Which claims are load-bearing for money

If any of these is wrong, the exposure is a chargeback, a refund obligation, or
a regulator. Ranked.

1. **"$14.99 a month, automatically, until you cancel."** The price is a display
   string in `lib/plans.ts` with nothing checking it against the provider's
   price object. `lib/plans.test.ts` pins the allowances to SQL but pins nothing
   about the price. Change the price at the provider and this page states the
   old figure as a term of the agreement. There is no automated guard.
2. **"18 analyses a month for the money", against the fact that limits may not
   be enforced.** The pages now say the allowance is what Pro sets and that
   counting is not always on. This was the single biggest correction in this
   pass: the previous copy described a metered product while `plan-card.tsx`
   told the same buyer "nothing is capped yet, so this is early support rather
   than more reps today". Two surfaces from one merchant disagreeing about what
   money buys is textbook services-not-as-described.
3. **"Upgrading mid-month does not reset the count."** Now disclosed. It was
   not, while the mirror-image rule that costs the customer on the way out was
   spelled out in detail. A player who ran 3 on Free and upgrades gets 15 that
   month, not 18.
4. **The two clocks.** Charge on the subscription date, allowance reset on the
   1st. The page previously taught the 1st emphatically and never said when the
   card is hit.
5. **"Deletion is refused while a subscription is live."** See the unfixed
   defects below. The route does not keep this promise in two states.
6. **"Cancel any time, self-serve, no email needed."** Now carries a support
   fallback, because the in-app control can be absent.

---

## 3. What the board flagged that was NOT fixed, and why

### Not fixed because it is outside these two files

Each of these was reported to the owner of the file rather than papered over in
the copy. **None of them is my file to edit.**

| # | Defect | File | Why it matters |
|---|---|---|---|
| A | Account deletion **fails open** on an unreadable profile. The `error` from the `profiles` select is discarded, so on a read failure both optional chains are undefined, the guard passes, and the account is deleted with a live subscription. The neighbouring checkout and portal routes fail closed on the identical read, with the comment "Fail closed on an unreadable or missing profile". | `app/api/account/delete/route.ts:38` | The terms promise a refusal the code gives only on the happy path. Fix: capture `error`, return 409 or 503. |
| B | Account deletion does not cover a **pending** subscription. Between checkout completing and a delayed payment settling, the subscription exists at the provider but the profile is still `free` with no subscription id, so the guard passes. The later `async_payment_succeeded` then fails to resolve a deleted user, the webhook 500s, the provider retries for days, and the subscription keeps billing a deleted account. | `app/api/account/delete/route.ts:43`, `lib/billing-events.ts` | Exactly the harm the section claims to prevent. Mitigated in copy only by advising players to wait until Settings shows Pro. |
| C | Deletion is **refused for a cancelled subscriber** for up to a month, because `plan` stays `pro` until the provider reports the period ended. | `app/api/account/delete/route.ts:43` | The terms now describe the real rule and offer a support route rather than asserting a rationale the code does not implement. |
| D | **No consent is collected at checkout.** `buildCheckoutBody` sets no `consent_collection`, and neither purchase surface links to `/terms`. The terms previously asserted "You agreed to this when you checked out". **That sentence has been deleted**, because it was the one provably false statement on the page. | `lib/stripe.ts:96`, `components/plan-card.tsx` | See question 3 below. This is probably a legal requirement, not a nicety. |
| E | The **auto-renewal disclosure is missing from the upgrade button** in the metered state. `plan-card.tsx` traps "Cancel any time" inside `{!metered && ...}`, so the one configuration where the terms are accurate is the one where the button says nothing about recurrence or cancellation. | `components/plan-card.tsx:99` | Move it out of the `!metered` branch and add "renews automatically each month until you cancel" plus a `/terms` link. |
| F | The **landing page FAQ contradicts the terms.** "Your first breakdown is free... If we introduce paid plans" against an auto-renewing $14.99/mo subscription. The JSON-LD publishes `offers: { price: "0" }` to search and answer engines. | `app/page.tsx:52`, `app/page.tsx:124` | A parent reading the sales page is told they cannot be charged. Highest-priority marketing fix outside these files. |
| G | The **plan card contradicts the free allowance** when the cap is off: "Analyses are unlimited for everyone while we are early". | `components/plan-card.tsx:76` | Now reconciled from the terms side by disclosing that limits are not always on. The card's copy is honest; it was the terms that were wrong. |
| H | **`PRO_PRICE_LABEL` carries no currency.** The terms now state "Prices are in US dollars" as a separate sentence rather than retyping the amount, but the plan card and the limit notice still show a bare `$14.99/mo`. | `lib/plans.ts:33` | A non-US parent reads their own dollar. Fix in `plans.ts` so it propagates to all three surfaces. |
| I | **No check ties `PRO_PRICE_LABEL` to the provider's price object.** | `lib/plans.ts`, `docs/billing-runbook.md` | Add the price to the launch and price-change checklist, and consider an owner-facing check that reads the provider price and compares. |
| J | **`plan_renews_at` is stored and rendered nowhere.** The webhook writes it; no UI displays it. | `app/api/stripe/webhook/route.ts:183`, `components/plan-card.tsx` | The terms now point at the provider's billing page for the next charge date. Surfacing `plan_renews_at` on the plan card would be better and would let the terms point at something we control. **Owner must confirm the hosted portal actually displays the next invoice date before ship**; `docs/deploy.md:82` says the portal settings cannot be read from the repo. |
| K | **`<Analytics />` could be removed instead.** The privacy page was corrected to describe it. If the owner would rather not run it at all, delete the import and the mount and revert the sentence. | `app/layout.tsx:3,80` | Owner's call. Both options are honest; only the previous state was not. |

### Not fixed because it needs facts I do not have

| # | Gap | Why unfixed |
|---|---|---|
| L | **No legal entity name, no company number, no registered or business address, no governing law, no forum.** "Vollyio" is a brand. | I will not invent an entity or a jurisdiction, and I will not ship a placeholder in user-visible legal copy. This is the most conspicuous missing item on the page and it is question 1 below. |
| M | **No arbitration clause, no class-action waiver.** | Business and legal decision, and one with real trade-offs given a 13+ audience. |
| N | **No in-app change-notice mechanism.** No changelog, banner, or what's-new surface exists anywhere in the repo. | Rather than promise it, both pages were narrowed to email, which is wired and real. If an in-app notice is built later the copy can be widened again. |

### Rejected outright

- **"Soften the delete-account promise to match the route."** Rejected, on the
  fact checker's own reasoning, which the editing rules make authoritative over
  defensive phrasing: the page states the intended rule correctly and the route
  is the thing that is wrong. The copy was made accurate about *scope* (it now
  says the block covers the run-out period, which is what the code does) but
  not weakened about *intent*. Defects A and B stay open as code bugs.
- **"Every other part of the app works the same way on both plans."** Kept as a
  softened form only. The absolute version forecloses ever shipping a Pro-only
  feature without amending the terms, and in the unmetered posture it reduces to
  "the two plans are identical and one costs $14.99". Replaced with "if we ever
  add another difference between them, it will be described here."
- **"Costs you nothing" for a failed clip.** Narrowed rather than kept. It is
  exactly true that a failed clip does not count against the monthly allowance,
  and not quite true that it costs nothing, because the five minute reservation
  in migration 026 refuses a retry with `in_progress`. The page now says both.

### Conflicts between reviewers, and how they were resolved

1. **Plain language wanted "once the provider reports the subscription has
   ended" cut from the cancel section as plumbing; the fact checker and the
   adversarial lens both leaned on that same fact for the delete-account
   timing.** Resolved for clarity, per the editing rules. The phrase is gone
   from the cancel section, where the reader only needs "the paid period ends,
   then you are on Free", and the substance survives in the delete section,
   where the timing actually bites and the reader needs it.
2. **The product brief states the caps as live fact; the fact checker and the
   adversarial lens both say the tense is wrong because `ENFORCE_FREE_CAP` is
   off in the launch posture.** Resolved for the fact checker. The numbers 3 and
   18 are stated exactly as the brief and the SQL give them, and a paragraph was
   added saying limits are not switched on at all times and what Pro means in
   that period. This adds a caveat rather than contradicting the brief, and it
   is durable in both states.
3. **Plain language wanted a short-version block at the top; the adversarial
   lens wanted no absolute promises anywhere.** Both applied. The short version
   is four lines answering what you get, what it costs, when you are charged,
   and how to stop, and every line is hedged where the detail sections hedge.
4. **Plain language flagged the Refunds section duplicating the cancel section
   three sections apart.** Applied. Refunds now opens on the fact only it has,
   and carries one cross-reference line.

---

## 4. Questions for counsel

### 4.1 Entity structure and trader identity

The page names no legal person. Who is the counterparty to this agreement, and
what has to appear on the page: entity name, registered address, company
number, VAT or tax registration? Which jurisdiction's law governs, and where are
disputes heard? Is a US LLC selling to UK, EU, Canadian and Australian consumers
subject to trader-identity disclosure requirements we are currently missing, and
does any of that change the answer on arbitration or a class waiver?

### 4.2 Minors consenting to a recurring charge

The audience is 13+ and the product is sold with a recurring charge. Today:

- The signup checkbox (`app/(auth)/signup/page.tsx:110`) collects "I am at least
  13 years old and agree to the Terms of Service and Privacy Policy. If I am
  under 18, a parent or guardian consents." It is real, required, and links both
  pages. It is collected **before the buyer has ever seen a price**.
- The purchase flow asks nothing about age and nothing about whose payment
  method it is. There is no gate in code.
- The terms now say the guardian must start the subscription and authorize the
  payment, and the refund list now covers an unauthorised purchase by a minor.

Is a checkbox at signup sufficient to bind a guardian who has never seen the
page to an auto-renewing charge agreed weeks later by a 14-year-old? Do we need
an age or guardian gate at checkout specifically? Does the answer differ by
state or by country? Is the infancy doctrine a real exposure here, and does the
stated refund policy adequately manage it? Separately: does the injury-risk
assumption in the same document, agreed on a minor's behalf, hold, and does the
newly added carve-out for death and personal injury caused by our negligence
put it in the right shape?

### 4.3 The auto-renewal acknowledgement requirement

This is the question with the clearest legal shape and the clearest fix.

- The checkout session sets no `consent_collection`, so the hosted payment page
  never presents these terms.
- Neither purchase surface links to `/terms`.
- In the metered state the upgrade button's own copy says nothing about
  recurrence or cancellation at all.
- The terms previously asserted "You agreed to this when you checked out". That
  sentence has been removed as false.

Several US state automatic-renewal laws, and the federal negative-option rule,
require a clear and conspicuous disclosure of the recurring terms **before**
payment, affirmative consent to those specific terms, and an acknowledgement
after. The UK and EU have their own analogues. Which of these applies to us at
our size and footprint? What exactly must appear next to the upgrade button, and
what must be captured and retained as proof of consent? Is a
`consent_collection[terms_of_service]=required` flag on the hosted checkout
page, plus the recurring terms in the button copy, enough, or does the
disclosure have to sit on our own page before the redirect?

### 4.4 Is the refund stance sufficient

The stated stance is: cancel any time with access to the end of the paid period;
no prorated refunds for a partial month; full refund on request for a charge
that is clearly a mistake, with a closed list of four cases (duplicate, charge
after a confirmed cancellation, charge on an account that never got access,
subscription started by a minor without the cardholder's permission); refund of
the unused paid period if we close a paid account; and an explicit line that
none of it removes rights under local law.

- Is a no-proration policy enforceable in each market we sell into, or do UK and
  EU distance-selling and cooling-off rules override it for a first month?
- Does the 14-day EU and UK right of withdrawal apply to a digital service like
  this, and if it does, does starting to use analyses waive it, and must we
  collect an express waiver at checkout?
- Is a closed list of refund cases a liability, in that it implies nothing else
  is refundable? Should it be framed as examples rather than an exhaustive list?
- Is "we answer support email within two business days" a commitment worth
  making in a terms document, or should it live somewhere non-contractual?
- Does the click-to-cancel posture, self-serve in Settings through the
  provider's portal with no retention flow, satisfy the cancellation-mechanism
  requirements everywhere we sell, given that the support fallback exists for
  the states where the in-app control is absent?

### 4.5 Two smaller ones

- **Liability cap of "what you paid in the last twelve months" is $0 for a free
  user**, on a product for minors whose own terms acknowledge injury risk. A
  carve-out for death and personal injury caused by negligence, and for fraud,
  has been added. Is that sufficient, and should there be a floor on the cap
  rather than the amount paid?
- **The privacy page claims GDPR and CCPA-style rights are honoured for
  everyone regardless of jurisdiction.** Is that promise wider than we can
  operationally keep, and does making it voluntarily create obligations we would
  not otherwise have?
