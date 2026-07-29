# Frontend

How to build UI in this repo correctly. This is Next 16: APIs, conventions, and file structure differ from older versions, so read the relevant guide in `node_modules/next/dist/docs/` before writing code and heed deprecation notices. Middleware is `proxy.ts`, not `middleware.ts`.

## Design tokens

All tokens live in `app/globals.css` `@theme`: nine palette colors, two line tokens, and three font tokens. Never introduce a new color or font. ("Ten colors" here previously counted `--color-line`, and `--color-gold-dim` was declared but never referenced; D-067 removed it and split the line token.)

- Palette families: navy, chalk, gold, teal. Coral is reserved for destructive actions.
- **Two line tokens, and the difference is semantic.** `--color-line` (chalk 12%) is for dividers, seams, and container edges. `--color-line-control` (chalk 41%) is for anything you can press or type into: `.btn-ghost`, `.chip`, `.input-field`, `.analytics-rep-tab`. A control whose border is the only thing identifying it needs 3:1 (WCAG 1.4.11) and 12% gives 1.40:1. Static labels like `.tag` keep `--color-line` on purpose, so the heavier edge means "this does something".
- Fonts: Space Grotesk (display), Instrument Sans (body), IBM Plex Mono (labels).
- Token-purity idiom: express opacity/lighten variants against the token, never as a raw hex/rgb of the same color: `color-mix(in oklab, var(--color-gold|chalk|navy|coral) N%, transparent | var(--color-chalk))`. Example: `.text-sheen` mid-stops use `color-mix(in oklab, var(--color-gold) 55%, var(--color-chalk))` (no eleventh color).
- Sanctioned literal-color surfaces only: `app/manifest.ts` JSON, `viewport.themeColor`, and `app/opengraph-image.tsx` inline styles (these cannot resolve CSS custom properties).

## Component classes

Shared classes live in `app/globals.css @layer components`. Reuse them; do not reinvent per page. Log every net-new shared class (name, purpose, call sites) so the set stays auditable.

Base set: `card`, `btn-primary`, `btn-ghost`, `chip`, `input-field`, `spot`, `reveal`, `text-sheen`.

Added:

| Class | Purpose | Call sites |
|---|---|---|
| `btn-destructive` | Coral destructive-action button (btn-primary shape, coral bg, navy text). | `components/delete-account.tsx` delete-account confirm. |
| `icon-btn` | 44x44 round icon-only action button (chalk-dim, hover chalk + faint bg). | `components/xp-toast.tsx` dismiss; available for future close/dismiss controls. |
| `hero-glow` | Ambient radial gold glow for the landing hero (decorative, transform/opacity only). | landing hero section. |

## Motion

Primitives are hand-rolled in `components/motion.tsx` (`Reveal`, `CountUp`) and `components/cursor-glow.tsx`. These and the shipped ambient/reveal durations stay. Default for ordinary interaction transitions is 150-300ms on `--ease-court`.

Discipline (see `docs/decisions.md` D-001, section 10.2). Any new keyframe, easing, longer motion, or third-party animation/motion library is allowed only under this gate:

- `prefers-reduced-motion` always wins, via a JS `matchMedia` self-guard that settles at the end state.
- No layout shift or jank; motion preserves layout dimensions.
- Lighthouse perf stays >=90 on landing and dashboard.
- Motion never conveys state alone; the same value and state are present without animation.
- A library must pass the 10.5 viability gate (see the dependency gate below), be tree-shaken, and have its cost justified in the Decision Log.
- Absent a section 10 grant, the default is no.

View-transition layer (D-002). The framework-native React `<ViewTransition>` sits on top of the hand-rolled component motion, which is untouched. `experimental.viewTransition` is enabled in `next.config.ts`. It is a progressive enhancement: browsers without the View Transitions API render instant swaps, so it is never a hard dependency. Every rule lives in `app/globals.css`, scoped to `::view-transition-*` only, and adds no color, font, or dependency (reuses `--ease-court` and the palette).

- Capture rule: most route content is wrapped in `Reveal` (starts at `opacity: 0`, fades in after the snapshot), so entering pages are transparent at capture; exits are always fully visible.
- Chrome anchors (`app-topbar`, `app-sidebar`, `app-tabbar`) are pinned with a fixed `viewTransitionName` and `animation: none` so navigation never slides the frame; `z-index: 100` keeps chrome above sliding content.
- Patterns: shared-element morph (`.vt-morph`) for a history/dashboard row score into `/analysis/[id]`, and a drills card into `/drills/[slug]`; directional slide from `transitionTypes`; Suspense skeleton dissolve; same-route crossfade for the history skill filter.
- Pending-nav hint: static routes with no `loading.tsx` carry a `useLinkStatus` hint (`components/link-pending.tsx`): a fixed-size gold dot, 100ms reveal delay, never shifts layout.
- Reduced motion (highest-risk surface): one block zeros every `::view-transition-*` `animation-duration` and `animation-delay` under `prefers-reduced-motion: reduce`, in addition to the app-wide reduce block that neutralizes component-level CSS motion. Reduce users get instant swaps.

Shipped component/campaign motion (D-005 through D-010) follows the same rules: named auditable keyframes, transform/opacity only, layout preserved, settled at the end state under reduce. The landing hero runs `hero-glow-drift` plus the `drift` seam-arc motif; both are decorative, convey no state, and are zeroed by the global reduce rule.

## Dependency gate

- Dependency budget is deliberately small but gated, not closed (D-001). An animation/motion library (10.2) and added MCP servers (10.5) are allowed once they clear the 10.5 viability gate plus a Decision Log entry. The gate, per candidate: publisher/provenance (official?), exact tool scopes and permissions, security (no unexpected network/fs/secret access, least privilege), necessity (cheapest tool for a real need), licensing/terms, pinned version.
- Chart, state-management, and service-worker libraries stay out unless they clear that same gate. The service worker stays hand-rolled (`components/pwa-register.tsx` + `public/sw.js`).
- No vendor names in UI, docs, or user-visible errors. The AI layer is "the coaching service"; the only vendor-named string in the repo is the `ANTHROPIC_API_KEY` env var, server-side only.
- Security authority is `docs/security.md`. Read and update its access-control matrices whenever changing a route handler, server action, table, storage policy, role, or paid external call.

## Commands

`npm run dev` (:3000) · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`. All four gates must pass before any commit. On this OneDrive-synced tree a build can hit `EPERM: unlink .next/...`; remove `.next` (`Remove-Item -Recurse -Force .next`) and rebuild, and kill any stale `next start` first.
