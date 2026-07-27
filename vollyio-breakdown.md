# Vollyio — Full Breakdown
*Written 2026-07-21, from a complete read of the repo (HANDOFF, decision log D-001→D-041, security docs, the analyze pipeline, landing page) and the live site at vollyio.com.*

---

## 1. What Vollyio is

Vollyio is a volleyball skill-analysis and AI coaching web app. A player uploads a clip of one rep (serve, pass, set, attack, block, or defense), trims it to a window, scrubs to their athlete and taps them — a hollow gold ring gets burned onto that frame — and the coaching service watches the whole clip as uniform dense frames (up to 40 at 6fps). Scoring is not free-scored by the model: each skill has 5 checkpoints × 4 observable mechanical pointers (120 total), the model judges each pointer as met / partial / missed / not-visible, and **the number is derived in code** from that checklist. Unobserved checkpoints are excluded rather than defaulted, and the model must state *who* it analyzed (`subject_check`) so a wrong-subject read surfaces as a warning instead of hiding.

Around that core sits a full product loop: quiz-first onboarding funnel (`/start`), skill ratings (EWMA per skill per discipline), XP and streaks, goals, a coach chat, learn content, drills, history, and a scoreboard. Free community beta; billing is deliberately inert until a real payment path exists (D-029 made the flag two-key so it can't lock users out).

**Stack:** Next.js 16.2 App Router + React 19, Supabase (auth, Postgres 17 with RLS on all 8 tables, storage), Anthropic SDK server-side only ("the coaching service" — never vendor-named), Vercel auto-deploy from `master`, 4 production env vars total.

## 2. What's genuinely working

**The integrity architecture is the product's real moat.** Most AI-coaching apps ship "VLM vibes." Vollyio has spent the last two weeks building the opposite: blind kill-gate tests that killed its own headline feature when the evidence said so (D-033: the on-device pose engine lost 13–0 in blind judging and produced physically impossible measurements 34% of the time — so it was deleted, ~1,500 lines), pointer-derived scores that explain themselves line by line, honest abstention ("not visible" instead of a hedged default), and an eval harness that was rebuilt specifically so it *can't report agreement it never earned* (D-031). This is rare and it's the right foundation for a trust product.

**Security posture is well past typical side-project level.** Atomic per-endpoint quotas consumed *before* paid calls, entitlement reservations, least-privilege grants with ownership RLS, bounded/typed uploads, same-origin checks on cookie-authed mutations, account deletion that provably purges storage on every path (E2E-verified; a backstop sweep already cleared 779 orphaned files), and `docs/security.md` maintained as a living authority with access-control matrices.

**Engineering discipline.** CI runs policy lint + typecheck + tests + prod build on every push; the decision log (`docs/decisions.md`) is exceptional — 40+ entries that record not just what was decided but what was rejected and why, including reversals. TDD is actually practiced (RED watched first). Migrations 011–015 are tracked and the 011 defect that 502'd every save was root-caused, fixed, and turned into a non-optional verification step.

**The live site is polished and honest.** Strong visual identity (navy/chalk/gold, locked design tokens), the court-film hero, real legal pages written against actual code behavior, no fabricated social proof (an explicit FTC-driven choice), a11y and reduced-motion handled, PWA installable. The landing copy has already been repositioned around checkpoints and coaching rather than the deleted measurement claims.

## 3. What's not working / at risk

**P0 — Production analysis is down right now.** The API account hit its monthly spend cap mid-validation on 2026-07-20 ("regain access 2026-08-01"), and the *same key serves production* (D-041 closing note). Every live analyze/coach call is currently failing behind a generic error. This has happened twice now (credits ran out 2026-07-13 too). There's no separate prod key, no per-key budget, no user-facing "service is down" state, and no alerting — the owner finds out by testing.

**P0 — Eval frames of real people are staged to ship publicly.** `public/evalframes/` and `public/evalframes-full/` (~30 MB of frames extracted from sourced footage, including recognizable athletes) sit in `public/` — everything there deploys to Vercel and becomes fetchable by URL. They 404 on the current deployment (added after the last push), which means the next `master` push publishes them unless they're moved first. The repo's own rule is "source footage frames never committed." Related: the likeness gate on the landing film (`film-court.webp`, real identifiable people, live since 07-14, still unconfirmed) and the exposed-credentials rotation from the Supabase→Vercel sync are both still open owner items.

**P1 — The scoring system is built for truth but hasn't been fed any.** The honest state per D-031: 18 eval cases, 100% pro-level (target population 0% represented), zero labeled with a weakest-metric, zero carrying measurements, zero scored runs, baseline provisional. Calibration (RAW_FLOOR/RAW_CEILING = 30..95) is anchored on essentially two clips — the owner's rep and one pro clip. The stability gate the roadmap requires (median 3-run range ≤5 pts) has never run. D-041's dense-coverage change shipped mechanism-verified but model-behavior-unverified because the spend cap hit mid-run. The machinery is excellent; the evidence base is n≈2.

**P1 — Unit economics are unmeasured.** Dense coverage costs ~30k input tokens per analysis, estimated $0.15–0.20 at opus-low — but that's derived, not measured, and thinking tokens are now billed on every call (D-027). `maxDuration = 120` may sit below real analyze latency (the ladder suggested ~148s for opus-low, also unmeasured under production shape). The commercialization plan's assumptions rest on these unknowns.

**P2 — The documentation no longer describes the product.** `HANDOFF.md` (the file any new session reads first) still describes the RTMPose engine, ~148 MB model downloads, measured checkpoints, and tracker fixes — *all deleted by D-033*. Its "current next step" points at a branch that's been superseded. `README.md` is still the stock create-next-app file. Roughly half of `docs/` describes systems that no longer exist (pose model selection, CV phase-1 spec, the orchestration-era ledgers). The only accurate current-state document is the tail of `decisions.md` — which is also why the folder feels cluttered: the truth is buried under strata of dead docs and ~90 MB of loose benchmark artifacts in the repo root.

**P2 — Product gaps between "works" and "retains."** The core loop is single-session: analyze → read breakdown. Nothing pulls a player back (no progress narrative over time, no follow-up on whether the priority fix improved, drills aren't connected back to re-analysis). A visitor can't see the product before signup — no sample analysis to poke at. When the coaching service is down (like right now), users get a dead generic error rather than a status. And the tap-and-ring flow, dense coverage, and the whole current pipeline have exactly one real-device verification run behind them.

## 4. How to make it better, in order

1. **Separate and cap the money.** Distinct API keys for prod vs experiments, per-key spend limits, raise the cap, and add a degraded-service banner + owner alert so an outage is announced, not discovered. (Partly owner-console work — the repo can only ship the graceful-failure half.)
2. **Close the P0 exposure items:** pull eval frames out of `public/`, resolve the likeness gate, rotate the briefly-exposed credentials.
3. **Buy the evidence the scoring system was built for.** Get intermediate/expert footage into the eval set, label weakest-metrics (human, ~an evening of work with the existing `label-case.mjs` tooling), run one real scored baseline + a 3-run stability check, and *measure* cost and latency per analysis instead of estimating. This converts "honest but unproven" into "honest and demonstrated" — the only durable differentiator this product has.
4. **Make the docs match reality.** Regenerate HANDOFF from D-027→D-041, write a real README, archive everything describing deleted systems, and leave a small living doc set with an index. (Full map in the improvement prompt.)
5. **Ship the retention loop.** Progress-over-time on the dashboard tied to the priority fix ("last time: contact behind shoulder — did it move?"), re-analyze nudges from drills, and a public sample breakdown so the value is visible pre-signup.
6. **Then launch prep:** counsel pass on legal copy, one real team/club beta for a genuine testimonial, domain + support address, and only then the D-029 billing checklist (Stripe + plan writer + upgrade URL).

## 5. Bottom line

Vollyio's codebase is stronger than most funded startups' — the security work, the decision log, and the willingness to kill its own differentiator on evidence are the marks of a real product culture. Its three weaknesses are all the same weakness: **claims outrunning verification** — a scoring system with no labeled baseline, unit economics that are estimates, docs describing a deleted engine, and a production service whose uptime depends on one shared, capped API key. The next unit of work that matters isn't a new feature; it's making the true things provable and the stale things gone.
