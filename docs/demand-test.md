# The demand test

Written **2026-08-11, before posting anything**, which is the only time it is
worth writing. After the numbers arrive there will be a reason why each one does
not count. Everybody has those reasons. This document exists so that the version
of you that has not seen the result gets to decide what the result means.

## Why this and not more building

The repository audit on 2026-08-11 found a product materially more complete than
its usage justifies: 15 tables, 60 migrations, 630 tests, six skills, coach chat,
weekly plans, progress tracking, billing, a PWA, an Android build, and a Play
listing one upload from complete.

Against that: **4 real users, 0 new in three days, 129 visitors in 30 days, and
$0 of external revenue in the product's lifetime.** The single Stripe charge was
the owner's own card, cancelled about five hours later.

The binding constraint is demand. No item in the engineering backlog addresses
it, and the audit's own conclusion was that the next unit of engineering has
lower expected value than the next unit of distribution.

## The test

Post a real breakdown where volleyball players argue about technique, with the
share link, disclosed as your own work, and with no signup ask.

The channel is chosen from the only evidence that exists: **one share link
accounted for 74 of the first 219 visitors ever**, about 34%, unplanned. Nothing
else this product has done has produced a comparable number.

Drafts and the subreddit rules that constrain them live in the session
scratchpad as `vollyio-distribution-drafts.md`.

**Not Play.** Internal testing is email-list gated, the list has two people on
it, and the opt-in link does nothing for a stranger. Play runs in the background
on its own multi-week clock; it is not the demand test.

## What each result means

Decided in advance. Read the row that matches and do what it says.

| Result | What it means | What to do |
|---|---|---|
| Fewer than ~20 click through | The **pitch** is wrong, not the product | Rewrite the opening line, post again in a different community. Change nothing in the code |
| They click, read, do not sign up | The **funnel** is wrong. The known figure is an 88.5% loss | Work the signup path. Still change nothing about the analysis |
| They sign up, run one rep, never return | The **product** is wrong | This is the expensive answer. Stop and re-scope before writing another feature |
| Three posts, three communities, no engagement at all | Players do not want this **from a stranger on the internet** | The channel is coaches and clubs, which is a different product and a different buyer. Decide whether to build that or stop |
| Real engagement, arguments about the read | The thesis holds | Then, and only then, resume building. Start with the failure logging and the label rate |

## The measurement

Take these before posting and again 72 hours after. No other numbers count.

**Amended 2026-08-13 (D-118).** Once the analysis-first funnel ships, every
visitor who uploads a rep becomes an `auth.users` row, so a raw count of that
table stops measuring demand and starts measuring traffic. Both numbers are
worth having and they are not the same number, so from that point on the user
count filters `is_anonymous = false` and the anonymous count is read separately
as the top of the funnel. Tester recruiting is counted separately again: an
install driven by a mutual-testing thread is not a volleyball player choosing
this product.

```sql
-- exclude the demo account: it is the 5th auth.users row
select count(*) from auth.users where is_anonymous = false;  -- baseline 5 (4 real)
-- the funnel's top, after D-118 ships. Zero until anonymous sign-in is enabled.
select count(*) from auth.users where is_anonymous;
select count(*) from public.analyses;               -- baseline 46
select count(*) from public.analysis_feedback;      -- baseline 2
select count(*) from public.share_links;            -- baseline 16
```

Visitors come from the hosting provider's analytics, 30-day window. Baseline
**129**.

## What would make this test invalid

Say it now, so it cannot be claimed afterwards.

- Posting to five places on the same day. That is the pattern both spam filters
  and moderators key on, and a removal is not a demand signal.
- Posting and then not answering comments. The argument **is** the distribution;
  a thread you abandon measures nothing.
- Changing the product mid-test. Then you have two variables and no answer.
- Letting the share link expire. It dies around **2026-09-10** and a dead link
  in a live thread reads as an abandoned project.

## The honest prior

This may not work, and that is an acceptable outcome of a test that costs a day.
What is not acceptable is running it, getting a weak result, and returning to the
backlog because the backlog is more comfortable than the answer. That is the
failure mode this document is written against.
