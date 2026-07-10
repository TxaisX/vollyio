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

## Component additions (D-005)

| Motion | Surface | Timing | Reduced-motion behavior |
| --- | --- | --- | --- |
| `drift` | Decorative seam motifs on the landing page | 16s alternate, transform only | Global reduce block runs one 0.01ms iteration and leaves the settled frame |
| `pop-in` | XP toast | 420ms scale + opacity | Global reduce block settles immediately at full opacity and scale 1 |
| `CountUp` reuse | Landing analysis score, skill count, streak | 900ms rAF tween | A live `matchMedia` listener cancels the tween and sets the target immediately |

All three preserve layout dimensions, use existing tokens and `--ease-court`, and add
no dependency. Motion remains supplementary; the same values and state are present
without animation.

## Reward feedback system (D-006)

| Pattern | Trigger | Surfaces |
| --- | --- | --- |
| `reward-arrive` | New earned content enters | XP and success toasts, completed goals, captured frames, score badges, coach messages |
| `reward-glow` | A meaningful milestone resolves | Goal completion, set win, match win |
| `reward-check` | A completion is confirmed | Goal, daily challenge, set/match, save confirmation |
| `nav-marker-in` | Active route changes | Desktop sidebar and mobile tab marker |
| `selection-settle` | A discrete selection becomes active | Active nav icon and newly won set dot |
| Learn crossfade/morph | Discipline or skill changes | Indoor/Beach card grid and list-to-detail skill title |

Buttons, ghost controls, and chips also use short transform-only press feedback. New
coach messages and captured frame grids animate only when inserted. The mobile tab
bar centers its active item with smooth scrolling only when reduced motion is off.

Under `prefers-reduced-motion: reduce`, all animation durations collapse to 0.01ms,
all animation/transition delays become 0ms, reveals render at opacity 1 with no
transform, and active-tab scrolling is instant. Device-emulation verification at
360px reported `clientWidth=360`, `scrollWidth=360`, and all Learn cards inside the
20px page gutters.

## Premium campaign motion (D-007)

| Pattern | Surface | Timing | Purpose |
| --- | --- | --- | --- |
| `hero-photo-settle` | Landing and auth photography | 1.35s once | Lets the real volleyball moment resolve without continuous ambient work |
| `hero-hud-in` | Landing analysis HUD | 720ms after copy begins | Connects the athlete to the product readout |
| `hero-metric-grow` | HUD metric bars and dashboard heading rule | 700ms staggered | Shows the score resolving from evidence |
| `court-line-in` | Landing court rule | 1.1s once | Carries the court geometry through the hero composition |

The authenticated shell also reuses the existing `drift` primitive at 3.5% opacity
for fixed court geometry, while dashboard score and challenge surfaces receive
stronger static hierarchy. Every new animation is transform/opacity only, settles
instantly under reduced motion, and does not alter layout dimensions.

## Analytics and launch-film motion (D-010)

| Pattern | Surface | Timing | Reduced-motion behavior |
| --- | --- | --- | --- |
| `analytics-draw`, `analytics-point-in`, `analytics-playhead-in` | Landing rep-intelligence trace | 300–900ms once per selected rep | Global reduce block settles the trace and evidence points immediately |
| Rep progression | Landing analytics tabs | 4.4s between examples while in view | A live `matchMedia` guard disables auto-progression; manual tabs remain fully usable |
| `launch-cut` | Five launch-film chapters | 3.8–8s per chapter across a 19.77s sequence | The route renders a static final brand frame instead of mounting the timed sequence |
| `launch-photo`, `launch-bar`, `launch-step`, `launch-line` | Launch-film camera move and evidence graphics | 720ms–19s, transform/opacity/filter only | The static final frame contains no animated descendants |

The launch route is also the deterministic source for `public/sideout-launch.mp4`.
The capture script lives in `scripts/render-launch-video.mjs` and requires only a
temporary local encoder, so the shipped application keeps the same dependency graph.

## Hero ambient layer (2026-07-10)

The landing hero photograph was removed at the owner's direction; in its place
the hero runs an ambient backdrop: `hero-glow-drift` (new keyframe, 21s
ease-in-out infinite alternate, translate3d + scale only) on `.hero-glow`, and
the pre-existing `drift` animation on the seam-arcs motif. Decorative only,
conveys no state, and the global reduced-motion rule zeroes both, leaving a
static composed backdrop. `hero-photo-settle` and `hero-shade` are no longer
referenced by the landing page (login/signup still use the photo treatment).
