# Handoff - vollyio

_Body last rewritten 2026-07-27; billing facts corrected 2026-07-31 (D-078).
Persistent in-repo project handoff. Older session-log entries (pre-D-027) live in
`archive/handoff-history.md`. **The authoritative account of the current system
is `docs/decisions.md`, now D-027 through D-077.** This file trails it: where the
two disagree, the decision log wins. Corrections below are marked inline rather
than by rewriting the surrounding prose, so the drift stays visible._

## Goal
Vollyio - volleyball skill-analysis and coaching web app. Next.js 16 (App Router,
React 19), Supabase (auth + Postgres 17, RLS on every table), the coaching service
(a vision model) server-side. Deployed on Vercel; a push to `master` auto-deploys
production. Live at https://vollyio.com.

## State (post-D-033: the model does the whole read)

- **No on-device ML.** D-033 removed the entire on-device pose engine after two
  blind kill gates on the owner's own footage: the measured-checkpoint arm lost
  13-0 to plain vision and produced 34% physically-impossible values above the
  honesty floor, and the tracker rang the wrong player 43% of the time versus the
  model's 97.4%. The coaching service now does assessment and cross-frame subject
  tracking by looking at the frames.
- **Subject marking** (D-030, D-036). The user taps their athlete, or picks from
  coach-spotted candidates (`app/api/players`: one frame returns up to six
  kit-and-position descriptions with torso points, numbered on the frame). The
  pick is a raw normalized coordinate; `injectMarkTime` guarantees a sent frame at
  that instant; `burnMark` draws a hollow gold ring client-side; `marker_frame_index`
  binds the ringed athlete across every frame; `subject_check` reports
  confirmed / mismatch / unmarked. Scrubbing >250ms from a mark clears it. The
  analyze-without-marking path stays one level down, never a dead end.
- **Scoring is a pointer checklist** (D-039, D-040, D-037, D-038). `lib/ai/pointers.ts`
  holds 120 cues (4 pointers x 5 checkpoints x 6 skills), each judged
  met | partial | missed | not_visible. The number is derived in code
  (fraction of met over visible pointers, raw band 30..95), with no display curve
  (D-040) and one scoring standard for every account (D-037). A checkpoint whose
  mechanics were never visible is excluded from the overall, not counted against
  the athlete (D-038). Unknown or invented statuses degrade to not_visible, which
  can never manufacture a score. The results page renders the full checklist under
  each bar (met gold, partial faded, missed coral, not-visible hollow).
- **Frame coverage is uniform and dense** (D-041). Extraction covers the whole
  trim window at up to 6fps, capped MAX_FRAMES=40, at 1024px to fit the 4MB body.
  Motion-guided sampling is deleted; the dense send set is the record. The tap
  instant still gets an exact frame.
- **Coach voice** (D-035). One shared coach voice fronts every rubric; disciplines
  resolve to indoor or outdoor (grass and sand judged together, `grass` the stored
  value, `beach` legacy). Player level shapes voice and expected gains only.
- **Model config** (D-027, D-004). The coaching read runs at opus-low effort; coach
  chat at sonnet-medium. Roughly 30k input tokens and ~$0.15-0.20 per full-window
  analysis - **derived, not yet measured live** (Phase 2 telemetry will measure it).
- **PRODUCTION AI IS BACK (2026-07-22).** The owner raised the monthly spend
  cap and the post-cap validation runbook was executed the same day
  (`docs/post-cap-validation.md`, all Claude-executable steps): real dense
  40-frame save on prod (proves 016/017 at the cap; telemetry measured
  31.7k input tokens, ~$0.27 for a maximal run, ~$0.23/analysis
  month-to-date via `/api/usage`), budget guard live-tripped (503 calm copy
  vs 400 control), first scored eval baseline committed (`evals/BASELINE.md`
  at `cac170c`: band agreement 7/18, pass rate 0.11, spread median 6 -
  honest numbers; no quality claim until labeling). Key-splitting and the
  Vercel `ANALYZE_MONTHLY_BUDGET_USD` env remain owner console items.
