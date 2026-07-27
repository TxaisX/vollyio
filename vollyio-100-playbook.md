# Vollyio — The Road-to-100 Prompt Playbook

*Six copy-paste prompts that drive Vollyio from ~62 to 100. Run them in order. Each session ends with a self-scored gate report against the rubric below, and hands you a short card of things only a human can do — designed so your part is never more than an evening. A session may only claim points its own gates verified. This makes 100 something you reach by prompting, with your role reduced to executing the printed cards between sessions.*

---

## The 100-point rubric

The score stops being a vibe and becomes this checklist. Every criterion is verifiable — by a test, a command, a live URL, or a dated artifact in the repo. Sessions must cite the evidence when claiming points.

| # | Criterion | Pts | Verified by |
|---|---|---|---|
| 1 | Repo truth: HANDOFF/README current, dead docs archived, no footage in `public/`, clutter archived | 8 | Session 1 gate |
| 2 | Degraded-service handling: quota/credit outage shows honest message, burns no entitlement, test-pinned | 5 | Session 1 gate |
| 3 | Cost + latency telemetry live; real $/analysis and duration measured from ≥10 production calls | 5 | Session 3 gate |
| 4 | Prod key separated from experiment key, spend caps + alert set | 4 | Card A receipt |
| 5 | Credentials rotated; likeness gate resolved; counsel has seen `/privacy` + `/terms` | 5 | Card A receipt |
| 6 | All eval cases labeled with reviewer provenance; intermediate + expert footage ≥40% of set | 8 | Session 3 gate |
| 7 | Scored baseline written (non-provisional), release gates pass: ≤5% unsupported claims, ≥95% correct abstention | 10 | Session 3 gate |
| 8 | Stability: median 3-run range ≤5 pts, p95 ≤8, on ≥10 cases | 6 | Session 3 gate |
| 9 | Device verification of the current flow (tap-and-ring, dense coverage, checklist render) — dated checklist run | 5 | Card B receipt |
| 10 | Priority-fix loop: next analysis of a skill references the last fix; dashboard shows fix-over-time | 6 | Session 2 gate |
| 11 | Public sample breakdown live, linked from landing, zero marginal cost per view | 4 | Session 2 gate |
| 12 | Feedback + retention instrumentation: in-app feedback capture, return-rate measurable | 4 | Session 2 gate |
| 13 | Beta kit shipped: invite page, onboarding email drafts, coach one-pager | 3 | Session 4 gate |
| 14 | ≥10 real external users completed ≥1 analysis each | 6 | Session 5, from DB |
| 15 | ≥1 genuine testimonial live (named, consented) | 3 | Session 5 gate |
| 16 | Beta feedback triaged; top 3 issues fixed and re-verified | 6 | Session 5 gate |
| 17 | Coach-agreement study: pointer verdicts vs ≥2 human coaches on ≥15 clips, agreement published on site | 6 | Session 6 gate |
| 18 | Billing live per D-029: Stripe, plan writer, upgrade URL, truth-table tests, one real test purchase | 4 | Session 6 gate |
| 19 | Domain + business support address + uptime/error alerting | 2 | Card D receipt |

**Total: 100.** Cards A–D are the human moves; every one is scripted by a session and none should exceed an evening.

---

## Session 1 — Foundation

Use `vollyio-improvement-prompt.md` (already in the repo root) exactly as written. It covers criteria 1–2 and preps 3. Its NOT VERIFIED list becomes **Card A**:

> **Card A (console + consent, ~1 hour):** create a second API key so prod ≠ experiments, set per-key spend caps + a spend alert, raise the monthly cap; rotate the briefly-exposed Supabase credentials; decide the likeness gate (consent, swap, or accept — record which in `docs/decisions.md`); email `/privacy` + `/terms` to counsel. Save screenshots/receipts to `archive/receipts/` — later sessions count points 4–5 only against these.

---

## Session 2 — Retention & the public face

