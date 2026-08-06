# The plan matrix: what Free is, what Pro is, and what neither is yet

The plan card, the pricing copy, and any marketing page are written from this
file. So it keeps two things apart that must never be blurred: what a plan
includes **today**, and what somebody has **proposed**. Section 1 is the first.
Section 3 is the second, and every row in it is labelled not built. Copy may
not draw on section 3 at all.

Money, switches, and the counting rules live in `docs/billing.md`. The
decisions behind the shape are D-064, D-065, and D-066.

## 0. The one-line answer

**Pro differs from Free in exactly one way: the analysis allowance, 24
against 1. Nothing else in the product asks what plan you are on.**

Free also carries a one-time signup grant of 6 analyses, spent against the
account's lifetime rather than per month (D-076, migration 040). It is a trial,
not a plan line: it is gone after six completed analyses and never returns, so
it belongs in onboarding copy and not in any sentence comparing the two plans.

And that one difference is IN FORCE. `shouldEnforceFreeTier()` requires the
cap flag, billing open, an upgrade destination, and a configured payment
provider, and since 2026-07-31 (D-078) all four hold in production: billing is
live, a real card has been charged, and the webhook applied the plan. Someone
upgrading today is buying capacity, and the copy below must say so.

Two switches, both on, with the provider fully configured:

    BILLING_ENABLED=true     Pro is buyable
    ENFORCE_FREE_CAP=true    the cap bites

Write every surface for the armed state, because that is the live state.

## 1. What is true now

| Dimension | Free | Pro | Where it is decided |
|---|---|---|---|
| Analyses | 6 at signup once, then 1 completed per UTC calendar month | 24 completed per billing period | `MONTHLY_ALLOWANCE` and `SIGNUP_GRANT` in `lib/plans.ts` (D-083, D-085), mirrored in migrations 044 through 049, pinned by `lib/plans.test.ts` |
| Is that allowance in force | Yes | Yes | `shouldEnforceFreeTier()` in `lib/billing.ts`; live since 2026-07-31 (D-078) |
| What counts against it | Completed analyses only. A clip that fails, times out, or hits a capacity outage costs nothing | Same | Insert ordering in `app/api/analyze/route.ts`, D-064 |
| When it resets | 1st of the UTC calendar month | The billing anniversary: the provider-reported period start to `plan_renews_at` | `private.allowance_window()`, migrations 035 and 049 (D-067, D-086) |
| Analyzed clip window | Up to 10 s. The default window is 2 s or 3 s depending on skill | Same | `MAX_CLIP_SECONDS` in `lib/frames.ts`, `SKILL_PROFILES` in `lib/frame-plan.ts` |
| Frames sent to the coaching service | 64, gapless coverage, contact phase at 1024 px and context at 640 px | Same | `MAX_FRAMES` in `lib/analysis-types.ts`, mirrored by the insert trigger in migration 025 |
| Frames stored per analysis | 24 | Same | `MAX_STORED_FRAMES` |
| Analysis model and reasoning effort | One model, one effort | Same | `lib/ai/client.ts`, D-027 |
| Breakdown depth | Everything the model returned: overall score, per-metric scores and notes, coverage, per-rep scores, timestamped insights, every numbered change with full detail, and drill links | Same | `components/breakdown-body.tsx`. Ungated. D-012 recorded this as the natural premium seam and it was never gated |
| History retention | Forever, until the account is deleted | Same | No retention job exists anywhere in the repo |
| History page | 100 most recent reps, filterable by skill | Same | `app/(app)/history/page.tsx` |
| Clip playback | The original clip is stored privately and replays on the breakdown, up to 100 MB | Same | Migration 005 |
| Share links | Unlimited, each expires in 30 days, revocable at any time. The clip travels with the link; frames never do | Same | Migration 019, `SHARE_LINK_TTL_DAYS` |
| Coach chat | On for everyone | Same | Live 2026-08-06. `NEXT_PUBLIC_COACH_ENABLED` in `lib/flags.ts` now defaults ON; set it to `false` to take it away again. The plan decides nothing about it |
| Coach chat quotas | 20 messages an hour, 30 a day | Same | Migration 028. Identical on both plans, which is why coach has no row in `lib/entitlement-features.ts` |
| Drills | The whole library, on a publicly indexable page | Same | `content/drills`, `app/(app)/drills` |
| Goals | Unlimited active goals, indoor scoped | Same | `app/(app)/goals` |
| Scoreboard | Full use, 10 most recent matches listed | Same | `app/(app)/scoreboard` |
| Ratings, XP, progression, priority fix loop | Full | Same | `lib/ratings.ts`, `lib/progression.ts` |
| Export or download | Does not exist for anyone. The only download in the app is a developer eval case behind `?debug` | Same | n/a |
| Skills and disciplines | All six skills, indoor and outdoor | Same | `lib/skills.ts` |
| Hourly analyze quota | 20 an hour | 20 an hour | Migration 028. An abuse control, not a plan line, and `docs/billing.md` section 2 requires it stay that way |
| Concurrency | One analysis at a time, on a five minute reservation | Same | Migration 026 |
| Deleting the account | Allowed | Refused while a live subscription exists. Cancel first | `app/api/account/delete/route.ts` |
| Cancelling | n/a | Keeps Pro to the end of the period already paid for, then drops to 3, counting anything already run that month | Webhook, D-064, `docs/billing.md` section 7 |

