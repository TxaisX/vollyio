# Acceptance Spec

Per-component and per-route pass/fail assertions. Sierra grades the build from this file alone; she should not need to re-read section 4. Each assertion is a single testable claim: it passes or it fails. IDs are stable so defects and report cards can cite them.

Legend:
- `[ ]` open assertion (must pass before the phase closes).
- `[prior-burst]` already satisfied by the earlier landing burst; enforced (must stay true) but not new work. Do not re-flag as a defect unless it regresses.
- Owner in brackets at section head: J = Jerry, D = Dave, L = Lisa (copy backing).

How to test is implied by the assertion (viewport at 360px, keyboard-only, reduced-motion emulation, screen reader for live regions/roles, `tsc`/`build`/`node --test` for gates, Lighthouse for perf/a11y).

---

# A. Components (21)

## A1. motion.tsx [J]
- MOTION-1: `CountUp` renders its target value (not `0`) with JavaScript disabled and in the server-rendered HTML; the animation is a progressive enhancement over the real number.
- MOTION-2: The animating `CountUp` span exposes its final value to assistive tech (accessible via real text or an `aria-label` carrying the target), and does not announce every intermediate tween value.
- MOTION-3: `CountUp` accepts and renders a `prefix`/locale-formatted output (or documents integer-only as intended) so it is not silently wrong for formatted numbers. [scope: confirm intent; no regression required if integer-only is documented]
- MOTION-4: When `to` changes, `CountUp` tweens from the previous displayed value, not from `0`.
- MOTION-5: `useInView` reveals content that is taller than ~10 viewports (the `threshold: 0.1` does not strand tall content at `opacity: 0`); verify a long section still reveals.
- MOTION-6: `Reveal` supports rendering as an element other than `<div>` (an `as`/`element` prop) so it does not force invalid nesting.
- MOTION-7: Under reduced motion, `CountUp` shows the final value immediately via its `matchMedia` self-guard. [prior-burst]

## A2. cursor-glow.tsx [J]
- GLOW-1: The glow gradient reads the gold token, not the hardcoded `rgb(232 185 59 / 0.07)` at line ~61.
- GLOW-2: `CursorGlow` re-evaluates pointer-fine and reduced-motion when the user changes them mid-session (a `matchMedia` `change` listener or per-interaction re-read), rather than capturing the decision once at mount.
- GLOW-3: `SpotlightGroup` batches its per-card `getBoundingClientRect` reads in a single rAF per pointer move, not one synchronous read per `.spot` card per move.
- GLOW-4: `Magnetic` clears its `setTimeout` on unmount (no timer fires after the element is gone).
- GLOW-5: All three effects no-op under reduced motion and on coarse pointers (already gated by `finePointer()`); confirm no console error when no pointer is present.

## A3. motif.tsx [J]
- MOTIF-1: `SeamArcs` SVG carries `focusable="false"` in addition to `aria-hidden`.
- MOTIF-2: `SeamArcs` has an enforced/intrinsic size (the replaced-element default cannot silently collapse or blow up); sizing is documented or defaulted, not left entirely to the caller's className.
- MOTIF-3: All stroke colors remain token-referenced (`var(--color-gold)`, `var(--color-chalk)`). [currently passing; must stay]

## A4. landing-nav.tsx [J]
- LNAV-1: A mobile menu exposes the section links (`#how`, `#skills`, `#progress`) at < 768px; they are reachable and operable at 360px (today they are `hidden md:flex` with no fallback).
- LNAV-2: The `<nav>` has an accessible name (`aria-label`), and the primary CTAs are reachable within a labeled landmark.
- LNAV-3: The "Log in" control has a >= 44px hit area (today `px-2 py-2 text-sm`).
- LNAV-4: The scroll handler that toggles `scrolled` is rAF-batched (does not run layout-affecting work synchronously on every scroll event).
- LNAV-5: Section anchor targets have `scroll-margin-top` clearing the fixed header, so a jumped-to heading is not hidden under the bar.
- LNAV-6: The mobile menu toggle is keyboard-operable, has `aria-expanded`, and traps nothing; focus returns to the toggle on close.
- LNAV-7: Skip-to-content link precedes the fixed header on landing. [prior-burst]

