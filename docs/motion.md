# Motion map: the view-transition layer

The framework-native React `<ViewTransition>` layer (section 7, decision D-002). It
sits on top of the hand-rolled component motion (`Reveal`, `CountUp`, cursor-glow),
which is untouched. `experimental.viewTransition` is already enabled in
`next.config.ts`. This is a progressive enhancement: browsers without the View
Transitions API render the app normally with instant swaps, so it is never a hard
dependency. Every rule lives in one place, `app/globals.css`, scoped to
`::view-transition-*` only.

`ViewTransition` and `transitionTypes` are imported from `react` and `next/link`
respectively (Next 16 integrates React's ViewTransition; confirmed against
`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`).

## The one rule that shapes everything: Reveal at capture

Almost every route's content is wrapped in `Reveal` (from `components/motion.tsx`),
which starts at `opacity: 0` and fades in from a client effect that runs *after* the
view-transition snapshot is captured. So the snapshot of an *entering* page is mostly
transparent. This makes enter-side positional transitions on Reveal-heavy content
prone to a flash-of-empty, and it is why the layer is deliberately weighted toward
the clean surfaces below. The exit side of any page is always fully visible, so exits
are always clean.

Two consequences drive the design:

1. The page **root** is pinned to `animation: none`, so a navigation never stacks a
   full-page crossfade on top of the `template.tsx` `fade-up` baseline. Only the
   elements we name opt back into motion (VT-NODOUBLE).
2. The Suspense reveal is expressed mostly as a **skeleton dissolve**: the skeleton
   is fully visible at capture, so it exits cleanly; the resolved content then arrives
   on the existing `template.tsx` + `Reveal` baseline underneath the dissolving
   skeleton. Coach is the exception (no `Reveal` in its content), so it gets the full
   exit + enter handoff.

## Anchors (fixed `viewTransitionName`, never move)

| Element | `viewTransitionName` | File |
| --- | --- | --- |
| Mobile app header | `app-topbar` | `app/(app)/layout.tsx` |
| Desktop sidebar nav | `app-sidebar` | `app/(app)/layout.tsx` |
| Mobile tab bar nav | `app-tabbar` | `components/app-nav.tsx` |

Distinct names because the sidebar and the tab bar are both in the DOM across
breakpoints (one is `display:none` per viewport). Each is pinned to `animation: none`
with `::view-transition-old(...)` set to `display:none` to avoid an old/new flash, and
`z-index: 100` so the chrome renders above sliding content.

## Route pairs and patterns

| Route pair / event | Pattern | Mechanism | Names / classes |
| --- | --- | --- | --- |
| `/history` row -> `/analysis/[id]` | Shared-element morph | Row score `<span>` and the detail `ScoreRing` share a name; `share="morph"` + `default="none"` | `rep-${id}`, `.vt-morph` |
| Dashboard recent row -> `/analysis/[id]` | Shared-element morph | Same as above from the dashboard recent list | `rep-${id}`, `.vt-morph` |
| `/drills` card -> `/drills/[slug]` | Shared-element morph | Card title and detail `<h1>` share a name | `drill-${slug}`, `.vt-morph` |
| `/drills` card <-> `/drills/[slug]` | Directional slide | `transitionTypes` on the links; the detail content maps them to enter/exit classes; drills list is the static home base (instant) | types `nav-forward` / `nav-back`; classes `.vt-nav-forward` / `.vt-nav-back` |
| Dashboard, coach, history, analysis, drills: skeleton -> content | Suspense reveal | `loading.tsx` content wrapped in `exit="vt-reveal-out"` (skeleton dissolves) | `.vt-reveal-out` |
| Coach: skeleton -> content | Suspense reveal (full) | Skeleton `exit` + page content `enter="vt-reveal-in" default="none"` (coach content has no `Reveal`, so it is clean) | `.vt-reveal-out`, `.vt-reveal-in` |
| `/history` skill filter (`?skill=`) | Same-route crossfade | List `<ViewTransition key={skill} name="history-list" share="auto" default="none">`; the surrounding `Reveal` stays mounted so only the swap animates | `history-list` |

Notes on the best-effort morphs:

- The `rep-${id}` morph into `/analysis/[id]` fires cleanly only when the breakdown is
  ready without showing its skeleton first (prefetched / cached / fast). When the route
  suspends, the skeleton dissolve is the handoff and the morph simply does not play.
  The matched names are still present on both ends (VT-MORPH-HIST / the dashboard
  variant), and it degrades gracefully. `default="none"` keeps the score inert on the
  history filter crossfade and every unrelated transition.
- The `drill-${slug}` morph and the directional slide combine on the forward
  navigation: the title lifts out of the slide (its own name) and travels from the
  card while the rest of the detail slides in. The enter side is Reveal-gated, so the
  travel is subtle by design; the back exit (detail sliding out to the right) is fully
  visible and clean.

## Pending-nav hint

`/drills/[slug]` is static and has no `loading.tsx`, so links into it carry a
`useLinkStatus` hint (`components/link-pending.tsx` -> `.vt-link-pending`): an
absolutely placed, fixed-size gold dot, opacity-toggled with a 100ms reveal delay so
fast prefetched navigations never flash it. It never shifts layout. Placed on:
`/drills` cards, `/analysis/[id]` "Drills for this" cards, and the dashboard daily
challenge link. Links into `/analysis/[id]` need no hint because that route has a
`loading.tsx` (the root cause is already handled).

## Keyframes (named, auditable) and timing

| Keyframe | Used by |
| --- | --- |
| `vt-fade` | reveal, directional, opacity across the layer |
| `vt-slide-y` | Suspense reveal enter/exit (vertical handoff) |
| `vt-travel` | directional slide (horizontal, via `--vt-x` = 56px) |
| `vt-morph-blur` | morph image-pair (hides interpolation) |

Timing bands (D-002): enter/exit fades are 150-200ms; the only 400ms durations are the
morph group and the directional `vt-travel` (travel is allowed the longer band). The
crossfade group is paced at 220ms.

## Reduced motion (non-negotiable, highest-risk surface)

A single block zeros **every** `::view-transition-*` `animation-duration` and
`animation-delay` under `prefers-reduced-motion: reduce`, across `group`, `old`, `new`,
and `image-pair`. Reduce users get instant swaps: no slide, no morph, no crossfade,
no dissolve. This is in addition to the app-wide reduce block that neutralizes the
component-level CSS motion. Directional slides simulate viewport movement, the most
common motion-sensitivity trigger, which is exactly why they are the narrowest-scoped
pattern (one route pair) and why the zeroing is unconditional.

## No new tokens, no library

This layer introduces no color, no font, and no dependency. It reuses `--ease-court`
and the palette tokens only. `ViewTransition` ships inside React/Next, so it fits the
dependency budget with nothing added. No animation/motion library was adopted, so
there is no 10.5 viability-gate or bundle-cost entry to record here.
