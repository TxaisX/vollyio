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

## D-022 — Landing films rebuilt to match the D-021 tool (real multi-player read)
Date: 2026-07-14 · By: owner request ("apply the new analysis tool look so it is accurate")

The D-015 court films depicted the OLD analysis look: a fabricated 11-bone
skeleton with a head-circle and neck node the product never draws, gold "key
joints", and a ball shown as a projected arc, all over a synthetic single-
player plate. After D-021 (multi-player detection, tap-to-select, full-clip
tracking) that reading was inaccurate. The films are rebuilt so what the
landing shows is what the product literally does.

The rebuild is grounded in real output, not a stylized approximation:
- Plate: `public/film-court.webp`, frame 0225 of the D-021 calibration clip
  (a genuine two-player rep), graded via ffmpeg. Replaces the synthetic
  `volleyball-hero.webp`, now retired as the plate.
- Skeleton, boxes, and ball positions are the ACTUAL RTMPose detector/pose
  output for that frame (dumped from the same `rtmlib` reference the engine
  was validated against), baked into `components/film-scene.tsx`. The bone
  graph is the product's real topology (torso, both arms, both legs to the
  ankles, hip line — no feet, no head node, since RTMPose emits neither), and
  every joint is chalk, matching the live `SkeletonOverlay`.
- The scene is composed like the real breakdown page: a vertical clip panel
  with the tracked player boxed in gold (a "watching" tag, the tap-to-select
  signature) and skeleton-traced, the other player in a thin chalk box
  (multi-player detection), the ball on a gold crosshair over its measured
  path, and a left HUD column (score 82, real measured checkpoints, priority
  fix). Copy on the landing (`app/page.tsx` film-room section) updated:
  "the ball path projected" became "the ball measured", and the beats now say
  every player is found and the tapped one tracked.

`scripts/render-hero-film.mjs` gains VP9 WebM output (it only emitted MP4 +
WebP before) and headless/own-profile Chrome flags so it runs on a desktop
with Chrome already open. The plate drift was dropped so the static
background compresses: both takes fell to ~0.4 MB each (from ~4 MB with
drift), leaner than the D-015 originals.

RIGHTS CAVEAT (see `docs/assets.md`): unlike the synthetic D-007 plate, the
new plate shows real, identifiable people from the owner's own test clip.
The owner chose this footage for the rebuild; owner must confirm likeness
consent for commercial use before the films ship to the public site.

Verified: `/film?variant=film|ambient` inspected in Chrome (skeleton/boxes/
ball register on the real players; HUD reads right), both takes re-rendered
with byte-identical loop seams (frame 300 = frame 0), and both play in place
on the landing hero and film-room section (desktop + 402px). Not yet pushed
(owner review pending on the likeness point).

## D-023 - Animation library source pool, no speculative installs
Date: 2026-07-16 · By: animation library intake

Record Lenis, GSAP, Vanta, and React Bits in
`docs/animation-library-pool.md` so future motion work starts from vetted
sources instead of rediscovering the transcript. No runtime package is added
in this pass because none has a current product interaction to own, and an
unused dependency fails the 10.5 necessity gate.

GSAP 3.15.0 is the primary future runtime candidate for a concrete complex
timeline, SVG path or morph, or scroll sequence that the existing primitives
cannot express cleanly. React Bits is a source catalog, not a whole-repository
dependency: one component may be copied only after its code, transitive
dependencies, MIT + Commons Clause terms, tokens, and reduced-motion behavior
are audited, with the required copyright and license notice retained. Lenis
1.3.25 stays on hold because replacing native scroll would touch anchors,
fixed navigation, nested scrollers, touch behavior, and the accessibility
surface without a stated need. Vanta 0.5.24 remains rejected on the
D-016/D-017 WebGL necessity ruling and its 2022 npm release age.

The pool records exact install triggers and validation requirements. Moving
any candidate into `package.json` still requires a feature-scoped Decision Log
entry, an exact version pin, minimal imports, settled reduced-motion output,
and the section 10.2 performance floor.

## D-024 — Deleting an account deletes the film, on every path
Date: 2026-07-17 · By: owner request after orphaned media was found

The Privacy Policy promises a player's film goes when their account goes.
`/api/account/delete` kept that promise for anyone deleting in-app, but an
account removed any other way skipped the route entirely. On 2026-07-17 the
project held 779 files, about 222 MB, across six deleted accounts, the oldest
from 2026-07-07. All of it belonged to test accounts removed by SQL or the
dashboard. It was purged via `scripts/purge-orphaned-media.mjs`, which stays
as the backstop sweep.