### Notes on that table

- **The only Pro-keyed behaviour that is live today is a restriction, not a
  perk.** A Pro subscriber cannot delete their account until they cancel. That
  is correct (the alternative is a recurring charge with no way to stop it),
  but it is worth naming: the sole thing the product currently does differently
  for a paying player is refuse them something.
- **The clip window is already a quality ceiling, not a capacity one.** At a 10
  second window the frame planner cannot reserve its edges and still carve a
  contact-phase core, so it falls back to a single uniform pass: 64 frames over
  10 s is a 156 ms stride, just inside the 167 ms gap `MAX_EDGE_GAP_S`
  guarantees. At the 2 s to 3 s default the core is carved and the swing gets
  30 fps. Longer is therefore **worse** at a fixed budget, which matters a
  great deal to section 3's first two rows.
- **Drills cannot be gated meaningfully.** `/drills` is a public, indexable
  marketing surface. Putting it behind a plan would cost the SEO that page
  exists for.
- **Coach chat is off for everyone**, so it is not a Free feature today and
  cannot be sold as a Pro one. Nothing may imply otherwise until the flag is
  back on.
- **Resolved drift, kept for the record:** this file used to flag
  `docs/security.md` for saying the coach quota was 60 an hour. That file now
  says 20, matching migrations 018 and 028, so the two agree.

## 2. What Pro is, stated honestly

Pro is a bigger allowance on a product that is otherwise identical. That is
the whole of it. Anything a plan card or a
landing page says beyond "24 analyses a month instead of 1" is either section 3
or it is a claim the product cannot honour.

## 3. Proposed, and not built

Nothing in this table exists. None of it may appear in copy.

| Proposed perk | Status | What it would actually mean | Costs more to serve | Needs a new dependency |
|---|---|---|---|---|
| Longer analyzed window for Pro | **Not built** | Raise `MAX_CLIP_SECONDS` for Pro, and raise the frame and pixel budgets with it or the read gets sparser rather than richer (see the note in section 1) | Yes, directly. More frames and more pixels per call | No |
| Bigger frame budget for Pro | **Not built** | Raise `MAX_FRAMES` and `PIXEL_BUDGET` per plan. `MAX_FRAMES` is mirrored by a database insert trigger and pinned by `lib/security-contract.test.ts`, so this is a migration 031+ plus a widened pin, not a constant edit | Yes, directly | No |
| Coach chat as a plan line | **Not built** | A smaller daily allowance on Free and the current quotas on Pro. `consume_api_quota` scope limits are fixed in SQL and plan-blind, so this is a new migration | Yes, per message | No |
| Gate the breakdown depth seam (D-012: fix detail, timestamped insights, drills) | **Not built** | Show Free the score and the headline fix, hold the rest for Pro | **No.** The model already produced all of it in the one call we already paid for | No |
| History retention split | **Not built** | Free keeps 30 or 90 days, Pro keeps everything | **No.** It saves money on the Free side by deleting coaching a player still wants | No |
| Share link limits on Free | **Not built** | Fewer links, or a shorter expiry, on Free | **No.** A share link is a row and a storage read | No |
| Export a breakdown | **Not built** | A print stylesheet, or a CSV of history | No, near zero | Only if PDF is generated server side. Print CSS and CSV need nothing |
| Annual price with a trial | **Not built** | $99/yr, 30 day trial, as an additional price object | Neutral | No |
| Coach or multi-athlete tier | **Not built** | Roster view over several players. A new product, not a perk | Yes | Probably not, but it is a schema change |
| Priority processing | **Not built** | There is no queue. Analysis is synchronous inside a 120 s route | n/a | n/a |
| Better model or higher effort for Pro | **Not built and measured against** | D-027 benchmarked the ladder: the analysis model is correct at every effort level and the cost curve is flat to inverted, so higher effort buys wall clock and nothing else | Yes, and buys nothing | No |
| Top-up packs and rollover | **Rejected**, see `docs/billing.md` sections 1 and 7 | Selling analyses by the pack anchors $9.99 against a marginal cost of 23 cents; rollover is a credit balance wearing a hat | n/a | n/a |

## 4. What to build first