## A5. app-nav.tsx [J]
- ANAV-1: The tab-bar active state carries a non-color signal (not `text-gold` alone) so it does not fail WCAG 1.4.1; it agrees with the sidebar's treatment. (`aria-current="page"` is present but is not a visual signal.)
- ANAV-2: Tab-bar labels are legible (raise `text-[9px]`; the label must not rely on 9px type as its only affordance).
- ANAV-3: Both `<nav>` landmarks (sidebar and tab bar) have accessible names, and the link groups use list semantics.
- ANAV-4: Sidebar links have a >= 44px hit area (today `px-3 py-2.5` computes just under).
- ANAV-5: Tab-bar links have a >= 44px hit area. [likely passing via `min-h-14`; confirm]
- ANAV-6: A tapped nav item gives pressed/pending feedback during a slow route transition (pairs with section 7 pending-nav).
- ANAV-7: `aria-current="page"` is set on the active link in both navs. [prior-burst]

## A6. pwa-register.tsx [D]
- PWA-1: Registration is gated on the `window` `load` event and guarded to production (no register in dev), and only when `serviceWorker` is supported.
- PWA-2: An update lifecycle is handled: on a new `sw.js`, the waiting worker triggers a user-visible, voice-correct reload prompt rather than silently never updating.
- PWA-3: Registration failures are logged in development instead of being swallowed by an empty `.catch(() => {})`.

## A7. score-ring.tsx [J]
- RING-1: The gold drop-shadow reads the gold token, not the hardcoded `rgb(232 185 59 / 0.35)` at line ~70.
- RING-2: The component exposes its value to assistive tech; the numeric text is real DOM (not aria-hidden). When `score == null` it renders accessible text such as "Not rated yet", not a bare "—".
- RING-3: The displayed number is clamped to 0-100 to agree with the capped arc (a score > 100 shows 100, not the raw value).
- RING-4: The reduced-motion path renders a rounded integer, not an unrounded float (`Math.round` the settled value).
- RING-5: The label text scales with `size` (not fixed `text-[10px]`), consistent with the size-scaled number. [number is prior-burst; label remains]
- RING-6: The ring has a `max-width`/fluid box so a large `size` does not overflow at 360px.
- RING-7: The number scales with `size` and the reduced-motion path settles at the final value. [prior-burst]

## A8. radar.tsx [J]
- RADAR-1: All-null ratings render a visible empty state (text or marker), not a silent collapse to a center point.
- RADAR-2: Null and zero are handled consistently: a null skill is not drawn as a zero vertex in the filled polygon while its dot is omitted; nulls are treated the same way in both the polygon and the dots.
- RADAR-3: Vertex labels do not overflow the SVG box at the left and right vertices at the rendered sizes (dashboard 196, landing 190); labels stay within the visible bounds or the container accommodates them.
- RADAR-4: Label type uses a token/utility, not ad-hoc `text-[10px]` inline sizing that diverges from the system.
- RADAR-5: `role="img"` + `aria-label` summarizing the rated skills is present. [prior-burst]

## A9. sparkline.tsx [J]
- SPARK-1: The sparkline exposes an accessible label (trend and latest value, or a visually-hidden equivalent); the six dashboard sparklines are not silent SVGs.
- SPARK-2: The `< 2` point state reads as "not enough data yet" (accessible text or a labeled placeholder), not a gray bar that looks like a `.skeleton`.
- SPARK-3: A flat series (all values equal) renders on the vertical mid-line, not pinned to the bottom where it reads as a min-value trend.
- SPARK-4: Non-finite values (`NaN`/`Infinity`) are guarded so the path never breaks or renders garbage.
- SPARK-5: Direction/trend is conveyed by more than line shape alone where it carries meaning (accessible text covers this; color stays teal).