- **UI restructure shipped 2026-07-21** (D-047 -> D-052): configuration moved off
  the dashboard to `/settings` (D-050) and the dashboard gained an xl right rail;
  scoreboard sides are Home (court blue) vs Guest (coral) (D-051); coach chat is
  dark behind `NEXT_PUBLIC_COACH_ENABLED` with hardened quotas ready (D-047);
  outdoor Learn content now derives from the authored outdoor base (D-048);
  analyze runs environment -> skill -> film as explicit steps with a wider video
  stage and a metric-checkpoint legend (D-052); analyses are shareable as
  revocable token links carrying the full breakdown plus the clip, never frames
  (D-049). Repo standard: `docs/ui.md`.
- **Named Vollyio 2026-07-24** (D-058). Every brand string, asset name, package
  name, localStorage key, and service worker cache renamed off Sideout; production
  URL repointed to vollyio.com. `archive/` left as historical material. One
  accepted cost: the localStorage rename resets an in-progress scoreboard match
  once. Same commit range carried a breakdown legibility pass (bigger metrics,
  summary, and clip; base font-size 106.25% on `html`), an iOS Safari clip-height
  fix, and the em dash ban made structural in `scripts/lint.mjs`.
- **Player feedback on breakdowns** (D-055): `analysis_feedback` (migration 022,
  owner-only RLS + parent-analysis `exists()` check, upsert on `analysis_id`) with
  a one-tap widget under every breakdown. Asked as **"Was this helpful?"** as of
  2026-07-26 (reframed from "Did this breakdown nail it?" - usefulness is what the
  player can actually judge); a negative answer collects wrong player / off read /
  nothing usable plus an optional note. This is the real-usage ground-truth stream
  that does not wait on hand-labeling. The stored column is still `was_right`.
- **Sharing is a link, not an image** (D-057). A full-breakdown share image was
  built and removed the same day; `ShareCard` is gone. Sharing is the revocable,
  30-day token link only (`/share/[token]`), which carries the clip, stays
  truthful on re-read, and needs one renderer instead of two.
- **A flawless rep now reaches 100** (D-056, FIXED 2026-07-26). The
  100-is-attainable ruling had shipped only into the prompt prose, while the
  displayed number is derived in code from pointer verdicts, so `RAW_CEILING = 95`
  in `lib/ai/pointers.ts` still capped every metric and the weighted overall.
  Ceiling is now 100: still linear, still uncurved, floor still 30, one standard
  (D-037/D-040 intact). The UI already said "out of 100" everywhere. One
  consequence: `evals/BASELINE.md` was measured at the 95 ceiling, so its
  band-agreement numbers need a re-run before they are cited again.
- **Migration state**: 017 (frame cap 40), 019 (share links), 020 (share-clip
  policy fix), and 021 (usage aggregates) are APPLIED to prod and verified.
  018 (coach quotas) is COMMITTED, NOT APPLIED - coach is dark so it is inert;
  apply it before or with any coach re-enable. 022 (analysis feedback) was
  VERIFIED APPLIED 2026-07-26 (applied 07-23, one feedback row already stored),
  and 023 (grant leak repair, D-059) was applied and verified the same day.
  Live migration state read directly on 2026-07-26: everything through 023
  except 018. Since then 026 (monthly allowance), 027 (the plan writer), and
  028 (billing quota scope + telemetry bounds) have been APPLIED to prod - do
  not rewrite them; a further change is a new file numbered 029 up. 024 and 025
  were not re-read this session, so their live state is unconfirmed rather than
  known. One thing to know about 028 landing ahead of its application code: it
  recreates `consume_api_quota` with the same body 018 carries, so the
  `coach_daily` scope and the tightened 20/hr `coach` limit are live in
  production now, and `/api/players` (which shares the `coach` scope) is bounded
  at 20/hr rather than 60 today. What 018 still holds that 028 does not is the
  `refund_api_quota` rewrite.
- **Share links are LIVE** (D-049, D-054): minted, streamed anonymously (206
  with Range), and revoked end-to-end against prod 2026-07-21. The 019 anon
  clip policy could never pass (RLS policy subqueries run with the caller's
  privileges); migration 020's SECURITY DEFINER predicate fixed it.
