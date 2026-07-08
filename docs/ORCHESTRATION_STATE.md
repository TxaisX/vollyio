# Orchestration State (authoritative resume anchor)

Mission: `sideout-perfection-orchestration-prompt.md` — make every component and route impeccable + land the section 10 grants. Autonomous; owner delegated approval to the agents (majority vote). Do NOT stop to ask.

- Branch: `polish/multiagent-burst`
- Started: 2026-07-08 ~07:10 PDT
- Resume cron: one-shot `c3bc54dd` @ 12:04pm PDT 2026-07-08 (session-only). On resume, schedule the next ~2h safety net before working.

## Phase tracker
- [x] Kickoff: read AGENTS.md / CLAUDE.md / globals.css; create /docs; seed ledger/decisions/reportcards/assets/tooling; record section 10 AGENTS.md amendments in Decision Log + edit AGENTS.md.
- [x] Phase 0 (Leon + Lisa): quality-floor.md, acceptance.md (348 lines, ~180 assertions), copy.md, metadata.md. Both A-, pass bar met round 1. Cards in reportcards.md; em-dash separator ruled D-003 (→ middot). Carried raise items = Phase 1 inputs.
- [ ] Phase 1 (Jerry + Dave): implement fixes + boundaries/scripts/view-transition flag + report-card round.
- [ ] Phase 2 (Sierra): adversarial verify; loop to Jerry/Dave until acceptance all-pass + 3 gates green + Lighthouse >=90.
- [ ] Phase 3 (Thomas): CI gates, preview, production deploy (owner delegated the section 9 gate to agents).
- [ ] Final: before/after HTML breakdown of the product.

## Gates the Orchestrator runs itself after every phase
`npx tsc --noEmit` ; `next build` ; `node --test` — never trust a phase as done until green.

## Current position
Phase 1a DONE + integrated + build GREEN (tsc clean, next build 47 routes, node --test 6/0, viewTransition enabled). All 21 components + routes + api + boundaries landed. Orchestrator integration applied: tsconfig allowImportingTsExtensions; D-004 model split (COACH_MODEL=claude-sonnet-5, ANALYZE_MODEL=claude-opus-4-8) in lib/ai/client.ts + api routes; deleted stray zzpreview; regenerated favicon.ico as RGBA (Turbopack rejected RGB); promoted icon-btn shared class + wired xp-toast.
REMAINING Phase 1 (Phase 1b, cross-agent wiring, then report cards):
- Wiring gaps (small): dashboard Sparkline needs skill={skill} prop; analyze-flow h2 id="pick-a-skill" + SkillPicker labelledBy; goals.tsx null "—" placeholder → middot+sr-only (RING-2/D-003 precedent); confirm sidebar <nav> aria-label present.
- On-page logo MARK graphic (G10.6-6/7): insert public/icon-mark.png into landing-nav + app-shell header (accessible name already set).
- PWA reload copy: canonicalize Jerry-1's placeholder in copy.md (Lisa).
- Phase 1b: section 7 view-transition layer (ViewTransition wrappers per route pair + ::view-transition CSS + reduced-motion block) — can touch globals.css.
- Phase 1 report-card round (Jerry↔Dave) to pass bar; then Phase 2 Sierra.

## How to resume
Read this file, then handoff.md, then the orchestration prompt. Continue from "Current position". Keep this file + ledger.md + reportcards.md + handoff.md updated every step.