## A10. metric-bar.tsx [J]
- MBAR-1: The bar is a `role="progressbar"` with `aria-valuenow`/`aria-valuemin=0`/`aria-valuemax=100` and an accessible name from `label`.
- MBAR-2: `score` is clamped to 0-100; a value > 100 does not overflow the track (track also has `overflow-hidden`).
- MBAR-3: The delayed-start timer is cleared on unmount; the `clearTimeout` cleanup is wired to the effect's return, not returned from the IntersectionObserver callback where it is ignored (no state update after unmount).
- MBAR-4: At 360px a long `label` does not crowd or overlap the value (`min-w-0`/truncation on the label row).
- MBAR-5: Under reduced motion the bar and number settle at the final value immediately. [prior-burst]

## A11. skill-icons.tsx [J]
- SICON-1: The SVG carries `focusable="false"`.
- SICON-2: An optional `title`/`aria-label` prop is supported for icon-only use; without it the icon stays `aria-hidden`.
- SICON-3: An unknown/unmapped skill renders a fallback glyph instead of crashing or rendering nothing.

## A12. recorder.tsx [J]
- REC-1: The Stop control uses a shared coral destructive-action class added to `globals.css` (e.g. `btn-danger`), not the inline `bg-coral … hover:brightness-110` one-off.
- REC-2: A polite live region announces recording state changes (started, counting/elapsed, auto-stopped), and the `<video>` has an accessible label.
- REC-3: Focus moves to the newly revealed primary control on each phase transition (to Start when ready, to Stop when recording, back to "Record a rep" on auto-stop/idle).
- REC-4: `new MediaRecorder(stream)` and `recorder.start()` are guarded; a failure calls `onUnavailable()` / surfaces a voice-correct message instead of failing silently.
- REC-5: The live `<video>` reserves an aspect ratio so entering the ready/recording phase causes no layout shift.
- REC-6: The elapsed counter and its color are not the only signal that recording is active (paired with REC-2 live region).

## A13. analyze-flow.tsx [J]
- AFLOW-1: The "instead" chips ("Record in-app instead" / "Upload a clip instead", "Use photos instead") have a >= 44px hit area, consistent with `chip min-h-11` used elsewhere.
- AFLOW-2: The preview empty-state copy does not promise "the clip to play back" on the record and photo paths, and contains no em dash (today: "…shows up here — full-size frames, and the clip to play back.").
- AFLOW-3: Focus moves into the revealed step-02 block after a skill is picked.
- AFLOW-4: Each submit button ("Break it down", "Send it again") shows a per-button pending affordance while `busy`, distinct from the shared status line.
- AFLOW-5: The status region announces reading/sending/error via `aria-live`. [prior-burst]
- AFLOW-6: The preview object URL is revoked on replace/unmount. [prior-burst]

## A14. clip-viewer.tsx [J]
- CLIP-1: The ball-marker ring reads the navy token, not the off-palette `rgba(11,18,32,0.55)` at line ~48.
- CLIP-2: A zero-frame `frames` array never computes modulo zero: `Prev`/`Next` are guarded and the counter never shows "1 / 0" or `NaN` (empty guard renders a "no frames" state).
- CLIP-3: The selected thumbnail carries `aria-current` (or `aria-selected`) in addition to the gold border, so selection is not color-only.
- CLIP-4: Thumbnail buttons have consistent accessible names across the `ClipPlayer` and `FramePlayer` strips (both provide a name; the `FramePlayer` strip does not drop the `title`/label the `ClipPlayer` strip has).
- CLIP-5: Auto-advance does not start under reduced motion (the `FramePlayer` `setInterval` self-guards with `matchMedia`).
- CLIP-6: Frame changes during autoplay are announced (a polite live region reports the current frame), or autoplay is paused for AT as appropriate.
- CLIP-7: Thumbnail strip and controls (Play/Pause/Prev/Next) meet the 44px target.

## A15. filmstrip.tsx [J]
- FILM-1: The dead `h-18` class is removed (the real height is the inline `style={{ height: 72 }}`).
- FILM-2: The strip/grid uses list semantics (`<ul>`/`<li>` or `role="list"`).
- FILM-3: An empty `frames` array renders safely (a "no frames" state), not relying on every caller to guard.
- FILM-4: Frame tile colors stay token-referenced (`bg-gold`/`text-navy`/`bg-navy/85`). [currently passing; must stay]

