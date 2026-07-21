# Phase 2 QA Report — Sideout adversarial verification

Author: Sierra (Phase 2). Scope: 6 audit lenses (token purity, accessibility, responsive/touch, prefers-reduced-motion, states/boundaries/metadata, copy voice) plus the gates/smoke runner.

- Gates (`npx tsc --noEmit` ; `next build` ; `node --test`): **GREEN** — tsc clean, next build passes (47 routes), node --test 6/0. The gates-smoke lens raised zero defects.
- Defects filed: **17** (0 blocker, 8 major, 9 minor). One incoming entry (`x.ts`, lens `test`) was a placeholder with no real content and was discarded, not counted.
- Verdict: **FAIL to sign off.** No route or shared class may pass while it carries an open blocker/major. 8 routes and 2 shared components are FAIL; see verdict tables.

Severity rule used for every verdict: a component/route FAILS if it has any open blocker or major; minors alone are PASS-with-notes.

---

## Blockers

None. (No defect reaches blocker severity; the 8 majors below block sign-off.)

---

## Major defects

### D1 — Eleventh palette color `#f6d987` in `.text-sheen`
- Assertion: **G10.1-1** (zero named/hex hits outside `@theme`) + quality-floor §1 (ten-color law).
- File: `app/globals.css` lines 265, 267.
- Problem: The shared `.text-sheen` gradient uses the raw hex `#f6d987` (a lighter gold between `--color-gold` and `--color-chalk`). It is an eleventh color — not one of the ten `@theme` tokens, not an opacity variant, and outside the three sanctioned surfaces — so it fails the G10.1-1 repo scan and breaks the ten-color law directly.
- Repro: `grep -n '#f6d987' app/globals.css` → two hits (265, 267) inside `@layer components .text-sheen`, outside `@theme`.
- Fix hint: Replace both stops with a token expression, e.g. `color-mix(in oklab, var(--color-gold) 55%, var(--color-chalk))`. Do not add a new token; express it from gold+chalk.
- Owner: **Jerry**

### D2 — Token colors re-typed as raw `rgb()` opacity variants in shared classes
- Assertion: **G10.1-1** (zero-hit scan) + quality-floor §1-2 / **RC-IMPL-TOKEN**.
- File: `app/globals.css` lines 144, 168, 211, 248, 290.
- Problem: Shared-class bodies outside `@theme` re-type token colors as raw `rgb()` opacity variants — the exact anti-pattern floor §1 forbids ("must be expressed against the token, never as a re-typed hex/rgb of the same color"). Hits: 144 `.btn-primary:hover` `rgb(232 185 59 / 0.55)` = gold; 168 `.btn-ghost:hover` `rgb(242 239 230 / 0.04)` = chalk; 211 `.icon-btn:hover` `rgb(242 239 230 / 0.04)` = chalk (newly-added Phase-1 class, in-scope); 248 `.input-field` `rgb(15 33 44 / 0.6)` = navy; 290 `.spot::after` `rgb(232 185 59 / 0.09)` = gold. `cursor-glow.tsx:75` already proves the intended idiom (`color-mix(in oklab, var(--color-gold) 7%, transparent)`).
- Repro: `grep -nE 'rgb\(' app/globals.css` → lines 144, 168, 211, 248, 290 sit in `@layer components` (gold = 232 185 59, chalk = 242 239 230, navy = 15 33 44).
- Fix hint: Rewrite each as `color-mix(in oklab, var(--color-gold|chalk|navy) N%, transparent)` mirroring `cursor-glow.tsx:75`. Prioritize the newly-added `.icon-btn:hover` (211) as in-scope Phase-1 work; the btn-primary/ghost/input/spot ones are shipped baseline but still fail the zero-hit gate.
- Owner: **Jerry**