The obvious fix does not work. A trigger cannot delete storage:
`storage.protect_delete` refuses any delete from `storage.objects` with
"Direct deletion from storage tables is not allowed. Use the Storage API
instead", because dropping the row leaves the bytes in the object store with
nothing pointing at them. Worse, it is a one-way trap: the Storage API deletes
by path via that row, so removing rows first would strand the film
permanently. The Storage API is the only correct path, and Postgres cannot
call it. Something outside the database has to.

Shipped: an AFTER DELETE trigger on `auth.users` (migration `015`) calls the
`purge-user-media` edge function over pg_net, which removes the account's
folders in `frames` and `clips` through the Storage API. This covers every
deletion path, including SQL and the dashboard.

Authorization is the account's own absence. The function refuses any `user_id`
that still has an account, so the worst any caller can do is finish a deletion
the policy already requires; a live player's film is unreachable through it.
That was chosen over a shared secret, which would have had to live in the
database for the hook to present it, putting a purge credential in the same
blast radius as the data. `verify_jwt` stays on, so a caller still needs a
valid project key to reach the function at all. Verified: a live account
returns 403 "account still exists", a publishable key cannot purge anyone, a
malformed id returns 400.

pg_net queues the request transactionally and its worker sends it after the
commit. That ordering is load-bearing, not incidental: the absence check only
passes once the delete is durable, and a rolled-back delete takes the queued
request with it.

Missing Vault config no-ops instead of blocking: removing the account is the
promise that must never fail, and the sweep catches whatever the hook misses.

10.5 gate for `pg_net` 0.20.4 (new database extension):
- Publisher/provenance: Supabase's own extension, on the project's available
  list, installed into the `extensions` schema.
- License: Apache-2.0.
- Pinned: whatever the platform ships; the migration is
  `create extension if not exists`, so it is idempotent.
- Scope/security: one outbound POST to this project's own edge function, with
  a publishable key. No inbound surface, no secret in the database.
- Necessity: the empirical result above. Postgres physically cannot reach the
  Storage API, and every alternative either strands the bytes or leaves the
  promise depending on a human remembering to run a script.

Config (`purge_media_url`, `purge_media_apikey`) lives in Vault rather than
inline so the migration carries no project identifiers. Neither value is
secret; the publishable key already ships in the browser bundle.

End-to-end verified, not just probed: a throwaway account with four planted
files, deleted through the admin API to imitate the exact path that stranded
the originals, lost every file within two seconds.
`net._http_response` recorded `200 {"ok":true,"removed":4,"failed":0}`.

## D-025 — SimCC sub-pixel decode layered over the pinned argmax anchor
Date: 2026-07-17 · By: Pose-precision workstream (A1)

The pose decode gained sub-pixel keypoint position without disturbing the only
verified parity anchor. `lib/pose/rtm/simcc-decode.ts` now exports two layers
over the same buffers:

- `decodeSimccArgmax` is the original plain-argmax function, byte-for-byte
  unchanged (score is the mean of the two axis maxima, coord via the split
  ratio, `score<=0` sentinel preserved). The fixture parity test
  (`rtm-decode.test.ts`, `simcc decode matches reference keypoints`, ≤0.75 px /
  ≤0.005 score against the Python `rtmlib` dumps) is repointed to it and stays
  green, so the buffers are still proven to be read correctly.
- `decodeSimcc` refines only the coordinate with a windowed soft-argmax: a
  normalized weighted centroid over ±2 bins around the argmax, weighting by the
  value clamped at zero. The score and the sentinel path are identical to the
  argmax layer. `pose-worker.ts` already imported `decodeSimcc`, so runtime
  picks up the refinement with no worker change.

Layer, do not re-run Python. The reference `get_simcc_maximum`
(`D:\posecmp\dump_fixtures.py`) is itself plain argmax with no soft-argmax or
DARK, so a soft-argmax decode necessarily diverges from the pinned keypoints.
Regenerating the fixtures would need the owner's offline `D:\posecmp` venv and
would discard the sole validated anchor; instead the argmax layer keeps the
anchor and three new synthetic/derived tests bound the refinement: a symmetric
two-bin peak lands at the exact fractional midpoint (argmax cannot), the score
is byte-identical to argmax on both fixtures, and the coordinate stays within
1.5 px of argmax on every real fixture keypoint. The sentinel is asserted
identical across both layers.

Logits vs values: the SimCC head emits values, not raw logits. Measured over
the two fixtures the classification rows span about [-0.74, 0.96] with peaks
~0.76-0.96 and scores ≤0.93 — bounded, Gaussian-response activations, and no
softmax exists anywhere in the path. The centroid therefore normalizes by the
window sum of non-negative weights (matching how `rtmlib` treats the outputs as
values); clamping tail negatives at zero keeps the measured -0.74 tails from
dragging the estimate off the true peak, and an all-zero window falls back to
the argmax bin.