## A16. coach-chat.tsx [J]
- CHAT-1: The message list is a live region (`role="log"` with `aria-live="polite"`) so streamed assistant text is announced.
- CHAT-2: Each bubble carries speaker attribution readable by AT (a visually-hidden "You"/"Coach" label or equivalent), not role-by-alignment-and-color only.
- CHAT-3: The typing indicator has an accessible label (e.g. "Coach is typing").
- CHAT-4: The error banner sits inside a live region so it is announced when it appears.
- CHAT-5: Assistant content renders with at least minimal markdown/paragraph handling (not raw `whitespace-pre-wrap` that flattens lists and emphasis), while staying on token and voice.
- CHAT-6: The Retry control is a shared class or an intentional inline text-link pattern documented as sanctioned; it is keyboard-operable and >= 44px if treated as a button.
- CHAT-7: Duplicate sends are de-duped (`if (streaming) return`) and the composer cannot double-submit. [confirm]

## A17. share-card.tsx [J]
- SHARE-1: All canvas colors are read from the `--color-*` tokens via `getComputedStyle`, mirroring the existing font reads; no hardcoded palette literals (`#0f212c`, `#e8b93b`, `#f2efe6`, `#b9c4c9`, `rgba(232,185,59,…)`, `rgba(242,239,230,…)`) remain.
- SHARE-2: `await document.fonts.ready` (or equivalent) precedes drawing so the first render uses the brand fonts, not a fallback.
- SHARE-3: A title longer than three lines truncates with an ellipsis, not a hard clip.
- SHARE-4: A canvas failure (`getContext` null / `toBlob` null) surfaces a voice-correct user-facing error instead of silently doing nothing.
- SHARE-5: The trigger button has a >= 44px hit area (today `btn-ghost px-4 py-2 text-sm`).
- SHARE-6: The rendered score is clamped to 0-100 on the arc and the number. [confirm]

## A18. scoreboard.tsx [J]
- SCORE-1: Scoring a point announces the new score via a polite live region (a screen-reader scorekeeper hears the result).
- SCORE-2: The serving indicator conveys serving state with a non-color signal readable by AT (label/text), not the gold pulse dot alone.
- SCORE-3: Set/match point badges and set/match completion are exposed to AT (they are text today; confirm they are announced, not purely visual position).
- SCORE-4: The `-1`, Undo, Abandon, and match-over Undo controls meet the 44px target.
- SCORE-5: The match-over headline (`{winnerName} wins {setLine}`) has `break-words` and does not overflow at 360px with a 30-char team name.
- SCORE-6: The pre-hydration placeholder uses `.skeleton` and matches the real layout closely enough that hydration causes no visible jump (today `min-h-[220px]` bare card).
- SCORE-7: The save error is announced via a live region.
- SCORE-8: Reduced motion disables the point-pop scale animation via `matchMedia` (or it is CSS-only and covered by the global reduce block); confirm no JS-driven pop under reduce.
- SCORE-9: `SetDots` exposes an accessible label. [prior-burst / already present]

## A19. goals.tsx [J]
- GOAL-1: The rating progress bar is a `role="progressbar"` with `aria-valuenow`/`aria-valuemin=0`/`aria-valuemax=target` (or 100-normalized) and an accessible name.
- GOAL-2: Field errors are wired via `aria-describedby` and `aria-invalid` on the corresponding inputs, and the form drops `noValidate` or otherwise pairs native + server validation without losing the a11y wiring.
- GOAL-3: After a successful create, focus is restored to a sensible anchor (the "New goal" trigger) and a "Goal added" message is announced via a live region.
- GOAL-4: The skill selector has an accessible group name; selected state is not conveyed by color alone (it uses `aria-pressed` today; confirm plus a non-color visual).
- GOAL-5: Goal-form controls and chips meet the 44px target. [chips already `min-h-11`; confirm buttons]

