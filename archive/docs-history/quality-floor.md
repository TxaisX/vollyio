# Quality Floor

The single, non-negotiable bar every component and every route in Sideout must clear. This is the floor Jerry and Dave build to and Sierra grades against. It is derived from the mission (sections 1-3), the ledger (section 4), `app/globals.css`, `AGENTS.md`, and the section 10 grants. Where a rule is already satisfied by the prior landing burst, it is marked `[prior-burst]` so it is enforced but not re-flagged as new work.

A build that violates any floor item breaches the quality bar. In report-card terms (section 6), a floor breach is a criterion at C or below and blocks the phase.

---

## 0. Scope and precedence

- `AGENTS.md` and `CLAUDE.md` win over this document if they ever conflict. The section 10 amendments are already reconciled into `AGENTS.md` and `docs/decisions.md` D-001/D-002.
- This is a polish and hardening pass, not a redesign. A visual or behavioral change beyond closing a ledger item or exercising a section 10 grant is a Ditto question, not a licence.
- Colors and fonts are law and are the one place the section 10 grants do not reach (10.1).

---

## 1. Token purity (zero-violation, 10.1)

The only colors are the ten in `@theme`: `navy`, `navy-light`, `navy-lighter`, `chalk`, `chalk-dim`, `gold`, `gold-dim`, `teal`, `coral`, `line`. The only font families are the three: `--font-sans` (Instrument Sans), `--font-display` (Space Grotesk), `--font-mono` (IBM Plex Mono).

- No raw hex, `rgb()`, `rgba()`, `hsl()`, or CSS named color, and no literal `font-family`, may appear in any component (`components/**`), route (`app/**`), or `@theme`/config, where a token is resolvable. Reference the token: `var(--color-*)`, the Tailwind `text-*/bg-*/border-*` utilities that map to the tokens, or `color-mix(in oklab, var(--color-*) …)`.
- In-browser `<canvas>` code (`share-card.tsx`) must read colors from the tokens with `getComputedStyle(document.documentElement).getPropertyValue("--color-*")`, mirroring how it already reads the fonts. Hardcoded palette literals on a client canvas are a defect.
- Literal hex is permitted only on the three build-time / config surfaces where CSS custom properties provably cannot resolve: `app/manifest.ts` (`theme_color`, `background_color`), `viewport.themeColor` in `app/layout.tsx`, and the `next/og` `ImageResponse` in `app/opengraph-image.tsx`. On those surfaces every literal must exactly equal the token value it stands for (navy `#0f212c`, navy-light `#16303f`, chalk `#f2efe6`, chalk-dim `#b9c4c9`, gold `#e8b93b`). Any other literal is a defect.
- Opacity variants of a token (`gold/40`, `rgb(232 185 59 / 0.35)` written as a token-derived value) must be expressed against the token, never as a re-typed hex/rgb of the same color.
- This rule holds under every section 10 grant. A sourced photo or video may contain any colors inside its own frame; its chrome, overlays, captions, and controls stay on token.

## 2. Shared-class reuse

Reuse the shared classes in `globals.css`: `card`, `card-lift`, `skeleton`, `btn-primary`, `btn-ghost`, `chip` (+ `chip-active`), `input-field`, `text-sheen`, `spot`, `reveal` (+ `reveal.in`), `reveal-static`, `stat-num`, `tag`.

- Do not re-implement a surface, button, pill, input, border, radius, gold glow, or focus state per page.
- A genuinely new pattern (for example a coral destructive-action button for the recorder Stop control, section 10.2 button redesigns, a shared thumbnail-tile) lands as exactly one new shared class in `globals.css`, reused everywhere it applies. It is never inlined as a one-off.
- Every net-new shared class is recorded in `docs/frontend.md` with its name, purpose, and call sites.

## 3. Responsive to 360px, zero horizontal overflow

- Every route and component renders at a 360px viewport width with no horizontal scroll and no clipped content. Test the document body and every scroll container.
- Wide content (frame strips, tables, marquees) scrolls inside its own `overflow-x-auto` container; the page body never scrolls sideways.
- Long unbroken strings (team names, goal titles, match-over headline, fix titles) wrap or truncate (`break-words` / `min-w-0` / `truncate`) and never push the layout wider than the viewport.
- Flex/grid children that can overflow carry `min-w-0` so text truncates instead of forcing overflow.

## 4. Touch targets >= 44px