### D3 — Sparkline trend direction/latest value not conveyed to assistive tech
- Assertion: **SPARK-5** (direction/trend conveyed by more than line shape) / **SPARK-1** (trend + latest value).
- File: `components/sparkline.tsx` line ~59-61.
- Problem: The only accessible name is `${SKILL_LABEL[skill]} rating trend over your last ${clean.length} reps.`. It announces that a trend exists and the sample count but never the direction (up/down/flat) or the latest value. Improving vs declining is carried by the polyline shape alone and is entirely unavailable to AT — two players with opposite trajectories get identical announcements.
- Repro: On `/dashboard`, NVDA/VoiceOver on any of the six skill sparklines reads "Serve rating trend over your last 6 reps, image"; the improving/declining signal is inaccessible.
- Fix hint: Derive direction and delta from `clean[0]` vs `clean[clean.length-1]` and fold direction + latest value into the aria-label, e.g. "Serve rating trend, up 8 to 71 over your last 6 reps" (flat/down variants). Color stays teal.
- Owner: **Jerry**

### D4 — History skill-filter chips below the 44px touch floor
- Assertion: **RC-IMPL-RESPONSIVE** (44px minimum tap target at 360px).
- File: `app/(app)/history/page.tsx` lines 60-74 (chip class strings at ~62 and ~70).
- Problem: The "All" chip and each skill chip are bare `chip` with no `min-h-11`. `.chip` only sets `padding: .375rem .875rem` at `font-size: .75rem` with no min-height, so each interactive `Link` computes to ~30px tall (12px text * 1.5 + 12px padding), well under 44px. These are the primary interaction on the route; every other interactive chip in the repo (analyze-flow, coach-chat, goals, scoreboard, clip-viewer) uses `chip min-h-11`.
- Repro: Open `/history` at 360px width; the filter chips ("All", "Serving", "Passing", ...) measure ~30px tall.
- Fix hint: Add `min-h-11` to both filter-chip class strings (lines ~62 and ~70), matching the `chip min-h-11` convention used everywhere else.
- Owner: **Jerry**

### D5 — Generic loading skeleton never specialized per route
- Assertion: **R-SKEL-1** (chat, two-column analysis, scoreboard, and list routes each get a matching skeleton).
- File: `app/(app)/loading.tsx` (generic 4-card grid) — missing siblings.
- Problem: Only `app/(app)/dashboard/loading.tsx` is tailored. No `loading.tsx` exists for coach (chat), analysis/[id] (two-column), scoreboard, history, drills, goals, or analyze — all inherit the generic 4-card grid, which matches none of those layouts.
- Repro: `glob app/**/loading.tsx` returns only `dashboard/loading.tsx` and the generic `(app)/loading.tsx`. Client-navigate to `/coach`, `/scoreboard`, or `/history` on a throttled connection: the 4-card grid shows, then a different real layout pops in.
- Fix hint: Add per-route `loading.tsx` skeletons mirroring each layout (chat bubble stack, two-column breakdown, scoreboard, divide-y list), each using the shared `.skeleton` class.
- Owner: **Jerry**

### D6 — No two-column loading skeleton for the analysis breakdown route
- Assertion: **R-AID-4** (two-column analysis skeleton).
- File: `app/(app)/analysis/[id]/page.tsx` — missing `app/(app)/analysis/[id]/loading.tsx`.
- Problem: With no route-level `loading.tsx`, the analysis breakdown falls back to the generic 4-card grid instead of a skeleton matching its two-column (player + breakdown) layout during the force-dynamic fetch.
- Repro: There is no `loading.tsx` in `app/(app)/analysis/[id]/`. Navigate client-side to `/analysis/<id>`: the generic 4-card grid shows, not a two-column skeleton.
- Fix hint: Create `app/(app)/analysis/[id]/loading.tsx` replicating the `lg:grid` two-column layout (score header, player column, metrics/timeline column).
- Owner: **Jerry**

### D7 — Dashboard fetch failures silently coerced to empty state
- Assertion: **R-DASH-1** (fetch failure distinguished from empty) + quality-floor §7 boundaries.
- File: `app/(app)/dashboard/page.tsx` lines ~43-74.
- Problem: The page destructures only `{ data }`, discards each query's `error`, and does `analysesData ?? []` / `goalsData ?? []`. Supabase queries return `{ data: null, error }` on failure and do not throw, so `(app)/error.tsx` never fires — a DB/RLS outage renders the "No film yet." empty CTA as if the user simply has no data. The in-code comment (lines ~72-74) admits this "known gap" rather than fixing it.
- Repro: Make any of the four dashboard queries error (revoke RLS / kill DB). Dashboard renders "No film yet." and empty goals instead of an error boundary or message; no throw occurs.
- Fix hint: Destructure `{ data, error }` on each query; if any `error` is set, throw (to hit `(app)/error.tsx`) or render an explicit inline "couldn't load" state distinct from the empty CTA. Remove the `?? []` masking on the error path.
- Owner: **Dave**

