---
name: css-animations
description: Pure-CSS animation techniques for Vollyio — performant loops, glow effects, gradient sheens, masks, and sweep patterns with zero JavaScript and zero dependencies. Use when implementing motion that ui-animation/animation-designer has already justified, and it can be done in CSS alone.
---

# CSS animations — Vollyio technique book

Everything here is hand-rolled CSS on the existing tokens. No libraries,
no new colors (mix with `color-mix(in oklab, var(--color-gold) N%,
transparent)`), keyframes named and commented in `app/globals.css`.

## Performance rules

- Compositor-only: animate `transform` and `opacity`. `box-shadow`,
  `background-position`, and `filter` may TRANSITION briefly (≤300ms,
  e.g. hover glow) but never run in infinite loops.
- Loops that must glow or sweep do it by MOVING a pre-painted gradient
  element with `transform` (see sweep recipe) — paint once, composite
  forever.
- `will-change: transform` only on long-running ambient elements
  (`.hero-glow`); never sprinkle it on interactions.
- Every infinite loop must degrade to a sane static frame under the
  global reduce block — or be explicitly hidden there (`.scan-line`).

## Recipe: sweep (shimmer / scanner)

A gradient child travels across a clipped parent. The trick: translate
percentages are of the CHILD's own size, so size the child as a fraction
of the parent and overshoot. Child 60% wide → `translateX(-100%)` →
`translateX(200%)` clears the far edge (`.skeleton::after`). Child 20%
tall → `translateY(-100%)` → `translateY(600%)` (`.scan-line`). Keep the
two numbers next to each other in a comment — they only make sense as a
pair.

## Recipe: glow

- Interactive glow: transition `box-shadow` on the existing shadow tokens
  (`--shadow-glow`) — `.btn-primary:hover`, `.input-field:focus`.
- Ambient glow: a blurred radial-gradient element drifting via transform
  (`.hero-glow`): paint the blur once, animate only `translate3d/scale`.
- One-shot state glow: animate border-color+shadow from lit to rest
  (`reward-glow`), `both` fill so reduced motion lands at rest.

## Recipe: gradient sheen on text

`background-clip: text` + oversized gradient + `background-position`
keyframe (`.text-sheen`). Finite iteration count (it runs 2×) — this is
the sanctioned exception to the no-background-loops rule because it is
brief and self-stops.

## Recipe: masks

- Edge fades: `mask-image: linear-gradient(...)` to dissolve grids/film
  edges (`.analytics-grid`) — static mask, zero animation cost.
- Legibility shades: stacked gradients as overlay elements
  (`.hero-film-shade`) rather than animating the media underneath.

## Recipe: draw-on lines

SVG `stroke-dasharray`/`stroke-dashoffset` keyframed to 0
(`reward-check`, `analytics-draw`). Normalize with
`pathLength`/`getTotalLength` so keyframes stay `1 → 0`. `both` fill —
under reduced motion the line is simply drawn.

## Recipe: scroll-linked

`animation-timeline: scroll(root)` + `animation-duration: auto` behind
`@supports (animation-timeline: scroll())`, transform-only
(`.scroll-progress`). Remember the global reduce block clobbers
durations — scroll-linked elements need their `auto` duration restored
there explicitly, since they mirror user input rather than autoplaying.

## Verifying

Chromium at `/opt/pw-browsers/chromium` computes scroll timelines and
transforms headlessly (`--force-prefers-reduced-motion` to check settled
states). DevTools paint-flash locally for anything suspected of painting
per frame.
