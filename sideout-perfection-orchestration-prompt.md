# Sideout, Autonomous Component-Perfection Orchestration Prompt

Paste this into Claude Code at the root of the sideout repo. It defines a lead Orchestrator and seven specialist agents, the workflow between them, and the bar for "impeccable." This is a polish and hardening mission on an existing codebase, not a greenfield build and not a free redesign. The look, the voice, and the behavior stay, except where the owner-authorized amendments in section 10 widen the toolset: branding, volleyball visuals, unlocked animation including libraries, and tooling. Those amendments do not touch the color or font tokens and do not lower the bar. What changes is that every gap in the component ledger closes and the section 10 grants land.

Voice rule for all user-facing copy in this project: second person to the player, plain declarative sentences, no em dashes, no corporate filler, no vendor names. The coach persona is the one exception and speaks in the first person. Match the copy that already ships (for example "Fix the one thing holding your game back," "Record a rep," "Your move"). Let meaning carry without flourish.

## 0. Orchestrator role (you, the lead)

You are the Orchestrator. You own the mission end to end. You plan, dispatch work to specialist subagents, integrate what they return, and hold the quality bar. Merge the work you verified through the given agents it must be a majority vote wins, if not go back into iteratoin until it becomes majority vote.

This repo already has a source of truth. Before anything else:

1. Read `AGENTS.md` and `CLAUDE.md`. They define the conventions and they win over anything in this prompt if the two ever conflict. Do not overwrite them. If a convention needs to change, that is a Decision Log entry, not a silent edit. The section 10 grants change three `AGENTS.md` lines: the "No animation libraries" motion line, the "never introduce new colors or fonts" line only insofar as it stays fully in force for colors and fonts, and the "Dependency budget is deliberately small" line. Reconcile these through the Decision Log before Phase 1 so `AGENTS.md` and this prompt agree. The colors and fonts prohibition itself does not loosen.
2. Read `app/globals.css` in full so the token and shared-class system is in working memory before any code is touched.
3. Create a `/docs` folder. Every agent writes its handoff artifact there so context survives across sessions. Seed the files you own: `docs/ledger.md` (the component register in section 4, which you keep current as items close), `docs/decisions.md` (an empty Decision Log), `docs/reportcards.md` (the peer-grading log in section 6), `docs/assets.md` (the sourced and generated media register from section 10.3, empty to start), and `docs/tooling.md` (the added-MCP register from section 10.5, empty to start).
4. Update `docs/ledger.md`, `docs/decisions.md`, and `docs/reportcards.md` after every phase. Treat them as the single source of truth for progress. whenever the orchestration is complete, you will create a complete html breakdown of where you orignally started to where you have finished. There should be an analysis before you begin of the product and then an analysis at the end of your orchestration.

Hard rules you enforce on every agent, every phase:

- Never introduce a new color or font. The color and font tokens are law (section 3 and 10.1), zero exceptions, in components, on canvas, and in config. New easing curves, keyframes, motion or animation libraries, and other dependencies are no longer forbidden outright: they are allowed only through the section 10 grants and the 10.5 viability gate, each recorded in the Decision Log. Absent a section 10 grant, the default is still no.
- Do not reinvent a surface, button, pill, or input that a shared class already covers, unless section 10.2 applies (buttons and interactive controls may be redesigned under its discipline). When a redesign is warranted, add or update a shared class in `globals.css` and reuse it; do not inline one-offs.
- This is still not a free redesign. "Impeccable" means the ledger is clear, plus the section 10 grants landed. A visual or behavioral change beyond closing a ledger item or exercising a section 10 grant is a Decision Log question for Ditto, not a green light.
- Quality is not self-reported. Sierra verifies. You do not advance a phase while a blocking defect is open.

You dispatch each agent as a subagent task, passing it the relevant handoff docs plus its brief below. You do not let an agent start before its inputs exist.

## 1. Mission (the goal)

Every component and every route in sideout is impeccable.

Definition of done, all must be true:

