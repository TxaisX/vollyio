# Validation Plan

_Resolved 2026-07-12 in a full decision-tree review with the owner. This is the
operating plan; HANDOFF.md tracks execution state against it._

## The strategy in one line

Validate with real players from the owner's own circle, measure their
unprompted return, and only then charge.

## Resolved decisions

1. **90-day goal: validate, then charge.** Revenue target modest, learning
   target high. Billing stays dormant until the trigger below fires.
2. **First users: people the owner plays with.** Sacramento pickup and league
   circle, recruited in person, roughly 10 to 25 players. No community
   posting, no coach pilots yet.
3. **Charge trigger: unprompted return.** Billing flips when roughly 40% or
   more of the cohort films a second session within two weeks of their first,
   without being asked. Volume and praise do not count.
4. **Pricing shape at flip: monthly subscription, $8 to $12.** Unlimited
   analyses plus coach chat; the first breakdown stays free. Priced under the
   consumer coaching apps from the D-012 teardown.
5. **Signup email: custom SMTP now, confirmations stay on.** Brevo free tier,
   sender verified on the product domain, wired into the auth provider, then
   the email rate limit raised. No more shared-mailer cap.
6. **Domain: buy now.** Point the deployment at it, move the support address
   off the personal inbox (email routing/forwarding is fine), verify the
   Brevo sender on it. Candidates to check first: sideout.app, getsideout.com,
   sideout.coach, trysideout.com.
7. **Calibration: week-one filming sprint, before recruiting.** Owner films
   himself plus one or two teammates across serve/pass/attack (10 to 20 short
   clips), scores them with his own judgment, ingests via
   `scripts/ingest-eval-clip.mjs`, and records the first passRate in
   `evals/BASELINE.md`. Coaching-quality changes are measured against it from
   then on.
8. **Build focus during validation: freeze plus quality.** No new surfaces.
   Allowed: fixes the cohort's usage exposes, eval-measured coaching-quality
   work (ball-dependent measurements qualify), and the ops items above.
   Explicitly deferred: Overall Game option, coach/team view, billing UI.
   (In-app deletion shipped 2026-07-12, ahead of schedule.)
12. **Product shape is frozen at the five core surfaces** (decided 2026-07-12
    after the competitor re-check): Analyze, Drills, Coach, Scoreboard, and
    the progress family (Dashboard, Goals, History, Learn). This matches the
    strongest competitor's shape and nothing new gets added to it. The two
    competitor surfaces we deliberately do not carry are recorded as
    **post-validation candidates, in this order of fit**: Community/Challenges
    first (the cohort is literally an existing offline community; leaderboards
    and challenges compound the XP system already built) and Nutrition second
    (furthest from the analyze-and-improve core; revisit only if users ask).
9. **Measurement: SQL over the database.** No analytics dependency. The
   analyses table answers the return-rate question; check it weekly.
10. **Grass footage maps to Beach.** One line of guidance in the funnel copy;
    no third discipline. Grass doubles shares beach standards (small teams,
    outdoors, wind, no rotations).
11. **Counsel reviews /privacy and /terms before charging**, as a hard item on
    the billing-flip checklist, not before friends use the free product.

## Sequenced actions

**Now, before recruiting**
- [ ] Buy the domain (owner; check candidates above), point Vercel at it, set
      `NEXT_PUBLIC_SITE_URL`, swap `NEXT_PUBLIC_SUPPORT_EMAIL` to the domain
      address once routing exists.
- [ ] Brevo account (owner), verify domain sender, enter SMTP in the auth
      dashboard, raise the email rate limit, confirm signup works twice in one
      hour.
- [ ] Calibration sprint: film, score, ingest, record `evals/BASELINE.md`.
- [x] Grass guidance line in the funnel copy (shipped with this plan).

**Then: recruit and watch (2 to 6 weeks)**
- [ ] Invite the circle in person; help first uploads happen courtside.
- [ ] Weekly SQL: signups, analyses per user, 14-day unprompted return rate.
- [ ] Fix what usage exposes; improve coaching quality only against the eval
      baseline; ship ball-dependent measurements when they raise passRate.

**Billing-flip checklist (armed when the 40% bar is met)**
- [ ] Counsel skim of /privacy and /terms.
- [ ] Stripe wiring through the D-012 seam (`canAnalyze` + `BILLING_ENABLED`),
      monthly subscription $8 to $12, first breakdown free.
- [ ] Domain support address live and monitored.
- [x] In-app deletion shipped 2026-07-12; policy wording updated to match.
