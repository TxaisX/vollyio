# Decision Log

Binding decisions. Section 10 amendments and any contested ruling (Ditto) land here.

## D-001 — Section 10 grants: AGENTS.md amendments (owner-authorized)
Date: 2026-07-08 · By: Orchestrator (per section 10 owner authorization)

The owner authorized the section 10 amendments. Per section 0 rule 1 / section 10 intro, the affected `AGENTS.md` lines are updated in the same commit as this entry (non-silent path). Amendments:

1. **Motion (10.2).** The "hand-rolled only / No animation libraries" rule is lifted. New keyframes, easing curves, motion beyond 150-300ms, and a third-party animation/motion library are allowed **under discipline**: `prefers-reduced-motion` always wins (JS `matchMedia` self-guard non-negotiable, settle at end state under reduce), no layout shift/jank, Lighthouse perf stays >=90 on landing + dashboard, any library is tree-shaken with bundle cost justified here, motion never conveys state alone, colors/fonts stay on token. Hand-rolled primitives (`motion.tsx`, `cursor-glow.tsx`) and shipped ambient/reveal durations stay. 150-300ms on `--ease-court` remains the default for ordinary interaction transitions.
2. **Dependency budget (10.5).** Small but **gated, not closed**: an animation/motion library (10.2) and added MCP servers (10.5) are allowed once they clear the 10.5 viability gate (publisher/provenance, exact scopes, security + least privilege, necessity, licensing, pinned version) + a Decision Log entry. Chart, state-management, and service-worker libraries remain out unless they clear that same gate; the service worker stays hand-rolled.
3. **Colors and fonts (10.1).** NOT loosened. The ten colors + three fonts stay the only ones, zero-violation, in components, on canvas, in assets' chrome, and in config. This is the one place the grants do not reach.

`AGENTS.md` motion line and dependency-budget line edited accordingly. Colors/fonts line left fully in force.

## D-002 — Sanctioned exception: `::view-transition-*` scoped rules (section 7)
Date: 2026-07-08 · By: Orchestrator

React `<ViewTransition>` (Next 16 integrated, not a third-party lib — fits the dependency budget) is adopted for navigation/content-change motion. It requires `::view-transition-*` keyframes/durations the component-level rule would forbid; this relaxes that rule for `::view-transition-*`-scoped rules ONLY. Enter/exit in the 150-210ms band; 400ms reserved for morph/directional-slide travel; every keyframe named + auditable; a reduced-motion block zeros every `::view-transition-*` duration/delay. Enabled via `experimental.viewTransition: true` (progressive enhancement; unsupported browsers get instant swaps). Read `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` before implementing.

## D-003 — User-facing em-dash title separator → middot (voice-law enforcement)
Date: 2026-07-08 · By: Orchestrator (both Phase 0 agents flagged; ruled under the explicit voice law, not a contestable redesign)

Shipped metadata uses an em-dash separator: `app/layout.tsx` title default + template (`%s — Sideout`), OG title, twitter title; `app/manifest.ts` name; `app/opengraph-image.tsx` alt. The no-em-dash voice law applies to all user-facing copy, and tab titles + OG + manifest are user-facing. The brand already uses the middot (·) as its separator throughout the UI. RULING: replace the em-dash SEPARATOR with ` · ` in title default/template, OG title, twitter title, and manifest name; rewrite the OG `alt` (a mid-sentence em-dash) as a clean no-em-dash sentence. Resolves Leon's R-ROOT-1 and Lisa's metadata flag. Implemented by Dave/Jerry in Phase 1 per `docs/metadata.md`; Sierra verifies zero user-facing em dashes repo-wide.

## D-004 — Coaching-service model split by task (owner-authorized, Phase 1a integration)
Date: 2026-07-08 · By: Orchestrator (integration step) · Recorded retroactively 2026-07-08

During Phase 1a integration the coaching service was split into two task-scoped model tiers instead of one model for everything, because the two call sites have opposite priorities:

1. **`COACH_MODEL`** — real-time coach chat. Latency-sensitive and high-volume, so it uses the **faster conversational tier** (cost- and speed-optimized).
2. **`ANALYZE_MODEL`** — deep frame/technique analysis. Accuracy-critical and low-volume, so it uses the **most capable reasoning tier**.