Judged on the three things that actually matter: does it cost us more to serve,
so the price has something behind it; is it visible enough to convert; can it
ship without a new dependency.

### First. Finish the allowance.

It is already built, it is the only real difference, and it is not delivered.
The perk is 24 against 1, the marginal cost is real and measured at roughly
$0.15 to $0.20 an analysis. DONE since 2026-07-31 (D-078): the cap is live,
the provider is configured, and Pro honestly sells its allowance. Every other
perk on this list now builds on a plan that already sells something real.

Cost: no code. Visibility: total, it is the plan card's whole sentence.
Dependency: none.

The uncomfortable half is retired with it: while the cap was off, Pro
genuinely bought nothing and the plan card had to say so. That constraint
ended when the cap engaged; the standing rule it leaves behind is the same
one, generalized: never sell a perk the product does not currently serve.

### Second. A longer analyzed window for Pro, with the frame budget raised to match.

This is the only proposed perk whose cost to us scales with what the player
gets. A 20 second window is a rally or a set of reps rather than one, it is
visible in exactly the place a player feels the limit (the trim bar already
says "up to 10s"), and `planFrameTimes` already takes a window and a budget as
arguments, so no new dependency is involved.

Be clear about the price, because it is the reason this is second and not
first. A longer window at today's 64 frames is a **worse** analysis, not a
better one: past roughly 9.5 seconds the planner drops its contact-phase core
and degrades to a uniform pass, which is the sparse-coverage failure D-041
deleted a sampler over. Delivering this honestly means raising `MAX_FRAMES`
and `PIXEL_BUDGET` for Pro, which touches the request schema, the client
extractor, `MAX_BODY_BYTES`, the database insert trigger that mirrors the frame
cap, and the contract test that pins the two together. That is a migration
031+, not a constant. Ship it only if you are willing to re-run the frame-plan
tests and prove the longer window is denser than the short one, not thinner.

### Third, and strictly conditional. Coach chat as a plan allowance.

Per-message cost is real, a coach that remembers your film is the most
demonstrable thing in the product, and both quota scopes already exist. The
honest shape is a smaller daily allowance on Free and today's 20 an hour and 30
a day on Pro.

The condition is not negotiable: coach chat is dark for everyone, and it went
dark for spend containment (D-047). It cannot be a Pro perk until it is a
feature. Turning it on to sell it re-opens the exposure that closed it, and the
per-plan quota split needs a migration because `consume_api_quota` limits are
written into SQL with no knowledge of a plan. If the flag is not coming back,
delete this row rather than leaving it on a roadmap.

## 5. What I would not build

**The D-012 breakdown seam.** This is the one that sounds best and is worst. It
is recorded in the decision log as the natural premium seam, and gating it is
one conditional. The problem is arithmetic: fix detail, timestamped insights,
and drill links come out of the same single call that produced the score. We
have already paid for those tokens. Hiding them saves nothing, so the price
gets no cost behind it, and the money comes purely from making the free product
worse. It is also the nearest neighbour to the locked-blur pattern D-012
explicitly rejected, and the free breakdown is the thing that gets shared,
which is the acquisition loop. If depth is to be sold, sell a **second, deeper
read** that costs a second call. Do not sell back the half of the first one we
are already holding.

**History retention.** Deleting a player's coaching to make a plan look bigger
is the worst trade in this document. It costs us nothing to keep, it removes
the progression story that ratings and goals are built on, and the day it fires
is the day a player who has been with us longest loses the most.

**Share link limits.** Sharing is how this product is found. Restricting the
free tier's ability to share is paying for revenue with distribution, in a
product whose distribution plan is "the analyzed clip is the ad".

**Export.** Cheap to build and probably worth building eventually, but not as a
Pro perk. It costs nothing to serve, so it justifies nothing, and a teenager
posting a clip does not want a PDF. If a coach-facing tier ever exists, export
belongs there.

**A better model or higher effort for Pro.** Ruled out by measurement, not
taste. D-027 found the analysis model correct at every effort level with a flat
to inverted cost curve. Selling "deeper analysis" that is the same analysis
taking longer is a claim we know to be false.

## 6. What copy may say today

May say: Pro is $9.99 a month for 24 analyses against 1 a month on Free, on a
UTC calendar month reset, cancellable any time with access to the end of the
period already paid for. Free may be described as 3 analyses to start and 1 a
month after that, provided both halves appear together: "3 free analyses" alone
is a number that stops being true in month two, and "1 a month" alone hides the
trial. `allowanceSentence()` builds the sentence so this is hard to get wrong.

Said, while the cap was off (historical; the cap is on): nothing is being counted today, and
upgrading now is early support rather than more reps. That is D-066's
requirement and the plan card already carries it.

Must not say: anything in section 3, anything about coach chat, anything about
priority, exports, retention, deeper analysis, or a larger clip. None of it
exists.