No new dependency, so the 10.5 dependency gate and 10.2 motion discipline are
not triggered by this change.

## D-026 — Confidence scale recalibrated to the on-device pose engine; noise-floor gate replaces per-metric thresholds
Date: 2026-07-17 · By: Use-the-data workstream (B)

The measurement confidence model (`lib/pose/metrics.ts`) was anchored to a
MediaPipe-style visibility scale (~0.95 clean), but the RTMPose SimCC engine
produces peak scores that top out ~0.75-0.85 (arms) and ~0.5-0.6 (legs/ankles).
Every attack leg/hip checkpoint therefore fell under the old 0.70 gate and
landed in `omitted_below_confidence`, so the coaching service received zero
measured values and scored vision-only — the verified cause of the attack/grass
score collapsing to 48 on every run despite full coverage and a locked track.

Fix: `metricConfidence` now calls a pure exported `confidenceScore(vis, fit,
reliability)` that affinely remaps visibility (`clamp01(1.8*vis - 0.36)`) so a
clean body-joint mean (~0.70) maps to ~0.90 confidence and genuine occlusion
(~0.40) falls below the floor. A single `NOISE_FLOOR = 0.4` is now the only
include/exclude gate; the per-metric `threshold` field and `DEFAULT_THRESHOLD`
were removed. Reliability is now a confidence attenuator, not a gate —
measurements between the floor and the old threshold are passed through WITH
their confidence. Prompts (`app/api/analyze/route.ts`, `lib/ai/output-spec.ts`)
were reframed from "trusted ground truth" to confidence-weighted evidence,
allowing a confidently-measured sound rep into the reward band while keeping the
honesty floor and the never-invent clause.

Rejected a global `coco33.ts` visibility remap: it would shift `SKELETON_MIN_V`,
`personConfidence`/`PERSON_CONFIDENCE_MIN`, and `PERSON_MIN_SCORE` and break
`coco33.test.ts`, so the recalibration is contained to `metricConfidence`.

No new dependency. Open follow-up: `PERSON_CONFIDENCE_MIN = 0.9` is likely
miscalibrated against the same ~0.75-max scale (the framing card's confident set
is almost always empty and falls back to raw detections); revisit separately.
Scoring quality is only verifiable post-deploy on a real device.

## D-027 — Reasoning effort pinned per model tier: Opus low for analyze, Sonnet medium for coach

D-004 chose the model per call site but never set reasoning effort, so both paths
ran on API defaults. On Opus 4.8 the absence of a `thinking` parameter means the
model runs with no reasoning at all — the analyze route had been doing this since
D-004, a configuration neither of the 2026-07-20 benchmarks tested.

Two studies informed the fix, and they are not comparable to each other. The
GPT-family study (`sideout-attacker-model-effort-report.html`, 33 model/effort
cells) scored candidates with blinded LLM judges on a 7-dimension rubric. The
Anthropic-family study (`model-effort-cost-ladder.html`, 20 cells) scored one
checkable fact: whether the model placed ball contact after the jump peak
(ground truth ~0.15s past peak). The two disagree on ground truth for the same
clip — the GPT evidence note calls contact "near the apex", which the ladder
treats as the wrong answer — so no cross-study winner is defensible. Both are
n=1 per cell and say so.

The ladder's checkable-fact axis is the one that maps to our release gates
(`analysis-validation-roadmap.md`: <=5% unsupported-claim rate, >=95% correct
abstention), because judge scores reward plausible-sounding coaching while a
frame-arithmetic check catches fabrication. On that axis: Opus 5/5 correct at
every effort and the only consistently harsh grader (52-64, under-claiming);
Sonnet correct at medium but wrong at high, xhigh, and max, with its max cell
burning 52,427 output tokens inventing a "stutter-hop" the frames refute; Haiku
3.5/5 and caught inventing joint angles off a 720p rear view, violating
`coach-prompt.txt`'s no-exact-angles rule.

Effort choice follows from the ladder shapes. Opus is flat-to-inverted (low
$1.546 vs max $1.487) but low runs 148.5s against max's 337.7s — 2.3x the wall
clock for zero accuracy gain, so `ANALYZE_EFFORT = "low"`. Sonnet's ladder is the
only clean monotonic one in the grid and it buys negative accuracy, so
`COACH_EFFORT = "medium"` is a cap, not a default restatement — Sonnet 5 defaults
to high, which is the first wrong cell.