Implemented as two env-driven constants in `lib/ai/client.ts`, consumed by the coach and analyze API routes. When the parallel `master` stream merged in its eval harness, `app/api/eval` was reconciled to `ANALYZE_MODEL` (it grades analysis output, so it must match the analyze tier) — this is the "one reconciliation" noted in the merge record.

Rationale: match model capability and cost to the task rather than paying the top tier for chat or under-powering analysis. Constraints held: model identifiers live only in server-side config/env (never user-facing, no vendor name in UI — the layer stays "the coaching service"), and `AI_MOCK=true` bypasses both tiers for zero-cost local/CI runs. This entry closes the gap where D-004 was referenced in `ledger.md` and the breakdown but had no Decision Log record.

## D-005 — Landing ambient drift and earned-moment entrance
Date: 2026-07-09 · By: Orchestrator (section 10.2 motion grant)

Adopt two token-only component animations without adding a dependency: `drift` gives
the decorative landing-page seam motif a slow transform-only movement, and `pop-in`
gives earned XP feedback a short scale-and-opacity entrance. Landing counters reuse
the existing `CountUp` primitive. These effects introduce no layout movement, color,
font, or persistent animation work outside the decorative transform. The global
reduced-motion block settles both CSS effects immediately, and `CountUp` now listens
for preference changes so an active rAF tween cancels and settles at its target.

Sierra verification: policy lint, TypeScript, 18 unit tests, and the 55-route
production build pass. No animation library or added MCP server was needed.

## D-006 — Reward feedback system and Learn continuity
Date: 2026-07-09 · By: Orchestrator (section 10.2 motion grant)

Adopt a shared, event-driven reward language without adding a dependency. New named
keyframes (`reward-arrive`, `reward-glow`, `reward-check`, `nav-marker-in`, and
`selection-settle`) are limited to direct interaction, new content, and earned
milestones. They power active navigation, captured frames, new coach messages, XP,
goal creation/completion, the daily challenge, set and match wins, and match-save
confirmation. Ordinary buttons and chips gain short press feedback.

The Learn regression came from `.card` links remaining inline, which fragmented
their background and border across wrapped text. `.card` now establishes block
layout, Learn links are explicit full-height blocks, and the list crossfades between
disciplines with a shared-element morph into skill detail. The mobile tab bar is a
contained horizontal control that centers the active item and cannot widen the page.

Motion carries no state alone. Every reward has text and accessible status where
needed. The global reduced-motion rule now also zeros animation and transition
delays. Verified at exact 360px and 390px device metrics with document width equal to
viewport width; policy lint, TypeScript, 18 tests, and the 55-route build pass. No
animation library or new token was introduced.

## D-007 — Premium volleyball campaign surface
Date: 2026-07-10 · By: Orchestrator (sections 10.2, 10.3, and 10.6)

Replace the landing page's split text/mockup hero with a full-bleed, generated
volleyball action photograph and an in-scene analysis HUD. The H1 is now the product
name, Sideout, with the offer in supporting display copy. The same still image carries
the sport into login and signup behind stable, high-contrast form tools. The app shell
gets low-opacity court geometry, and the dashboard uses clearer score, challenge,
streak, level, and momentum hierarchy without becoming a marketing layout.

The hero asset was generated specifically for Sideout from this brief: an elite
indoor player at jump-serve contact in a mostly empty training gym, athlete on the
right with clean left-side copy space, photoreal sports-campaign treatment, no text,
logos, watermark, crowd, duplicate anatomy, or branded uniform. The selected output
was converted to a 1774×888, 63.1 KiB WebP and registered in `docs/assets.md`.

New motion is named and auditable: `hero-photo-settle`, `hero-hud-in`,
`hero-metric-grow`, and `court-line-in`. It runs once, uses transform/opacity only,
and conveys no required state. Reduced-motion emulation reports 0.01ms duration and
zero delay. Exact 360px emulation reports `clientWidth=360`, `scrollWidth=360`,
stable two-row CTAs, and a 680px hero in an 800px viewport so the next proof strip is
visible. Policy lint, TypeScript, 18 tests, and the 55-route build pass. No new color,
font, dependency, or external media license was introduced.

## D-008 — On-device motion tracking dependency
Date: 2026-07-10 · By: CV Phase 1 build (section 10.5 gate)

