---
name: animation-designer
description: Recipes for Sideout's higher-order motion patterns — staggered lists, scroll-driven effects, progress indicators, microinteractions, and loading states. Use when designing a new animated surface or upgrading a static one, after reading ui-animation for the ground rules.
---

# Animation designer — Sideout pattern recipes

Read `ui-animation` first for the non-negotiables. This skill is the
pattern book: which shape of motion fits which product moment, with the
repo's own primitives as the implementation.

## Staggered lists

Stagger communicates "these are siblings, scan them in order." Use for
cards, metrics, insights — anything the eye should walk through.

```tsx
{items.map((item, i) => (
  <Reveal key={item.id} delay={i * 60}>…</Reveal>
))}
```

- 60–90ms per step; cap total stagger under ~500ms (`Math.min(i, 6) * 80`
  for long lists so late items don't feel punished).
- Viewport-triggered via `Reveal`'s IntersectionObserver; above-the-fold
  content uses `immediate` so it never waits for the observer.

## Scroll-driven effects

Pure CSS scroll timelines only — no scroll listeners, no rAF loops.

- Reading progress: `.scroll-progress` already exists (scaleX on
  `animation-timeline: scroll(root)`, `@supports`-gated, stays on under
  reduced motion because it mirrors the user's own scrolling).
- In-view reveals: `Reveal` (IO-based) is the standard; prefer it over
  `animation-timeline: view()` while Safari coverage is uneven.
- Parallax: allowed in principle (transform-only) but the landing already
  carries ambient drift + court films — add nothing there without a clear
  attention job. Decorative stacking is how pages get slower and worse.

## Progress indicators

Pick by what's actually known:

| Knowledge | Pattern |
|---|---|
| Determinate % | scaleX fill bar (`hero-metric-grow` shape) |
| Staged but unmeasurable | `StatusTicker`: real stage names, walks forward, RESTS on the last line — looping progress reads as fake |
| Nothing but "working" | `WorkingDots` + one honest line of copy |
| Scroll position | `.scroll-progress` |

Never invent fake percentages. The ticker pattern exists because the
scoring wait is staged-but-unmeasurable.

## Microinteractions

Every interactive element answers the pointer within 200ms, transform-only:
press settle (`:active` scale 0.97–0.99 or translateY(1px)), hover
lift (`.card-lift`), focus glow (`.input-field:focus`, `:focus-visible`
outline). New controls copy these tokens rather than inventing new ones.
A microinteraction is feedback, not decoration — if the element does
nothing, it doesn't get one.

## Loading states

- Route-level: `loading.tsx` skeletons mirroring the real layout
  (`.skeleton` = pulse + directional shimmer, reduce-safe).
- In-flow waits: keep the trigger visible and disabled with `aria-busy`,
  swap its label to the working state (see "Break it down" button).
- Reveal handoff: skeleton → content runs through the view-transition
  `.vt-reveal-*` names; don't add a second entrance on top (VT-NODOUBLE).
- Anything over ~10s needs staged copy (ticker), not a spinner.

## Choosing NOT to animate

The strongest tool here. Dense data (Measured card, tables), error states
(instant, `animate-fade-up` at most), and anything already adjacent to two
moving things. One page earns at most one ambient layer.