## A20. skill-picker.tsx [J]
- PICK-1: The group is a `radiogroup` (container `role="radiogroup"`) with an accessible name associated to the "Pick a skill" heading (`aria-labelledby`).
- PICK-2: Each option is `role="radio"` with `aria-checked`, replacing the independent `aria-pressed` toggles.
- PICK-3: Keyboard: roving `tabIndex` with Arrow keys moving selection and focus between options; only one option is in the tab order.
- PICK-4: Selected state carries a non-color signal (border/weight/checkmark) in addition to `aria-checked`, not `bg-gold/10` color alone.
- PICK-5: Each option meets the 44px target (the card padding already exceeds it; confirm).

## A21. xp-toast.tsx [J]
- XP-1: A manual dismiss control (button) is present so a keyboard user can close the toast without waiting out the 4s timer.
- XP-2: The dismiss control is >= 44px and keyboard-operable, and focus is handled so the toast is not a trap.
- XP-3: `role="status"` is present and the entrance animation is CSS-only (covered by the global reduce block). [prior-burst]

---

# B. Routes and boundaries

## B1. Landing `/` [J/D]
- R-LAND-1: Page-level metadata, `metadataBase`, and Open Graph are set on the publicly shared landing route. [prior-burst]
- R-LAND-2: At 360px every section is reachable, including the nav section links via the mobile menu (pairs with LNAV-1), with zero horizontal overflow.
- R-LAND-3: The on-page logo mark appears in the landing header (10.6, see G10.6). 
- R-LAND-4: No user-facing string on the landing route contains an em dash (sweep the hero and body copy).

## B2. Root layout `app/layout.tsx` [D]
- R-ROOT-1: `title.template` (`%s — Sideout`) and default title are set. [prior-burst]
- R-ROOT-2: `app/global-error.tsx` exists, renders on token/voice, and includes `<html>`/`<body>` as required for a global error boundary.
- R-ROOT-3: `viewport.themeColor` equals the navy token literal `#0f212c`. [prior-burst; must stay]

## B3. `/offline` [J/L]
- R-OFF-1: The page offers a forward action (a "Try again" reload and/or a link back) so it is not a dead end once connectivity returns.
- R-OFF-2: The page sets a title and is noindex. [prior-burst]
- R-OFF-3: Copy is second-person and em-dash-free.

## B4. `/login`, `/signup` [D]
- R-AUTH-1: The submit button shows a pending state and disables while the server action is in flight; double-submit is impossible.
- R-AUTH-2: Error roles (`role="alert"`), `aria-invalid`, `aria-describedby`, and page titles are present. [prior-burst]
- R-AUTH-3: Signup surfaces per-field errors where the server distinguishes them, not only a single top-level banner.
- R-AUTH-4: Logout shows a pending state and cannot double-submit.

## B5. App shell `(app)/layout.tsx` [D/J]
- R-APP-1: `app/(app)/error.tsx` exists and catches a null session or a thrown query (every child dereferences `user!.id`), rendering a token/voice recovery UI instead of the framework default.
- R-APP-2: Logout has a pending state and a mobile affordance (it is reachable on mobile, not only in the desktop sidebar).
- R-APP-3: The mobile tab bar's omission of Goals and History is resolved (either surfaced in the tab bar or reachable via an in-app affordance on mobile).
- R-APP-4: Skip-to-content link and `robots: noindex` are present. [prior-burst]
- R-APP-5: The on-page logo mark appears in the app-shell header/nav with the accessible name "Sideout, home" (10.6).

## B6. `/dashboard` [D/J]
- R-DASH-1: Data-fetch failures are distinguished from empty state, not silently coerced via `?? []` in a way that hides an error.
- R-DASH-2: The route sets its own title.
- R-DASH-3: The tailored loading skeleton matches the layout. [prior-burst]
- R-DASH-4: The XP progress bar is `role="progressbar"` with valuenow/min/max and a name. [prior-burst]
- R-DASH-5: Lighthouse performance and accessibility are both >= 90 on the dashboard.

## B7. `/analyze` [D/J]
- R-ANLZ-1: The route sets its own title.
- R-ANLZ-2: The skill picker uses radiogroup semantics (see PICK-1..3).
- R-ANLZ-3: In-flow reading/sending/error states are present. [prior-burst / existing]

