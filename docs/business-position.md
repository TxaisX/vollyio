# Where the business actually is

Measured 2026-08-19 against the live database and the checked-in cost model.
Every number here is read rather than estimated; where something is an
assumption it is labelled one, because the last time this document family
carried an unlabelled estimate it was wrong by 14x in the flattering
direction (docs/billing.md, D-106).

## 1. The numbers, as they are

| | Value | Source |
|---|---|---|
| Accounts | 9 | `auth.users` |
| Accounts created in the last 7 days | 3 | `auth.users` |
| Accounts that ever analysed a rep | 6 of 9 (67%) | `analyses` |
| Analyses, lifetime | 54 | `analyses` |
| Analyses, last 7 days | 7 | `analyses` |
| Share links minted | 16 | `share_links` |
| Accounts on the Pro plan | 2 | `profiles` |
| Accounts with a real subscription id | 1 | `profiles` |
| Lifetime revenue | $0 | Stripe |
| Last analysis | 2026-08-17 | `analyses` |

Read the first and last rows together. The product works, activation is
healthy at 67%, and **nobody is arriving**. Nine accounts is not a
conversion problem, a pricing problem or a product problem. It is a
distribution problem, and every hour spent on the first three is an hour not
spent on the fourth.

The one paying subscription is the owner's own. Treat lifetime revenue as
$0 for planning.

## 2. Unit economics

Measured, not derived (D-106).

- A completed analysis costs **$0.0164**. Output is ~70% of that, so the
  lever on unit cost is response length, not input size.
- Pro at $29.99/mo nets $28.82 after Stripe. At FULL use (540 analyses) it
  costs $8.86 and clears **$19.96, about 69% gross margin**. Nobody has ever
  run full use; at half use it clears $24.39.
- Weekly at $7.99 nets ~$7.46. Same allowance, so a heavy weekly subscriber
  is the least profitable shape and a light one is the most.
- A fully-used free account costs **$1.48/mo**. The one-time signup grant
  costs about **$0.05**.
- Fixed costs run about **$54.50/mo**.

**Break-even is 3 Pro subscribers.** 3 x $19.96 = $59.88 against $54.50.
That is the entire hurdle, and it is small enough to be worth saying plainly:
this business needs three people to say yes, not three hundred.

The constraint that actually binds is not margin, it is the prepaid
inference balance. One balance serves every surface and per-account quotas
bound a single player, never the aggregate. A hundred free accounts arriving
in a week is a cost event before it is a revenue event.

## 3. What each goal costs to reach

### Goal A: break even, $54.50/mo
Needs **3 Pro subscribers**, or 8 weekly subscribers.

Nothing in the data supports a conversion rate yet, because the denominator
of paying users is zero. So this is stated as a requirement rather than a
forecast: at an assumed 2% visitor-to-paid rate, which is optimistic for a
cold audience and generous for a sports app, 3 subscribers needs roughly
**150 engaged signups**. At 1% it needs 300. The honest version is that the
first paying stranger is the number that matters, because it converts every
rate on this page from an assumption into a measurement.

### Goal B: the Play production listing
Needs **12 testers opted in simultaneously for 14 consecutive days**. One
opt-out or uninstall resets that tester.

This is a compliance gate, not a growth channel, and it is worth being clear
about what buying it does and does not buy.

**What the purchased testers buy:** the right to have a public Play listing
at all, roughly two weeks from the day the twelfth one opts in.

**What they do not buy:** any revenue, any usage signal worth reading, any
product feedback worth acting on, and any of the "what did testers say"
material Google asks for when the production application is reviewed. Paid
testers install, leave it, and collect. Budget them as a **listing fee**,
not as marketing spend. Realistic cost is $20-60 on Fiverr.

Two risks worth pricing in before tomorrow morning:
1. **Country match.** The closed track is live in 4 countries and most
   tester gigs are staffed outside them. Confirm the gig's countries against
   the track's, or widen the track first. This is the single most common way
   this purchase is wasted.
2. **Review quality.** Google has rejected production applications where
   testing was visibly hollow. Mitigate by getting 2-3 real volleyball
   people into the group alongside the paid ones and keeping what they say.

### Goal C: revenue from the web
This is the right instinct and the data agrees with it.

The web has three structural advantages the app does not:
- **No 15% Play cut** and no review latency between a change and a customer.
- **77 indexable content pages already built** (34 injury entries, 37
  drills, 6 skill pages), which is a real asset that cost nothing further to
  own.
- The keyword harvest says those pages target queries people actually type.
  "jumpers knee volleyball", "volleyball shoulder pain" and "volleyball
  ankle" are all at the most frequent rank, and the injury library was until
  this week the least discoverable thing on the site: no index address, not
  in the sitemap, no structured data.

That gap is now closed (llms.txt, HowTo on drills, MedicalWebPage on injury
entries, FAQPage on the landing page, the injury index in the sitemap).
**Organic content is the only channel here with a zero marginal cost per
visitor**, which matters more than usual when the fixed cost is $54.50 and
revenue is $0.

The honest caveat: SEO pays in months, not days. It is the right long game
and the wrong thing to wait on.

## 4. Ranked by cost to reach the first paying stranger

1. **Post where volleyball players already are, personally.** Cost: time.
   The r/AndroidClosedTesting post is a tester funnel, not a player funnel.
   r/volleyball, r/beachvolleyball and local league groups are the player
   funnel, and a filmed rep with a real breakdown is the only demo the
   product needs. Highest-converting audience the product will ever get for
   free, and the one thing the data says has never been tried at volume.
2. **Ship the tester purchase.** Cost: $20-60 plus the country check. Buys
   the listing, unlocks Play organic discovery in ~2 weeks.
3. **Let the injury pages work.** Cost: zero, already done. These answer a
   question someone types at 11pm in pain, which is the highest-intent
   traffic this product can receive, and the entry pages now say what they
   are to a crawler.
4. **The web funnel already exists end to end** and is verified live: quiz,
   signup, situated account, analyze, plan picker, Stripe checkout. Nothing
   in the path needs building. It needs people walking it.

## 5. What would change this analysis

- **The first paying stranger.** Converts every rate above from assumption
  to measurement, and is worth more as information than as $29.99.
- **A week of 20+ signups.** Would move the binding constraint from demand
  to inference balance, which is a different and much better problem.
- **Any evidence of retention.** 54 analyses across 6 players says people
  try it. Nothing yet says they come back, and a subscription business is
  a retention business. This is the largest unmeasured risk on the page.