Admit `@mediapipe/tasks-vision` at the exact pinned version 0.10.35 (publisher:
Google, Apache-2.0). It provides the WASM pose landmarker behind the CV Phase 1
measurement pipeline. Scope is the analyze flow only: the engine loads lazily via
`lib/pose/engine.ts`, runs in a hand-rolled worker (`lib/pose/pose-worker.ts`), and
resolves null on any unsupported browser or failed load so extraction degrades to
the pre-existing pipeline. The WASM runtime and the lite landmarker model are
self-hosted under `public/pose/` and fetched on demand; nothing enters the page
bundle and no third-party CDN is contacted at runtime.

Same entry, scope clarification for the vendor-name rule: the rule governs UI,
user-visible errors, and marketing surfaces. `package.json`, import specifiers, and
engineering docs may name dependencies, since this gate itself requires naming
publishers. UI copy refers to the capability as "motion tracking".

## D-009 — Training corpus and consent
Date: 2026-07-10 · By: CV Phase 1 build (sections 10.3 and 10.5)

Each analysis stores 24 extracted frames and a dense keypoints file permanently in
the private frames bucket as a future training corpus for in-house models (ball
detection, player identification). Corpus use is gated on explicit consent: an
opt-in/opt-out choice at first upload writes `profiles.training_consent`
(default false) with `training_consent_at`; a settings toggle can change it any
time; every corpus query hard-filters on the flag. Rationale: subjects are largely
minors, so consent is collected before any training use rather than assumed, and
the corpus must remain provably clean.

## D-010 — Rep intelligence and launch film
Date: 2026-07-10 · By: Site launch build (sections 10.2, 10.3, and 10.6)

Add a selectable three-rep analytics sequence to the landing page so the score is
always connected to its motion trace, metric movement, cited frame, and next-best
action. The examples auto-progress only while visible and only when reduced motion
is not requested; the manual tabs expose the same content without motion.

Add `/launch` as a five-chapter 16:9 campaign surface and render that route into
`public/sideout-launch.mp4`. New named motion (`analytics-draw`,
`analytics-point-in`, `analytics-playhead-in`, `launch-cut`, `launch-photo`,
`launch-bar`, `launch-step`, and `launch-line`) stays on existing palette and type
tokens, moves only fixed-size layers, and carries no state alone. Reduced motion
settles landing analytics immediately and replaces the launch sequence with a static
final frame through the existing live `matchMedia` guard.

No runtime dependency was added. The reproducible capture script uses a temporary
local encoder outside the application dependency graph. TypeScript, policy lint, 18
tests, the 56-page production build, exact 390px overflow check, and launch-film
frame review pass.

## D-011 — Vercel MCP server (section 10.5 gate)
Date: 2026-07-10 · By: Mobile/cloud workflow enablement

Add the hosted Vercel MCP server (`https://mcp.vercel.com`) to `.mcp.json` beside
the existing Supabase server. Gate: publisher is Vercel itself (first-party hosted
endpoint, same provenance as the deployment platform already in use); auth is
per-user OAuth at connect time, so no token or secret enters the repo; scope is
deployment/project inspection for whatever the authenticated user can already see
in the Vercel dashboard — least privilege is enforced by that OAuth grant, and the
repo grants nothing by itself. Necessity: the project deploys via the GitHub →
Vercel connection, and sessions running off this machine (claude.ai/code on
mobile, cloud CI-adjacent work) have no Vercel CLI login; the MCP server is how
those sessions verify a deployment landed. No code dependency, no license surface,
nothing enters any bundle; pinning does not apply to a hosted HTTP endpoint — the
URL is the stable public entry point.

## D-012 — Free-tier onboarding funnel and breakdown value surface
Date: 2026-07-11 · By: Competitive teardown follow-through

Adopt the commitment-funnel onboarding and value-forward breakdown presentation
observed in the competitive teardown of two consumer coaching apps, implemented
without any of their pressure mechanics. New `/welcome` step sequence (level ·
focus skill · 90-day target · echo summary) is the first writer of
`profiles.level`, creates a real row through the existing goals path when a
target is chosen, and hands off to `/analyze` with the chosen skill
pre-selected via a validated `?skill=` param. Breakdown page now counts its own
artifacts up front (strengths · fixes · drills chips anchor-linking to their
sections), names the first change "Your #1 fix", and closes with the existing
share card in a send-it-to-your-team framing.

