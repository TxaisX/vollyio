# Decision Log

Binding decisions. Section 10 amendments and any contested ruling (Ditto) land here.

## D-001 — Section 10 grants: AGENTS.md amendments (owner-authorized)
Date: 2026-07-08 · By: Orchestrator (per section 10 owner authorization)

The owner authorized the section 10 amendments. Per section 0 rule 1 / section 10 intro, the affected `AGENTS.md` lines are updated in the same commit as this entry (non-silent path). Amendments:

1. **Motion (10.2).** The "hand-rolled only / No animation libraries" rule is lifted. New keyframes, easing curves, motion beyond 150-300ms, and a third-party animation/motion library are allowed **under discipline**: `prefers-reduced-motion` always wins (JS `matchMedia` self-guard non-negotiable, settle at end state under reduce), no layout shift/jank, Lighthouse perf stays >=90 on landing + dashboard, any library is tree-shaken with bundle cost justified here, motion never conveys state alone, colors/fonts stay on token. Hand-rolled primitives (`motion.tsx`, `cursor-glow.tsx`) and shipped ambient/reveal durations stay. 150-300ms on `--ease-court` remains the default for ordinary interaction transitions.
2. **Dependency budget (10.5).** Small but **gated, not closed**: an animation/motion library (10.2) and added MCP servers (10.5) are allowed once they clear the 10.5 viability gate (publisher/provenance, exact scopes, security + least privilege, necessity, licensing, pinned version) + a Decision Log entry. Chart, state-management, and service-worker libraries remain out unless they clear that same gate; the service worker stays hand-rolled.
3. **Colors and fonts (10.1).** NOT loosened. The ten colors + three fonts stay the only ones, zero-violation, in components, on canvas, in assets' chrome, and in config. This is the one place the grants do not reach.

`AGENTS.md` motion line and dependency-budget line edited accordingly. Colors/fonts line left fully in force.

## D-002 — Sanctioned exception: `::view-transition-*` scoped rules (section 7)
Date: 2026-07-08 · By: Orchestrator

React `<ViewTransition>` (Next 16 integrated, not a third-party lib — fits the dependency budget) is adopted for navigation/content-change motion. It requires `::view-transition-*` keyframes/durations the component-level rule would forbid; this relaxes that rule for `::view-transition-*`-scoped rules ONLY. Enter/exit in the 150-210ms band; 400ms reserved for morph/directional-slide travel; every keyframe named + auditable; a reduced-motion block zeros every `::view-transition-*` duration/delay. Enabled via `experimental.viewTransition: true` (progressive enhancement; unsupported browsers get instant swaps). Read `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` before implementing.