### D8 — Same silent `?? []` error-masking across coach, goals, scoreboard, history
- Assertion: **R-CGSH-2** (fetch failure distinguished from empty) + quality-floor §7.
- File: `app/(app)/coach/page.tsx` lines ~33-35 (plus `goals/page.tsx` ~48-51, `scoreboard/page.tsx` ~35-37, `history/page.tsx` ~45-47).
- Problem: Each route destructures only `{ data }`, ignores `error`, and coerces a failed fetch to an empty list. Because Supabase queries don't throw, `(app)/error.tsx` cannot catch them, so a fetch failure renders as a normal empty state ("No matches yet", "Nothing here yet", empty chat). Each carries a self-admitted "Known gap (R-CGSH-2)" comment.
- Repro: Force the games/analyses/chat_messages/goals query to error. `/scoreboard` shows "No matches yet", `/history` shows "Nothing here yet", `/coach` shows an empty thread, `/goals` shows the empty state; none surface an error.
- Fix hint: Capture `error` on each query and distinguish fetch failure from empty (throw to the boundary or render an explicit error state). Apply to coach, goals, scoreboard, and history.
- Owner: **Dave**

---

## Minor defects

### D9 — New shared classes not logged in `docs/frontend.md`
- Assertion: **RC-IMPL-REUSE** (new patterns reused and logged) + quality-floor §2.
- File: `docs/frontend.md` (does not exist).
- Problem: Floor §2 requires every net-new shared class recorded in `docs/frontend.md` with name, purpose, and call sites. `docs/frontend.md` does not exist. `.btn-destructive` and `.icon-btn` are reused correctly in code but the "logged" half of the assertion is unmet.
- Repro: `ls docs/frontend.md` → no such file; the two new classes are not recorded in the required log.
- Fix hint: Create `docs/frontend.md` and log `.btn-destructive` (purpose: coral destructive-action button; call site: recorder Stop) and `.icon-btn` (purpose: 44px round icon button; call site: xp-toast dismiss).
- Owner: **Jerry**

### D10 — `white` used as a color-mix partner needs an explicit ruling
- Assertion: **G10.1-1** (named-color scan).
- File: `app/globals.css` lines 143, 189.
- Problem: The CSS named color `white` is a color-mix partner at line 143 (`.btn-primary:hover`, shipped) and 189 (`.btn-destructive:hover`, new Phase-1 class). The G10.1-1 named-color scan returns hits. It is arguably the sanctioned lighten idiom (mix toward white) but `white` is not a token, so it needs an explicit ruling rather than passing silently; btn-destructive copied the pattern verbatim.
- Repro: `grep -nE '\bwhite\b' app/globals.css` → lines 143, 189 inside `@layer components`.
- Fix hint: Either rule color-mix-with-white as a sanctioned lightening primitive in `docs/decisions.md` (annotating the scan so it is not read as a fail), or replace `white` with `var(--color-chalk)`. Apply the same resolution to the shipped btn-primary:hover for consistency.
- Owner: **Orchestrator**

### D11 — Dashboard XP progressbar omits `aria-valuemin`
- Assertion: **R-DASH-4** + quality-floor §7 (valuenow/min/max).
- File: `app/(app)/dashboard/page.tsx` line ~137.
- Problem: The header XP progressbar sets `role="progressbar"`, `aria-valuenow`, `aria-valuemax`, and `aria-label="XP to next level"` but omits `aria-valuemin`. It is the only progressbar in the build missing min — `metric-bar.tsx` (line ~68) and `goals.tsx` (line ~342) both set `aria-valuemin={0}`. ARIA defaults min to 0 so the computed percentage is correct, but the explicit contract lists min and this is inconsistent.
- Repro: Inspect the LV XP bar `<span role="progressbar">`; no `aria-valuemin` is emitted. Grep for `aria-valuemin` returns only goals.tsx and metric-bar.tsx.
- Fix hint: Add `aria-valuemin={0}` to the progressbar span at line ~137.
- Owner: **Jerry**

