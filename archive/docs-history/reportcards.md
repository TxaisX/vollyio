# Report Cards (peer grading log)

Scale: A impeccable · B solid (minor, floor intact) · C works but breaches floor · D partial · F missing/broken.
Pass bar to close a phase: every artifact at A- or better, no criterion below B.
Self-grade first, then peer grade; a wide self-vs-peer gap is a signal. A grader cannot pass an artifact with an open blocking defect.

Format per card: grader → author → artifact · per-criterion letters w/ cited justification · overall · raise-to list.

## Phase 0 — PASSED (pass bar met round 1, no raise round needed)
- **Lisa → Leon** (quality-floor.md + acceptance.md): coverage A, testability A-, voice A- · **overall A-** · pass. Raise-to-A (carried): atomic-split multi-clause assertions; strip em dashes from the spec's own prose; resolve title separator (ruled in D-003).
- **Leon → Lisa** (copy.md + metadata.md): coverage B+, voice A, testability A- · **overall A-** · pass. Raise-to-A (carried to Phase 1 inputs): supply PWA-2 reload/update prompt copy; represent SCORE-7 save-error in the scoreboard live region; enumerate signup per-field error strings (or mark shipped-keep); specify AFLOW-4 per-button pending affordance.
- Self-grades: both A- (matched peer; no wide self/peer gap).
- Carried raise items are Phase 1 inputs (Jerry/Dave) and re-checked by Sierra in Phase 2. Em-dash separator resolved by D-003 (→ middot).

## Phase 1 — Jerry ↔ Dave (self + peer), integrated
- **Jerry (implementation, 5 clusters + routes)**: self A-. Token purity A, class reuse A (btn-destructive + icon-btn added + reused), a11y A- (radiogroup, live regions, progressbars, data-visual names), responsive A (44px, 360px), reduced-motion A- (matchMedia self-guards), focus A, states A. Peer/Orchestrator note: a few cross-file wires (sparkline prop, skill-picker labelledby) closed in integration.
- **Dave (platform/data)**: self A-. Boundaries A (global-error, (app)/error, not-founds), scripts A (typecheck/test added), coaching discipline A (cache/dedupe/backoff/max_tokens + D-004 model split), branding A (RGBA favicon/maskable/OG). Withheld A on the CS-5 model-tier + tsconfig/favicon blockers, all resolved by the Orchestrator in integration.
- Build gate green after integration. Both at pass bar (A-).

## Phase 2 — Sierra (authoritative) + fix loop
- **Sierra adversarial card**: gates GREEN (tsc/build 47 routes/test 6/0; all 10 public routes 200, no 500s). 17 defects: 0 blocker, 8 major, 9 minor. Initial verdict FAIL (8 routes + 2 shared components carried majors). Full card + per-component/route tables in `docs/qa.md`.
- **Fix loop (Dave/Jerry/Lisa + Orchestrator)**: all 17 cleared. Re-verify GREEN — build/tsc/test pass; targeted checks confirm each fix (aria-valuemin, 44px targets, video labels, error-throwing on 5 routes, 8 loading skeletons, globals.css zero literals, second-person boundary voice). Post-fix verdict: **PASS** (no open blocker/major).
- Live drive (Orchestrator, Playwright @375px): zero horizontal page overflow, skip link + logo mark present, single h1, middot title live, landing 200.
- **Lighthouse (Edge, mobile):** landing **99 performance / 100 accessibility**; /login **99 / 100** (app-shell surface). Both clear the >=90 gate. The authed /dashboard is session-gated for a headless run but shares the identical design system + the Sierra-verified a11y primitives (progressbars, data-visual names, radiogroup, live regions).
- Phase 1b (section-7 view-transitions): implemented + gates re-verified green; docs/motion.md maps the route-pair patterns.

## 2026-07-09 re-verification — Sierra authoritative
- **Sierra → Orchestrator** (current master + D-005 motion patch): token purity A, class reuse A, accessibility A, responsive A-, reduced motion A, focus A, states A, machine enforcement A- · **overall A-** · pass.
- Evidence: component/route contract scan, policy lint, `tsc --noEmit`, 18/18 Node tests, and a production build generating 55 routes all pass. D-005 documents every added keyframe; `CountUp` cancels and settles when reduced motion changes; no user-facing em dashes remain in the linted surface.
- Raise-to-A: repeat numeric Lighthouse on an authenticated dashboard session when a reusable test account is available. The last recorded landing and app-shell checks remain 99 performance / 100 accessibility.

## 2026-07-09 UI motion pass — Sierra authoritative
- **Sierra → Orchestrator** (D-006 Learn + reward system): layout A, responsive A, token purity A, accessibility A, reduced motion A, interaction feedback A- · **overall A-** · pass.
- Evidence: desktop and exact 390px captures show complete Learn cards; exact 360px metrics report document/card bounds inside the viewport; reduced-motion emulation reports 0.01ms transitions, zero delay, visible reveals, and instant scrolling. Policy lint, TypeScript, 18/18 tests, and the 55-route build pass.
- Raise-to-A: add automated browser interaction coverage for milestone toasts and set/match transitions when a browser test dependency clears the tooling gate.

## 2026-07-10 premium surface pass — Sierra authoritative
- **Sierra → Orchestrator** (D-007 landing/auth/app campaign): product signal A, visual hierarchy A, volleyball specificity A, responsive A, token purity A, accessibility A, reduced motion A, performance A- · **overall A** · pass.
- Evidence: generated asset register complete; 63.1 KiB responsive WebP; desktop landing/login and exact 390px landing captures inspected; exact 360px metrics show document width 360 and next-section proof visible; reduced-motion duration 0.01ms with zero delay. Policy lint, TypeScript, 18/18 tests, and 55-route production build pass.
- Raise-to-A+: repeat numeric Lighthouse against the production deployment after this uncommitted campaign patch is reviewed and shipped.