## B8. `/analysis/[id]` [D/J]
- R-AID-1: `generateMetadata` is implemented for this shareable result (skill + date driven title/description, on voice, no vendor name).
- R-AID-2: A custom not-found renders when the analysis is missing (the `notFound()` path has a token/voice `not-found.tsx`).
- R-AID-3: A `createSignedUrls` failure renders a message, not blank images.
- R-AID-4: The loading skeleton matches the two-column breakdown layout (not the generic four-card grid).
- R-AID-5: A null session is caught by `(app)/error.tsx` (pairs with R-APP-1).

## B9. `/coach`, `/goals`, `/scoreboard`, `/history` [D/J]
- R-CGSH-1: Each route sets its own title.
- R-CGSH-2: Fetch failures are not silently coerced to empty where that hides an error.
- R-CGSH-3: `scoreboard` scoring is announced (pairs with SCORE-1).
- R-CGSH-4: Empty and error handling render on token/voice. [existing; must stay]

## B10. `/drills`, `/drills/[slug]` [D/J]
- R-DRL-1: `drills/[slug]` implements `generateMetadata` (drill name/summary driven), replacing the generic inherited title.
- R-DRL-2: A bad slug renders a custom `not-found.tsx` for `drills/[slug]`, not the framework 404.
- R-DRL-3: `/drills` sets its own title.
- R-DRL-4: `generateStaticParams` keeps the detail pages static/indexable. [existing; must stay]

## B11. Loading skeletons [J]
- R-SKEL-1: The generic `(app)/loading.tsx` is replaced or specialized per route so the chat, two-column analysis, scoreboard, and list routes each get a skeleton that matches their layout.
- R-SKEL-2: The dashboard skeleton stays tailored and correct. [prior-burst]
- R-SKEL-3: Every skeleton uses the shared `.skeleton` class and neutralizes under reduced motion. [globals covers this; confirm]

## B12. Stray / dev routes [D]
- R-STRAY-1: `app/(app)/zzpreview/page.tsx` is removed or excluded from the production build so no unlisted dev route is publicly reachable (the mission adds no routes; this one is not in the ledger).

## B13. Coaching-service call discipline (`api/coach`, `api/analyze`, `coach-chat` client) [D]
Applies to every call to the coaching service (section 3).
- CS-1: Deterministic responses are cached (analysis uses `cache_control: ephemeral` on the rubric/output-spec system blocks today; confirm it stays and extend caching where a response is deterministic).
- CS-2: User input that triggers a call is debounced at 500ms where applicable (the coach composer does not fire a request per keystroke; explicit submit is fine, but any typeahead/auto path debounces).
- CS-3: Requests are batched where possible (frame payloads are sent in one analyze call, not per frame). [existing; must stay]
- CS-4: Duplicate React triggers are guarded: correct effect deps plus in-flight de-dupe (`coach-chat` `if (streaming) return`; analyze `busy` guard). No double-send on rapid submit.
- CS-5: The cheapest capable model is used for simple/high-frequency calls (the `MODEL` constant is justified; a lighter model is used where the task allows).
- CS-6: `max_tokens` is conservative per call (coach 1024, analyze 4096 today; confirm these are intentional ceilings, not defaults).
- CS-7: A 429 from the coaching service is handled with exponential backoff (server and/or client), not a hard failure on first rate-limit.
- CS-8: No user-visible string in these paths names a vendor; errors use "the coaching service." [confirm across api/coach, api/analyze, coach-chat]

---

# C. Section 7 — view-transition acceptance per route pair [J builds, D enables]