### D12 — Analyzed-rep and analyze-preview `<video>` elements are unlabeled
- Assertion: (new) quality-floor §7 Media (every `<video>` carries an accessible label).
- File: `components/clip-viewer.tsx` line ~110; `components/analyze-flow.tsx` line ~322.
- Problem: The recorder camera preview is labeled (`aria-label="Camera preview"`, `recorder.tsx:172`), but the ClipPlayer analyzed-rep `<video>` and the analyze-flow preview `<video>` have no `aria-label` and no `<track>`, so AT announces a bare "video" with no context on `/analysis/[id]` and on the `/analyze` preview.
- Repro: Tab to the clip player on `/analysis/[id]`; a screen reader announces only "video, control". Same on `/analyze` after picking or recording a clip.
- Fix hint: Add an aria-label to both `<video>` elements (e.g. "Your analyzed rep" on ClipPlayer, "Clip preview" on analyze-flow), mirroring the recorder's labeled-video pattern.
- Owner: **Jerry**

### D13 — Dashboard "Mark complete" button below the 44px touch floor
- Assertion: **RC-IMPL-RESPONSIVE**.
- File: `app/(app)/dashboard/page.tsx` line ~203 (`btn-primary w-full py-2.5 text-sm`).
- Problem: `py-2.5` (utilities layer wins the cascade) overrides `.btn-primary` padding, giving 20px content + 20px vertical padding = 40px tall, 4px under 44px. It renders at 360px on the dashboard (challenge card stacks into the single mobile column).
- Repro: Open `/dashboard` at 360px; the "Mark complete" submit button under Daily challenge measures ~40px tall.
- Fix hint: Add `min-h-11` (or drop `py-2.5` so btn-primary's own 0.75rem padding applies), matching clip-viewer/goals which pair py-2 with min-h-11.
- Owner: **Jerry**

### D14 — Landing "Get started" desktop CTA below the 44px touch floor
- Assertion: **LNAV-3**.
- File: `components/landing-nav.tsx` line ~98 (`btn-primary px-4 py-2.5 text-sm`).
- Problem: `py-2.5 text-sm` overrides btn-primary padding to yield a 40px-tall control (4px under 44px). Its sibling "Log in" correctly uses `flex min-h-11`. Desktop-only (`hidden md:flex`), so not exposed at 360px, but it is a sub-44px tap target on touch tablets/laptops at >=768px.
- Repro: View the landing header at >=768px on a touch device; the gold "Get started" button measures ~40px tall while "Log in" is 44px.
- Fix hint: Add `min-h-11` to the desktop "Get started" Link (or use `py-3` like the mobile-menu variant on line ~159).
- Owner: **Jerry**

### D15 — Magnetic and SpotlightGroup don't re-read reduced-motion mid-session
- Assertion: **RC-IMPL-REDUCE** / quality-floor §6.
- File: `components/cursor-glow.tsx` lines ~90-117 (SpotlightGroup) and ~137-162 (Magnetic).
- Problem: Both capture `finePointer()` (which embeds the reduced-motion check) once at mount and never re-evaluate — no `matchMedia('change')` listener, no per-interaction re-read. Only CursorGlow in the same file was fixed with change listeners. Floor §6 governs every JS effect in the file, so this gap is a fail even though GLOW-2 (scoped to CursorGlow) passes. Load-time reduce is safe (finePointer() returns false, both effects no-op); only the mid-session toggle regresses.
- Repro: On a fine pointer with Reduce Motion OFF, enable OS "Reduce motion" mid-session, then move the pointer over a Magnetic CTA / `.spot` card. CursorGlow stops, but Magnetic still translates toward the cursor and SpotlightGroup still moves the gold gradient under the pointer.
- Fix hint: Mirror the CursorGlow/clip-viewer FramePlayer pattern: hold reduced-motion + pointer-fine in a `matchMedia('change')`-driven ref/state (or re-check `finePointer()` at the top of the pointermove handler) so both effects stop the moment the user enables reduce.
- Owner: **Jerry**

### D16 — Partial signed-URL failure renders blank frames instead of a message
- Assertion: **R-AID-3**.
- File: `app/(app)/analysis/[id]/page.tsx` lines ~97-98, ~117.
- Problem: The failure guard only triggers when ALL frames fail: `framesFailed = frame_paths.length > 0 && urls.filter(Boolean).length === 0`. A partial `createSignedUrls` failure (some paths signed, some not) leaves the failed frames as `url ?? ""`, passing an empty-string img src to ClipViewer and rendering blank/broken images for those frames instead of a message.
- Repro: Return a signed array where some entries have empty `signedUrl`; the framesFailed message does not show and ClipViewer receives frames with `url=""`, rendering blank images.
- Fix hint: Treat any missing signed URL as a per-frame failure — filter out unsignable frames, or show the fallback when `urls.filter(Boolean).length < frame_paths.length`.
- Owner: **Dave**

### D17 — Boundary copy uses first-person system voice
- Assertion: **RC-SPEC-VOICE** / quality-floor §11 (second-person-to-the-player voice; coach persona is the only first-person exception).
- File: `app/(app)/error.tsx` lines ~21-24; `app/(app)/drills/[slug]/not-found.tsx` lines ~9-11.
- Problem: `error.tsx` reads "We couldn't load this page."; `drills/[slug]/not-found.tsx` reads "We don't have a drill at this link." These boundaries are not the coach, so first-person-plural system voice is off-spec.
- Repro: Trigger the (app) error boundary or visit a bad drill slug; recovery copy reads "We couldn't…" / "We don't have…" rather than second person.
- Fix hint: Reword to second person / neutral declarative, e.g. "This page didn't load. Try again or head back to your dashboard." and "There's no drill at this link. Browse the full library instead."
- Owner: **Lisa**

---

## Discarded input

- One incoming entry (`file: x.ts`, `problem: "p"`, `fix_hint: "f"`, `lens: test`) was a non-substantive placeholder. It is not a real finding, is excluded from all counts and tables, and needs no owner.

---

## Per-component verdict

FAIL = has an open blocker/major. PASS = clean or minor-only (notes carried).

| Component | Open defects | Worst severity | Verdict |
|---|---|---|---|
| `app/globals.css` (shared classes) | D1, D2 (major); D4, D10 (minor) | major | **FAIL** |
| `components/sparkline.tsx` | D3 (major) | major | **FAIL** |
| `components/clip-viewer.tsx` | D12 (minor) | minor | PASS (notes) |
| `components/analyze-flow.tsx` | D12 (minor) | minor | PASS (notes) |
| `components/cursor-glow.tsx` | D15 (minor) | minor | PASS (notes) |
| `components/landing-nav.tsx` | D14 (minor) | minor | PASS (notes) |
| `components/metric-bar.tsx` | none | — | PASS |
| `components/goals.tsx` | none | — | PASS |
| `components/recorder.tsx` | none | — | PASS |
| `docs/frontend.md` (required log) | D9 (minor) | minor | PASS (notes) — file missing |

## Per-route verdict

| Route | Open defects | Worst severity | Verdict |
|---|---|---|---|
| `/` (landing) | D14, D15 (minor) | minor | PASS (notes) |
| `/dashboard` | D7 (major); D11, D13 (minor) | major | **FAIL** |
| `/coach` | D8, D5 (major) | major | **FAIL** |
| `/goals` | D8, D5 (major) | major | **FAIL** |
| `/scoreboard` | D8, D5 (major) | major | **FAIL** |
| `/history` | D4, D8, D5 (major) | major | **FAIL** |
| `/analysis/[id]` | D6 (major); D16, D12 (minor) | major | **FAIL** |
| `/analyze` | D5 (major); D12 (minor) | major | **FAIL** |
| `/drills` (library) | D5 (major) | major | **FAIL** |
| `/drills/[slug]` | D17 (minor) | minor | PASS (notes) |
| `(app)` error boundary | D17 (minor) | minor | PASS (notes) |

Sign-off blocked until D1-D8 are cleared and re-verified; minors D9-D17 should land in the same fix loop before Phase 3.
