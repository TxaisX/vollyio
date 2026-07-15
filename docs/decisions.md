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

## D-014 — Player Lock spec: adopt the ideas on-device, defer the vendor spine
Date: 2026-07-12 · By: Player Lock pipeline spec review

An external "Player Lock" spec proposed server-side single-player tracking
through a hosted segmentation vendor: transcode proxy, per-frame masks, a
track state machine, exit/re-entry prediction, virtual-camera crops. The
review found the state machine and continuity ideas excellent and the spine
wrong for Sideout today: server video processing surrenders privacy and the
zero-marginal-cost analysis path, adds per-clip vendor spend while billing
is dormant, and brings two to three new dependency gates plus first-time
queue infrastructure. The spec stays in the decision record as the premium
north star for after billing ships; its own S1-to-S2 JSON contract means an
on-device implementation now and a hosted one later share everything
downstream.

Adopted now, on-device (`lib/pose/track-state.ts`, pure and unit-tested):
track continuity over the followed player's timeline. Gaps are labeled only
when evidence supports the label — short mid-frame holes read as occlusion,
holes preceded by least-squares motion out through a frame edge read as
frame exits with the edge named, and everything else is honestly a sampling
gap of the windowed capture, never a claim. Output: a coverage fraction,
absence events, and a lost flag. Wired in three places: the measurements
block gains `tracked_coverage` and `frame_exits` session stats (the
coaching service now knows how much of the play the follow covered), the
capture carries the full continuity object, and the analyze preview shows
one human line ("Left frame right at 0:04 · back by 0:06").

Deferred with the spine: hosted segmentation, ghost-zone re-entry UI,
virtual-camera crop rendering (One Euro smoothing noted for when a cropped
playback surface exists), appearance-based re-lock gating.

## D-015 — The court films: landing motion shot from our own film room
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

## D-016 — Animation "skills" pass: adopt the craft, decline the packages
Date: 2026-07-12 · By: Motion-quality pass, full creative access grant

The owner shared six community "animation skills" (Three.js 3D, Animation
Designer, Flutter Animations, pure-CSS animations, UX motion design) and
asked for all of them applied at best quality, installing what's needed.
The registry hosting them is unreachable from this environment, and on
review they are instruction documents, not code — so the decision is to
apply the craft they encode directly, inside the section 10.2 discipline,
and decline the two that fail Sideout's gates on the merits: Flutter
animations target a different platform entirely, and a Three.js/WebGL layer
fails the 10.5 necessity test — the landing already carries real product
motion (D-015 court films) and a 3D scene would spend the dependency budget
on spectacle the page doesn't need.

What shipped, all hand-rolled in `app/globals.css` on existing tokens:

