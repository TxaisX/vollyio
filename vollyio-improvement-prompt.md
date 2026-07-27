# Vollyio improvement session — paste this into Claude Code at the repo root

You are working on Vollyio, a volleyball skill-analysis + AI coaching app (Next.js 16 App Router, Supabase, the coaching service server-side, Vercel auto-deploy from `master`, live at vollyio.com). Your job this session is to make the product *honestly* better: no gold-plating, no invented wins, no claim you didn't verify. Where something cannot be verified in-session, you say so explicitly in your final report instead of marking it done.

## Read first, in this order
1. `AGENTS.md` and `docs/security.md` — the constitution. Both bind every change you make.
2. `docs/decisions.md`, entries **D-027 through D-041** — this is the ONLY accurate description of the current system. The on-device pose engine no longer exists (D-033), scores derive from a pointer checklist in code (D-039/D-040), and frame extraction is uniform dense coverage (D-041).
3. `HANDOFF.md` — **treat as historical, not current.** It predates D-028→D-041 and still describes the deleted RTMPose engine. You will rewrite it in Phase 1.

## Standing rules for this session
- Every route handler and server action is directly callable: authenticate, authorize, and same-origin-check inside it. Update `docs/security.md` matrices with any change to a route, action, table, policy, or paid call.
- No vendor names anywhere user-visible. Design tokens in `app/globals.css` `@theme` are closed. Dependency budget is gated per D-001/10.5 — default answer is no.
- TDD where behavior changes: watch the test fail first. Gates before any commit: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. All green or you don't commit.
- Record any decision of consequence as a new numbered entry in `docs/decisions.md`, including what you rejected.
- Honesty floor: a check that didn't run is "skipped," never "passed." Your final report must contain a **NOT VERIFIED** section listing everything that still needs the owner or a real device.

---

## Phase 1 — Make the repo tell the truth (docs + clutter)

The repo root and `docs/` carry ~90 MB of benchmark artifacts and a stratum of docs describing deleted systems. Fix it with git so history stays clean (`git mv` / `git rm`; check `git ls-files` first — untracked artifacts just move on disk).