- Every interactive control (link, button, tab, chip, icon button, toggle, dismiss) has a hit area of at least 44x44 CSS px, including where padding is the only size source. Use `min-h-11` / explicit sizing, not visual size alone.
- Known targets to bring to 44px: `landing-nav` Log in; `app-nav` sidebar links; `analyze-flow` "instead" chips; several `scoreboard` controls (`-1`, Undo, Abandon, match-over Undo); `share-card` trigger; `skill-icons` in tappable wrappers; `xp-toast` (new) dismiss.

## 5. Keyboard focus: visibility and management

- A visible focus indicator appears on every focusable element on keyboard focus. The global `:focus-visible` gold outline is the baseline; do not remove it or override it to invisible on any control.
- Skip-to-content link precedes every fixed header, on the landing route and the app shell. `[prior-burst: app shell + landing have skip links]`
- Focus moves to the newly revealed control on each step transition: `recorder` (idle to ready to recording, and back to idle on auto-stop) and `analyze-flow` (into the revealed step-02 block after a skill is picked).
- Focus is restored after a form submit collapses its trigger: `goals` (after a successful create, focus returns to a sensible anchor, e.g. the "New goal" trigger, with a "Goal added" announcement).
- No keyboard trap: `xp-toast` and any auto-dismissing overlay is dismissible by keyboard without waiting out a timer.
- Focus order follows visual order; no positive `tabIndex`.

## 6. Reduced motion (CSS and JS both)

- The global `@media (prefers-reduced-motion: reduce)` block in `globals.css` neutralizes CSS animations/transitions. That covers CSS only.
- Every requestAnimationFrame-driven or JS-driven effect independently checks `window.matchMedia("(prefers-reduced-motion: reduce)")` and settles at its final state, with no motion: `CountUp`, `score-ring`, `radar`, `metric-bar`, `sparkline` draw, `cursor-glow`, `clip-viewer` autoplay, `scoreboard` point-pop, and any section 10.2 library-driven effect. `[prior-burst: CountUp, score-ring, metric-bar already self-guard]`
- The `matchMedia` decision is not captured once at mount for the life of the component where the user can change it mid-session; either re-read on the interaction or attach a `change` listener (specifically `cursor-glow`, which today decides `finePointer()`/reduced-motion once).
- `clip-viewer` auto-advance is paused (never started) under reduced motion.
- The section 7 view-transition layer ships a reduced-motion block that zeros every `::view-transition-*` duration and delay, so reduced-motion users get instant swaps (D-002).
- No motion causes layout shift or jank; motion never conveys state on its own (see section 8).

## 7. Accessibility contracts by component type

Each contract is a hard requirement for the components of that type.