- VT-ENABLE: `experimental.viewTransition: true` is set in `next.config.ts` and the app renders normally (instant swaps) in a browser without support (progressive enhancement). [D]
- VT-REDUCE: A reduced-motion block zeros every `::view-transition-*` duration and delay; under reduced motion all navigations are instant swaps with no slide/morph. (Highest-risk surface; non-negotiable.)
- VT-NOSHIFT: No view transition introduces layout shift or jank on any applied route pair; the app-shell header and nav landmarks are anchored with a fixed `viewTransitionName` so only content moves.
- VT-NODOUBLE: A view transition never double-animates an element that the per-component `Reveal`/`template.tsx` fade already animates on that mount.
- VT-NAMED: Every `::view-transition-*` keyframe is named and auditable; enter/exit sit in the 150-210ms band; 400ms is used only for morph/directional travel (D-002).
- VT-MORPH-HIST: History row to `analysis/[id]` breakdown uses a shared-element morph (`<ViewTransition name=…>` matched on both ends) so the thumbnail appears to travel.
- VT-MORPH-DRILL: Drills list to `drills/[slug]` uses a shared-element morph on matching names.
- VT-SUSPENSE: Dashboard, analysis, coach, and the list routes use the Suspense-reveal pattern (`loading.tsx` skeleton content and resolved content wrapped with `exit`/`enter` + `default="none"`) so the skeleton hands off instead of popping.
- VT-SLIDE: Deeper navigations tag `transitionTypes: nav-forward` and returns tag `nav-back`, mapped in the page `<ViewTransition>`.
- VT-CROSSFADE: The `/history` skill filter (same route, different `?skill=`) keys a `<ViewTransition>` on the filter value with `share="auto"` so the list crossfades instead of hard-swapping.
- VT-PENDING: Any `<Link>` to a dynamic route lacking a `loading.tsx` uses `useLinkStatus` for a fixed-size, opacity-toggled pending hint with the ~100ms delay pattern (no layout-shifting inline element); the root cause (a `loading.tsx` or prefetch) is fixed where possible.
- VT-MAP: `docs/motion.md` records the view-transition map (which route pairs use which pattern and the `viewTransitionName` anchors).

---

# D. Section 6 — report-card criteria per artifact

The phase closes only when every artifact reaches A- or better with no criterion below B, self-graded first then peer-graded, with a raise-to list per round logged in `docs/reportcards.md`.

## Specs (Leon's `acceptance.md` + `quality-floor.md`; Lisa's `copy.md` + `metadata.md`)
- RC-SPEC-COVERAGE: Every ledger item and every section 10 grant maps to at least one assertion here; nothing in section 4 is unrepresented.
- RC-SPEC-TESTABILITY: Every assertion is a single pass/fail claim Sierra can evaluate without re-reading section 4.
- RC-SPEC-VOICE: Copy/metadata assertions and all example strings are second-person, em-dash-free, vendor-name-free, and match shipped voice.

## Implementations (Jerry per component/route; Dave per boundary/script/state)
- RC-IMPL-TOKEN: Token purity — zero hardcoded colors/font-families outside the three sanctioned config surfaces (section 1 of the floor).
- RC-IMPL-REUSE: Class reuse — no reinvented surface/button/pill/input; any new pattern is one shared class in `globals.css`, reused and logged.
- RC-IMPL-A11Y: Accessibility — the per-type contracts (data-visual names, progressbar, live regions, radiogroup, labeled landmarks, no-color-only) all pass.
- RC-IMPL-RESPONSIVE: Responsive — 360px clean, zero horizontal overflow, 44px targets.
- RC-IMPL-REDUCE: Reduced motion — every rAF/JS effect self-guards and settles at end state; view transitions zero out.
- RC-IMPL-FOCUS: Focus — visible everywhere, moved on step transitions, restored after collapsing submits.
- RC-IMPL-STATES: States — loading/empty/error/not-found per route; no silent `?? []` masking; metadata/titles per route.

## Anti-gaming
- RC-GAME: No artifact is passed with an open blocking defect; a grader who signs off on something Sierra later fails carries that miss to their next card.

---

# E. Section 10 grants as pass/fail

## G10.1 — Colors and fonts zero-violation
- G10.1-1: No new palette color and no new `font-family` is introduced anywhere by the animation, asset, or branding grants — in any component, on any canvas, in any asset's chrome, or in config. A repo scan for hex/`rgb(`/named-color/`font-family` outside `@theme` and the three sanctioned config surfaces returns zero hits.
- G10.1-2: Sourced/generated media chrome (overlays, captions, controls, borders) is on token; only the media's own pixels may carry other colors.