```
You are working on Vollyio (read AGENTS.md, docs/security.md, docs/decisions.md D-027 onward, and HANDOFF.md — current as of Session 1's rewrite). This session ships three user-visible things, each behind the full gate (lint, typecheck, test, build), each its own commit, decisions recorded.

1. PRIORITY-FIX LOOP (rubric #10). When a player analyzes a skill they've analyzed before, the new breakdown opens with a "Last time" strip: the previous priority fix and whether the checkpoint behind it moved (its pointer statuses then vs now — the data is in stored results; no schema change to model output). The dashboard's skill card gains a one-line fix history. Respect docs/security.md for any query change; RLS already scopes rows to the owner.

2. PUBLIC SAMPLE BREAKDOWN (rubric #11). A read-only public route rendering ONE real analysis from a static JSON snapshot committed to the repo (owner's own rep only — likeness rule). It must show the pointer checklist, an honest "not visible" checkpoint, and the subject-check line, because the honesty IS the pitch. Link it from the landing FAQ and hero secondary CTA. No auth, no DB read, no coaching-service call — zero marginal cost. Add noindex until the owner approves the clip, then a card note to flip it.

3. FEEDBACK + RETURN INSTRUMENTATION (rubric #12). After each viewed breakdown, one lightweight prompt: "Did this read your rep right?" yes/no + optional short text, stored in a new RLS-scoped table (update security.md matrices, add migration). A tiny server-derived stat so return rate is queryable: analyses per account per week. No third-party analytics beyond what's already installed.

End with the gate report scored against the rubric, citing evidence per point claimed, and print Card B:

CARD B (owner phone session, ~30 min): the current-flow device checklist from HANDOFF — run it on a real phone against production once Card A's key work is done, mark each item pass/fail with date, commit as archive/receipts/device-verify-YYYY-MM-DD.md. Also: pick the sample-breakdown clip and confirm consent to publish it unindexed→indexed.
```

---

## Session 3 — Evidence (the trust points)

*Run after Cards A and B. This session spends API budget deliberately — state the measured spend in the report.*

```
You are working on Vollyio (read AGENTS.md, docs/security.md, docs/decisions.md D-027 onward, HANDOFF.md, evals/LABELING.md). Card A receipts should show a separated, funded API key; verify archive/receipts/ and stop with a clear message if not.

1. LABELING SPRINT PREP (rubric #6). Make labeling fast enough to finish tonight: extend the review UI (scripts/review-evals.mjs) so each case can be labeled in-place (weakest metric, band, "unknown" as a legitimate answer, reviewer provenance) in under 2 minutes. Then print Card C part 1 and PAUSE this workstream until labels exist — never invent a label.

2. MEASURED ECONOMICS (rubric #3). With telemetry from Session 1 live, pull the last N production analyses: real token counts, $/analysis, wall-clock vs maxDuration. Write docs/economics.md with measured numbers and update the D-027 open risks with facts.

3. BASELINE + STABILITY (rubric #7, #8) — after labels land: run the scored baseline (make-baseline without --force; it must stop being provisional on merit), then 3-run stability on ≥10 cases. Compare against the release gates in docs/analysis-validation-roadmap.md. If gates FAIL, that is a finding, not a defeat: diagnose (which skills, which pointers drift), fix the narrowest thing (pointer wording, RAW_FLOOR/RAW_CEILING recalibration against labels — never prompt-hunting per D-034), re-run. Record every number honestly in evals/BASELINE.md, including failures.

CARD C (owner, one evening): label every active case in the review UI (~2 min each); source intermediate/expert clips per evals/SOURCING.md until they are ≥40% of the set (your own footage + consenting teammates is the fast path); re-run the ingest command per case. Then re-invoke this session's step 3.
```

---

## Session 4 — The beta kit