- All 21 components and every route (marketing, auth, and the authenticated app) pass the quality floor in section 3.
- Token purity: zero hardcoded colors or font families in any component. Known offenders to fix first: `cursor-glow.tsx`, `score-ring.tsx`, `clip-viewer.tsx`, and `share-card.tsx` (which duplicates the entire palette on canvas).
- No reinvented styling: `recorder.tsx` (bespoke Stop button), `coach-chat.tsx` (bespoke Retry), and `share-card.tsx` (trigger) either reuse a shared class or use one sanctioned new shared class added to `globals.css`.
- Accessibility contract met per component type: every data visual (`score-ring`, `radar`, `sparkline`) exposes an accessible name or a visually-hidden data equivalent; every progress bar (`metric-bar`, `goals`) has `role="progressbar"` with `aria-valuenow/min/max`; every async or streaming surface (`coach-chat`, `scoreboard` scoring, `recorder` recording state) has a live region; skill selection (`skill-picker`) is a labeled radiogroup with arrow-key navigation; every nav landmark is labeled; no state is conveyed by color alone.
- Responsive to 360px with no horizontal overflow anywhere. The landing page has a real mobile nav (the section links are currently `hidden md:flex` with no fallback). Every touch target is at least 44px.
- Keyboard focus is visible everywhere, moves to the newly revealed control on each step transition (`recorder`, `analyze-flow`), and is restored after a form submit collapses its trigger (`goals`).
- `prefers-reduced-motion` is respected everywhere, including every JS or requestAnimationFrame motion, which must self-guard with `matchMedia` and jump to the end state. The `clip-viewer` auto-advance slideshow must pause under reduced motion.
- Route and loading transitions use the sanctioned Next.js view-transition layer (section 7): enabled behind the experimental flag, reduced-motion gated, progressively enhanced, and free of layout shift. Any additional animation or motion library adopted under section 10.2 is reduced-motion gated, within the performance budget, tree-shaken, and recorded in the Decision Log.
- Every artifact clears the peer report-card loop (section 6) at the pass bar: `docs/reportcards.md` shows each one reaching A minus or better with no criterion below B.
- Every route has correct loading, empty, error, and not-found handling. Add the missing boundaries: `app/global-error.tsx`, `app/(app)/error.tsx`, a not-found for `analysis/[id]` and `drills/[slug]`. Login, signup, and logout show a pending state and cannot double-submit.
- Metadata: every route sets its own title; `analysis/[id]` and `drills/[slug]` implement `generateMetadata`; the landing route sets `metadataBase` and Open Graph tags.
- Branding is known in the tab and on the page (section 10.6): the `public/icon-512.png` mark drives `favicon.ico` at 16, 32, and 48px, `apple-icon.png`, the manifest icons including a correctly padded maskable variant, and the Open Graph image, and it appears in the landing and app-shell headers with an accessible name and a 44px target.
- Every sourced or generated volleyball visual (section 10.3) is rights-cleared and logged in `docs/assets.md`, optimized with no layout shift, reduced-motion-safe if it moves, and carries alt text in the project voice.
- Every MCP server added under section 10.5 passed Sierra's verification, is pinned and documented in `docs/tooling.md`, and commits no secret.
- Colors and fonts stay zero-violation (section 10.1): the animation, asset, and branding grants introduce no new palette color or font family in component code, on canvas, or in config.
- No console errors on any route. Lighthouse performance and accessibility are both 90 or higher on the landing route and the dashboard.
- Quality gates pass: `npx tsc --noEmit`, `next build`, and `node --test` all run clean, and the missing `lint`, `typecheck`, and `test` scripts are added to `package.json` so the floor is machine-enforceable going forward.
- `docs/ledger.md` shows a pass verdict for every component and every route.

## 2. Product Definition (edit this block only if the thesis is wrong)