Rejected switching analyze to gpt-5.6-terra despite its 94.8 judge score: scored
by GPT judges on a rubric with no fabrication ground truth, at n=1, in a
benchmark whose effort averages are non-monotonic (terra alone swings 94.8 at
ultra to 61.2 at high). Checked and cleared one methodological concern — judge-b
(terra) runs ~10 points more generous than judge-a (sol), but identically for
terra's own outputs (+9.9) and everyone else's (+10.0), so it is uniform leniency
that cancels in ranking, not self-preference.

`app/api/eval/route.ts` was deliberately left inheriting no effort setting. It
uses ANALYZE_MODEL per D-004 because it grades analysis output, but judging is
arguably where more reasoning helps rather than less; giving it its own constant
is an open decision, not an oversight.

Two open risks, both unmeasured. `maxDuration = 120` in `app/api/analyze/route.ts`
sits below the ladder's 148.5s Opus-low figure — that number is derived rather
than measured (only Haiku's durations were measured) and all five cells ran in
parallel contending for resources, so it needs a real single-shot timing check
against the production call shape before it is treated as a ceiling breach.
Thinking tokens are now billed on every analyze call where previously none were;
the ladder's $1.55/analysis is NOT this cost (it priced a multi-turn agentic run
at list on a subscription where nothing was billed) but the real figure is
unmeasured and feeds the commercialization plan's assumed $0.10-0.20/analysis.

Neither study tested stability, which the release gates require (median 3-run
range <=5 points, 95th percentile <=8). This decision is evidence-backed but not
verified to our own standard until that runs.

## D-028 — Pose engine swapped to MediaPipe: a licence the product can ship on, and the confidence gate re-anchored with it

The live engine string was `rtm-body7-m/*`: RTMPose-m trained on the body7
dataset mix, whose terms are non-commercial. Every measured biomechanic the
product sells was computed by weights it could never charge for. That made the
engine a hard blocker on monetisation, not a tuning choice.