- **Spend containment shipped** (D-054): `/api/usage` dev-only estimate
  report over `analyses.telemetry` (partial-month measured ~$0.19/analysis,
  inside D-027's derived range), and a self-imposed monthly budget guard in
  the analyze route behind `ANALYZE_MONTHLY_BUDGET_USD` (unset = disabled;
  tripped/unknown = the calm capacity 503, fail closed). 429/402 now render
  calm on the client instead of coral (`lib/analyze-status.ts`).
- **CORRECTED 2026-07-31 (D-078): billing is BUILT and LIVE, and both numbers
  below have changed.** A real card was charged on 2026-07-31 and the webhook
  fired, so "inert" is false. Free is now **3 completed analyses at signup, once,
  then 1 per calendar month** (D-076, migration 040; `signup_grant()` sits beside
  `plan_monthly_allowance()`), and Pro is **$9.99/mo** for 18 (D-077). The
  mechanics described in the rest of this bullet did not change. Original text:

- **Billing is BUILT and INERT** (2026-07-27, D-064, `docs/billing.md`). A paid
  plan exists in code: free is 3 completed analyses per UTC calendar month, Pro is
  $14.99/mo for 18 (`lib/plans.ts` pinned against migration 026's SQL). The window
  is the UTC calendar month, not the subscription anniversary, and the count reads
  stored analysis rows, so a failed clip costs the player nothing. Shipped with it:
  three routes under `app/api/stripe/` (checkout, portal, and a webhook that
  verifies the HMAC over the raw bytes before parsing), a Settings plan card, a
  remaining-count line on the dashboard and the analyze page, and a 402 the client
  renders as a calm state rather than an error. `profiles.plan` now has exactly one
  writer, `set_subscription_plan`, granted to `service_role` and reached only from
  the signed webhook (migration 027). That is the first thing in the repo to need a
  service-role key: `lib/supabase/service.ts` is its only reader, the webhook route
  its only importer, and a second importer is a security change rather than a
  refactor. Migration 028 added a `billing` quota scope (10/hr) for the two payment
  routes and bounded `analyses.telemetry`. **None of it is switched on**: metering
  needs `BILLING_ENABLED=true` AND `NEXT_PUBLIC_UPGRADE_URL`, and checkout refuses
  on top of that unless free-tier enforcement is genuinely on. **None of it is
  deployed either**: `9de3f2b` sits one commit ahead of `origin/master`, so
  production is still serving `24da4a8` while its database already carries 026-028.
- **Security** is live and is authored by `docs/security.md`: atomic per-endpoint
  quotas, entitlement reservations, least-privilege grants, bounded uploads;
  migrations 011-013 applied. Read/update its matrices with any surface change.
  The one anon data surface is `analysis_by_share_token` + the live-link clips
  policy (D-049, migration 019).
- **Git**: work merges fast-forward to `master`. Push to `master` auto-deploys.
- **Repo hygiene (2026-07-21, this session)**: benchmark artifacts and retired docs
  moved to `archive/`, eval footage out of `public/`, docs pruned to a living set,
  `README.md` and this file rewritten to current reality (D-042).

## Standing rules
`AGENTS.md` + `docs/security.md` + `docs/decisions.md` D-001 bind every change. No
attribution trailers; no vendor names in UI/docs (the AI layer is "the coaching
service", the payment layer is "the payment provider"; vendor strings survive only
as env var names and code paths, `ANTHROPIC_API_KEY`, `STRIPE_*`,
`app/api/stripe/`, never in anything a player reads); design tokens
locked in `app/globals.css @theme`; middleware is `proxy.ts`; dependency budget
gated by the 10.5 viability gate. Every route handler and server action
authenticates and authorizes inside itself; cookie-authenticated mutations also
same-origin-check; paid calls consume an atomic quota first. TDD where behavior
changes (watch the test fail first). Gates before any commit: `npm run lint`,
`npm run typecheck`, `npm test`, `npm run build`, all green. Decisions of
consequence get numbered entries in `docs/decisions.md`.

## Open items needing the owner

Closed since the last revision: the coaching-service spend cap was raised
(2026-07-22) and `ANALYZE_MONTHLY_BUDGET_USD=25` is now set in Vercel
Production, so the in-app budget guard (D-054, migration 021) is the second wall
beneath the provider cap. The key split below is what remains of that item.

1. **Split API access** - create a separate dev workspace in the provider console
   with its own spend limit (suggest $10-20/mo) and a distinct key, spend alerts
   on both; the dev key goes in `.env.local` only and the production key in Vercel
   Production env only. After this, local usage can never take prod down again.
2. **Rotate the briefly-exposed Supabase credentials** (`SUPABASE_JWT_SECRET` and
   siblings were removed from prod env but never rotated).
3. **Resolve the likeness gate** on `public/film-court.webp` (D-022): consent, swap
   to the synthetic plate, or accept knowingly. Record the choice in `docs/decisions.md`.
4. **Supabase->GitHub deploy integration looks misconfigured** (a Windows absolute
   path where a repo-relative one belongs); may re-apply old migrations if it starts.
5. **Counsel skim of `/privacy` and `/terms`** before any marketing push.
6. **Eval labeling** (see `evals/LABELING.md`): label all 18 active cases, source
   intermediate/expert footage, then run a scored baseline and stability check.
7. **Migration 018 (coach quotas) before or with any coach re-enable**
   (`NEXT_PUBLIC_COACH_ENABLED=true` in Vercel is the switch; leave unset to
   stay dark). Narrower than it was: 028 already put 018's `consume_api_quota`
   body and the `coach_daily` scope into production, so what 018 still carries
   is the `refund_api_quota` rewrite that knows `coach_daily`. Apply it anyway
   rather than reasoning about which half is live.
8. **Enable leaked-password protection** in the Supabase auth dashboard. The
   security advisor flags it as off; it checks new passwords against a breach
   corpus. One toggle, and it pairs with the managed bot protection this file
   already wants before a public push. It matters more now than it did: the
   monthly reset replaced the lifetime-one free rule, so a farmed account is
   worth 3 analyses a month forever rather than one ever (`docs/billing.md`
   section 6). **D-076 narrowed this: a farmed account is now worth 3 once plus
   1 a month, so the yield is a third of what this line assumed.** While in the advisor: the `SECURITY DEFINER` functions it reports
   as callable by `authenticated` are **expected and correct** for this project.
   Each derives `auth.uid()` itself and acts only on the caller, which is the
   mechanism that scopes a player to their own rows. The two that would be an
   incident rather than a warning are `set_subscription_plan` and
   `user_id_for_billing_customer`: both are `service_role` only, and either one
   showing up as callable by `authenticated` means the billing boundary is open.
9. **Re-run the eval baseline** (D-056). The 100 ceiling shipped, so
   `evals/BASELINE.md` at `cac170c` was measured against a scale that no longer
   exists. Its band-agreement figures must not be cited until a re-run replaces
   them, and labeling (item 6) wants the same run anyway.
10. **Set the two billing secrets only the owner can read.** `SUPABASE_SERVICE_ROLE_KEY`
    first, `STRIPE_SECRET_KEY` last; `STRIPE_WEBHOOK_SECRET` is already in Vercel
    Production, which is the half that has to precede the key. Key-last is
    the ordering that cannot strand a paying player: a deployment able to take a
    payment before it can verify an event would never write the plan, never record
    the customer reference, and leave the player unable to reach the portal to
    cancel. `STRIPE_PRICE_ID`, `NEXT_PUBLIC_UPGRADE_URL`, and `OWNER_ALERT_EMAIL`
    are already set. `BILLING_ENABLED` stays unset until item 11 passes.
11. **Run the billing verification `B0`-`B10`** in `docs/security.md` against a
    staging project before arming anything. `B2` through `B5` are the point of the
    exercise: no test in the suite can run them, because the grants, the row
    security, and the signature are properties of a live database and a live
    endpoint. A passing typecheck is not a denied write.
12. **Confirm the customer portal settings** in the provider dashboard: cancel at
    period end, payment method updates, plan switching disabled (there is only one
    plan). The product, the monthly price (now $9.99, `price_1TzKG5JOFP4i3BqJC2z0xklp`,
    D-077), and the webhook endpoint exist;
    the portal configuration cannot be read from the repo, and the portal route is
    a subscriber's only route to cancelling.
13. **Managed bot protection and the hosting-firewall rules** before arming the
    monthly reset, not merely before a marketing push. Signup has no captcha and
    no firewall today; lifetime-one is what currently makes that safe, and the
    monthly reset removes it (`docs/billing.md` section 6). If this slips, watch
    signups per day and analyses per account for the first month, because the
    failure mode is quiet.

## Device-verification checklist (current flow)
Nothing in the post-D-033 flow has been eyeballed in a browser. The spend cap that
blocked this was raised on 2026-07-22, so nothing is holding it up: the owner runs
one clip end to end on a real phone against production and
marks each item pass/fail with a date (commit as
`archive/receipts/device-verify-YYYY-MM-DD.md`):
1. Framing card opens on upload; scrubbing shows coach-spotted candidates as a
   numbered list with dots (D-036), or a direct tap works.
2. Tap-and-ring: the pick burns a hollow gold ring on the frame; scrubbing >250ms
   away clears a stale mark.
3. Analyze runs dense uniform coverage over the trim window with visible progress
   and completes inside `maxDuration`.
4. Results render the pointer checklist under each metric bar with correct colors
   (met gold, partial faded, missed coral, not-visible hollow) and cue text.
5. Unobserved checkpoints show "Not visible" with a dashed track and are excluded
   from the overall.
6. The `subject_check` line reads confirmed / mismatch / unmarked correctly for the
   ringed athlete.
7. The number is blunt and uncurved; notes name faults by pointer without softening.

## Next step
Push `master`. The middleware fix (D-060) is already live, but the billing commit
`9de3f2b` is unpushed, so production is serving code that predates it against a
database that already carries 026-028. The gap is benign today: billing is inert
either way while `BILLING_ENABLED` is unset, and the free rule the analyze path
reserves against is unchanged. It should still not be left standing. The one
behavior change 028 already made to the live site is `/api/players` sharing the
tightened 20/hr coach quota instead of the old 60.

Then re-run the eval baseline against the 100 ceiling (Open items 9). Then the
standing list: the owner's seven-item real-phone device checklist (below), eval
labeling (`evals/LABELING.md` - the biggest scoring-trust lever; the committed
baseline gives labeling a concrete target list), the dev/prod key split (Open
items 1), and coach re-enable whenever wanted (018 applied first).

Arming billing is deliberately a several-step operation and not a flag: Open
items 10 through 13, in that order, and `docs/deploy.md` "Billing rollout" is the
operator-facing version of the same sequence.

Known doc drift, in files this pass does not own: `docs/security.md` still says
`/api/stripe/checkout` and `/api/stripe/portal` carry no atomic quota and still
records `/api/coach` at 60/hr, both of which migration 028 changed; its `B0` note
says the configuration gate reads only the key and the price, while
`stripeConfigured()` requires the endpoint secret too. `docs/billing.md` still
reads as though the migrations and the provider objects are outstanding, and
documents `set_subscription_plan` with five arguments where the shipped function
takes six. `.env.example` lists none of the billing variables.

Note that D-055's feedback stream and eval labeling answer the same question
from opposite ends. Feedback is free, arrives from real reps, and grades
usefulness; labeling is slow, costs the owner's time, and grades correctness
against a known answer. Getting 022 applied first means the cheap stream is
running while the expensive one is still being built.

## Session log
- **2026-07-27 (Session 7, the billing surface)** - `9de3f2b` built the paid path
  end to end and left it switched off: migration 026 replaced the lifetime-one
  free rule with a per-plan count over the UTC calendar month, 027 gave
  `profiles.plan` its one `service_role` writer plus the customer reverse lookup,
  028 added a `billing` quota scope for the two payment routes and bounded
  `analyses.telemetry` against a player writing their own token counts. Three
  routes under `app/api/stripe/`, a plan card, a remaining-count surface, a calm
  402, and the first service-role client in the repo (one reader, one importer).
  026/027/028 applied to prod; the live product, price, and webhook endpoint
  exist; `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `BILLING_ENABLED`
  are deliberately absent, so nothing is metered and no money can move. Decisions
  in D-064. Gates green at `9de3f2b`: lint, typecheck, 236 tests, build. This
  entry and the docs resync (`README.md`, `SETUP.md`, `docs/deploy.md`, this file)
  followed the build; the drift left in `docs/security.md`, `docs/billing.md`, and
  `.env.example` is listed under Next step rather than silently fixed.
- **2026-07-26 (Session 6c, live infrastructure audit)** - Connectors authorized,
  so prod was read directly for the first time this session. Confirmed migration
  022 applied 07-23 (one feedback row stored, so the widget works). Found and
  fixed two defects nobody was watching. D-059: 012's default-privilege revoke
  named four privileges, so every table created after it inherited TRUNCATE,
  REFERENCES, and TRIGGER for `anon` and `authenticated` (`share_links`,
  `analysis_feedback`); TRUNCATE bypasses RLS, which is the tenant boundary.
  Migration 023 widens the default to `revoke all` and strips the leak; applied
  to prod and verified, column grants intact. D-060: `proxy.ts` asserted its
  Supabase env with `!` and threw on every matched path when unset, which is
  nearly the whole site, and the `getUser()` fallback was unguarded too;
  production had been logging it since 07-07. Routing moved to a tested
  `lib/route-guard.ts` where missing config, failed verification, and a real
  visitor all collapse to `userId = null`, fail-closed by construction. Also
  triaged the Supabase security advisor: the SECURITY DEFINER warnings are all
  documented-by-design, `rls_auto_enable` is a Supabase platform event-trigger
  function that cannot be called over RPC, and leaked-password protection is off
  (now Open items 8). 136 tests; lint, typecheck, build green.
- **2026-07-26 (Session 6b, the three defects the docs pass exposed)** - Fixed
  D-056: `RAW_CEILING` 95 -> 100, so a flawless rep scores what every "out of
  100" label in the UI already promised (tests re-pinned to 100 first, watched
  fail, then fixed). Fixed the feedback widget's Change button, which set
  `correcting` and dropped the player straight into the negative form, leaving
  anyone who had answered "did not help" with no path back to helpful; `revising`
  and `correcting` are now separate states, Cancel restores from what is stored
  rather than from the stale `initial` prop, and a Cancel affordance exists on the
  re-opened question. Backfilled `docs/security.md`, which was missing a row for
  every surface added since D-049: `share_links`, `analysis_feedback`,
  `POST /api/players`, `GET /api/usage`, `GET /share/[token]` and its clip route,
  the `analysis_by_share_token` function, and a `clips` bucket row that still
  claimed owner-only read after 019/020 opened the shared path. The "simple
  version" now admits its one visitor-readable exception. 132 tests; lint,
  typecheck, and build green.
- **2026-07-26 (Session 6, feedback copy + docs brought current)** - Reframed the
  breakdown feedback ask from "Did this breakdown nail it?" / "Yes, nailed it" to
  "Was this helpful?" / "Yes, helpful", with the standing answer reading back as
  helpful / did not help and the third reason chip changed from the now-circular
  "Not helpful" to "Nothing I can use" (D-055). Copy and comments only; the
  `was_right` column and the whole write path are untouched. Then closed the
  four-day documentation gap: D-055 (feedback), D-056 (the 100-ceiling defect),
  D-057 (share link over share image), D-058 (the Vollyio rename and the
  legibility pass) written up, and this file brought to current state. The
  documentation pass is what surfaced D-056: the 07-23 "scoring reaches 100" work
  edited only the prompt prose, and code-derived scoring (D-039/D-040) means the
  displayed number never sees it. 132 tests; lint, typecheck, and build green.
- **2026-07-23 / 24 (Session 5, feedback, share, and the rename)** - Undocumented
  until 2026-07-26; see D-055 through D-058. In order: `analysis_feedback` +
  migration 022 + the widget, the 94-100 prose remap, and the base type bump;
  breakdown legibility enlargement plus the repo-wide em dash removal and the
  lint rule that keeps it that way; the iOS Safari clip-height fix; the
  full-breakdown share image built and then dropped for the read-only token
  link; and the Sideout -> Vollyio rename onto vollyio.com.
- **2026-07-22 (Session 4, post-cap runbook executed)** - Owner raised the
  spend cap; the whole `docs/post-cap-validation.md` sequence ran the same
  night. Live key confirmed; eval pre-checks green; full eval run (18 cases
  x2, zero failed runs) + first scored baseline committed (`cac170c`);
  real 40-frame serve analysis saved through prod (throwaway account via
  local Playwright - the owner's Chrome automation tab throttles video
  decode, so the extension path can't do uploads; account deleted after,
  which also live-tested 015's media purge: 41 storage objects gone);
  `/api/usage` verified against live data ($0.23/analysis month-to-date);
  budget guard tripped for real on a 1-cent `next start` and controlled
  against prod. Remaining: owner device checklist, labeling, key split.
- **2026-07-21 (Session 3, spend containment + share links live, D-054)** -
  Applied 019 to prod; the end-to-end share check caught that anon clip
  streaming could never work (RLS policy subqueries run with caller
  privileges) and migration 020 fixed it with a SECURITY DEFINER predicate -
  mint/stream/revoke all verified live. Shipped migration 021 (usage
  aggregates, authenticated-only), `lib/ai/pricing.ts` (estimate-only rates,
  throws on unknown models), `/api/usage` (dev-only report), the
  `ANALYZE_MONTHLY_BUDGET_USD` guard in the analyze route (fail closed,
  dormant until the env var is set), calm 429/402 client states
  (`lib/analyze-status.ts`), share expiry copy + bespoke dead-link page, and
  `docs/post-cap-validation.md` (pre-checks run green). 132 tests; gates
  green.
- **2026-07-21 (Session 2, UI restructure D-047 -> D-052)** - Eight work
  packages planned with the owner and merged FF to master: migration-file
  hygiene (missing 014s reconstructed; prod already allowed grass) + `docs/ui.md`
  + onboarding error surfacing; `/settings` page + dashboard xl rail (D-050);
  scoreboard Home/Guest with court-blue token (D-051); coach dark + hardened
  quotas, migration 018 committed-not-applied (D-047); outdoor Learn content
  from the beach-authored base with combined surface notes (D-048); analyze
  flow environment-first with required skill step, wider video stage, metric
  legend (D-052); public share links with full breakdown + clip via one anon
  RPC + live-link clips policy, migration 019 committed-not-applied (D-049).
  109 tests green; every branch passed lint/typecheck/test/build. Parallel
  session applied migration 017 to prod (verified: cap 40 live).
- **2026-07-21 (Session 1 foundation)** - Repo made to tell the truth. Located the
  live repo (`G:\OneDrive\Documents\Projects\sideout`; two stale copies exist on
  disk). Moved ~90 MB of benchmark artifacts and retired docs into `archive/`
  (heavy footage-laden outputs untracked and gitignored, the small reproducible
  methodology kept tracked in `scripts/benchmark/`, D-042); confirmed no
  git-tracked artifact exceeds 10 MB (no history bloat). Moved eval footage out of
  `public/` into `evals/footage/` (gitignored). Pruned `docs/` to a living set,
  folded frontend+motion+tooling into one `docs/frontend.md` and validation-plan
  into the roadmap, wrote `docs/README.md` and `archive/README.md`, rewrote
  `README.md` and this file to the post-D-033 world. Then Phase 2 degraded-service
  handling + analyze telemetry, Phase 3 eval labeling path. Gates green per commit.
- **2026-07-20 (architecture arc, D-027 -> D-041)** - See `docs/decisions.md`. In
  order: reasoning effort pinned per tier (D-027); pose engine swapped to a
  shippable licence then removed entirely after two blind kill gates (D-028, D-033);
  free tier now with billing documented as future (D-029); mandatory subject choice
  with model accountability (D-030); eval harness stopped reporting agreement it had
  not earned (D-031); score calibration curve, then one coach voice, mechanics-only,
  one standard, unobserved-excluded, pointer checklist, all hedges removed, dense
  uniform coverage (D-034 -> D-041). Production hit its monthly API spend cap
  mid-validation of D-041.