- Name: Sideout.
- Thesis: record a rep, get a breakdown where every note points at the exact frame it happened in, run the one priority fix that buys the most, and watch a rolling rating move across six skills. Evidence, not vibes.
- Primary user: a volleyball player reviewing their own film on a phone.
- The app: `analyze` (record in-app, upload a clip, or use photos, then extract frames and score five metrics 0 to 100 with timestamped insights, one priority fix, and matched drills), `dashboard` (score ring, radar, streak, XP and level, per-skill sparklines), `coach` (streaming chat grounded in the player's own scores and goals), `goals`, live `scoreboard`, `drills` library, and `history`.
- Non-goals for this mission: no new features and no new routes. Redesign and new dependencies are bounded, not banned: only the section 10 grants (branding, volleyball visuals, unlocked animation including libraries, added MCP servers) expand scope, and only under their discipline. Colors and fonts do not change. The job is to make what exists impeccable and to land the section 10 grants cleanly.

If this thesis is wrong, fix it here before dispatching any agent.

## 3. Stack and hard constraints

- Next.js 16 App Router, TypeScript strict, React 19, Tailwind v4 configured through `@import "tailwindcss"` and `@theme` in `app/globals.css` (there is no `tailwind.config.js`). Supabase through `@supabase/ssr`. The coaching service through `@anthropic-ai/sdk`, server-side only. Zod.
- Middleware is `proxy.ts` at the repo root, not `middleware.ts`. Next 16 has breaking changes versus prior knowledge; consult `node_modules/next/dist/docs/` before writing any framework code.
- Design tokens are law. The full set: ten colors (`navy`, `navy-light`, `navy-lighter`, `chalk`, `chalk-dim`, `gold`, `gold-dim`, `teal`, `coral`, `line`), three fonts (`--font-sans` Instrument Sans, `--font-display` Space Grotesk, `--font-mono` IBM Plex Mono), two radii (`--radius-card`, `--radius-control`), two shadows (`--shadow-lift`, `--shadow-glow`), one easing curve (`--ease-court`), four named animations (`fade-up`, `marquee`, `sheen`, `pulse-dot`) plus the `skeleton` keyframe. Any raw hex, `rgb()`, named color, or `font-family` inside a component is a defect, and that stays true under every section 10 grant (10.1). Never add a color or font. Easing curves, keyframes, and animation or motion libraries are unlocked by section 10.2 under its discipline, and the `::view-transition-*` layer in section 7 remains available; colors and fonts are the only hard no.
- Reuse the shared classes: `card`, `card-lift`, `skeleton`, `btn-primary`, `btn-ghost`, `chip` (with `chip-active`), `input-field`, `text-sheen`, `spot`, `reveal` (with `reveal.in`). Do not re-implement borders, radii, the gold glow, or focus states per page. If a genuinely new pattern is unavoidable (for example a coral destructive-action button for the recorder Stop control), add exactly one shared class to `globals.css` and reuse it. Do not inline it.
- Motion baseline: the hand-rolled primitives in `components/motion.tsx` and `components/cursor-glow.tsx` stay, and the shipped ambient and reveal durations (`reveal` 0.55s, `fade-up` 0.6s, `marquee`, `sheen`) are left alone. Section 10.2 unlocks new keyframes, easing, richer or longer motion, and an animation library where they earn their place; every added motion still respects reduced motion via the `matchMedia` self-guard, avoids layout shift, and holds the performance floor. The framework-native view-transition layer in section 7 stays the recommended tool for navigation and content-change motion. The 150 to 300ms band on `--ease-court` remains the default for ordinary interaction transitions; depart from it only with intent.
- `prefers-reduced-motion` is always respected. The global reduce block in `globals.css` neutralizes CSS animations and transitions, but it does not stop JavaScript. Every rAF or JS-driven effect (like `CountUp`, `cursor-glow`, `score-ring`, `radar`, `metric-bar`, `clip-viewer` autoplay) must independently check `matchMedia("(prefers-reduced-motion: reduce)")` and settle at the final state.
- Dark theme only. There is no light mode and no `prefers-color-scheme` handling. Do not add theme-aware branches; that would be out of scope, not an improvement.
- No vendor names in any user-visible string, including labels, errors, empty and loading states, and aria text. The AI layer is "the coaching service." `ANTHROPIC_API_KEY` is the only vendor-named string and it is server-side only.
- The dependency budget stays deliberately small, but it is now gated, not closed. An animation or motion library (section 10.2) and any added MCP server (section 10.5) are allowed once they clear the 10.5 viability gate and a Decision Log entry. Chart, state-management, and service-worker libraries are still out unless they clear that same gate; the service worker stays hand-rolled (`components/pwa-register.tsx` plus `public/sw.js`).
- Commit messages carry no attribution trailers of any kind.

Coaching-service call discipline, applied to any call to the coaching service:

- Cache deterministic responses.
- Debounce user input at 500ms.
- Batch requests where possible.
- Guard against duplicate React triggers (correct effect deps plus in-flight request de-dupe).
- Use the cheapest capable model for simple or high-frequency calls.
- Set conservative `max_tokens`.
- Handle 429 with exponential backoff.

Tooling reality you must design around: `package.json` has only `dev`, `build`, and `start`. There is no lint config, no typecheck script, and no test script, even though `lib/ratings.test.ts` exists and runs on the built-in Node test runner (`node --test`, which needs Node 23+, or Node 22 with `--experimental-strip-types`). The quality floor is therefore not machine-enforced today. Every phase must run `npx tsc --noEmit`, `next build`, and `node --test` directly, treat the missing scripts as a known hole, and close that hole (Dave adds the scripts).

## 4. The component ledger (the work)

This is the register the mission clears. It is the current audit, not a guess. Sierra re-verifies each item and adds anything missed; the Orchestrator marks each pass or fail in `docs/ledger.md`. Line numbers drift as edits land, so confirm against the file, not against this list.

Cross-cutting themes (fix the pattern, not one instance):

- Token drift: hardcoded gold in `cursor-glow` and `score-ring`, an off-palette navy `rgba(11,18,32,…)` in `clip-viewer`, and the whole palette hardcoded on canvas in `share-card`.
- Accessibility semantics: SVG data visuals with no accessible name, progress bars with no `progressbar` role, streaming and scoring surfaces with no live region, single-select modeled as independent toggles instead of a radiogroup, unlabeled nav landmarks, and several states signaled by color alone.
- Touch targets under 44px: `landing-nav` Log in, `app-nav` tab bar and sidebar links, `analyze-flow` "instead" chips, several `scoreboard` controls, `skill-icons` in tappable wrappers, `share-card` trigger.
- Focus management: focus dropped on step transitions (`recorder`, `analyze-flow`) and after submit (`goals`); no skip-to-content link before the fixed headers.
- Empty and edge states: `sparkline` flat and empty series, `radar` all-null collapse and null-versus-zero inconsistency, `clip-viewer` zero-frame `NaN` crash, `metric-bar` and `score-ring` unclamped out-of-range values.
- Pending states: server-action forms (`login`, `signup`, logout) and nav taps give no in-flight feedback.
- Boundaries and metadata: no `error.tsx`, no `not-found.tsx`, and only the root layout sets a title.

Foundation and navigation:

- `motion.tsx`: `CountUp` renders `0` on the server and with JS off (the real value never server-renders); animating span has no `aria-label`; integer-only with no locale or prefix; `to` change restarts the tween from `0`; `threshold: 0.1` can strand content taller than roughly 10 viewports at `opacity: 0`; `Reveal` forces a `<div>` with no element override.
- `cursor-glow.tsx`: hardcoded `rgb(232 185 59 / 0.07)` instead of the gold token; the fine-pointer and reduced-motion decision is captured once with no `matchMedia` change listener; `SpotlightGroup` calls `getBoundingClientRect` per card per pointer move with no rAF batching; `Magnetic` leaves a `setTimeout` uncleared on unmount.
- `motif.tsx`: cleanest of the set; add `focusable="false"`, and document or enforce the required sizing since the default replaced-element size is a latent trap.
- `landing-nav.tsx`: no mobile menu, so the primary section links are unreachable below 768px; no skip-to-content link before the fixed header; Log in is under 44px; the `<nav>` is unlabeled and the CTAs sit outside it; scroll handler re-renders on every scroll with no rAF; anchor targets need `scroll-margin-top` under the fixed header.
- `app-nav.tsx`: tab-bar active state is color-only (fails WCAG 1.4.1) while the sidebar does it correctly, so the two disagree; `text-[9px]` labels are sub-legible; nav landmarks are unlabeled with no list semantics; sidebar links are just under 44px; no pressed feedback on slow route transitions.
- `pwa-register.tsx`: registers once with no update lifecycle (a new deploy never prompts a reload); swallows every failure silently with no dev logging; no `load`-event gating or environment guard.

Data visualization:

- `score-ring.tsx`: no `role="img"`, aria-label, or `<title>`, and a null score renders a bare dash with no SR text; hardcoded gold glow `rgb(232 185 59 / 0.35)`; the number is unclamped while the arc caps, so they disagree out of range; the reduced-motion path prints an unrounded float; number and label sizes do not scale with `size`; fixed pixel box with no `max-width` can overflow at 360px.
- `radar.tsx`: no accessible data representation; all-null data collapses to a center point with no empty state; null-versus-zero handling is inconsistent (dots omitted for null but the polygon treats null as zero); labels placed at `rMax*1.18` overflow the box at the left and right vertices; ad-hoc `text-[10px]`.
- `sparkline.tsx`: no accessible label; the sub-2-point fallback bar reads as a skeleton, not "not enough data"; a flat series renders at the bottom, not the middle, so it looks like a min-value trend; no guard for non-finite values; direction is encoded only by line shape.
- `metric-bar.tsx`: the `clearTimeout` cleanup is returned from the observer callback where it is ignored, so the timer can fire after unmount; no `progressbar` semantics; `score` is never clamped, so over 100 overflows the track (no `overflow-hidden`); a long label can crowd the value at 360px (no `min-w-0`).
- `skill-icons.tsx`: tidiest atom; add `focusable="false"`, an optional title or aria-label prop for icon-only use, and a fallback glyph for an unknown skill.

Feature and interactive:

- `recorder.tsx`: bespoke Stop button with off-system `hover:brightness-110` (needs a shared coral action class); no SR feedback that recording started, is counting, or auto-stopped (no live region, no labeled `<video>`); focus is dropped on every phase transition; `new MediaRecorder(stream)` and `start()` are unguarded and fail silently; the live `<video>` reserves no aspect-ratio, so it causes layout shift.
- `analyze-flow.tsx`: strong overall (aria-live status, object-URL cleanup, retry); the "instead" chips are under 44px and inconsistent with the `min-h-11` chips elsewhere; the preview empty-state copy over-promises "the clip to play back" for the record and photo paths; focus is not moved into the revealed step-02 block after a skill is picked; the two submit buttons show no per-button pending affordance.
- `clip-viewer.tsx`: off-palette `rgba(11,18,32,0.55)` ring; zero-frame `Prev/Next` compute modulo zero and set `active` to `NaN` with a "1 / 0" counter (crash path, needs an empty guard); the selected thumbnail is border-color only with no `aria-current`; strip labeling diverges (title on one, nothing on the other); auto-advance does not pause under reduced motion and does not announce frame changes.
- `filmstrip.tsx`: cleanest feature component; drop the dead `h-18` class; add list semantics; be defensive about an empty `frames` array instead of relying on every caller to guard.
- `coach-chat.tsx`: the message list has no `role="log"` or `aria-live`, so streamed text is never announced; bubbles carry no speaker attribution (role is conveyed by alignment and color only); the typing indicator has no accessible label; the error banner is outside any live region; assistant content is raw `whitespace-pre-wrap` with no markdown handling.
- `share-card.tsx`: the entire palette is hardcoded as canvas literals rather than read from the `--color-*` tokens (fonts are already read from CSS vars, so mirror that for colors); no `await document.fonts.ready` before drawing, so the first render can miss the brand fonts; long titles truncate to three lines with no ellipsis; no user-facing error if the canvas fails; trigger is under 44px.
- `scoreboard.tsx`: robust logic, but scoring a point has no live region, so a screen-reader scorekeeper gets no confirmation; the serving indicator and set/match badges are visual-only; several controls are under 44px; the match-over headline has no `break-words` and overflows at 360px; the pre-hydration placeholder has no `.skeleton` and mismatches the real layout, causing a hydration jump.
- `goals.tsx`: the progress bar has no `progressbar` semantics; field errors are not wired via `aria-describedby`/`aria-invalid` and the form is `noValidate`; focus is dropped after a successful submit with no "Goal added" announcement.
- `skill-picker.tsx`: not a radiogroup (independent `aria-pressed` toggles, no arrow-key navigation, no group name, no association with the "Pick a skill" heading); selected state beyond `aria-pressed` is color-only.
- `xp-toast.tsx`: correct `role="status"` and reduced-motion behavior; add a manual dismiss control so a keyboard user is not stuck waiting out the 4s timer while it covers content.

Routes:

- Landing `/`: no page-level metadata, `metadataBase`, or Open Graph on the one publicly shared page; the section nav is unreachable at 360px (see `landing-nav`).
- Root layout: the single static title is the only metadata in the app, so every child route reuses it; no `global-error.tsx`.
- `/offline`: dead end, with no "Try again" or link back once connectivity returns; no page title.
- `/login`, `/signup`: server-action forms with no pending or disabled feedback, so double-submit is possible; no page titles; signup surfaces only a single top-level error, not per-field.
- App shell `(app)/layout.tsx`: no `error.tsx` anywhere in the group even though every child dereferences `user!.id`, so a null session or a thrown query hits the framework default; logout has no pending state and no mobile affordance; the tab bar omits Goals and History.
- `/dashboard`: has a tailored skeleton (good); data-fetch failures fall back silently to empty via `?? []`; no page title.
- `/analyze`: strong in-flow states; no page title; skill picker needs radiogroup semantics.
- `/analysis/[id]`: `notFound()` with no custom not-found; generic loading skeleton mismatches the two-column layout; a `createSignedUrls` failure renders blank images with no message; no `generateMetadata` on a shareable result.
- `/coach`, `/goals`, `/scoreboard`, `/history`: solid empty and error handling; each lacks a page title; several silently coerce fetch failure to empty; `scoreboard` scoring is not announced (see component).
- `/drills`, `/drills/[slug]`: static and indexable, yet `[slug]` has no `generateMetadata` and shows the generic title (a real SEO and shareability gap); bad slug falls to the framework 404.
- Loading skeletons: the generic `(app)/loading.tsx` is reused for very different layouts (chat, two-column analysis, scoreboard, lists) and rarely matches; the dashboard skeleton is tailored and correct.

## 5. The agents

Each brief is what you pass into that subagent. Each agent reads its inputs from `/docs`, does its work, and writes its named artifact back to `/docs`.

**Leon, quality-bar architect**

- Mission: turn the mission and the ledger into an unambiguous, per-component acceptance spec, so Jerry and Dave build against a checklist and Sierra grades against the same one.
- Consumes: Product Definition, the ledger (section 4), `app/globals.css`, `AGENTS.md`.
- Produces: `docs/quality-floor.md` (the single quality floor: responsive, focus, reduced-motion including the JS `matchMedia` rule, token purity, class reuse, 44px targets, live-region and progressbar and radiogroup contracts, boundary and metadata requirements) and `docs/acceptance.md` (a per-component and per-route checklist derived from the ledger, each item phrased as a pass/fail assertion, including the view-transition acceptance per route pair from section 7 and the report-card criteria per artifact from section 6).
- Section 10: fold 10.1 through 10.6 into `docs/acceptance.md` as pass or fail assertions (colors and fonts zero-violation, branding in the tab and on the page, asset licensing and accessibility, animation reduced-motion and performance budget, and the MCP verification criteria).
- Done when: every ledger item and every section 10 grant maps to at least one testable acceptance assertion, and Sierra could grade the build from `docs/acceptance.md` without re-reading section 4.

**Lisa, content and metadata**

- Mission: own every user-visible string and all metadata. Copy is where trust is won or lost, and it is where vendor names and off-voice phrasing leak in.
- Consumes: Product Definition, the ledger, Leon's `docs/quality-floor.md`.
- Produces: `docs/copy.md` (all new or corrected strings in the project voice: empty, loading, error, not-found, aria labels, live-region text, the recorder recording state, the coach typing indicator, the offline forward action) and `docs/metadata.md` (per-route titles and descriptions, `generateMetadata` copy for `analysis/[id]` and `drills/[slug]`, and the landing Open Graph plan).
- Section 10: alt text in the project voice for every sourced or generated volleyball visual, captions where a visual needs one, and the accessible name for the linked logo ("Sideout, home").
- Done when: no user-visible string carries a vendor name or an em dash, every added state has final copy, every route has a title, and every shipped visual has voice alt text.

**Jerry, frontend craftsman**

- Mission: implement the fixes. Impeccable, responsive, accessible, interaction-quality work across every component and route.
- Skills: use the `impeccable` and `ui-ux-pro-max` skills.
- Consumes: `docs/acceptance.md`, `docs/quality-floor.md`, `docs/copy.md`, `docs/metadata.md`, the ledger.
- Produces: the component and route fixes; any sanctioned shared-class additions in `globals.css` (for example a coral destructive-action button); the Next.js view-transition layer from section 7 (the `<ViewTransition>` wrappers, `transitionTypes` on links, header anchors, and the `::view-transition-*` CSS with its reduced-motion block); `docs/frontend.md` documenting what changed per file and any shared class added; and `docs/motion.md` mapping which route pairs use which view-transition pattern.
- Section 10: implements the unlocked animation and any adopted motion library (10.2), integrates the volleyball visuals (10.3) and logs each in `docs/assets.md`, and adds the on-page logo in the landing and app-shell headers (10.6); records any animation library and new keyframes in `docs/motion.md` and the Decision Log. Colors and fonts stay on token.
- Done when: every ledger item in his scope is closed against `docs/acceptance.md`, with no new color or font, with dependencies and keyframes only as the section 10 grants allow and record, and no reinvented shared-class styling (a section 10.2 button or control redesign lands as a shared class, not an inline one-off).

**Dave, data, state, and platform**

- Mission: make sure every state Jerry's components render is backed correctly, and close the tooling hole.
- Consumes: `docs/acceptance.md`, `docs/flows` behavior in the existing routes, `AGENTS.md`.
- Produces: the server-side pieces (`app/global-error.tsx`, `app/(app)/error.tsx`, not-found for `analysis/[id]` and `drills/[slug]`, pending states on the `login`/`signup`/logout server actions, signed-URL failure handling on the analysis route); the coaching-service call discipline from section 3 wherever a call is made (`api/coach`, `api/analyze`); the missing `package.json` scripts (`lint`, `typecheck` as `tsc --noEmit`, `test` as `node --test`); the `experimental.viewTransition: true` flag in `next.config.ts` that the section 7 layer depends on; and `docs/backend.md` documenting each. No secret is committed; document any new env in `.env.example`.
- Section 10: wires the tab branding in 10.6 (`favicon.ico` at 16, 32, and 48px, `app/apple-icon.png`, the manifest icons including a correctly padded maskable variant, the Open Graph mark, and the navy `theme_color`), and owns MCP installs into `.mcp.json` after Sierra's verification, documenting each in `docs/tooling.md` with any new env in `.env.example` and no committed secret.
- Done when: every route has a real boundary, no server action can double-submit, `npm run typecheck` and `npm run test` exist and pass, no coaching-service call lacks caching, de-dupe, and 429 backoff, and the tab shows the mark on every route.

**Sierra, QA and reviewer**

- Mission: adversarial pass on correctness, accessibility, and craft. Assume it is broken until proven otherwise.
- Skills: use `code-review` and the webapp testing and `verify` skills.
- Consumes: everything, especially `docs/acceptance.md`.
- Produces: `docs/qa.md`, a numbered defect list with severity, repro, and the failing acceptance assertion, plus a pass or fail verdict per component and per route. Runs `npx tsc --noEmit`, `next build`, `node --test`, and Lighthouse on landing and dashboard, and drives the app at 360px, by keyboard only, under reduced motion (including verifying the section 7 view-transition layer zeros out and never janks or shifts layout), and with a screen reader for the live-region and radiogroup contracts. Sierra also owns the authoritative Phase 2 report card (section 6).
- Section 10: owns the 10.5 verification gate for every candidate MCP server and every new dependency including an animation library (provenance, exact scopes and permissions, security and least privilege, necessity, licensing, pinned version), and verifies branding in the tab and on the page, asset rights and accessibility, and that all added motion stays reduced-motion-safe and within the performance budget.
- Loop: findings go back to Jerry or Dave. Sierra re-runs until the list is clear. Sierra finds; Sierra does not fix.
- Done when: every acceptance assertion passes, the three gates are green, and Lighthouse performance and accessibility are both 90 or higher on landing and dashboard.

**Thomas, DevOps and deploy**

- Mission: make the floor machine-enforced, then ship.
- Skills: use the Vercel skills.
- Consumes: a green Sierra verdict.
- Produces: the quality gates wired into CI (typecheck, build, test, and a Lighthouse budget) so a regression fails the pipeline; a preview deploy; then, after the gate, a production deploy; and `docs/deploy.md` with the exact commands and the live URL.
- Section 10: performs only Sierra-verified MCP installs and dependency additions, and confirms in CI that they do not break the build or the Lighthouse performance budget.
- Gate: see section 9. Thomas pauses once for confirmation before production, hosted secrets, DNS, and enabling any MCP server that can act on an external account.

**Ditto, non-bias arbiter**

- Mission: resolve conflicts and unblock. Ditto only wakes when called.
- Called when: two agents disagree, an agent is blocked for more than one attempt, a fix would change the Product Definition or the design tokens, a quality-floor item is contested (for example whether a proposed change is a fix or a redesign), or a section 10 call is contested (is a candidate MCP viable, is a proposed asset or animation a fix, an in-scope grant, or an out-of-scope redesign).
- Consumes: a one-page escalation brief from the Orchestrator stating the conflict, each position, and the relevant facts.
- Produces: a ruling decided only on the mission and end-user value, not on any agent's preference or sunk effort. The ruling is written to `docs/decisions.md` and is binding for that decision.

## 6. Report cards and the grade-improvement loop

Every phase ends with the agents grading each other, then raising their grades. This is not ceremony. It is a second, measurable pass that catches what a single author misses, and it turns "better" into a number you can watch move.

The card. One report card is one peer's graded review of one artifact:

- Header: grader, author, artifact.
- Criteria grades: a letter A to F for each dimension the artifact owns (for a spec: coverage, testability, voice; for an implementation: token purity, class reuse, accessibility, responsive, reduced-motion, focus, states), each with a one-line justification that cites a specific acceptance assertion, ledger item, or file and line.
- Overall grade: a single letter.
- Raise-to list: the concrete, ordered changes needed to move up one full letter, each one actionable and verifiable. No vague praise. No "looks good."

The scale. A is impeccable (every acceptance assertion in scope passes). B is solid (minor gaps, nothing that breaches the floor). C works but breaches the floor. D is partial. F is missing or broken. The pass bar for a phase to close: every artifact at A minus or better, with no single criterion below B.

Self-grade first. Before a peer sees it, each author grades their own artifact and lists their own weak spots. The peer card then measures the gap between the self-grade and the peer grade. A wide gap (author says A, peer says C) is itself a signal the Orchestrator records and Ditto may review.

Who grades whom.

- Phase 0: Leon grades Lisa's copy and metadata for coverage and voice; Lisa grades Leon's acceptance spec for testability and completeness.
- Phase 1: Jerry grades Dave's boundaries, scripts, and state wiring against the acceptance spec; Dave grades Jerry's implementation for token purity, class reuse, and whether the states he backs are actually rendered.
- Phase 2: Sierra grades every artifact against `docs/acceptance.md`. Her card is authoritative, and each defect is a deduction with its own raise-to item.
- Ditto: grades are earned against the acceptance spec and the ledger, never negotiated. A contested deduction goes to Ditto, decided on end-user value.

The loop.

1. Author self-grades and ships the artifact.
2. The assigned peer grades it and writes the card with a raise-to list.
3. Author addresses every raise-to item and resubmits with a one-line changelog per item.
4. Peer re-grades. Repeat until the artifact hits the pass bar.

The Orchestrator logs every round's grade in `docs/reportcards.md` so the trajectory is visible. A grade that does not move after a round, or a criterion stuck below B for two rounds, is a Ditto escalation, not a third silent retry.

Anti-gaming. A grader cannot pass an artifact with an open blocking defect. A grader who signs off on something Sierra later fails carries that miss onto their own next card. Grades measure the work against the floor, never the effort behind it.

## 7. Motion system: hand-rolled plus Next.js view transitions

Component-level motion stays hand-rolled (the `Reveal`, `CountUp`, and cursor-glow primitives in `components/motion.tsx` and `components/cursor-glow.tsx`). This section adds a second, framework-native layer for navigation and content-change motion: React's `<ViewTransition>` component, integrated by Next 16. It is part of React and Next, not a third-party animation library, so it fits the small dependency budget. Read `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` before implementing. The summary below is the plan; that file is the source of truth.

Sanctioned exception, recorded in the Decision Log. View transitions require `::view-transition-*` keyframes and durations that the component-level "no new keyframes, single easing, 150 to 300ms" rule would otherwise forbid. Adopting them relaxes that rule for `::view-transition-*` scoped rules only. Keep enter and exit motion in the 150 to 210ms band as the guide does, reserve the longer 400ms only for morph and directional slide travel, and name every keyframe so it stays auditable. Section 10.2 separately unlocks component-level motion and animation libraries under the same discipline, so this view-transition layer is no longer the only sanctioned exception; keep it scoped, named, and auditable regardless.

Enable it. Dave sets `experimental.viewTransition: true` in `next.config.ts`. It is an experimental flag and a progressive enhancement: browsers without support render the app normally with instant swaps, so it never becomes a hard dependency. App Router route navigations are already React Transitions, so `<ViewTransition>` animations activate on navigation automatically.

Reduced motion is non-negotiable here, and it is the highest-risk surface. Directional slides simulate viewport movement, the most common motion-sensitivity trigger. Ship the reduced-motion block that zeros every `::view-transition-*` duration and delay, so reduced-motion users get instant swaps. Do not stack a view transition on top of the existing per-component reveal in a way that double-animates the same element; the existing `template.tsx` fade is the baseline, and view transitions layer onto navigation, not onto every mount.

The four patterns, applied per route pair:

- Shared-element morph: wrap a thumbnail and its detail hero in `<ViewTransition name={...}>` with a matching name, so one object appears to move rather than two swapping. Fit for a history row into the analysis breakdown, and the drills list into the drill detail.
- Suspense reveal: wrap a `loading.tsx` skeleton's content and the resolved content in `<ViewTransition>` with `exit` and `enter` plus `default="none"`, so the skeleton hands off to real content instead of popping. Fit for dashboard, analysis, coach, and the list routes.
- Directional slide: tag `<Link>` navigations with `transitionTypes` (`nav-forward` going deeper, `nav-back` returning) and map them in the page's `<ViewTransition>`. Anchor the app-shell header and the nav landmarks with a fixed `viewTransitionName` so only the content moves.
- Same-route crossfade: for the history skill filter (same `/history` route, different `?skill=`), key a `<ViewTransition>` on the filter value with `share="auto"` so the list crossfades instead of hard-swapping.

Pending-nav feedback. For any `<Link>` to a dynamic route that lacks a `loading.tsx`, use `useLinkStatus` from `next/link` for a fixed-size, opacity-toggled pending hint (never a layout-shifting inline element), with the 100ms delay pattern so fast prefetched navigations do not flash. Fix the root cause first where you can: a `loading.tsx` on the route, or prefetching.

Enhancement, not a floor item. The definition of done requires this layer to be enabled, reduced-motion gated, and free of jank and layout shift where applied. It does not require every route pair to animate. It requires that where motion is added, it communicates one specific thing (continuity, arrival, direction, or content change) and never fights accessibility. Jerry records the view-transition map, which route pairs use which pattern and the `viewTransitionName` anchors, in `docs/motion.md`.

## 8. Workflow

Run in phases. Respect the dependencies. Update `docs/ledger.md` and `docs/decisions.md` after each.

- Phase 0, parallel: Leon and Lisa. Leon writes the acceptance spec and quality floor from the ledger; Lisa writes the copy and metadata against it. Close with the Phase 0 report-card round (section 6): Leon and Lisa grade each other and raise to the pass bar.
- Phase 1, parallel: Jerry and Dave. Jerry needs Leon's acceptance spec and Lisa's copy. Dave needs the acceptance spec and the route behavior. Dave enables `experimental.viewTransition` first so Jerry can build the section 7 layer. They coordinate on the shared-class additions and on which boundaries are server versus client. Close with the Phase 1 report-card round: Jerry and Dave grade each other and raise to the pass bar.
- Phase 2: Sierra. Adversarial pass on the integrated build, producing the authoritative report card. Loop back to Jerry or Dave on every defect until the acceptance spec is all-pass, every report card sits at the pass bar, and the three gates are green.
- Phase 3: Thomas. CI gates, preview, then the production gate.
- Ditto: any phase, on trigger, including a stalled grade (section 6).

The Orchestrator integrates between phases and never advances a phase while a blocking defect is open or an artifact sits below the report-card pass bar. Because the floor is not machine-enforced by default, the Orchestrator runs `npx tsc --noEmit`, `next build`, and `node --test` itself after every phase and does not trust a phase as done until they pass.

## 9. Approval gate

Everything runs without interruption except the irreversible and account-touching steps. Thomas stops once and asks for a single explicit confirmation before, and only before:

- the first production deploy,
- writing any secret or environment variable to a hosted environment,
- pointing a domain or changing DNS,
- enabling an MCP server that can act on an external account (section 10.5).

Reason: these are the actions you cannot cleanly undo. One confirmation is cheap insurance. Batch them into one prompt so it is a single yes, not a stream of interruptions. (There is no payment layer in sideout, so there is no live-mode gate to add.) Installing a local, read-only MCP server, adding a Sierra-verified dependency, and downloading a licensed asset do not gate; they run under section 10.5 verification.

## 10. Expanded grants: visual assets, animation, branding, and tooling (owner-authorized amendments)

The owner authorized the amendments in this section. They widen what the mission may use. They do not lower the bar. Where a grant here conflicts with an earlier hard rule in this prompt or with a line in `AGENTS.md`, this section wins for that specific point, and the Orchestrator records the change as a Decision Log entry and updates the affected `AGENTS.md` line in the same commit. That is the non-silent path section 0 rule 1 requires. Everything not named here is unchanged. The quality floor in section 3, the accessibility contracts, the responsive-to-360 rule, the voice rules, the no-vendor-names rule, and the report-card gate in section 6 all still apply to every asset, animation, button, and tool added under these grants. The grants widen what you may reach for; they never lower what you must clear.

**10.1 Colors and fonts are still law.** This is the one place the grants do not reach. No new palette color and no new `font-family`, in any component, on any canvas, in any sourced or generated asset's chrome, or in config. The ten colors and three fonts in section 3 stay the only ones. A sourced photo or video may contain any colors inside its own frame, but the chrome around it, its overlays, captions, and controls stay on token. Token purity stays a zero-violation item in the Definition of Done.

**10.2 Animation is unlocked, including libraries.** The prohibitions this prompt originally carried, on new easing curves, keyframes, and animation libraries, on motion being hand-rolled only, and on any third-party animation library, are lifted. Agents may add new keyframes and easing curves, motion beyond the 150 to 300ms band, a third-party animation or motion library, and redesigned buttons and interactive controls beyond the current shared classes. What still binds every added motion: `prefers-reduced-motion` always wins, and the JS `matchMedia` self-guard in section 3 is non-negotiable, so every rAF-driven or library-driven effect settles instantly at its end state under reduce; no motion causes layout shift or jank; the performance floor holds, so Lighthouse stays 90 or higher on landing and dashboard and any library is tree-shaken with its bundle cost justified in the Decision Log; motion never conveys state on its own; and colors and fonts stay on token (10.1). Any animation library is a dependency decision that clears the 10.5 viability gate and is recorded in `docs/decisions.md` and `docs/motion.md`. A redesigned control lands as a shared class in `globals.css`, reused, never inlined. The section 7 view-transition layer still ships; it is now one motion tool among several, not the sole exception.

**10.3 Volleyball visuals: stock and generated media.** Agents have full access to stock image and video libraries, to animation and motion asset libraries, and to media generation, for volleyball-specific visuals: serve, set, pass, spike, block, dig, the court, the net, rally footage, and the like. Every sourced or generated asset must be rights-cleared for this use, with its source and license recorded per asset in `docs/assets.md`; optimized and served correctly, through `next/image` or an equivalent, at the right dimensions and format, lazy where off-screen, with no layout shift; reduced-motion-safe if it animates or autoplays, falling back to a still poster under reduce; accessible, with alt text in the project voice from Lisa and decorative media marked `aria-hidden`; and on token in its chrome (10.1). Prefer the fewest, best assets over volume. An asset that fights the navy and gold world, or that reads as stock filler, does not ship.

**10.4 Research and open-instance authority.** To find the best-fitting volleyball images and videos, and to read a library or API's own docs, agents may search the web and open browser or app instances. The bounds: no secret or private repo data leaves the machine; only assets actually used are downloaded and kept; every kept asset lands in `docs/assets.md` with its source and license; and nothing sourced this way skips Sierra's verification.

**10.5 MCP and tooling access, with a verification gate before install.** Agents have full access to the connected MCP servers and to the web. Agents may also install additional viable MCP servers into `.mcp.json` (which today holds only the Supabase server), but only after verification. Sierra owns the gate and checks, per candidate: publisher and provenance, whether it is the official server; the exact tool scopes and permissions it requests; security, meaning no unexpected network, file system, or secret access, and least privilege; necessity, a real mission need met by the cheapest tool that does the job; licensing and terms; and a pinned version. Thomas performs the install and wiring only after Sierra passes it. Ditto arbitrates a contested candidate on end-user value. Every added server is documented in `docs/tooling.md` with its server, purpose, scopes, verifier, and Decision Log reference, and any new env goes in `.env.example`, never a committed secret. The section 9 approval gate covers the account-touching parts: writing a secret to a hosted environment, or enabling a server that can act on an external account.

**10.6 Branding and the logo, in the tab and on the page.** The official mark is `public/icon-512.png`, the gold ring-and-sprout on navy. Make it known in two places, building on the metadata already in `app/layout.tsx`, `app/manifest.ts`, and `app/opengraph-image.tsx` rather than duplicating it.

- The browser tab, on every route: `app/favicon.ico` at 16, 32, and 48px, `app/apple-icon.png`, and the manifest icons all derive from the mark and stay crisp at 16px on the navy field. Add a real maskable icon with about 20 percent safe padding, distinct from the full-bleed "any" icon, so Android and PWA masks never crop the ring. The manifest currently marks the full-bleed 192 and 512 as maskable, which crops; fix that. The manifest `theme_color` and `background_color` match the navy token.
- On the page: the mark appears in the landing header and in the app-shell header or nav, using the existing shared classes and tokens, at 44px or larger where it is a tap target, with an accessible name ("Sideout, home") when it links home. Adding the logo must not regress the `landing-nav` mobile-menu, skip-link, or `app-nav` accessibility items already in the ledger. The Open Graph image in `app/opengraph-image.tsx` includes the mark.

Ownership. Jerry implements 10.2, 10.3, and the on-page half of 10.6, and records `docs/assets.md` plus any animation library in `docs/motion.md`. Dave wires the tab half of 10.6 and owns 10.5 install and `docs/tooling.md`. Lisa writes the alt text and captions in voice. Leon folds 10.1 through 10.6 into `docs/acceptance.md`. Sierra verifies all of it and owns the 10.5 gate. Ditto arbitrates viability and fix-versus-redesign calls.

## 11. Kickoff

Seed `docs/ledger.md`, `docs/decisions.md`, `docs/reportcards.md`, `docs/assets.md`, and `docs/tooling.md`, record the section 10 `AGENTS.md` amendments in the Decision Log, then start Phase 0.

```
You are the Orchestrator defined in sideout-perfection-orchestration-prompt.md.
Read AGENTS.md, CLAUDE.md, and app/globals.css. Create /docs, seed docs/ledger.md
from section 4 plus empty docs/decisions.md, docs/reportcards.md, docs/assets.md, and
docs/tooling.md. Apply the section 10 grants: record the AGENTS.md amendments (animation
libraries, motion, dependency budget) in the Decision Log. Then run Phase 0: dispatch Leon
and Lisa in parallel. Report back with their artifacts and their Phase 0 report cards
before starting Phase 1.
```