```
You are working on Vollyio (usual reading list). Build everything a 10-player beta needs so the owner only has to hit send (rubric #13).

1. An invite landing route (/beta) with honest positioning backed by Session 3's real numbers ("scores stable within ±N points run-to-run" — cite evals/BASELINE.md, never round up), what beta users get, what data is kept, deletion promise.
2. Outreach drafts in docs/beta-kit.md: a short DM for players, an email for a club coach, and a one-page coach explainer (what the checklist means, what "not visible" means) — written in the site's voice per docs/copy.md, zero hype, no fabricated claims.
3. A weekly owner digest: script that queries (RLS-respecting service path, security.md updated) signups, analyses run, feedback yes/no ratio, return rate — printed as one text block the owner can read in 30 seconds.
4. Flip the sample breakdown to indexed if Card B consent is recorded.

Gate report + Card D:

CARD D (owner, ~2 hours + calendar time): buy the domain, set the business support address, wire uptime/error alerting (Vercel + a spend alert already exists from Card A); send the outreach to one club/team and 5–10 individual players. The calendar does the rest — rubric #14 and #15 cannot be rushed by any prompt, only made frictionless, which this session just did.
```

---

## Session 5 — Beta harvest

*Run ~3–4 weeks after Card D, once ≥10 external users have analyses in the DB.*

```
You are working on Vollyio (usual reading list). This session converts beta reality into points 14–16.

1. Verify from the database: count distinct external accounts with ≥1 completed analysis (exclude the owner). Report the true number — if <10, say so and stop scoring #14.
2. Triage every piece of feedback (feedback table + anything in docs/beta-kit.md the owner pasted in): cluster, rank by frequency × severity, fix the top 3 with full TDD + gates, and re-verify each fix against the reporting user's actual case shape.
3. If the owner has secured a testimonial (consented, named), place it on the landing in the slot that has deliberately stayed empty since launch — the first real social proof. If not, print exactly what to ask the happiest beta user, based on their real usage.
4. Re-run the Session 3 stability check on any skill whose pointers changed in step 2. Calibration must survive iteration.
```

---

## Session 6 — Proof and commerce

```
You are working on Vollyio (usual reading list). The last 10 points.

1. COACH-AGREEMENT STUDY (rubric #17). Build the study harness: select ≥15 labeled clips across skills/levels, produce a blinded scoring sheet for human coaches (checkpoint verdicts, no model output visible), and an agreement computation (per-pointer agreement + score correlation) that writes docs/validation-study.md. Print the card: owner recruits 2 coaches (the beta club's coach is the warm path), each spends ~1 hour. When the sheets return, ingest and compute honestly — publish the real agreement number on the site's FAQ ("our checklist agrees with certified coaches N% of the time"), whatever it is. If it is bad, that is the most valuable finding this product has ever produced: diagnose per-pointer and fix.
2. BILLING (rubric #18). Implement D-029's checklist exactly: Stripe (through the 10.5 dependency gate, decision entry), checkout + webhook writing profiles.plan server-side only, a real upgrade URL, pricing page per vollyio-commercialization.html revised against docs/economics.md's measured costs, lib/billing.ts truth-table extended and test-pinned. Free tier stays default; flipping BILLING_ENABLED remains a deliberate two-key owner action. One real test-mode purchase E2E before claiming the points.
3. Final rubric audit: walk all 19 criteria, verify each against its evidence, output the honest total. Anything unverified stays unclaimed — print the residual card instead.
```

---

## Operating rules for every session

- Scores come only from the rubric; evidence or it didn't happen. No session inflates its predecessor's claims.
- All work obeys AGENTS.md + docs/security.md; decisions of consequence get numbered entries; every commit passes lint, typecheck, tests, and prod build.
- If a session finds reality diverging from this playbook (a criterion already met, or newly impossible), it updates the playbook file itself with a dated note rather than pretending.
- The calendar items (#14–17) are the only points prompting cannot compress — the sessions make them frictionless, the cards make them small, and the weeks do the rest.