- **The coaching read** (the 30–60s scoring wait, the app's weakest moment):
  a status ticker (`StatusTicker` in `components/analyze-flow.tsx`) walks
  through what the pipeline is actually doing — reading frames, tracing
  motion, checking measured angles, scoring the rubric, writing the fix —
  resting on the last line instead of looping, because a loop reads as fake
  progress. Over the filmstrip, a `.scan-line` gold band sweeps while the
  model reads (transform-only, decorative; the ticker carries the state, so
  reduced motion hides the band entirely).
- **Reading progress** on the breakdown page: `.scroll-progress`, a pure
  CSS scroll-driven hairline (`animation-timeline: scroll(root)`), scaleX
  only, zero scroll listeners, hidden behind `@supports` where timelines
  don't exist. It mirrors the user's own scrolling, so it stays on under
  reduced motion via an explicit duration restore next to the global block.
- **Skeleton shimmer**: the loading pulse gains a directional gradient
  sweep (`::after`, translateX only) so every `loading.tsx` reads as
  activity rather than fading; reduced motion keeps the static block.
- **Input focus glow**: `.input-field:focus` adds a soft gold ring +
  bloom via box-shadow transition on `--ease-court`.

Verified: scroll-timeline computation confirmed in the shipped Chromium
(scaleX tracks scroll fraction), tsc, policy lint, 62 unit tests, and a
production build. No new dependencies, no new colors, no new fonts.

## D-017 — CSS 3D tilt on landing cards: depth without a dependency
Date: 2026-07-12 · By: 3D-animations research pass (section 10.2 motion grant)

The owner asked how agency sites (ramanstudio.com class) get their 3D feel
and how Sideout can have it. The honest decomposition: most of that feel is
pointer-tracked perspective tilt, not WebGL. A real-time three.js/R3F layer
stays declined on the D-016 grounds (10.5 necessity fails while the court
films carry the landing), and the pre-rendered film pipeline (D-015) remains
the sanctioned path for true-3D scenes. What ships now is the zero-dependency
rung: a `Tilt` primitive in `components/cursor-glow.tsx` alongside its
pointer-effect siblings.

- Single-element `perspective(900px) rotateX/rotateY` clamped to ±5° (±2° on
  the film-room panel, where the film is the attention object and the tilt
  only signals "an object you can examine"). Transform-only, compositor-only.
- A persistent 200ms `--ease-court` transform transition gives weighted
  tracking (each pointermove retargets it) and doubles as the settle-flat on
  pointerleave — in the 150–200ms feedback band.
- Same guards as `SpotlightGroup`/`Magnetic`: pointer-fine + reduced-motion
  media queries re-evaluated live; teardown clears the inline transform so a
  mid-session reduce toggle settles flat instantly. Touch devices never
  attach listeners; SSR renders a plain div.
- Applied only to cards that already carry hover affordances (`card-lift
  spot`: the three steps, six skills, four progress cards) plus the film
  panel — the evidence and coach-chat cards intentionally keep no pointer
  feedback, so they get no tilt.
- Second pass, same grant: `.reveal-3d`, an entrance variant on the same
  grids — identical `.reveal` timing and travel, but the plane starts
  pitched 9° away (origin at the bottom edge) and stands up as it arrives.
  The reduce block's `.reveal` visibility override explicitly covers the
  variant so reduce users never meet a pitched card, with or without JS.

State never rides on the tilt (it is feedback, not signal), no layout
properties move, and no dependency was added.

## D-018 — Quiz-first registration funnel and the four-tier level system
Date: 2026-07-12 · By: Funnel follow-through on the D-012 teardown

The D-012 teardown adopted the commitment funnel post-signup. This closes the
gap to the competitor pattern: the funnel now runs before the account exists.
`/start` (public, in the auth route group) asks discipline, level, position,
play frequency, focus skill, then target rating with a chosen timeframe
(30/90/180 days). Answers park in localStorage under `sideout.funnel.v1`;
`FunnelHandoff` (mounted in the app layout) consumes them on the first authed
page, and `applyFunnel` validates with the same zod schema as the form path,
writes the profile, creates the goal with the chosen deadline, and redirects
into `/analyze` with skill and discipline preselected. Landing CTAs point at
`/start`; `/welcome` stays as the fallback quiz (same steps) for players who
sign up directly. The handoff drops its payload for accounts that already
have reps: the funnel is a first-session ramp, never an overwrite.

Level tiers renamed beginner / intermediate / expert / pro (migration 008,
applied live: stored `advanced` rows became `expert`, `elite` became `pro`).
`profiles` gains `discipline`, `position`, `play_frequency`; the coach chat
context carries position and frequency. Each tier now sets a coaching voice
in both the analysis output spec and the coach chat prompt: beginner teaches
patiently, intermediate is direct, expert holds a high bar without praise
padding, and pro is deliberately harsh: judged against the professional
standard, verdicts never softened, adequacy never praised. The funnel's pro
card says exactly that before a player picks it. The scoring rubrics stay
frozen; voice and return-scale calibration are the only per-level levers.

D-012's rejections stand: no countdowns, no fabricated projections, no
locked-blur content. No new dependency. Verified end to end against the
local prod build with a throwaway account (created, SQL-confirmed, applied,
deleted): profile fields, goal deadline at exactly the chosen timeframe, and
the `/analyze?skill=&discipline=` landing all confirmed in the database.

## D-019 — On-device ball tracking: vendored sports-ball detector
Date: 2026-07-12 · By: D-013 roadmap P2 follow-through

The analysis pipeline's remaining eyeballed field becomes measured. A
MediaPipe ObjectDetector rides the existing pose worker, filtered to the COCO
"sports ball" class, and its per-instant detections are cleaned into a timed
ball path (`lib/pose/ball-track.ts`: confidence floor, teleport speed gate
with two-point re-lock, near-simultaneous dedupe).

10.5 gate for the vendored model, `public/pose/efficientdet_lite0_f16.tflite`
(EfficientDet-Lite0 float16, 7.25 MB):
- Publisher/provenance: Google MediaPipe model zoo, same publisher and
  distribution channel as the already-vendored pose landmarkers.
- License: Apache 2.0, same as the landmarkers.
- Pinned: vendored by checksum
  (sha256 4b59100025bea1235a84c1038879a6cccc9f6c49f5e41144e91e74d99e780993);
  no runtime fetch from third-party hosts.
- Scope/security: runs entirely on-device in the existing worker; no new
  network surface, no new npm dependency (@mediapipe/tasks-vision already
  ships the ObjectDetector API).
- Necessity: D-013 named on-device ball tracking the differentiator and left
  the insertion hooks (`ball_track_source: "tracked"`, `ballEstimated`).

Wiring, all strictly additive and never-worse: detector load failure or zero
detections leaves every prior behavior intact. Ball detection always reads
the full frame (the ball leaves any player crop). When the cleaned path is
substantial (8+ points) and lands on 3+ sent frames, the client sends tracked
marks; the server then replaces the model's estimated ball_track, flips
ball_track_source to "tracked", and feeds the measured positions to the
coaching service as trusted ground truth for toss, contact, and timing. The
stored result now also carries frame_times (client data, response schema
unchanged) so sparse marks sit on the clip timeline. The keypoints sidecar is
version 2 with the timed ball path, and the clip player follows the ball live
(dense path interpolated at the playhead; sparse timed marks as the fallback,
labeled measured vs estimated). Verified: 8 node tests on the track helpers,
real-Chromium WASM smoke over the vendored file paths (detector loads;
"sports ball" detects at 0.22 on the repo's real volleyball photo, which
calibrated the cleaner's confidence floor to 0.2), full build.

## D-020 — First-party web analytics on the platform
Date: 2026-07-13 · By: owner request

The site gains traffic analytics via the deployment platform's own analytics
package, mounted once in the root layout. It renders no UI, adds no
user-facing vendor naming, and sends page-view beacons to the site's own
domain (`/_vercel/insights/*`), so no third-party origin enters the CSP
surface.

10.5 gate for `@vercel/analytics@2.0.1`:
- Publisher/provenance: the deployment platform's first-party package, same
  vendor already trusted with hosting and build.
- License: MPL-2.0, published on npm by the platform org.
- Pinned: caret on 2.0.1 in package.json, resolved exact in the lockfile.
- Scope/security: client beacon to the first-party `/_vercel/insights`
  endpoint only; no cookies, no cross-site identifiers; script is served
  from the app's own domain.
- Necessity: the funnel work (D-012, D-018) is live and unmeasured; the
  owner asked for traffic analytics directly. The platform dashboard must
  have Web Analytics enabled for beacons to be recorded.

## D-021 — Motion tracking engine replaced: two-stage detector + pose models, full-clip capture
Date: 2026-07-14 · By: owner request (full-video analysis; old model removal approved)

A measured failure, not a hypothetical: on a 296-frame handheld volleyball
test clip (comparison harness and per-frame results archived at
`D:\posecmp\`, stats in `stats.json`), the shipped pose landmarker returned
at most 1 person per frame across all 296 frames and zero people on 8 frames
with players clearly visible, despite `numPoses: 4` — the exact production
configuration. The replacement two-stage pipeline (person detector + top-down
pose estimator) found every player in every frame (avg 2.02 people, zero
empty frames). The landmarker models are removed; the ball detector (D-019)
is unaffected and keeps `@mediapipe/tasks-vision` in place.

10.5 gate for `onnxruntime-web@1.27.0` (new npm dependency):
- Publisher/provenance: Microsoft's official ONNX Runtime web build, npm
  `onnxruntime-web`.
- License: MIT (verified from the installed package metadata).
- Pinned: exact `1.27.0` in package.json (no range), resolved in the
  lockfile; runtime wasm/mjs assets vendored same-origin under
  `public/pose/ort/` (no CDN fetch).
- Scope/security: on-device inference only, loaded inside the existing pose
  worker; no telemetry, no new network surface beyond the app's own model
  bucket below.
- Necessity: the empirical result above; the replacement models are ONNX and
  need a runtime the browser can execute (webgpu with single-thread wasm
  fallback; the app ships no cross-origin isolation headers, so
  SharedArrayBuffer threading is deliberately not assumed).

10.5 gate for the vendored detector model
`yolox_m_8xb8-300e_humanart-c2c7a14a.onnx` (101,400,344 bytes):
- Publisher/provenance: Megvii YOLOX architecture, exported and distributed
  through the OpenMMLab MMPose model zoo (`download.openmmlab.com`, the
  `onnx_sdk` channel); the exact file validated in the comparison above.
- License: Apache-2.0 (YOLOX and MMPose distributions).
- Pinned: sha256
  `3dea6513388889f0fff4b77bf7a26013600321b9eb9ceb0e9a400a82572f5f23`,
  hash-verified in the client before any inference session is created
  (`lib/pose/model-fetch.ts`); manifest in `lib/pose/rtm/model-manifest.ts`.
- Scope/security: hosted in the app's own public storage bucket `models` as
  40 MiB parts (storage caps single objects below this file's size),
  reassembled and hash-checked on device, cached via the Cache API; no
  third-party host at runtime.
- Necessity: the pose stage is top-down and needs person boxes; this is the
  exact detector the validated comparison ran.

10.5 gate for the vendored pose model
`rtmpose-m_simcc-body7_pt-body7_420e-256x192-e48f03d0_20230504.onnx`
(54,330,655 bytes):
- Publisher/provenance: OpenMMLab MMPose (RTMPose-m, body7 training set),
  same distribution channel and session as above.
- License: Apache-2.0 (MMPose model zoo).
- Pinned: sha256
  `5c0a4bf67953e6d2ac43ce15e77dc9d5d354ae18430a47d2c5963a7bc5683e3c`, same
  client-side verification, chunked hosting, and caching as the detector.
- Necessity: the model whose per-frame output the comparison validated;
  17-keypoint output adapts losslessly into the existing 33-slot landmark
  contract (`lib/pose/rtm/coco33.ts`), so kinematics, metrics, and the
  viewer are unchanged.

Retired: `public/pose/pose_landmarker_full.task` and
`pose_landmarker_lite.task` (D-013) are deleted; `@mediapipe/tasks-vision`
stays only for the D-019 ball detector, which now also works on the worker
path (the worker's ball result was previously dropped on the main thread).

Capture semantics change with the same grant: the peak-windowed dense
sampler is replaced by one full-clip pass over the trimmed window
(`captureFullClip` in `lib/frames.ts`), `coverage: "full"` joins the
measurements schema, the keypoints sidecar bumps to version 3 (same shape,
wall-to-wall frames), the sent frames are planned from measured rep contacts
and wrist-speed peaks instead of the luminance scan (kept as fallback), and
the framing card offers tap-to-select boxes over every detected player in
place of the draggable crop frame. Verified: decode parity fixtures against
the archived Python reference (boxes ±0.5 px, keypoints ±0.75 px, scores
±0.005 on two frames including one the old model returned nobody for),
94 node tests, policy lint, tsc, real-Chromium smoke (engine ready, multiple
persons found on the failure frame, ball detector live), full build, and the
storage-hosted chunks reassembling to the exact pinned hashes.