**1a. Create `archive/` at the repo root, gitignore-exempt only for its README.** Move into it (grouped in dated subfolders, e.g. `archive/2026-07-model-benchmarks/`):
- Root benchmark/evidence artifacts: `vollyio-attacker-model-effort-report.html` (17.8 MB), `model-effort-cost-ladder.html`, `attack-analysis-palominos.html`, `benchmark-ranking.json`, `consensus-synthesis.json`, `matrix-results.json`, `build-report.mjs`, `run-judges.mjs`, `run-matrix.mjs`, `run-stability.mjs`, `coach-prompt.txt`, `coach-output.schema.json`, `judge-output.schema.json`, `video-evidence-notes.md`, `frames/`, `raw/`, `judging/`, `dist/`, `ab/`, `codex-attack-model-effort-eval/`, `agent-setup-report-card.html`, `pose-engine-investigation-report.html`, `vollyio-perfection-orchestration-prompt.md`, `vollyio-next-steps.html`, `The fix is a full restart of Claude Code.md`, `.mcp.json.bak`.
- These are *evidence cited by D-027/D-033*, so archive, don't delete. Write `archive/README.md`: one line per subfolder saying what it is and which decision cites it.
- If any single artifact >10 MB is git-tracked, note it in the report (history bloat — owner may want it out of git entirely; don't rewrite history yourself).
- `vollyio-commercialization.html` stays findable: move to `docs/` (D-029 references it).

**1b. Get eval footage out of `public/`.** `public/evalframes/` and `public/evalframes-full/` hold frames of real people; anything in `public/` becomes publicly fetchable on the next deploy (they 404 on the current deployment, so this is about the *next* push — move them before it happens). Move them under `evals/` (already gitignored for footage), fix any script paths that referenced them (`scripts/extract-eval-frames*.mjs`, review tooling), and verify with `git ls-files public/ | grep -i eval` → empty, and that the built site serves nothing under `/evalframes`.

**1c. Prune `docs/` to a living set.**
- **Keep (living):** `decisions.md`, `security.md`, `backend.md`, `deploy.md`, `copy.md`, `assets.md`, `analysis-validation-roadmap.md`, `metadata.md`.
- **Archive (describe deleted systems or finished one-time efforts):** `pose-model-selection.md`, `cv-phase1-spec.md` + `.html`, `superpowers/` (both plans), `ORCHESTRATION_STATE.md`, `ledger.md`, `reportcards.md`, `orchestration-breakdown.html`, `report-card-2026-07-10.html`, `acceptance.md`, `quality-floor.md`, `qa.md`, `qa-learn-eval.md`, `animation-library-pool.md`, `pro-technique-study.html`.
- **Merge:** fold `frontend.md`, `motion.md`, `tooling.md` into one short `docs/frontend.md`; fold `validation-plan.md` into `analysis-validation-roadmap.md` (keep the roadmap's name).
- Write `docs/README.md`: a ten-line index saying which doc is authoritative for what, and that `archive/` is history.

**1d. Rewrite the two entry documents.**
- `README.md`: replace the stock create-next-app text. What Vollyio is (three sentences), stack, how scoring works (pointer checklist, one paragraph), quickstart pointing at `SETUP.md`, doc index pointing at `docs/README.md`, live URL.
- `HANDOFF.md`: regenerate from current reality (source: D-027→D-041 + the code). Keep the same section shape (Goal / State / Rules / Open items / Next step / Session log) but the State section must describe the post-D-033 world: model-does-the-whole-read, tap-and-ring subject marking, pointer-derived scores, dense uniform coverage, spend-cap outage. Move session-log entries older than D-027's date into `archive/handoff-history.md`. Add a dated line noting this rewrite.

**Gate:** all four checks green, prod build route count unchanged, then commit Phase 1 on its own.

## Phase 2 — Production resilience (the outage class)

Production analyze/coach is currently down: the shared API key hit its monthly spend cap (D-041 note; second cost outage this month). You cannot fix the billing console from the repo — flag it — but ship the half you can:

- **Degraded-service handling.** When the coaching call fails with a quota/credit-class error, users currently get a generic 502 string. Detect that class server-side (status + error shape; log the real cause, never surface vendor detail) and return a distinct, honest message ("The coaching service is temporarily out of capacity — your clip wasn't charged against your limit. Try later.") with an appropriate status. Make sure the entitlement reservation and hourly quota are *released/not burned* on this path — verify against the actual reservation flow in `app/api/analyze/route.ts` and `lib/entitlements.ts`, and pin it with a test.
- **Measure, don't estimate.** Add lightweight server-side telemetry on the analyze route: input/output/thinking token counts from the API response, wall-clock duration, model + effort, written to the existing analysis row (server-set column or JSON field — check `docs/security.md` before touching the table; the client must not be able to write it). This turns D-027's two open risks (cost per analysis, `maxDuration=120` vs real latency) into measured numbers after a handful of live runs.
- **Owner checklist (report, don't attempt):** separate API key for production vs experiments, per-key spend limits, raise the cap, alerting on spend threshold; rotate the briefly-exposed Supabase credentials (HANDOFF open item); resolve the likeness gate on `film-court.webp` (D-022); Supabase→GitHub integration misconfig.

## Phase 3 — Trust: feed the eval system real evidence

The harness is capable (D-031) but starved: 18 cases, all pro-level, 0 labeled, 0 scored runs, baseline provisional. In-session you cannot watch footage or spend API budget, so build the *fastest possible human path*:

- Verify `scripts/label-case.mjs` end-to-end against a copy of a real case file; fix any friction that would make the owner's labeling pass slower than ~2 minutes per case. If a simple local review UI already exists (`scripts/review-evals.mjs`), make labeling reachable from it.
- Write `evals/LABELING.md`: the exact owner workflow — label all 18 actives (`unknown` is a legitimate answer), source intermediate/expert clips per `evals/SOURCING.md`, then the two commands for a scored baseline + 3-run stability check, and what the release gates in `analysis-validation-roadmap.md` require (≤5% unsupported-claim rate, ≥95% correct abstention, median 3-run range ≤5).
- Confirm `--strict` coverage gating is wired into CI or wire it as a non-blocking report step until cases are labeled (a blocking gate on an unlabeled suite would just get ignored).

## Phase 4 — Product: from "works once" to "worth returning to"

Pick by impact within the session budget; each item independently shippable, each behind the full gate:

1. **Close the loop on the priority fix.** The dashboard and a new analysis of the same skill should reference the previous priority fix ("Last time: contact behind the shoulder"). Data already exists in stored results; surface it — this is the single cheapest retention feature the product can ship.
2. **Public sample breakdown.** One real (owner-consented) analysis rendered read-only at a public route, linked from the landing FAQ/hero, so a visitor sees the checklist, notes, and honesty markers ("not visible") before signup. No auth, no cost per view (static/stored data only). Respect the likeness rule — owner's own footage only.
3. **Service-status honesty on the client.** Analyze page surfaces the Phase 2 degraded state distinctly from "your clip failed" (no dead-end spinner, quota not burned messaging).
4. **Device-verification checklist refresh.** Rewrite the stale device checklist in the new HANDOFF for the *current* flow: tap-and-ring subject select, coach-spotted candidates (D-036), dense-coverage analyze on a phone, pointer checklist rendering, unobserved styling, subject-mismatch warning. The owner runs it; you just make it current and honest.

## Phase 5 — Final report

End with: what shipped (commits + one-line each), measured numbers if any live calls ran, the **NOT VERIFIED** list (device checks, owner-console items, labeling, counsel review, likeness, key rotation), and the single highest-leverage next action. Do not summarize work as done that is listed as not verified.