Considered removing on-device pose entirely and letting the vision model read
the frames unaided. Rejected: the measured-checkpoint block IS the
differentiator (`sideout-commercialization.html` positions it against "everyone
ships VLM vibes"), and kill gate A tests measured checkpoints against VLM
narrative in blind comparison — deleting them does not fail that gate, it
deletes the thing being gated. The per-metric scores in `lib/ai/schema.ts` come
from the model, not from pose, so removal would not have broken the dashboard;
it would have removed the evidence underneath the scores while leaving the
scores looking identical. That is the worst possible shape for an
anti-fabrication product.

So the swap keeps measurement and changes only the weights: MediaPipe Pose
Landmarker, Apache-2.0, vendored same-origin under `public/pose/`. This is a
return to the pre-D-021 engine, and most of the implementation was recoverable
from history rather than rewritten.

What the swap buys beyond the licence:
- The 33-landmark layout in `types.ts` is MediaPipe's NATIVE output, so the
  17-to-33 adapter (`rtm/coco33.ts`) and the entire two-stage detect-then-crop
  pipeline are deleted rather than ported.
- Heels are emitted again, which silently fixes a live bug: `serve.contact_height`
  and `attack.jump_height` both declared `LM.leftHeel/rightHeel`, which the
  17-keypoint model never populated. `visibilityMean` divides by the number of
  declared landmarks while dead slots contribute zero, so a clean 0.95 mean
  arrived as 0.475, mapped below `NOISE_FLOOR`, and BOTH METRICS WERE OMITTED
  FROM EVERY ANALYSIS for the life of that engine, with nothing erroring.
- First analyze on a device no longer downloads ~155 MB of chunked ONNX weights
  from Supabase storage with sha256 reassembly; it fetches 15 MB of static
  same-origin assets. `onnxruntime-web` and `public/pose/ort/` (39 MB) are gone,
  so the repo gets smaller by about 24 MB despite vendoring the models.

THE DANGEROUS PART, and the reason this entry is long. D-026 re-anchored the
visibility remap FROM MediaPipe's scale TO RTMPose's (`1.8*vis - 0.36`, because
a clean RTM joint reads ~0.70). Swapping back without touching it would have
computed `1.8*0.95 - 0.36 = 1.35`, clamped to 1.0 — every metric passing, the
abstain lane silently stopped abstaining, no error, no failing test, and the
coaching service handed unreliable measurements labelled confident. The exact
failure the honesty floor exists to prevent, introduced by fixing a licence.

Three mechanisms now make that class of bug loud instead of silent:
1. The remap is derived FROM its two named anchors (`VISIBILITY_ANCHORS`) rather
   than expressed as opaque gain/bias constants, so the numbers cannot drift
   away from the meaning they were chosen for.
2. `CALIBRATED_ENGINES` + `isCalibratedFor`, asserted in
   `lib/pose/confidence-calibration.test.ts` against the models actually
   shipped, so renaming or swapping the engine without re-deriving the anchors
   fails the suite.
3. `EMITTED_LANDMARKS` + `lib/pose/metric-topology.test.ts`, asserting every
   metric's declared landmarks are a subset of what the engine emits — the
   general form of the heel bug, which was undetectable before.

Verified: the occlusion assertion genuinely fails under the old constants
(MediaPipe occlusion at 0.45 maps to 0.45 under RTM's remap, above the 0.4
floor), so the guard is load-bearing rather than decorative.

Test count moved 147 -> 147 (134 after deleting 22 RTMPose decode tests, plus 13
new calibration, topology, and sizing tests). The deleted tests pinned decode
math that no longer exists; they were not replaced because there is nothing left
to replace them with. Accuracy against real footage is UNVERIFIED — MediaPipe
was the engine D-021 moved away from on tracking-quality grounds, and this
returns to it for licence reasons. Device verification on a real clip is
required before this ships, and a measured comparison against the archived
RTMPose reference (`D:\posecmp\`) is the honest way to quantify what was traded.

## D-029 — Free tier now, paid tier documented as future; BILLING_ENABLED made inert without a payment path

Decision: run a free community beta to gather feedback, and do not build
commerce yet. The paid tier stays a documented future idea
(`sideout-commercialization.html`: Pro $14.99/mo, free tier 3 analyses/mo).

The audit that preceded this found the seam is not what the plan assumed.
`canAnalyze` — cited in the commercialization plan as an existing billing seam —
DOES NOT EXIST anywhere in the codebase. The free-plan check lives entirely
inside the Postgres function `reserve_analysis_entitlement`.

More importantly, `BILLING_ENABLED=true` was a trapdoor, not a feature flag.
The enforcement half is real and atomic; the commerce half is entirely absent —
no Stripe dependency, no checkout, no webhook, and nothing that can write
`profiles.plan` (the column is revoked from `authenticated` and has no
server-side writer). Flipping the flag would have capped every account at one
lifetime analysis, permanently, behind a 402 reading "Upgrade to keep training"
that points at nothing.

`lib/billing.ts` makes enabling billing a two-key operation: the free cap is
enforced only when `BILLING_ENABLED` is set AND an upgrade destination is
configured. The wrong single key is now inert instead of destructive, and the
flag-without-a-path combination is reported as a misconfiguration rather than
silently locking users out. `lib/billing.test.ts` pins the truth table.

Not done, deliberately: no Stripe, no pricing page, no plan writer. When the
paid tier ships it needs all three plus a real upgrade URL, and the existing
D-012 reservation machinery is ready to enforce against it.

## D-030 — Choosing the athlete is mandatory, and the model states who it analyzed

Framing was previously optional in two ways at once: the most confident
detection was pre-selected, and a "Skip and analyze the whole frame" button sat
next to it unconditionally. So the common path was that nobody ever chose, the
analysis silently followed whichever box scored highest, and a rep on a busy
court could be scored against the wrong person with no signal anywhere that it
had happened.

Now the primary action stays disabled until the player taps someone, with the
reason stated rather than implied. Detection state is distinguished from
detection result, so "still looking" no longer reads the same as "found nobody"
— previously both surfaced as an empty candidate list.

Zero detections is deliberately NOT a dead end. The pose engine is allowed to
return nothing (`loadPoseEngine` is null on any failure by design, and the whole
pipeline degrades rather than blocks), so a hard requirement to tap would let an
engine failure make the product unusable. That path becomes an explicit
"Analyze anyway, no player marked" — the user opts into an unmarked analysis
instead of being handed one by default.

The other half is making the model accountable for the choice. `subject_check`
carries who it analyzed, described physically (kit colour, number, court
position — never a name, since it cannot know one), plus `confirmed` /
`mismatch` / `unmarked`. A mismatch surfaces on the analysis page as a visible
warning rather than being buried.

`marker_match` is typed as a plain string, not an enum, following the existing
rule at the top of `lib/ai/schema.ts`: value constraints stay OUT of the schema
because `messages.parse()` validates client-side, so an enum would turn a
slightly-off word into a 502 presented to the user as a coaching-service outage.
A weak signal is worth more than a failed analysis. The field is optional for
the same reason and because stored rows predate it.

Open: an unmarked analysis and a confirmed one are still scored identically.
Whether an unmarked result should carry lower confidence, or be excluded from
the rating EWMA, is a real question this does not settle.

## D-031 — The eval harness reported agreement it had never earned; checks now declare when they did not run

The audit found the suite could not measure the product: all 23 cases are
`level: "pro"`, zero carry a `weakest_metric` label, and zero carry a
measurement block. Investigating that turned up something worse than a coverage
gap — an active false signal.

Exported cases were written with `overall_min: 0, overall_max: 100` and
`weakest_metric: ""`. The band is not a placeholder to the runner: it is a valid
range, so `overall_in_range` FIRED and PASSED on every case regardless of what
the model returned. The empty string, meanwhile, caused `weakest_metric` to be
skipped silently. So the harness reported passes built on a check that could not
fail and omitted the check that could — a green suite that proved nothing, which
is a worse position than an obviously empty one because it reads as evidence.

Fixes, in order of importance:
1. A check now carries `status: pass | fail | skipped` with a reason, and
   `caseVerdict()` returns `unverified` when no label-driven check actually ran.
   A check that never ran can no longer be counted as one that passed.
2. `isVacuousBand()` treats 0-100 as a placeholder rather than a label, which
   closes the false pass directly.
3. Coverage is reported alongside every result — per-label counts, which checks
   fired versus were skipped, and blocking gaps — and `--strict` exits non-zero
   so it can gate CI. `passRate` is computed over pass + fail only, with
   `unverified` reported separately rather than folded into either.
4. Both exporters and the in-app export now emit an EMPTY `expected` pointing at
   the labeling command, so an unlabeled case reads as unlabeled.
5. `scripts/label-case.mjs` captures labels with reviewer provenance and accepts
   `unknown` as a real answer, distinguishing a reviewer-confirmed abstention
   ("no single fault isolated") from a case nobody has looked at. The 18 existing
   cases carry `weakest_metric: ""` with notes like "no fault isolated", which
   reads like the former but is indistinguishable from the latter — so they are
   all counted as unlabeled and NOTHING was inferred on their behalf.
6. `evals/BASELINE.json`/`.md` self-marks provisional while gaps exist and
   refuses to write from empty results without `--force`.

Honest state after this work: 18 active cases, 100% pro-level, 0% weakest_metric
labeled, 0% carrying measurements, 4 blocking gaps, baseline provisional and
coverage-only with zero scored cases. No labels were invented. The harness is
now CAPABLE of measuring the product and correctly reports that it currently
does not — which is the whole point.

Still requires a human: real intermediate/expert footage (the target population
is 0% represented), a weakest-metric decision on all 18 active cases by someone
who watched the reps, re-capture with tracking on so cases carry measurements,
and one real scored run before the baseline stops being provisional.

## D-033 — Two blind tests killed the on-device engine; the model does the whole read and the user marks the target

D-028 restored the pose engine on the argument that measured checkpoints were
the product's differentiator and had to be tested, not assumed. They were
tested. Both halves failed, on the owner's own footage, under blind judging.

Kill gate A (measurement vs vision). Thirteen clips, both arms given identical
frames, rubric, output spec, model, and effort; the only variable was whether
the on-device measurement block was attached. Three blind judges per clip, order
randomised. The measured arm won nothing: 13-0 against on overall quality,
evidence grounding, and fewer unsupported claims, and it cost more (93.6k/23.8k
tokens against 82.9k/18.2k). Checked separately against anatomy with no judge
involved, 42 of 124 measured values (33.9%) are physically impossible — jump
heights of 2.75 and 0.04 body heights, a 137-degree shoulder-hip separation —
every one carrying confidence above the honesty floor. The layer built to stop
fabrication was the source of it, and the confidence gate could not see it
because the MediaPipe engine reports near-total confidence in everything
(the D-028 saturation finding).

Kill gate B (tracking). With measurements gone, the engine's last job was
holding the tapped player across the clip. Fourteen clips, both arms handed the
identical first-frame mark, then asked where that player is at later moments.
The tracker used the shipped nearest-body association from `fullPass`; the model
followed by looking. Neither graded itself — each arm's claim was drawn as a
ring and three blind judges said which ring sat on the marked player, order
randomised per frame. When it committed, the model was right 38/39 (97.4%); the
tracker was right 28/49 (57.1%), i.e. on the WRONG player 43% of the time. The
model abstained 17 times, the tracker 7 — but the tracker's silence is not
honesty: nearest-body matching always snaps to some nearby person and reports
success, so it cannot tell when it is lost. A silent wrong answer is the exact
failure an anti-fabrication product cannot ship.

Decision. Remove the on-device pose engine entirely — the two `.task` models,
the wasm runtime, the tracking worker, the crop geometry, the subject-select and
metrics layers, ~1500 lines, and the whole wrong-body bug class. The model does
the full read: assessment and cross-frame subject tracking. Target selection
stays mandatory (D-030) but becomes a raw tap coordinate burned onto the first
frame before upload, so nothing on-device can select the wrong person or produce
a number. `subject_check` (D-030) already surfaces a wrong or lost subject as a
warning, which is the honest handling for the model's abstentions.

This reverses D-028's "keep pose, it's the differentiator" position. The
reversal is the evidence's, not a change of taste: "we measure your jump height"
is a sharper pitch than "we coach your technique," but it is currently false a
third of the time and was never shippable as written. Cost paid knowingly:
positioning must be rewritten around coaching quality over measurement.

Executed the same day, owner-approved. Deleted: `lib/pose/` (22 files),
`public/pose/` models + wasm, the `@mediapipe/tasks-vision` dependency, the
five diagnostic pages, `components/measured-card.tsx`,
`lib/ai/measurements-schema.ts`, and every measurement lane in the request
schema, the analyze/eval routes, the eval scorer, and the coverage report.
Kept: real-speed frame extraction (`lib/frames.ts`, luminance-scan planning),
the trim window, extras storage, mandatory subject pick (D-030), and
`subject_check`. New flow: the user scrubs and taps their athlete; the tap is a
raw normalized coordinate; extraction guarantees a send frame at exactly that
instant (`injectMarkTime`, planned as a peak so the byte trimmer can never drop
it); a hollow gold ring is burned onto that frame client-side (`burnMark`);
`marker_frame_index` names it to the model; the prompt binds the ringed athlete
as the subject in every frame and instructs saying so rather than guessing when
the subject cannot be followed. Scrubbing more than 250ms away from a placed
mark clears it, so a stale tap cannot ring empty court. The analyze-without-
marking path stays one visual level down, never a dead end. Gates after the
cut: tsc 0, 87 tests (pose tests deleted with the layer), policy lint, prod
build. The A/B evidence stays in `scripts/ab-*.mjs`, `scripts/kgb-run.mjs`, and
`ab/` summaries; the browser export pages died with the engine they measured.

## D-034 — The product score scale is set by a calibration curve in code, not by prompt persuasion

The owner ran the newly deployed tap-and-ring flow on his own rep (the first
live device-verification, and the ring worked: subject_check named the exact
tapped player, marker confirmed). Production scored it 42. An independent
full-frame read of the same rep judged it 68: real approach and elevation, one
clear fault (contact behind the hitting shoulder). The owner asked for the
gentler calibration across all six skills.

What validation showed before anything shipped (scripts/calib-check.mjs, the
same clip, ring-marked frame 0, grass rubric, 2 runs per cell at low and high
effort):
1. The model's raw judgment is STABLE: 42-50 across efforts and runs on the
   shipped prompt. Low and high effort agree, echoing the D-027 ladder.
2. Prompt wording is an UNSTABLE lever: three successive rewordings of the
   scoring-standard block moved the same clip 42 -> 56 -> 50, including a
   regression from adding a plausible-sounding "spread your scores" clause.
   Chasing a target number through prose is noise-chasing.

Decision, two parts:
- The standard block keeps ONE semantic fix that survived validation: the
  rubric's numeric anchors are declared to be a professional scale that does
  not set the number, and checkpoints are scored independently so one fault
  does not bleed into every metric. This moved raw scores from ~45 to ~53
  and is defensible on meaning, not just effect.
- The scale itself is set in `lib/score-scale.ts`: a monotonic
  piecewise-linear curve (0->0, 30->40, 50->66, 70->80, 90->92, 100->100)
  applied in the analyze route to metrics, overall, and rep scores for every
  tier EXCEPT pro, whose contract remains the professional bar untouched.
  Anchored on the owner-labeled rep (raw ~50 -> shown 66-70, matching the
  independent 68) with the elite end pinned so a great rep cannot inflate.
  Ordering between reps is exactly the model's; only where numbers sit
  changes, and notes stay blunt about faults.

Validated end to end: the anchor clip now shows 66-70 at low effort, 70-74 at
high, against 42 in production before the change. Unit tests pin monotonicity,
the anchors, and input clamping.

Why a curve and not rubric rewrites: the six rubric prose blocks are the
product's judgment definition and are frozen (D-004); rewriting them to move
numbers would change WHAT is judged to fix WHERE the numbers sit, with no
labeled eval floor to catch drift (D-031: 0 scored cases). A deterministic
curve moves the numbers, is provable, reversible in one file, and leaves the
judgment alone. Known rough edge, accepted: expected_gain still arrives on the
model's raw scale, so mid-band gains slightly understate displayed gains.

## D-035 — One coach, two surfaces: grass and sand judged together, indoor alone

Owner call. The eighteen per-discipline coach personas ("elite BEACH serving
coach", "elite GRASSS attacking coach", ...) are replaced by ONE shared coach
voice fronting every rubric, and the three disciplines resolve to two coaching
groups: `indoor`, and `outdoor` covering grass and sand together.

The outdoor anchors are the grass set (firm footing matches most recreational
outdoor footage, and it is the set the D-034 calibration was validated
against), fronted by a surface-adaptation note: read the footing from the
frames, hold grass near the indoor bar, credit sand's cost to approach and
jump, count wind control in the player's favor. The beach anchor set is
deleted; beach-specific strictness (hand-set rules) is left to the note and
the frames.

Wire and database untouched: all three stored values stay valid
(indoor|beach|grass; live constraints verified), `beach` becomes a legacy
value new captures no longer produce, and the capture/onboarding/dashboard/
learn UIs offer two choices ("Indoor", "Grass & sand") with `grass` as the
stored value for the combined group. Dashboard queries went group-aware
(`.in` over GROUP_DISCIPLINES) so historical beach rows stay visible under
the combined chip. The five-metric taxonomy per skill is unchanged
everywhere, so ratings and stored results remain comparable.

Validated: getRubric returns the identical outdoor rubric for beach and
grass; the D-034 anchor clip still scores 66-70 at low effort (70 at high)
under the unified coach voice, so the calibration survives the persona swap.
Known reductions, accepted: rep-history rows recorded under `beach` display
as "Grass & sand"; goals still query indoor-only (pre-existing quirk, out of
scope here).

## D-036 — Mechanics only, and coach-spotted player selection

Owner feedback from a live run (a setting rep at night, scored 75): the app
described his session as a "casual pickup game", and the subject check
reported analyzing a different player than the one he marked (honestly
surfaced, but still the wrong player).

Two changes:
1. The setting judgment is gone. `scene_read` is removed from the schema, the
   output spec, the result type, and the results page, and the spec gains a
   hard rule: never characterize the setting, occasion, or seriousness of
   play in any field; the same swing earns the same words and number on a
   championship court or a backyard one. Scoring was already
   setting-independent; now the words are too.
2. The framing card gains coach-spotted candidates (`app/api/players`): one
   frame goes to the model, which returns up to six clearly visible players
   as short kit-and-position descriptions with torso points. The user picks
   from the list (numbered dots on the frame) or still taps directly; the
   pick becomes the same plain coordinate as ever. Spotting shares the coach
   quota bucket, fails open to an empty list, and goes stale with the same
   250ms scrub rule as the mark. Validated against the owner's anchor frame:
   the first candidate returned was the correct athlete with a usable torso
   point.

## D-037 — One scoring standard for every account: the advanced-amateur ceiling

Owner call, after comparing his own rep and pro tournament footage through the
pipeline. The per-tier scoring standards are gone: AMATEUR vs PRO standard
selection, and the pro-tier exemption from the D-034 score curve, are all
removed. Every account is scored against the single validated standard (the
rubric's ~90 elite prose as the top of the scale, checkpoints scored
independently) and mapped through the same curve, so a 75 means the same thing
on every profile and any two clips can be compared number to number.

The player's level still personalizes the coaching VOICE and the realism of
expected gains (RETURN_SCALE); the pro voice keeps its bluntness but now says
so on the shared scale. What is lost, knowingly: the funnel's "judged like a
professional" scoring contract; a pro-tier user now gets pro-blunt words over
the standard scale rather than a separate harsher number.

## D-038 — Unobserved checkpoints are excluded from the score, not defaulted

Owner call: the number is purely the mechanics of the analyzed athlete,
nothing else. The old behavior "scored conservatively" any checkpoint the
footage hid, which silently folded CAMERA quality into a MECHANICS number: a
pro hitter on broadcast-cut footage scored a hedged 72-75 built mostly of
abstention-defaults.

Now each metric carries observed: boolean. A checkpoint whose mechanics
genuinely cannot be seen (occlusion, crop, camera cut, motion blur) is marked
observed=false, keeps a best-guess score and a note naming exactly what was
not visible, and is EXCLUDED from the overall, which becomes the read of the
observed mechanics only (fallback to all metrics when nothing was observed,
rather than an empty mean). The results page renders unobserved checkpoints
as "Not visible" with a dashed track instead of a bar. Older stored rows have
no flag and count as observed.

Validated: the pro tournament clip went 75 (five conservative defaults) to 81
(approach excluded as not visible; jump 82, arm swing 80, contact 82 scored
on their visible merits). The owner's park clip stayed in band (72) with the
sparse-frame checkpoints now honestly flagged instead of silently defaulted.
The number went UP by becoming more honest, not by inflating: invisibility
stopped counting against the athlete.