- Data visuals (`score-ring`, `radar`, `sparkline`): each exposes an accessible name or a visually-hidden data equivalent. A purely decorative SVG is `aria-hidden`, but then the datum it represents must appear as real, screen-reader-readable DOM text (not itself hidden). Null/empty data states expose accessible text ("Not rated yet" / "Not enough data yet"), never a bare dash or a shape a sighted user cannot interpret. `[prior-burst: radar has role=img + aria-label; score-ring svg is aria-hidden with the number as real text]`
- Progress bars (`metric-bar`, `goals` rating bar): `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and an accessible name. `[prior-burst: dashboard XP bar already has role=progressbar]`
- Async / streaming surfaces (`coach-chat` message stream, `scoreboard` scoring, `recorder` recording state, `analyze-flow` status): a polite live region announces the change. `[prior-burst: analyze-flow has aria-live status]` Error banners on these surfaces sit inside a live region so they are announced.
- Single-select (`skill-picker`): a labeled `radiogroup` with `role="radio"` options, an accessible group name associated with its heading, roving `tabIndex`, and arrow-key navigation. Selected state is exposed via `aria-checked`, not by color alone.
- Nav landmarks (`landing-nav`, `app-nav` sidebar and tab bar): every `<nav>` has an accessible name (`aria-label`), and repeated link groups use list semantics.
- No state by color alone (WCAG 1.4.1): active tab, serving indicator, set/match badges, sparkline direction, insight strength-vs-fix, selected chip/skill, and thumbnail selection each carry a non-color signal (text, icon, `aria-current`/`aria-checked`/`aria-selected`, shape, or weight) in addition to color.
- Icon-only controls and standalone icons (`skill-icons`, `motif` SeamArcs, nav icons) carry `focusable="false"` on the SVG and either `aria-hidden` (decorative) or an accessible label (meaningful).
- Media: `<video>` elements have an accessible label describing the clip; decorative/generated media is `aria-hidden`; sourced media carries alt text in the project voice (10.3).

## 8. Boundaries, states, and metadata (per route)

- Every route handles loading, empty, error, and not-found as applicable to that route. The loading skeleton matches the layout it stands in for (the generic `(app)/loading.tsx` must not stand in for chat, the two-column analysis, the scoreboard, or lists without matching them). `[prior-burst: dashboard skeleton is tailored]`
- Missing boundaries to add: `app/global-error.tsx`, `app/(app)/error.tsx`, a not-found for `analysis/[id]`, a not-found for `drills/[slug]`.
- Data-fetch failures are not silently coerced to empty (`?? []`) where that hides an error from the user; distinguish "no data yet" from "the fetch failed."
- Signed-URL failure on `analysis/[id]` renders a message, not blank images.
- Server-action forms (`login`, `signup`, logout) show an in-flight pending state and cannot double-submit. Nav taps to a slow route give pressed/pending feedback.
- Every route sets its own `title` (via the `%s — Sideout` template). `analysis/[id]` and `drills/[slug]` implement `generateMetadata`. The landing route sets `metadataBase` and Open Graph. `[prior-burst: landing metadataBase/OG/title done; root title.template done; login/signup/offline titles done]`

## 9. Dark theme only

- There is no light mode and no `prefers-color-scheme` handling anywhere. Do not add theme-aware branches, tokens, or `data-theme` logic. Adding one is out of scope, not an improvement.

## 10. No vendor names

- No vendor or model name appears in any user-visible string: labels, errors, empty/loading states, `aria-*` text, alt text, titles, or OG copy. The AI layer is "the coaching service." The only vendor-named string in the repo is the server-side `ANTHROPIC_API_KEY`.

## 11. Voice (all user-facing copy)

- Second person to the player, plain declarative sentences. The coach persona is the one exception and speaks first person.
- No em dashes. Ranges are written with "to" (for example "0 to 100"), not an em dash; a plain hyphen is acceptable only inside a compound word. This flags existing copy that uses "—" as sentence punctuation (landing hero, `analyze-flow` preview empty state) as items to sweep.
- No corporate filler, no hype, no vendor names. Match shipped voice: "Fix the one thing holding your game back," "Record a rep," "Your move."

## 12. Motion discipline (10.2, D-001/D-002)

- New keyframes, easing curves, motion beyond the 150-300ms band, and a third-party animation/motion library are allowed only under discipline: reduced-motion always wins (section 6), no layout shift or jank, Lighthouse performance stays >= 90 on landing and dashboard, any library is tree-shaken with its bundle cost justified in `docs/decisions.md`, and motion never conveys state alone.
- 150-300ms on `--ease-court` remains the default for ordinary interaction transitions; depart with intent.
- The shipped ambient/reveal durations (`reveal` 0.55s, `fade-up` 0.6s, `marquee`, `sheen`, `pulse-dot`) and the hand-rolled primitives stay.
- View transitions are scoped to `::view-transition-*` rules only, named and auditable, enter/exit 150-210ms, 400ms reserved for morph/directional travel (D-002).

## 13. Machine-enforceable gates

- `npx tsc --noEmit`, `next build`, and `node --test` all run clean.
- `package.json` gains `lint`, `typecheck` (`tsc --noEmit`), and `test` (`node --test`) scripts so the floor is enforceable in CI.
- No console errors on any route. Lighthouse performance and accessibility are both >= 90 on the landing route and the dashboard.
- No committed secret; any new env is documented in `.env.example`. Commit messages carry no attribution trailers.

## 14. Branding presence (10.6)

- The `public/icon-512.png` mark drives `favicon.ico` (crisp at 16, 32, 48px on navy), `apple-icon.png`, the manifest icons (including a dedicated maskable variant with ~20% safe padding, distinct from a full-bleed "any" icon), and the Open Graph image.
- The mark appears in the landing header and the app-shell header/nav using existing shared classes and tokens, at >= 44px where it is a tap target, with the accessible name "Sideout, home" when it links home. Adding it must not regress the `landing-nav` mobile menu, skip link, or `app-nav` accessibility items.

---

Every item above maps to one or more pass/fail assertions in `docs/acceptance.md`. Sierra grades from the acceptance list; this document is the rationale behind it.
