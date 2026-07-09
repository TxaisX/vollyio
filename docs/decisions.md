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

## D-003 — User-facing em-dash title separator → middot (voice-law enforcement)
Date: 2026-07-08 · By: Orchestrator (both Phase 0 agents flagged; ruled under the explicit voice law, not a contestable redesign)

Shipped metadata uses an em-dash separator: `app/layout.tsx` title default + template (`%s — Sideout`), OG title, twitter title; `app/manifest.ts` name; `app/opengraph-image.tsx` alt. The no-em-dash voice law applies to all user-facing copy, and tab titles + OG + manifest are user-facing. The brand already uses the middot (·) as its separator throughout the UI. RULING: replace the em-dash SEPARATOR with ` · ` in title default/template, OG title, twitter title, and manifest name; rewrite the OG `alt` (a mid-sentence em-dash) as a clean no-em-dash sentence. Resolves Leon's R-ROOT-1 and Lisa's metadata flag. Implemented by Dave/Jerry in Phase 1 per `docs/metadata.md`; Sierra verifies zero user-facing em dashes repo-wide.

## D-004 — Coaching-service model split by task (owner-authorized, Phase 1a integration)
Date: 2026-07-08 · By: Orchestrator (integration step) · Recorded retroactively 2026-07-08

During Phase 1a integration the coaching service was split into two task-scoped model tiers instead of one model for everything, because the two call sites have opposite priorities:

1. **`COACH_MODEL`** — real-time coach chat. Latency-sensitive and high-volume, so it uses the **faster conversational tier** (cost- and speed-optimized).
2. **`ANALYZE_MODEL`** — deep frame/technique analysis. Accuracy-critical and low-volume, so it uses the **most capable reasoning tier**.

Implemented as two env-driven constants in `lib/ai/client.ts`, consumed by the coach and analyze API routes. When the parallel `master` stream merged in its eval harness, `app/api/eval` was reconciled to `ANALYZE_MODEL` (it grades analysis output, so it must match the analyze tier) — this is the "one reconciliation" noted in the merge record.

Rationale: match model capability and cost to the task rather than paying the top tier for chat or under-powering analysis. Constraints held: model identifiers live only in server-side config/env (never user-facing, no vendor name in UI — the layer stays "the coaching service"), and `AI_MOCK=true` bypasses both tiers for zero-cost local/CI runs. This entry closes the gap where D-004 was referenced in `ledger.md` and the breakdown but had no Decision Log record.
