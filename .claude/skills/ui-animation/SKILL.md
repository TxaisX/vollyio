---
name: ui-animation
description: Sideout's UX motion principles. Use before adding or changing any interaction transition, entrance, exit, or state-change motion in the app — buttons, cards, dialogs, navigation, list changes. Encodes the section 10.2 motion discipline so proposals never fight the repo constitution.
---

# UI animation — Sideout motion principles

Motion here is a coaching tool: it directs attention to the next action and
confirms what just happened. If a motion does neither, it doesn't ship.

## Non-negotiables (section 10.2, docs/decisions.md D-001)

1. `prefers-reduced-motion` always wins. The global reduce block in
   `app/globals.css` zeros durations; anything JS-driven self-guards with
   `useReducedMotion()` from `components/motion.tsx` and settles at the END
   state (never the start state, never hidden).
2. Animate `transform` and `opacity` only. No animated layout properties
   (width/height/top/margin), no layout shift, ever.
3. Ordinary interaction transitions: 150–300ms on `--ease-court`
   (`cubic-bezier(0.22, 1, 0.36, 1)`). 400ms is reserved for view-transition
   travel/morph only. Longer than that is ambient-only (drift, glow).
4. Motion never conveys state alone — a text/ARIA equivalent always exists.
5. No motion libraries without the 10.5 gate + a Decision Log entry.
   Default answer: hand-roll it.

## Durations by job

| Job | Duration | Notes |
|---|---|---|
| Press/hover feedback | 150–200ms | transform scale/translate only |
| Enter (element appears) | 200–300ms | fade + ≤14px translate |
| Exit (element leaves) | 150–200ms | exits are faster than entrances |
| Earned moment (score, badge, toast) | 340–580ms | `pop-in`, `reward-arrive` |
| View-transition travel/morph | 400ms | already defined; don't add more |
| Ambient (decorative loops) | 2.4s+ | must survive the reduce block as a static frame |

## Use what exists before writing anything

- Entrances: `Reveal` / `reveal-static` (staggers via `--reveal-delay`)
- Numbers: `CountUp` (already reduced-motion aware, SSR-correct)
- Earned moments: `pop-in`, `reward-earned`, `reward-panel`, `reward-check`
- Press states: `.btn-primary/:active`, `.chip:active`, `.card-lift:active`
- Loading: `.skeleton` (pulse + shimmer), `WorkingDots`, `StatusTicker`
  (components/analyze-flow.tsx — staged wait copy that never loops)
- Navigation: the `::view-transition-*` layer in globals.css (D-002)
- Scroll: `.scroll-progress` (pure CSS scroll timeline)

New keyframes go in `app/globals.css` `@theme` or `@layer components`,
named, with a comment stating the one constraint the code can't show.

## Review checklist before shipping motion

- [ ] Reduced motion: toggled on, the UI lands at the settled end state
- [ ] No layout shift at 390px and desktop
- [ ] State readable with animations globally disabled
- [ ] Durations in band; easing is `--ease-court` unless ambient
- [ ] Lighthouse perf ≥ 90 on landing + dashboard still holds