Explicitly rejected from the teardown: countdown/data-reset urgency, pre-rating
prime screens, fabricated progress projections, decoy pricing, and locked-blur
content ahead of a purchasable tier. Billing stays dormant behind
`BILLING_ENABLED`; the natural premium seam (fix detail, timestamped insights,
drills) is recorded here for when a paid tier ships. Deferred with it: an
"Overall Game" analysis option (skill-enum migration + rubric) and an
onboarding motion-tracking demo on a bundled clip (asset weight vs the
Lighthouse floor).

No new dependency, no schema change, no new motion. TypeScript, policy lint,
48 tests, and the 57-route production build pass.

## D-013 — Analysis fidelity: full landmarker, true timing, per-rep read
Date: 2026-07-12 · By: Analysis-quality roadmap phase 1-2

Raise the measurement layer toward a human reviewer's read of a clip. Four
changes, all additive and all downgrade-safe:

Pose model: add the full pose landmarker beside lite under the same D-008
grant (same publisher, license, 33-landmark contract; self-hosted under
`public/pose/`). The engine now tries full first and falls back to lite;
the measurements block reports whichever variant actually loaded, so
stored analyses stay honest about their provenance.

Timing: the landmarker's video mode previously ran on a synthetic 30fps
clock, smearing fast volleyball motion whenever real capture cadence
differed. A rebasing monotonic clock (`createMonotonicClock`, unit-tested)
now feeds it true frame times, preserving real inter-frame spacing within
each capture phase and rebasing across phase boundaries where clip time
legitimately regresses.

Model contract: two optional output fields. `scene_read` is the one-line
coach's opening (setting, visible rep count, context) grounded in the
frames. `rep_scores` gives per-rep mini-scores whenever more than one
repetition is distinguishable — the on-device rep windows already shipped
in the measurements block; the model now scores against them. The
breakdown page renders both (scene line above the summary; a "Rep by rep"
card with the spread). Old rows omit the fields and render unchanged.

Measurements: `knee_flexion_at_plant` (attack) and
`shoulder_hip_separation` (serve, attack) join the catalog with honest
reliability factors; the 2D-projection caveat on separation is encoded as
a 0.65 reliability so it only survives clean capture.

The eval harness (`/api/eval` + `evals/SOURCING.md` pipeline) is the
referee for every further change of this kind: no scoring-path change
ships on a passRate regression once the calibration baseline lands.

## D-014 — The court films: landing motion shot from our own film room
Date: 2026-07-12 · By: Front-end premium campaign phase 2

The landing page needed real volleyball motion, and every stock route was
either off-limits (third-party rights, off-token grading) or beneath the
bar (generic filler). Decision: shoot our own. A capture-only route
(`/film`, noindexed and robots-disallowed) stages a ten-second "court
vision" loop in pure project CSS/SVG over the D-007 hero photo: a scan
sweep, a pose-skeleton trace locked to the player, a projected ball path,
measured checkpoints in the product's real units (`lib/pose/
measurement-format.ts` labels), and the score-plus-priority-fix read. Every
animation on the route runs exactly ten seconds with infinite iterations,
so scene state is fully periodic.

`scripts/render-hero-film.mjs` captures it deterministically: it pauses
every animation via the Web Animations API, sets `currentTime` explicitly
per frame, and screenshots 300 frames at 30fps over CDP, verifying the
loop closes by comparing frame 300 against frame 0 byte-for-byte. Two takes
ship: `sideout-hero-loop` (ambient, hero backdrop) and
`sideout-court-vision` (full HUD story, "The film room" landing section),
each as H.264 MP4 plus a VP9 WebM that capable browsers prefer, with WebP
posters extracted from the same frame set.

Playback rules live in `components/court-film.tsx`: muted, looped,
`preload="none"`, poster-first, play/pause tied to viewport intersection,
a visible pause control on every instance (WCAG 2.2.2), still poster for
`prefers-reduced-motion` (JS matchMedia guard) and for data-saver
connections. No new dependencies; the render tooling stays out of
`package.json` and runs ad hoc with an explicitly provided ffmpeg.