## G10.2 — Animation unlocked, including libraries
- G10.2-1: Every added rAF-/library-driven effect settles instantly at its end state under reduced motion via the `matchMedia` self-guard.
- G10.2-2: No added motion causes layout shift or jank.
- G10.2-3: Lighthouse performance stays >= 90 on landing and dashboard with the added motion.
- G10.2-4: Any animation/motion library cleared the 10.5 viability gate, is pinned, tree-shaken, and its bundle cost is justified in `docs/decisions.md`; it is recorded in `docs/motion.md`.
- G10.2-5: No motion conveys state on its own; colors and fonts stay on token (G10.1).
- G10.2-6: A redesigned button/control lands as a shared class in `globals.css`, reused, never inlined.

## G10.3 — Volleyball visuals
- G10.3-1: Every sourced/generated asset is rights-cleared, with source and license recorded per asset in `docs/assets.md`.
- G10.3-2: Each asset is optimized and served via `next/image` (or an equivalent) at correct dimensions/format, lazy where off-screen, with no layout shift.
- G10.3-3: Any asset that animates or autoplays is reduced-motion-safe and falls back to a still poster under reduce.
- G10.3-4: Each asset has alt text in the project voice (from Lisa); decorative media is `aria-hidden`.
- G10.3-5: Asset chrome is on token (G10.1); an asset that fights the navy/gold world or reads as stock filler does not ship.

## G10.4 — Research / open-instance authority
- G10.4-1: Only assets actually used are downloaded and kept; every kept asset is in `docs/assets.md` with source and license; nothing sourced this way skipped Sierra's verification.

## G10.5 — MCP / tooling gate
- G10.5-1: Every candidate MCP server or new dependency (including any animation library) passed Sierra's gate on all six criteria: publisher/provenance (official server), exact tool scopes/permissions, security + least privilege (no unexpected network/filesystem/secret access), necessity (real mission need, cheapest tool), licensing/terms, and a pinned version.
- G10.5-2: Every added server is documented in `docs/tooling.md` (server, purpose, scopes, verifier, Decision Log ref); any new env is in `.env.example`; no secret is committed.
- G10.5-3: Enabling any server that can act on an external account, and writing any hosted secret, passed the single section 9 confirmation gate.

## G10.6 — Branding in the tab and on the page
- G10.6-1: `app/favicon.ico` derives from `public/icon-512.png` and is crisp at 16, 32, and 48px on the navy field.
- G10.6-2: `app/apple-icon.png` is present and derives from the mark.
- G10.6-3: The manifest ships a dedicated maskable icon with ~20% safe padding, distinct from a full-bleed "any" icon; the current mislabeling of the full-bleed 192/512 as `maskable` (which crops) is fixed.
- G10.6-4: The manifest `theme_color` and `background_color` equal the navy token `#0f212c`. [existing; must stay]
- G10.6-5: The Open Graph image (`app/opengraph-image.tsx`) includes the mark, and its literal hex values equal the token values (sanctioned build-time surface, G10.1).
- G10.6-6: The mark appears in the landing header and the app-shell header/nav using existing shared classes and tokens, at >= 44px where it is a tap target, with the accessible name "Sideout, home" when it links home.
- G10.6-7: Adding the on-page logo did not regress LNAV-1 (mobile menu), the skip links, or the `app-nav` accessibility items (ANAV-1..4).

---

# F. Cross-cutting gates (must be green to close)

- GATE-TSC: `npx tsc --noEmit` runs clean.
- GATE-BUILD: `next build` runs clean.
- GATE-TEST: `node --test` runs clean (includes `lib/ratings.test.ts`).
- GATE-SCRIPTS: `package.json` has `lint`, `typecheck` (`tsc --noEmit`), and `test` (`node --test`) scripts.
- GATE-CONSOLE: No console errors on any route.
- GATE-LH-LAND: Lighthouse performance >= 90 and accessibility >= 90 on `/`.
- GATE-LH-DASH: Lighthouse performance >= 90 and accessibility >= 90 on `/dashboard`.
- GATE-SECRETS: No committed secret; new env in `.env.example`; no attribution trailers in commits.
- GATE-LEDGER: `docs/ledger.md` shows a PASS verdict for every component and every route.
