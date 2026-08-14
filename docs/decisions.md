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

Shipped metadata uses an em-dash separator: `app/layout.tsx` title default + template (`%s — Vollyio`), OG title, twitter title; `app/manifest.ts` name; `app/opengraph-image.tsx` alt. The no-em-dash voice law applies to all user-facing copy, and tab titles + OG + manifest are user-facing. The brand already uses the middot (·) as its separator throughout the UI. RULING: replace the em-dash SEPARATOR with ` · ` in title default/template, OG title, twitter title, and manifest name; rewrite the OG `alt` (a mid-sentence em-dash) as a clean no-em-dash sentence. Resolves Leon's R-ROOT-1 and Lisa's metadata flag. Implemented by Dave/Jerry in Phase 1 per `docs/metadata.md`; Sierra verifies zero user-facing em dashes repo-wide.

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
name, Vollyio, with the offer in supporting display copy. The same still image carries
the sport into login and signup behind stable, high-contrast form tools. The app shell
gets low-opacity court geometry, and the dashboard uses clearer score, challenge,
streak, level, and momentum hierarchy without becoming a marketing layout.

The hero asset was generated specifically for Vollyio from this brief: an elite
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
`public/vollyio-launch.mp4`. New named motion (`analytics-draw`,
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
wrong for Vollyio today: server video processing surrenders privacy and the
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
ship: `vollyio-hero-loop` (ambient, hero backdrop) and
`vollyio-court-vision` (full HUD story, "The film room" landing section),
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
and decline the two that fail Vollyio's gates on the merits: Flutter
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
and how Vollyio can have it. The honest decomposition: most of that feel is
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
(30/90/180 days). Answers park in localStorage under `vollyio.funnel.v1`;
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
GPT-family study (`vollyio-attacker-model-effort-report.html`, 33 model/effort
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
differentiator (`vollyio-commercialization.html` positions it against "everyone
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
(`vollyio-commercialization.html`: Pro $14.99/mo, free tier 3 analyses/mo).

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

## D-039 — Scores are computed from a pointer checklist, never free-scored

Owner call: each skill's number must come from a set of concrete mechanical
pointers, purely mechanics. Implemented as `lib/ai/pointers.ts`: a catalog of
four observable cues per checkpoint (5 checkpoints x 6 skills = 120 pointers),
each judged by the model as met | partial | missed | not_visible. The NUMBER
is derived in code: fraction = (met + 0.5*partial) / visible pointers, mapped
linearly raw 35 (all missed) to 92 (all met), then through the product curve.
The model no longer emits checkpoint scores at all; the schema takes note +
pointer verdicts, and unknown statuses or invented keys degrade to
not_visible, which can never manufacture a score.

Consequences, all intended:
- observed is now DERIVED (a checkpoint with zero visible pointers is
  excluded from the overall, which is the plain mean of observed checkpoint
  scores; the model's whole-clip read stands in only when nothing at all was
  visible).
- The results page shows the checklist under every bar: met (gold), partial
  (faded gold), missed (coral), not visible (hollow) with the cue text, so a
  score explains itself line by line.
- Phase guardrail after validation caught it: frames of an athlete standing
  or walking are not evidence about a phase they are not performing; a phase
  the footage never captures is not_visible, not missed. Without this the
  sparse-frame park rep scored 47 from walking frames; with it, 59.
- Determinism: the same checklist always produces the same number; run-to-run
  variance now lives only in the pointer verdicts, which are binary-ish and
  far more stable than free numbers.

Validated: pro attacker 79 (power/follow-through excluded as not visible,
observed checkpoints 69-85 with the guide-arm and elbow-load faults named by
pointer); owner's park rep 59 on sparse offline frames with the missed
approach pointers matching the independent human read. Calibration note: the
checklist is stricter than the D-034 free-score anchor (66-70 for that rep);
the knobs are RAW_FLOOR/RAW_CEILING in one file, and any recalibration should
wait for labeled eval cases rather than another prompt hunt.

## D-040 — Every scoring hedge removed: the pointer derivation IS the scale

Owner call, asking for the bluntness of the model-effort reports. Audit found
five places the pipeline softened numbers; all are gone:
1. The D-034 display curve (raw 50 -> shown 66) is DELETED (lib/score-scale
   removed). Checkpoint scores are now the raw pointer derivation, uncurved,
   in the analyze route, the eval route, and the diagnostic scripts alike.
2. The derivation band widens 35..92 -> 30..95: all pointers missed reads a
   broken 30, all met an elite 95, so the scale uses its full range.
3. The overall's no-observation fallback no longer gets curved either.
4. rep_scores pass through raw.
5. The shared standard gains a blunt-verdict rule: a missed mechanic is
   missed, not "developing" or "almost there"; never soften, pad, or console.
Model and effort unchanged: opus-4-8 at low, the ladder's accuracy cell.

Validated against a full continuous watch of the owner's rep (all frames at
6fps, no selection): the human read said 65 — a genuinely athletic standstill
jump wrapped in a missing approach. Unhedged pipeline: 68 (curved it showed
75). The pro clip reads 70 on broadcast-cut footage with the invisible
bow-draw scored bluntly at 52 and follow-through excluded as not visible.
The curve was hiding roughly 7-10 points of grade inflation across the
mid-band; the pointer checklist no longer needs it because scores derive
from mechanics met, not from rubric-anchor pessimism (the original D-034
motivation, since made obsolete by D-039).

## D-041 — The coach watches every frame: uniform dense coverage, no motion picking

Owner call, after two clips proved the point: sparse sampling scored a
standstill jump as an approach jump, and only a continuous watch caught a
mistimed jump under a high set. The motion-guided sampler (luminance scan,
peak picking, burst layout) is DELETED. Extraction now covers the whole trim
window uniformly at up to 6fps, capped at MAX_FRAMES=40 by what one request
carries; frames render at 1024 (down from 1568) so a full watch fits the
4MB body, with the existing re-encode fallback. The tap instant still gets
an exact frame. The separate extras storage pass is gone: the dense send set
IS the record. Cost: roughly 30k input tokens per full-window analysis,
about $0.15-0.20 at opus-low, inside the ladder budget.

Validation note, honest: the offline every-frame run could not complete
because the API account hit its MONTHLY SPEND CAP mid-run ("regain access
2026-08-01"). The same key serves production, so live analyses are blocked
until the owner raises the limit in the provider console. The mechanism
shipped is deterministic (uniform stride + mark injection + byte budget) and
unit-gated; the model-behavior validation resumes when budget does.

## D-042 — Repo made to tell the truth: benchmark clutter and dead-system docs archived

The repo root carried roughly 90 MB of benchmark evidence and a stratum of docs
describing systems D-033 deleted. Session 1 of the road-to-100 playbook moved
them out of the way of the living repo without rewriting history.

- Untracked benchmark outputs, footage frames, and scratch (the ~18 MB
  model-effort report, run JSON, `frames/raw/judging/ab/dist`, the codex eval
  copy, the `.mcp.json.bak` and restart note) moved on disk into
  `archive/2026-07-model-benchmarks/` and sibling folders.
- Retired tracked docs describing the deleted pose engine or finished one-time
  efforts moved via `git mv` into `archive/docs-history/`, `archive/reports/`,
  and `archive/orchestration/` so their history is preserved and they stay
  greppable.
- `docs/` pruned to a living set; `frontend.md`, `motion.md`, and `tooling.md`
  folded into one `docs/frontend.md`; `validation-plan.md` folded into
  `analysis-validation-roadmap.md`; `docs/README.md` and `archive/README.md`
  written; `README.md` and `HANDOFF.md` rewritten to the post-D-033 world.
- Eval footage moved out of `public/` into `evals/footage/` (gitignored). It was
  already gitignored under `public/`, so it never reached a deploy; the move is
  defense in depth against a future un-ignore, and the two extractor scripts now
  write there so they can never repopulate `public/`.

Archive tracking policy, reconciling two owner-authored intents. This session's
prompt asked that `archive/` be "gitignore-exempt only for its README"; the
existing `.gitignore` deliberately kept the small hand-written benchmark
methodology tracked "because it is the methodology, not the output." Resolution:
`archive/` is gitignored except `README.md`; the heavy regenerable outputs and
footage stay untracked there; the reproducible methodology (`run-matrix`,
`run-judges`, `run-stability`, `build-report`, the two schemas, `coach-prompt`,
`video-evidence-notes`) moved to `scripts/benchmark/`, where it stays tracked and
out of the root. Retired text docs moved with `git mv` also stay tracked because
git does not untrack an already-tracked file under an ignore, and their history
is worth keeping. Rejected: untracking the methodology (loses reproducibility
from git) and `git rm`-ing the archived docs (loses history for no real space
saving on small text).

Confirmed no single git-tracked artifact exceeds 10 MB, so there is no history
bloat to excise; the heavy artifacts were already untracked. The three
road-to-100 planning docs left at the root (`vollyio-100-playbook.md`,
`vollyio-breakdown.md`, `vollyio-improvement-prompt.md`) stay untracked in place
because the playbook references them there; relocating the owner's own active
plan was out of scope for a truth-and-clutter pass.

## D-043 — Production resilience: honest degraded-service handling and measured telemetry

Production analyze/coach is down: the account API key hit its monthly spend cap
(D-041). Two failures compound the outage. First, a coaching-call failure
returned a generic 502 that reads like "your clip failed," when the real cause
is a temporary account-level capacity outage that charged the player nothing.
Second, the hourly analyze quota is consumed before the coaching call and was
never refunded, so an outage that did no billable work still burned one of the
player's twenty hourly slots.

Degraded-service handling. `lib/ai/errors.ts` `classifyCoachingError` maps a
failure to `capacity | busy | unknown` from status plus message, kept pure so it
is unit-tested without the SDK error object. The two production shapes (a 400
"credit balance is too low" and a usage/spend cap) classify as `capacity`; a
plain 429 or 529 is `busy`; everything else is `unknown`. On `capacity` the route
refunds the analyze quota (`refund_api_quota`, migration 016) and returns a
distinct honest 503: "temporarily out of capacity, so your clip wasn't counted
against your limit." The class requires both a billing signal and a plausible
status, so a stray substring in an unrelated 500 cannot trigger a refund.

The entitlement reservation needed no change: the free-tier check keys on the
`analyses` table, not the reservation row (`reserve_analysis_entitlement`), and
the route's `finally` already releases the reservation on every path, so a
failed analysis that never inserts a row leaves the free tier unspent. Verified
against the reserve/release/link flow rather than assumed.

`refund_api_quota` only decrements inside the active window and never crosses the
`request_count > 0` check (it deletes a would-be-zero row), so it cannot be used
to escape the rate limit: the window still expires on schedule and no paid work
happened during the outage.

Telemetry. A server-set `telemetry jsonb` column on `analyses` records real input
/output/cache token counts, wall-clock duration, model, and effort, written in
the same insert. This turns D-027's two open risks (cost per analysis,
`maxDuration=120` versus real latency) into measured numbers after a handful of
live runs. It is a dedicated column, not a key inside `result`, for two reasons:
`result` is sent to the client by the analysis, history, and coach read paths, so
telemetry there would ship the model's vendor string to the browser (no-vendor
rule) and bloat the payload; and no read path selects `telemetry`, so it stays
server-side. There is an insert grant but no update grant, so a row stays
immutable after creation; like `result` and `model`, the owner could set it at
insert via the Data API, and it gates nothing (security.md).

Rejected: storing telemetry in `result` (client exposure, vendor-string leak); a
post-insert update path (needs an update grant plus an RLS update policy, which
would break analyses immutability); moving quota consumption after the coaching
call (breaks the atomic-before-paid-work rule in security.md).

Client surface. The analyze flow (`components/analyze-flow.tsx`) now reads a 503
distinctly: a new `unavailable` status renders the server's honest message in the
neutral chalk tone, not the coral error state, so "the service is temporarily out
of capacity and your clip wasn't counted" never reads as "your clip failed." The
spinner clears (503 is not a busy state) and a retry stays offered, so it is a
calm status, not a dead end. All 503s map here (capacity, plus the fail-closed
quota and entitlement paths), which is correct: none of them is the clip's fault.

Honesty. The pure classifier and the refund helper are unit-tested (TDD, red
first). Migration 016 is additive and was applied to production and verified
(column, function, grants). NOT verified live: the full-route degraded behavior,
the real telemetry values, and the client `unavailable` state in a browser,
because the spend cap blocks every live call until the owner raises the limit.
The exact production error body should be confirmed against
`classifyCoachingError` when the cap next lifts.

## D-044 — The priority-fix loop: a breakdown remembers last time

The cheapest retention feature the product can ship, built entirely from data
already stored on analyses, so it costs no API call and changes nothing about the
model output.

Two surfaces:
- The breakdown of a rep opens with a "Last time" strip when the player has
  analyzed this same skill and discipline before: the previous priority fix
  (`priority_fix.title`) and whether the checkpoint behind it moved. The
  checkpoint is `changes[0].target_metric` (the metric the top change targets),
  and its score on the two reps gives an honest then-to-now reading.
- Each dashboard skill card gains a one-line "Focus:" history: the latest
  priority fix for that skill.

The comparison lives in a pure, unit-tested helper (`lib/priority-loop.ts`
`lastTimeFix`). It never fabricates movement: a checkpoint not observed this rep
reads as "not visible", not as a delta, and a checkpoint with no prior observed
score reads as a baseline, not an improvement. Only a genuine numeric change
between two observed scores becomes up/down/same.

Data path and security. The breakdown adds one read for the previous rep, scoped
by the explicit owner filter plus RLS, within the existing `select` grant, so no
security surface changes. The dashboard lifts the fix title straight from the
stored `result` JSON with a PostgREST JSON-path select
(`fix:result->priority_fix->>title`) rather than pulling every full result blob;
the select syntax was verified against the live REST API by a differential test
(a valid path is permission-denied under anon RLS, a malformed one is a parse
error) so the core dashboard query cannot 500.

Known limits, accepted: the then-to-now number carries the same run-to-run
pointer noise as any single score (D-039 calibration note), so the strip states
the two numbers plainly rather than asserting the player improved; and the
previous rep is the immediately prior one of that skill, not a best or a median.

## D-045 — Weighted checklist scoring and coverage, reconciled from the skill-eval spec

The owner supplied a from-scratch per-rep grading spec (weighted components,
per-component confidence, coverage %, outcome kept separate, coverage-weighted
trend). Adopting it verbatim would have reversed five decisions at once
(D-027/D-034/D-039/D-040/D-041: model free-scoring against prompt anchors, a
"predicted <=88" hedge, 4-6 keyframes, Sonnet) and swapped the frozen five-metric
taxonomy for a new set, breaking comparability with every stored analysis, every
rating, and the D-044 "Last time" strip. The owner chose to RECONCILE: take the
spec's structure, keep the anti-fabrication guardrails.

What changed (all code-side; the model's pointer job is unchanged):
- Weighted overall. Each of the five metrics per skill carries a weight summing
  to 100 (`lib/ai/metrics.ts`). The overall is the weighted mean over OBSERVED
  metrics, so a heavier checkpoint (contact, swing) moves the number more than a
  lighter one (follow-through, recovery). This replaces the plain mean of D-038.
- coverage_pct + low_confidence. coverage_pct is the observed weight over the
  total; below 60 the read is flagged low-confidence and the results page says how
  much of the checklist the clip supported. Formalizes D-038's exclude-unobserved
  into an honest number instead of a silent omission.
- Coverage-weighted trend. `updateRating` scales the EWMA step by coverage, so a
  bad-angle rep on 55% coverage moves the rolling rating about half as much as a
  full read (`lib/ratings.ts`).
- One scoring path. The analyze route and the eval route now derive through a
  single `lib/ai/derive.ts` `deriveResult`, so an eval measures exactly what
  production scores (they had drifted: eval used the model's overall, analyze a
  derived mean).

Kept from the current system (the guardrails the owner did not want to lose):
scores stay code-derived from the pointer checklist (D-039), uncurved (D-040), on
one standard for every account (D-037), read from dense uniform coverage (D-041),
on Opus at low effort (D-027). No prompt, schema, or model change: the model still
judges pointers met|partial|missed|not_visible; the weighting and coverage are
pure code.

Deferred from the spec: the explicit per-component confidence tiers
(seen/predicted) and the "predicted <=88" cap (a hedge D-040 removed); the 4-6
keyframe capture (D-041's dense coverage stands); the Sonnet route (D-027's Opus
stands); a separate outcome field (a small future addition, mechanics-only per
D-036 either way).

The weights are a calibration knob in one file, tuned against labeled cases like
RAW_FLOOR/RAW_CEILING (D-034), never through prompt wording. The pure derivation
and the coverage-weighted rating are unit-tested (weights sum to 100, the weighted
mean, coverage, low-confidence, and trend weighting). NOT verified live: the felt
effect on real reps, because the spend cap blocks every coaching call.

## D-046 — The save ceiling follows the send budget: DB frame cap raised 12 -> 40

D-041 raised the send budget MAX_FRAMES from 12 to 40 for dense coverage, but the
insert guard `private.enforce_analysis_insert_limit` (migrations 011/013) still
rejected `frame_count > 12`. So every clip whose dense extraction produced more
than 12 frames was read by the model, billed, and THEN thrown out at the insert
with `check_violation 'invalid analysis media count'` — surfaced to the player as
the route's generic "Couldn't save your analysis." 500. Production proof: a
`POST /rest/v1/analyses 400` paired with the postgres error, the entitlement
released but the hourly quota NOT refunded (the read had succeeded), while every
saved row capped at frame_count 12 and the failure was post-deploy.

Migration `017_frame_cap_alignment.sql` raises the ceiling to 40 (matching
MAX_FRAMES) and changes nothing else: the media-count check, the per-index
frame-path format loop, the stored-extras cap (MAX_STORED_FRAMES - 2 = 22), the
owner check, the advisory-lock hourly rate limit, and the server-set created_at
all stand. Safe because the read set is contiguous by construction —
`finalizePlanned` re-indexes the frames 0..N-1 after any byte-budget drop — so the
`f00..fNN` position loop holds at 40 exactly as it did at 12. No app code changed;
the bug was purely the DB guard trailing the app constant.
`lib/security-contract.test.ts` now pins the DB ceiling to the MAX_FRAMES constant
so the two cannot drift again. Verified by the contract test and the full gate.
The operative fix is applying migration 017 to prod — the trigger lives only in
the DB, so the git push records it but does not change live behavior until it is
applied (as migration 016 was, via MCP). NOT verified live: a real >12-frame
save, because the spend cap blocks every coaching call.

## D-047 — Coach chat gated dark and hardened before it returns

Coach chat had a 60/hr quota, no daily ceiling, and no billing gate: one
account could run 1,440 metered model calls a day. With the monthly spend cap
already blown (live coach was 503ing anyway), the owner chose hide-plus-harden
over remove: the surface ships dark behind `NEXT_PUBLIC_COACH_ENABLED`
(default off; nav entry filtered, /coach 404s, /api/coach 404s before any
work) and the abuse limits land in the same pass so re-enabling is one env
flip. Migration `018_coach_quota.sql` adds a rolling 24-hour `coach_daily`
scope (30/day) and drops the hourly cap to 20; the route consumes hourly then
daily and refunds the hourly unit when the day gate refuses. Route-side
tightening: message cap 2000 -> 600 chars, replies 1024 -> 512 tokens, session
history 20 -> 10 turns, and the prompt drill catalog trimmed to the player's
two weakest skills. Nothing is deleted: page, components, API, and both DB
tables stay, so the feature returns intact. Migration 018 is committed but not
applied to prod; it is inert while the route 404s.

## D-048 — Outdoor lessons derive from the authored outdoor base; grass = sand, indoor distinct

D-035 grouped grass and sand as one outdoor coaching surface, but the Learn
content never followed: the grass variant was synthesized as an INDOOR clone
plus one context sentence, so a player picking "Grass & sand" read indoor
mechanics. The owner's ruling: grass and sand are the same environment, and
outdoor must read completely differently from indoor, because the mechanics
differ (researched 2026-07-21, volleyballmag.com / avp.com / betteratbeach.com:
outdoor hand-setting is judged far more strictly so the legal contact is a
longer, lower guide and bump-setting is the wind default; open-hand serve
receive is effectively unusable and each player covers half the court with the
pass target off the net; sand shortens and slows the attack approach while
open-hand tips are illegal, making pokey/cobra/roll shots and placement the
short game; grass keeps near-indoor footing but the outdoor rules and wind
still apply). The grass variant now derives from the authored beach content
with combined both-surfaces context notes; sand-only and doubles-only phrasing
was softened where it would mislead a grass player. Scoring is untouched:
rubric grouping, the pointer checklist, and the metric taxonomy stand exactly
as D-037/D-039/D-040 fixed them. `content/technique.test.ts` pins the
un-cloning (grass differs from indoor, matches its beach base, keeps every
metric key).

## D-049 — Public share links: the full breakdown and the clip, never the frames

Sharing was a client-drawn PNG carrying skill, score, one fix title. Owners
can now mint revocable 30-day token links to the full evaluation. Design
posture: the app still has no service-role client; anonymous access is two
deliberate, bounded surfaces in migration `019_share_links.sql` — the
SECURITY DEFINER `analysis_by_share_token(text)` function (returns only skill,
discipline, overall_score, created_at, result, clip_path; hashes the token
itself; filters revocation and expiry) and one storage policy letting anon
read a clips-bucket object only while a live share link points at its
analysis. Only the token's sha256 is stored, so a table read never yields a
working link. The clip streams through `/share/<token>/clip`, which validates
the token and proxies the signed URL server-side with Range support, because
the storage path embeds the owner's user id and must never reach a viewer.
The frames bucket gets NO policy and the projection never returns frame
paths: frames are structurally unshareable, per the owner's explicit "clip
yes, frames never". The written breakdown is one shared component
(`components/breakdown-body.tsx`) used by both the private page and the share
page, so the two can never drift. `lib/share-contract.test.ts` pins the
projection, the dual revocation/expiry guards, and the clips-only policy.
Migration 019 is committed but not applied to prod; share links 404 until it
is.

## D-050 — Dashboard is for evaluations; configuration moves to /settings

Settings, account, coaching level, and the consent toggle lived at the bottom
of the dashboard, and wide screens stacked everything in one column with dead
space on the right. The dashboard now carries only play state: score stage,
skill momentum, recent breakdowns, with an xl right rail (daily challenge,
goals, a This-week card that absorbs the header pills, and a Focus-now card
surfacing the newest priority fix). Below xl the old order is untouched. The
new /settings page (sidebar + tab bar entry) holds Account (display-name edit,
email, sign out, delete), Coaching level, Player profile (position, play
frequency, default environment — fields onboarding wrote but no surface ever
exposed; migration 012 already granted their update), and Privacy. Writes go
through `lib/profile-update.ts`, one field per submit; settings never
re-writes the legacy `beach` value. Companion repo standard: `docs/ui.md`
pins the house primitives and plain-language ease-of-use rules (44px targets,
labels beside icons, color never alone) for a 13-plus, any-experience
audience; every surface this round touched conforms to it.

## D-051 — Scoreboard sides are Home (court blue) vs Guest (coral)

The scoreboard's sides were interchangeable neutral cards labeled Us/Them.
Sides are now Home and Guest by default with a per-side accent: one new token
`--color-court-blue` (#4f9de2) for Home, the existing coral for Guest, applied
as a top border plus score tint so the `.card` base and the gold serving/set
signals stay untouched. Names remain free strings (1-30 chars): stored games
and live localStorage matches keep whatever names they had; only the defaults
and setup labels changed. Team keys stay `a`/`b` on the wire and in the
`games` table.

## D-052 — Analyze flow: environment, then skill, then film; and the checkpoint legend

The capture flow preselected a discipline and buried it above "01 Pick a
skill", so players never consciously chose where they were playing even
though environment shapes the rubric prose and the Learn content. The flow is
now three explicit steps, each revealing after the previous decision: 01
Where are you playing (nothing preselected on a bare visit; deep links with
`?discipline=`/`?skill=` still prefill), 02 Pick a skill, 03 film/trim/mark.
The server contract keeps its `default("indoor")` fallback; the client always
sends an explicit choice. The video stage also widens to the full content
width on desktop during mark/trim (containers only; the tap-to-mark
coordinate math reads intrinsic frame pixels and is unaffected). And the
metric checkpoint bubbles, previously color-only for met/missed, get a
plain-language legend (`components/metric-legend.tsx`: Hit / Partly there /
Missed / Not visible, doesn't count) rendered wherever the metrics render,
including shared breakdowns.

## D-053 — One advanced coaching voice; unseen mechanics become a summary note, never a score cost

The owner removed the coaching-level setting: every account now gets the same
advanced, high-performance coaching voice, and the per-level expected-gain
scale went with it. The number was already one standard for every account
(D-037); now the words are too. profiles.level survives as a self-reported
experience field that only sizes the daily challenge and drill suggestions;
the Settings card, the outputSpec/coach-prompt level parameters, and the
"Player level" line in the analyze message are gone. The onboarding "pro"
option no longer promises a blunter voice.

Second half, the owner's 90+ goal: a score of 90+ must be reachable in real
app use, and what the camera cannot see must never stand in the way. The
derivation already excluded not_visible pointers from every number (D-038,
D-045) with no coverage cap on the overall, so the math allowed 90+; the leak
was judging. The pointer instructions let "partial" absorb uncertainty, and a
half-credit hedge on unclear footage silently pulled clean reps into the 80s.
The judging rules now state: partial is a verdict about VISIBLE flaws only;
when evidence is too unclear to judge confidently, the pointer is not_visible,
excluded entirely, and named once at the end of the summary ("Not visible in
this clip: ..."), which is the only place unseen mechanics appear. Scoring
math, weights, floor and ceiling (30..95), and the one-standard rule are
untouched. This is a deliberate owner-directed prompt change recorded against
D-034's no-prompt-hunting rule; the labeled eval baseline remains the way to
verify its effect once the spend cap lifts.

## D-054 — Spend containment: self-imposed budget, estimate-only pricing, and the share-clip repair

The 2026-07-20 outage had a structural cause: one provider key with one
monthly spend cap serves production and local development, so local usage
killed the live app. The owner-side fix is split keys with per-workspace
limits (HANDOFF "Open items" 1); the app-side fix is this entry.

Migration 021 adds two SECURITY DEFINER aggregates over `analyses.telemetry`
(month-to-date and per-day, grouped by model), granted to authenticated only
— an anon grant would publish org-wide spend volume through the public rpc
surface. `lib/ai/pricing.ts` holds checked-in per-MTok rates and refuses to
price a model it does not know (a silent $0 would understate spend, the one
direction an estimate must never err); every consumer labels its output an
estimate, never billing truth. `/api/usage` (dev-only, 404 in production,
session-required — the same posture as `/api/eval`) renders the report.

`lib/ai/budget.ts` is the guard: `ANALYZE_MONTHLY_BUDGET_USD` set in the
environment makes the analyze route check estimated month-to-date spend
before anything is consumed — no body parsed, no hourly slot, no entitlement.
Tripped or unknown spend returns the existing capacity 503 verbatim, so the
client's calm "clip wasn't counted" path covers it unchanged. Semantics: env
unset or malformed = guard disabled (a misconfigured deploy degrades to
no-guard, never dead-app); AI_MOCK skipped; 5-minute per-instance cache; a
spend figure that cannot be fetched or priced fails closed, which matches
`consumeApiQuota`'s existing 503-on-rpc-failure behavior, so no new
availability mode exists. Deploy order is code (dormant) -> migration 021 ->
env var; never the env var first.

Client honesty rode along: hourly-limit 429 and free-cap 402 previously
rendered as the coral error even though the player did nothing wrong and the
clip was never read. `lib/analyze-status.ts` maps 503/429/402 to the calm
unavailable state (server copy first), leaves 409 and everything else as
errors, and is unit-tested; `analyze-flow.tsx` lost its inline branch.

Share links went live the same session and the end-to-end check caught a real
D-049 bug: RLS policy subqueries run with the caller's privileges, and anon
has no grants on `share_links`/`analyses` (012 default-deny), so 019's
storage policy could never pass for the audience it was written for —
anonymous clip streams always 404'd, and owner-side testing masked it because
owners stream through their own-objects policy. Migration 020 routes the
check through a SECURITY DEFINER predicate (`clip_is_shared`) and covers
authenticated non-owner viewers too. 019, 020, and 021 are all applied to
prod and verified. The share status copy now names the 30-day lifetime
(pinned to the DDL by test), and dead links land on a bespoke
`app/share/[token]/not-found.tsx` instead of the default 404.

Known-inert, deliberately not fixed: the `games` table DDL still defaults
`team_a`/`team_b` to 'Us'/'Them' (003) — the client always sends explicit
names (D-051), and prod DDL churn while the deploy-integration misconfig
(HANDOFF "Open items" 4) is unresolved is the wrong trade. The post-cap
validation sequence lives in `docs/post-cap-validation.md`.

## D-055 — Player feedback on breakdowns: the flywheel signal, asked as usefulness

Eval labeling is the slow, expensive way to learn whether a breakdown was any
good (`evals/LABELING.md`, still unfinished). The player already knows, and
they know it at the moment they read it. Migration 022 adds
`analysis_feedback`: one row per analysis, owner-only RLS with the same
posture as `share_links` (D-049) plus an `exists()` check on the parent
analysis so a forged `analysis_id` is rejected at the RLS boundary rather
than only in the app. Writes upsert on `analysis_id`, because a player is
allowed to change their mind. No anon surface.

What it grades is deliberately narrow. Skill, environment, and subject are
all user-declared at upload, so the model is not classifying the skill; its
job is the technique read, the number, and the fix. The feedback therefore
grades the COACHING, not the classification: one boolean, and when it is
negative, which of three reasons (wrong player / off read / nothing usable)
plus an optional 500-character note. Wrong-player answers feed subject
detection (D-030, D-036), off-read answers feed the rubric and pointer cues,
and nothing-usable answers feed the fix generator. That is a real-usage
ground-truth stream that costs the player one tap.

The ask was originally "Did this breakdown nail it?" with a "Yes, nailed it"
affirmative. Reframed 2026-07-26 to **"Was this helpful?" / "Yes, helpful"**,
and the standing answer now reads back as helpful / did not help. Two
reasons: correctness is not the thing the player can actually judge (they
cannot see the rubric, so "did it nail it" invites them to grade the score
they were just given), whereas usefulness is exactly what they know; and
"nailed it" asks them to defend the app rather than report their experience.
The third reason chip moved from "Not helpful" to "Nothing I can use",
which under a usefulness question would otherwise restate the question. The
stored column stays `was_right` (022 is already written); only the ask is
framed as usefulness, and the semantics are close enough that existing rows
stay meaningful. Rename the column only if a migration touches this table
for another reason.

**Migration 022 must be applied for feedback to persist.** Until it is, the
widget renders and every submit returns "Couldn't save that."

## D-056 — A flawless rep reaches 100 (defect found and fixed)

The owner's ruling: 100 is real and attainable, not a number withheld on
principle. A rep with no correctable fault left across every checkpoint
should read 100.

Half of that shipped on 2026-07-23. `lib/ai/output-spec.ts` STANDARD was
remapped so the ceiling is a reachable 100: solid execution moved to 70-84,
standout to 85-93, and a new band reserves 94-100 for near-flawless to
flawless work, with an explicit instruction that a checkpoint which cannot
be faulted for this competitive-amateur population is a 100.

That change does not move the displayed number, and the reason is D-039 and
D-040 working as designed. The score is derived in code from pointer
verdicts, and the model's own numbers are discarded: `deriveResult` reads
only `pointers[].status`, and `deriveMetric` maps the met-over-visible
fraction onto `RAW_FLOOR = 30 .. RAW_CEILING = 95` (`lib/ai/pointers.ts`).
Every metric therefore caps at 95, the overall is a weighted mean of those,
so the overall caps at 95 too. All-pointers-met still displays 95. The
STANDARD prose that now describes a 94-100 band governs a number nothing
reads.

Fixed 2026-07-26 on the owner's instruction: `RAW_CEILING = 100` in
`lib/ai/pointers.ts`. D-040 stays intact, because this is not a curve. The
mapping is still linear, the floor is still a broken-fundamentals 30, and one
standard still serves every account (D-037). All that changed is where the top
of the line sits, and the tests that pinned 95 now pin 100.

The UI was already telling the truth the code did not: `score-ring`,
`metric-bar`, `radar`, and both share and analysis page titles have always
rendered "out of 100". `scoreBand` needs no change either, since Elite is
`>= 92` and remains reachable. The lasting lesson is narrower than the bug:
when scoring moved into code (D-039/D-040), the prompt prose stopped being
able to set numbers, so any future change to the scale has to touch
`pointers.ts` or it changes nothing that a player sees.

Two consequences to carry. The committed eval baseline
(`evals/BASELINE.md` at `cac170c`) was measured against the 95 ceiling, so its
band-agreement figures are no longer comparable and need a re-run before they
are cited again. And the STANDARD prose remains worth keeping despite grading
nothing directly: `raw.overall_score` is still the fallback when no checkpoint
was observable at all, and `rep_scores` are still the model's own numbers, so
the prose governs both.

## D-057 — Sharing is a read-only link, not an image

Shipped and then reverted inside one day, recorded because the reasoning
should not have to be rediscovered.

The share export originally drew a single summary card (score + priority
fix) to an image. On 2026-07-23 it was widened to render the entire analysis
to a dynamic-height image: header, score, full summary, every metric with
bar and note, all fixes with expected gain and timeframe, and the drills.
Then the whole image path was removed in favor of the token link that
already existed (D-049): `ShareLink` -> `/share/[token]`, opened by anyone
without an account, showing the breakdown and the clip, editable by nobody,
with raw frames never shared. `ShareCard` and both its usages are gone.

Why the link wins: the image duplicated the entire breakdown renderer in a
second medium that has to be kept in sync by hand, it could not carry the
clip (which is the thing worth watching), and it cannot be revoked once
sent, whereas a token link is revocable and 30-day-expiring by DDL. The
link also stays truthful when the analysis is re-read, and one renderer
means one place for a copy or layout fix.

## D-058 — Vollyio

The product is Vollyio, on vollyio.com. Every brand string across app,
components, lib, docs, and the project skills was rewritten, the public film
assets and the launch teaser renamed, the commercialization report retitled,
and the production URL repointed off the vercel.app subdomain. The package
name, the localStorage keys, the service worker cache name, and the script
temp-dir prefixes moved too.

Two migration notes. The service worker deletes any cache that is not the
current one on activate, so the cache rename self-cleans. The localStorage
rename does orphan existing client state: an in-progress scoreboard match
resets once, accepted knowingly.

Left alone on purpose: `archive/` (historical material, documented as such),
the pinned sha256 vector in `lib/share-token.test.ts` (cross-checked against
migration 019, not a brand string), and the perception env plus repo
filesystem paths in the frozen cv scripts.

Alongside the rename, the breakdown got a legibility pass: metric labels and
scores, cue justifications, the summary, and the clip/frame viewer all
enlarged (clip column 34rem -> 42rem), and the global base font-size raised
to 106.25% on `html` so Tailwind's rem sizing scales type and spacing
together from one number, with `text-size-adjust: 100%` stopping mobile
browsers from re-inflating on top of it. A `w-full` height-auto video
collapses to zero height on iOS Safari until it plays, so the clip element
carries a mobile min-height (dropped at sm and up) with `object-contain`.
And the no-em-dash rule became structural: 110 em dashes were removed across
11 files and `scripts/lint.mjs` now fails the build on one anywhere in
scanned source, in copy or comments alike. It is a house rule now, not a
copy review note.

## D-059 — The post-012 grant leak: new tables inherited TRUNCATE

Found by reading live grants against the contract this file claims, not by a
test. Migration 012 wrote its forward-looking default as:

    alter default privileges for role postgres in schema public
      revoke select, insert, update, delete on tables from anon, authenticated;

Four privileges, and Postgres has more than four. TRUNCATE, REFERENCES, and
TRIGGER stayed in the inherited default set. Pre-012 tables were unaffected,
because the same migration also ran `revoke all on all tables`. Every table
created AFTER 012 inherited those three for both `anon` and `authenticated`:
`share_links` (019) and `analysis_feedback` (022). Both of those migrations
carry a comment asserting "012's default-deny leaves new tables ungranted",
which was true only of the four privileges 012 happened to name.

TRUNCATE is the one that matters, and not because of what it deletes.
**TRUNCATE bypasses row security entirely.** RLS is this product's whole tenant
boundary (see the top of `docs/security.md`), so a privilege that ignores RLS
on a table holding every account's rows is a hole in that boundary by
definition, whatever today's reachability happens to be.

Reachability today is nil, which is why this is repair and not an incident:
PostgREST exposes no TRUNCATE verb and no arbitrary SQL, so there is no request
that reaches the privilege. It mattered anyway, because the next SECURITY
INVOKER function with a dynamic statement, or any future SQL-adjacent surface,
would have made it reachable, and nothing in the repo was watching.

Migration 023 fixes both halves: it widens the default revoke to `revoke all`
so no future table inherits anything, and it strips the three privileges from
the two tables that already had them. Column-scoped grants are untouched, and
verified so after the fact: `share_links` still has table SELECT plus INSERT on
(`analysis_id`, `token_hash`, `user_id`) and UPDATE on (`revoked_at`);
`analysis_feedback` still has SELECT, INSERT, UPDATE. `anon` now holds nothing
on either.

Applied to production 2026-07-26 and verified by re-reading
`information_schema.role_table_grants` and `column_privileges`.

The generalizable lesson, and the reason this is a numbered entry rather than a
commit message: a revoke list that names privileges is a denylist, and it
silently stops being correct as soon as the set of privileges is larger than
the list. `revoke all` is the allowlist form. Any future default-privileges
statement in this project uses `all`.

## D-060 — Middleware must not be able to take the site down

Production had been throwing, at low volume, since 2026-07-07:

    Error running the exported Web Handler: Error: Your project's URL and Key
    are required to create a Supabase client!    route=/middleware

`proxy.ts` read its configuration as `process.env.NEXT_PUBLIC_SUPABASE_URL!`.
The `!` is an assertion to the type checker, not a runtime guarantee, so an
absent or empty variable handed `undefined` to `createServerClient`, which
threw. The proxy matcher covers nearly every path, which makes the blast radius
total: the landing page, `/login`, `/signup`, `/privacy`, and every share link
500 together, and none of them need a session at all. A configuration mistake
should cost the authenticated surface, never the public one.

The same shape sat one layer down. `getClaims()` was wrapped in try/catch but
the `getUser()` fallback was not, so an auth-service blip or a rejected token
propagated out of the middleware with the identical whole-site result. The
second observed production error, PGRST303 "JWT issued at future" (clock skew
between the token and the database), is exactly the class of transient that
reaches that path.

The fix keeps the security property intact by collapsing two states into one.
`lib/route-guard.ts` decides routing from `userId: string | null`, and a missing
configuration, a failed verification, and a genuine visitor all arrive as
`null`. That is fail-closed by construction: a protected path with no verified
user is always redirected to `/login`, so an unconfigured deployment cannot
serve protected content. There is deliberately no separate "unconfigured"
branch, because such a branch is where a fail-open bug would eventually live.
Public paths pass through and keep rendering.

Extracting the decision also made it testable without a request object, which
is the reason the guard is in `lib/` rather than inline: four cases now pin the
behavior, including the regression itself.

Not fixed, and deliberately: the PGRST303 skew error is PostgREST validating a
token's `iat` against the database clock. Nothing in application code can
correct it, and it now degrades to an unauthenticated request rather than a
crash, which is the right outcome for a token this server cannot trust.

## D-061 - The frame budget follows the movement, amending D-041

D-041 deleted the motion-picked sampler on evidence: sparse coverage scored a
standstill jump as an approach jump, because the sampler guessed which moments
mattered and left gaps everywhere else. That finding stands and this does not
reopen it. Coverage remains continuous end to end; only the stride varies, and
`lib/frame-plan.test.ts` pins the guarantee that earns the right to move frames
around: no part of any plan is sampled sparser than spreading the old 40-frame
budget evenly over the same window would have been.

The forcing argument is arithmetic. An attack needs about three seconds to show
approach through landing, which spread evenly is 75ms per frame, while the
swing from cocked to contact runs 120-160ms and needs four or five frames
before its sequence reads as motion rather than a slideshow. Evenly spread, the
swing gets two. No per-skill window tuning fixes that while the stride is
constant, so "score the mechanics" and "uniform stride" could not both be true.

`lib/frame-plan.ts` holds a profile per skill (window in whole seconds, the
contact phase to protect, and where contact sits when the player marked no
instant) and allocates in a fixed order that makes the guarantee structural
rather than incidental. Reserve the edges first at uniform-40 density. Give the
core whatever remains, at the source's own frame rate. Then trim the core, and
only the core, until the plan fits the pixel pool. The edges are the guarantee
and the core is the upgrade, so the upgrade is what yields. An earlier attempt
capped the core at 30fps instead, and it inverted on short high-fps windows
where a fixed core came out coarser than uniform would have been.

The core is anchored on the marked instant when there is one, since that is the
moment the player chose. Core frames are `burst` and edges are `context`, which
makes the existing over-budget backstop in `finalizePlanned` degrade in the
right direction: it thins the approach and never the contact.

MAX_FRAMES moves 40 to 64 and costs no extra request budget, because pixels now
vary by role exactly as stride does. Contact frames keep 1024 where hand shape
and elbow lead must be legible; approach and recovery frames render at 640,
where the question is only where the athlete is and what the body is doing. So
64 frames occupy the pixel pool 40 already spent. Migration 025 moves the
database ceiling in the same change, because raising the app constant alone is
D-046 exactly: a dense clip read, billed, and only then rejected at the insert.
`lib/security-contract.test.ts` now resolves the newest migration defining
`enforce_analysis_insert_limit` instead of pinning 017 by filename, which was
that same drift waiting to happen a second time.

Two limits are measured rather than assumed. Source frame rate comes from
`requestVideoFrameCallback` (`detectSourceFps`), since sampling finer than the
source only re-decodes the same image; Firefox has no such API and falls back
to 30. `fpsFromSamples` is split out so the arithmetic is testable headlessly,
and it abstains on a stalled clock, a backwards seek, or too few frames instead
of inventing a rate. And no region is planned denser than the frames it
actually contains.

Three defects the tests caught before this shipped, all of which would have
degraded coverage silently. A region planned denser than the source, whose
duplicate filter then stripped the region and tore a 0.41s hole. A float error
where a 0.1s tail arrives as 0.09999999999999998 and a bare `floor()` drops a
whole frame, turning a 33ms stride into 50ms. And the pixel pool not
constraining the allocator, so a 60fps source produced a plan costing 43.7M of
41.9M pixels, which the over-budget fallback would have silently trimmed.

Verified against a real clip (3840x2160 h264, 60.12fps): every skill beats
uniform-40 at every point, attack running a 29ms core against a 74ms approach
where uniform was 75ms throughout, at 98-99% of the pixel pool. Windows are
whole seconds. Omitting the skill falls back to the original uniform pass, and
a window too long to carve a worthwhile core out of degrades to it too.

## D-062 - Marking the athlete is required, and video is the only input

Reverses the "never a dead end" half of D-033 and D-036. The framing card used
to offer "Analyze without marking a player" underneath the primary button, on
the reasoning that the model would choose a subject and report `subject_check:
unmarked`, so the player always had a way forward. In practice that path
produces the one failure the product cannot absorb: a confident, detailed
breakdown of somebody else's rep. The player has no way to tell a wrong-subject
read from a harsh one, and every downstream number (the rating EWMA, the
priority-fix loop, the goal progress) inherits the error silently.

So the mark is now mandatory, and the three ways around it are closed:

1. The skip button is gone. The primary button stays disabled with the reason
   spelled out until a tap lands, and the coach-spotted candidate list (D-036)
   remains the assist that makes the tap cheap.
2. A clip this browser cannot render an opening frame from is now a hard stop
   with a named cause, not a silent fall-through to unmarked extraction. That
   fall-through was the real leak: the one case where marking was impossible
   was exactly the case that skipped it. The message names HEVC and Safari,
   matching `videoErrorMessage`, because the failure is a property of the
   browser the player is standing in and not of their clip.
3. Photos are no longer an input at all. `extractFramesFromPhotos`, the hidden
   photo input, and the still-image branch of the gallery picker are removed;
   `analyzeRequestSchema` narrows `source` to the literal `"video"`. A still
   sequence carries no ring marker and no scrub timeline to place one on, so
   "marking is required" and "photos are accepted" cannot both be true. The
   database check constraint still allows `photos` because stored rows predate
   this; nothing new can create one.

`subject_check` keeps rendering "unmarked" for older rows. The model still
reports it, and a mismatch verdict is still the loudest thing on the results
page, because a mark tells the model who to watch but does not guarantee it
obeyed.

## D-063 - The marketing film assets are re-rendered, not just the code that makes them

Two claims the code gates cannot see were shipping in pixels. The film-room
clip carried "SIDEOUT - FILM ROOM" burned into the frame, rendered 2026-07-20
from a component whose caption was renamed a week later. The hero loop drew a
green pose skeleton with joint dots and a tracking box over the athlete,
rendered 2026-07-14, before D-033 removed on-device pose estimation from the
product and `landing-cinematic.test.ts` started pinning "the mark is a ring,
not a skeleton" against `film-scene.tsx`.

Both components were correct. Both assets were stale. Every gate passed the
whole time, because `npm run lint`, `tsc`, and 151 tests read source, and the
lie was in an mp4.

Both variants are re-rendered from the current `film-scene.tsx` via
`scripts/render-hero-film.mjs`: `VARIANT=ambient` to `vollyio-hero-loop.*` and
`VARIANT=film` to `vollyio-court-vision.*`, posters at frame 186, which is
inside the 22%-to-100% window where `film-ring-in` holds the ring at full
opacity. The hero now shows what the product does: a tap pulse, a gold ring
around the chosen athlete, and a "watching" tag. No box, no skeleton, no
projected ball path.

Render against a PRODUCTION server, never `next dev`. The first pass was
captured off the dev server and baked the Next.js dev-tools badge into the
bottom-left of all 300 frames. The script drives Chrome by CDP and screenshots
whatever the page paints, so anything a dev build overlays becomes part of the
asset. `npm run build && npx next start -p 3002`, then `SITE_URL` at that port.

The gap this leaves open: a rendered asset can contradict a decision entry and
nothing will fail. Re-render both variants whenever `film-scene.tsx`, the
brand name, or the analysis overlay changes, and treat "did the assets get
re-rendered" as part of any change to what the product claims to measure.

## D-064 - Three a month replaces one forever, and one function is the only thing that can make a player pay

D-029 left billing unable to move in either direction. The enforcement half
was real and atomic: `reserve_analysis_entitlement` would refuse a free
account any analysis after its first, ever. The commerce half was absent, and
`profiles.plan` had no writer at all, because migration 012 revoked the column
from `authenticated` and nothing replaced it. So `BILLING_ENABLED=true` was a
trapdoor rather than a flag, and `lib/billing.ts` answered it with a two-key
gate: enforce only when the flag is set AND an upgrade destination exists.
That gate was a promise that the second key would eventually be real. This
entry is the work that makes it real, and the boundaries that work had to
respect.

**Lifetime-one becomes 3 a month free and 18 a month Pro** (migration 026).
Lifetime-one was never a plan. It was containment: one analysis per account
meant a farmed signup was worth one analysis, and that property was carrying
weight the signup flow does not carry on its own. Giving it up is what section
6 of `docs/billing.md` is about, and the owner's call is recorded there rather
than relitigated here. What is settled is the shape: an allowance is per plan,
resolved inside the same advisory lock that already serialized the check, and
compared against a count. Nothing about the D-012 reservation machinery
changed. Only the question it asks did.

**The window is the UTC calendar month, not the subscription anniversary.**
An anniversary window is the one the payment provider knows and the database
does not. Answering "how many do I have left" would mean asking the provider
for the current period boundaries, so a provider outage would take the counter
down with it, and a player sitting between a failed renewal and a successful
retry would have no defined window at all. Worse, the number the player sees
would depend on a remote system that has no reason to be up when they are
about to film. The calendar month is computed from the server clock inside
`private.allowance_window`, never passed in, and it agrees with
`analyze_usage_month()` (migration 021), so the per-user counter and the
platform spend backstop measure the same month rather than two overlapping
ones. It also makes "when do I get more" a date a player can read off a
calendar instead of a fact about their own billing history. The cost is real
and accepted: subscribe on the 28th and you get 18 for three days, then 18
again on the 1st. Charging on the anniversary while metering on the calendar
is the trade, and the alternative trades a durable local answer for a remote
one.

**The count reads completed analyses, never attempts.** A row in `analyses`
is inserted only after the coaching call returned and parsed, so counting rows
means a clip that fails, times out, or hits a capacity outage costs the player
nothing, and there is no refund path to get wrong. This falls out of the
existing insert ordering rather than being bolted on, which is exactly why it
is written down here and in the migration comment: the property is one
refactor away from being lost, and the failure would be silent and would land
on the player, who would have paid an analysis for an error that was ours.
Counting reservations or requests would also collapse the allowance into the
abuse quota, and section 2 of `docs/billing.md` is explicit that those three
walls stay separate.

**The plan writer is `service_role` only** (migration 027). AGENTS.md says
player-editable metadata never decides authorization or billing entitlement,
and `profiles.plan` is the sharpest test of that rule in the product: if the
account could write the column that describes what the account may spend, one
data-API call would grant 18 analyses a month and every other control would
still pass, cheerfully. `set_subscription_plan` is `security definer` with
`search_path = ''`, revoked from `public`, `anon`, and `authenticated`, and
granted to `service_role`. The signature-verified webhook is its only caller.
That is also the reason a service-role key now exists in the deployment at
all, which is the largest single change to the security posture here:
`lib/supabase/service.ts` is the only module that holds it, the webhook route
is its only importer, and `docs/security.md` records that a second importer is
a security change and not a refactor. The verification steps that prove a
player cannot write their own plan live in that file's billing section, and
they are steps to run rather than claims to trust.

**No payment SDK.** The integration is two POSTs and one HMAC: `fetch`
against the provider's form-encoded API to mint the checkout and management
pages, and `node:crypto` to verify the webhook. The vendor SDK is a large
transitive tree carrying an API-version coupling, its own retry behavior, and
telemetry this app never asked for, against a dependency budget that is
deliberately small and gated (D-001 section 10.5), and it would have to clear
that gate on necessity alone. It does not: `lib/stripe-sign.ts` is pure and
unit-tested, which is more than the SDK's verifier can be from inside our test
run. There is a second reason that matters more. On the one route where
getting verification wrong means anyone on the internet can set anyone's plan,
the verification should be code we can read.

**Cancel takes effect at period end.** The cancel click does not map to
anything. A subscription cancelled at period end stays active until it gets
there, and it is the subscription-deleted event that maps to `free`. So a
player who cancels on the 3rd keeps Pro for the month they already paid for.
Ending access at the click would be taking back something already bought, at
exactly the moment the player is deciding what to think about us. The
follow-on is stated in `docs/billing.md` section 7 and should reach the cancel
confirmation rather than being discovered: their Pro-era analyses that month
still count against the 3 they drop to.

What is NOT built, so nobody reads this as a finished feature:

- **No provider objects exist yet.** No product, no price, no webhook
  endpoint, no keys. `BILLING_ENABLED` is unset, so nothing is metered and
  every account is effectively unlimited right now, and `stripeConfigured()`
  is false, so the plan card renders an honest "not switched on" state instead
  of a button that would 503. The code path is complete; the account is empty.
- **Neither billing route consumes an atomic quota.** The scope list in
  `consume_api_quota` is fixed in SQL and holds no billing scope, and
  borrowing `analyze` would charge a player analyses for pressing upgrade.
  A signed-in player can therefore loop checkout. Recorded in
  `docs/security.md` under request and cost controls with what closing it
  costs.
- **The "already on Pro" check is read-then-act.** The stored plan only turns
  `pro` when the webhook lands, so two upgrade clicks seconds apart both pass
  and both mint a session. If the player completes both, that is their money.
  A billing quota, an idempotency key, or a post-payment state on the plan
  card each fix a different part of it; none is built.
- **The configuration gate is two keys wide and the feature needs three.**
  `stripeConfigured()` checks the API key and the price, not the endpoint
  secret, so a deploy holding the first two renders a live upgrade button and
  then rejects every event the provider sends. The player is charged, the plan
  is never written, and they cannot reach the portal to cancel because the
  portal keys on a customer reference only the webhook records. `docs/security.md`
  step B0 has the ordering that avoids it; widening the predicate is the fix.
- **Nothing reconciles the stored plan against the provider.** The webhook
  applies whatever the newest delivery says, deliveries are not ordered, and a
  redelivered stale event can therefore overwrite a newer one with no further
  event coming to correct it.
- **`profiles.stripe_customer_id` has no unique index**, so two profiles
  holding the same customer reference would resolve arbitrarily.
- **Deleting an account does not cancel the subscription.** A player can
  delete themselves and keep being charged for a product they no longer have.
  That is the most user-hostile gap on this list and it should not survive the
  first paying customer.
- No dunning, no proration, no annual price, no trial, and no user-facing
  "you are out of analyses" email. Players find out in the app, at the moment
  it matters, which is section 5's call and stands.
- The owner alert covers the spend backstop tripping. The other half of
  section 5, the provider reporting credits exhausted, has no alert.

## D-065 - The billing review found five ways to take money and deliver nothing

Six agents built the billing surface in parallel and a reviewer read each slice
against auth, secrets, fail-closed, entitlement integrity and correctness. It
returned eleven blocking findings. Five of them were the same shape: a path
where the product could charge a player and then fail to give them anything, and
each one passed every gate the repo had.

`stripeConfigured()` gated on the secret key and the price and not on the
endpoint secret, which the same module owns. A deploy with two of the three
shows a working upgrade button, takes the card, and then rejects every webhook
forever: the plan never becomes pro, the customer id is never recorded, and
because the portal needs that id the player cannot even cancel what they are
being charged for. A missing environment variable has to deny the sale.

The checkout route sold Pro without consulting `shouldEnforceFreeTier()`. With
the free cap switched off, which is its state today, a subscription buys
literally nothing, because an unenforced allowance is already unlimited. The
route now refuses unless the thing being sold is the thing being enforced.

Webhook delivery is not ordered, and the write was idempotent for duplicates
only. A cancellation and the update that preceded it can arrive either way
round, so a stale "still active" event landing second restored a subscription
the player had already ended. `set_subscription_plan` now takes the event
timestamp, compares it under an advisory lock against the newest one applied,
and refuses to move a plan backwards. It still records the identifiers from a
stale event, because dropping the customer id over an ordering accident is how a
paying player ends up unable to reach the portal.

`past_due` mapped to free while `invoice.payment_failed` deliberately did
nothing. That is one policy stated twice and disagreeing with itself: the same
failed renewal downgraded or did not depending on which event carried it. The
provider retries a failed charge for days and most retries succeed, so
`past_due` now keeps access and only `unpaid` and `canceled` drop it.

The two payment routes had no atomic quota, which AGENTS.md requires before any
paid or high-amplification call. They were the only mutating cookie-
authenticated routes in the repo without one. Reusing the analyze scope would
have let opening plan settings eat an analysis, so migration 028 adds a
`billing` scope at 10 per hour.

The finding worth the most was not in this work at all. `analyses.telemetry` is
inserted by the analyze route using the PLAYER'S credentials, so migration 016
had to grant `insert (telemetry)` to authenticated and nothing can tell the
server apart from a client posting its own numbers. `analyze_usage_month()` sums
that column, the budget guard prices the sum, and a tripped budget returns 503
to every player. One account writing an absurd token count could therefore take
the whole product offline, and after this change it would also have spammed the
owner alert. Migration 028 bounds each field far above any real analysis and far
below anything that could move a monthly total. That is a bound, not a fix: the
fix is for the server to write telemetry with credentials the player does not
hold, and that belongs in its own change to the analyze route.

What this says about the method: parallel agents produced a working surface
quickly and every one of them wrote code that passed lint, types, tests and the
build. The defects were all in the seams between slices, in what one agent
assumed another had handled. The review pass was not a formality, and neither
was reading its findings rather than trusting the green gates.

## D-066 - Open first, premium optional: selling and capping are two switches

D-029 fused them, and the fusion was invisible until the product tried to
launch. `BILLING_ENABLED` turned on the free cap AND the purchase path at the
same time, and the checkout route refused to sell unless the cap was enforced,
on the reasoning that a subscription buying an allowance nothing applies is a
subscription buying nothing. That reasoning is sound and the conclusion was
still wrong, because it left exactly two reachable postures: a closed product
that sells, or an open product that cannot.

The posture the product actually wanted is neither. Be open on day one, and let
a player decide for themselves whether to go premium. Nobody is refused a rep,
and anyone who wants the paid plan can take it.

So there are two variables now:

    BILLING_ENABLED    the purchase path exists at all
    ENFORCE_FREE_CAP   the monthly allowance actually refuses a rep

`billingOpen()` reads the first, `shouldEnforceFreeTier()` requires both plus an
upgrade destination, and checkout gates on the first rather than the second. The
D-029 trapdoor survives inside the second, where it belongs: a cap with nowhere
to pay still never engages, because refusing a rep is only fair when the player
can do something about it. `ENFORCE_FREE_CAP` unset parses to false, so the safe
default is the open one and forgetting the variable can never be the thing that
starts refusing work.

What this cost, and it is the part worth being honest about: while the cap is
off, Pro genuinely does not buy more analyses, because free is already
unlimited. The plan card says that in as many words rather than implying a limit
that is not there. Someone upgrading in this window is buying the plan early and
keeping the product running, and the copy has to say so, or the first support
question is why they were charged for something they already had.

`lib/billing.test.ts` walks the whole two-by-two-by-two table and asserts the
property that matters directly: a player is never refused a rep in a
configuration where they could not have bought their way past it.

## D-067 - A border can be decoration or it can be the affordance, and 12% chalk cannot be both

`--color-line` was one token doing two unrelated jobs. As a divider or a card
edge it is exactly right: chalk at 12% is a hairline that catches light without
drawing attention, and the whole navy surface depends on that restraint.

The trouble is that `.btn-ghost` and `.input-field` have no fill of their own.
Their background is the surface behind them, so that same hairline is the only
thing on screen saying a control is there. Measured against the three surfaces
the app puts controls on, it lands at 1.40:1 on navy, 1.41 on navy-light and
1.38 on navy-lighter, against the 3:1 that WCAG 1.4.11 asks of a component
boundary you need in order to identify the component. Text contrast was never
the problem here and still passes everywhere; this is the non-text rule, which
a contrast pass that only samples text will not catch.

`docs/ui.md` opens by promising the app works for a first-time smartphone user
without instructions. A secondary button that is invisible on a bright phone at
a sunlit court fails that promise before any copy is read.

So the token splits by job rather than by shade. `--color-line-control` is
chalk at 41%, the lowest value clearing 3:1 on all three surfaces (3.54 on
navy, 3.32 on navy-light, 3.03 on navy-lighter, which is the binding one), and
it is applied only to things you press or type into. Everything
decorative keeps `--color-line` untouched, so the restraint survives where it
was doing real work.

The split turned out to say something the single token could not. `.tag` and
`.chip` were near-identical rings, one a static label and one a button; they
now differ, and the heavier edge reads as "this does something". That is a
better system than the one that was replaced, not just a compliant one.

Also removed here: `--color-gold-dim`, declared since the palette landed and
referenced by nothing. Every dimmed gold in the codebase goes through the
`color-mix` idiom instead, which is what this doc already required, so the
token was an invitation to do the thing the token-purity rule forbids.

## D-068 - Reading text and label text were the same size, so the app read like a control panel

The root font-size is already tuned up to 106.25% specifically so type and
spacing scale together, and the comment on it says to bump that one number to
scale everything. That lever was doing its job. The problem was underneath it:
`text-sm` was the app's most-used size at 155 call sites against 8 for
`text-base`, and it was carrying both the labels and the prose. At the tuned
root it renders 14.88px, which is under the mobile body floor and, worse,
identical to the chrome sitting next to it. A coaching note read like a field
label because it was set like one.

`docs/ui.md` promises a 13-year-old can operate this without instructions. The
sentences that do the actual teaching were the ones set smallest.

So there are two semantic sizes now, and only two, because those were the two
strings that kept getting retyped:

`text-body` is prose a player reads. 1rem, 17px at the current root, with the
line height set to exactly `leading-relaxed` so the sites that already carried
that class are byte-identical and the ones that did not simply gain it. It went
on 47 places: coaching notes, drill steps, page descriptions, empty states,
consent copy, and the coach's own chat answers, which were the single most-read
surface in the product and were the size of a caption.

`text-page-title` is the h1 of a top-level destination. Its values are exactly
`text-3xl font-bold tracking-tight`, so adopting it on all 14 page titles moved
no pixels at all. That is the point. D-067 had just finished repairing coach,
goals and scoreboard by hand after they drifted to `text-2xl`; a four-class
string retyped per page will drift again, and a single token cannot.

Everything else stays on the stock scale. `text-sm` and `text-xs` are still
right for labels, counts, meta, and the deliberately dense analytics widget,
and they were left alone there on purpose. The rule is about the job the text
does, not about banning a class.

Two things were deliberately not touched. The legal pages set their prose at
0.9375rem (15.94px); that is a rounding-level gap rather than the defect here,
and both files were mid-edit in another session. And the root font-size was
left at 106.25%, since raising it would have inflated the chrome along with the
prose, which is the exact conflation this decision is trying to undo.

## D-069 - Six things the site told a buyer that the code did not do

An adversarial review of the whole product went looking for the reason nobody
has bought it and found, on the way, that the paid surface was making claims
the code contradicted. These are not conversion problems. They are a live
subscription describing itself incorrectly to the person paying for it, and
they are fixed here as a group because they share one cause: the paid path was
built in a hurry after the free one, and each surface was written against the
posture its author had in mind rather than the one the code was in.

**The structured data said the product was free.** `app/page.tsx` published a
single `Offer` at `price: "0"` to every search and answer engine while a $14.99
auto-renewing subscription was on sale. That is the claim that reaches a parent
before any page does. It is now an `AggregateOffer` carrying both tiers, priced
from `lib/plans`. The same block advertised "Coach chat" in `featureList` while
the feature is gated behind `COACH_ENABLED` and its route 404s when that flag is
off, so it has been removed rather than promised conditionally.

**The paying state was the one state that disclosed nothing.** In
`components/plan-card.tsx` the renewal and cancellation sentence sat inside
`{!metered && ...}`, so the moment a player was actually going to be charged on
a recurring basis was the moment the card stopped mentioning that it recurred or
how to stop it. California's ARL asks for that disclosure before the purchase.
It is now unconditional, and only the genuinely posture-dependent sentence
("limits are not switched on yet") remains behind the flag.

**Nothing recorded assent.** Neither purchase surface linked the terms and the
checkout collected no consent, while the terms page asserted "you agreed to this
when you checked out." The hosted page now carries the renewal terms and a link
via `custom_text`, and the plan card links the terms above the button. The
stronger form, `consent_collection[terms_of_service]`, is deliberately NOT used
yet: it requires a Terms of Service URL configured in the provider dashboard,
which cannot be written through the API, and a missing URL makes session
creation ERROR rather than degrade. Set that URL, then switch, in one line.

**Deleting an account could leave the subscription charging.** This is the
serious one. `app/api/account/delete/route.ts` guards against deleting a live
subscriber, and a twenty-line comment above the guard explains that it is "the
one thing standing between 'I deleted my account' and a recurring charge with no
way to stop it from inside the app." The read under that comment discarded its
`error`. An unreadable profile therefore produced `billing = null`, which made
the `pro` check false, which waved the request past the guard and deleted the
account while the card kept being charged, logging a clean success. A transient
failure was sufficient. The read now fails closed with a 503; a genuinely absent
profile still proceeds, because `maybeSingle` reports that as null data with a
null error and there is no subscription to orphan in that case.

**A promise about minors that nothing asked about.** The terms require a parent
or guardian to be the one who starts an under-18 subscription. No surface asked.
`PlanAction` now takes an `attestation` and the upgrade button is disabled until
it is ticked. A checkbox is not identity verification and does not pretend to
be; it is the difference between a promise nobody is ever asked to make and one
they are.

**Nobody was named.** The terms had no counterparty, no governing law and no
forum. There is now a section stating that the service is operated as a sole
proprietorship based in California, that California law governs, and that
undisputed matters belong in Sacramento County, with small-claims rights
preserved. The operator's personal address and phone are deliberately NOT
published here: they are being removed from the payment provider's public
profile for the same reason, and a business address is the right answer rather
than a home one.

Also here: `scripts/eval-label-plan.mjs`. Coverage reports 852 unlabeled cases,
and `label-case.mjs` with no argument walks all of them, which at the two
minutes a case that LABELING.md budgets is a 28-hour job. That is why it has sat
at 0 rather than because it is hard. The planner proposes a stratified 18, about
36 minutes, balanced across all six skills, deterministic so a half-finished
session resumes cleanly. The accuracy gate never needed 852 labels.

## D-070 - The analyze tier moves to Opus 5, and the default it stopped inheriting

`ANALYZE_MODEL` is now `claude-opus-5`, up from `claude-opus-4-8`. `ANALYZE_EFFORT`
stays `low`. `COACH_MODEL` and `COACH_EFFORT` are untouched.

**The price per token does not move.** Opus 5 bills $5 in / $25 out per MTok, the
same as the 4.8 it replaces, so the ~$0.21-per-analysis unit economics and the
$25 spend backstop keep their arithmetic. `lib/ai/pricing.ts` gains a row rather
than swapping one: telemetry written before this change carries the 4.8 model
string, and `estimateCostUsd` throws on a model with no row, so deleting 4.8
would turn the month-to-date spend read into an exception over history instead of
a number.

**The reason to keep stating `thinking` explicitly inverted.** On Opus 4.8 the
parameter was load-bearing because the tier ran with no reasoning at all when it
was absent, which is what D-027 recorded. On Opus 5 the default is the opposite:
omitting `thinking` runs adaptive. `app/api/analyze` and `app/api/players` both
name it, so neither changes behaviour here — but the comment justifying it did,
and a comment that states a false reason is worse than none, because the next
person deletes the line when they find the reason no longer holds.

**`app/api/eval/route.ts` silently gains reasoning.** D-027 left that route
inheriting no `thinking` and no `effort` deliberately, on the argument that
judging is where more reasoning helps. Under 4.8 that inheritance meant no
reasoning and effort `high`; under Opus 5 it means adaptive reasoning and effort
`high`. The route now spends more per case than it did, and it moves toward — not
away from — the production call shape it claims in its own comment to be
measuring. Left as-is because it is the direction D-027 wanted, but it is a
behaviour change nobody typed, which is the kind that goes unnoticed.

**Carried forward unmeasured, and named as such.** Two things are asserted rather
than measured. `ANALYZE_EFFORT = "low"` comes from a 2026-07-20 grid run against
Opus 4.8; the flat-to-inverted cost ladder that justified it has not been
re-measured on Opus 5. And `max_tokens: 4096` on the analyze call caps thinking
plus response text together, against a model that writes longer than its
predecessor — a truncated response returns a null `parsed_output` and the route
answers 502. The structured-output schema bounds the text, which is why this
ships without raising the ceiling, but the first real analyses on this model are
the measurement, and a 502 rate that appears now has an obvious first suspect.

## D-071 - The daily loop was a button, and the XP behind it was a text field

Two problems that only look separate. The daily challenge picked a drill by
hashing the whole catalog against the player and the date, so it was real
content chosen at random rather than chosen for them; and completing it was a
bare button that inserted an `xp_events` row the client itself was granted
permission to write. A product that refuses to claim a trend without four reps
and two days of movement was handing out 75 XP for a click.

**What today is now chosen against.** `lib/daily-assignment.ts` targets, in
order of authority: the checkpoint the last breakdown actually named, then the
lowest rating on the board, then a stable rotation. Only the last of those is
not evidence, and the card says so rather than implying a diagnosis, which is
why `Assignment.targeted` exists as a field instead of a vibe. Drills are then
narrowed to ones that train that exact checkpoint via `drillsForMetric`, and
the pick inside the narrowed pool stays FNV-1a on (user, day) so a refresh
never reshuffles work already started.

**The metric it targets is not where you would look for it.** `priority_fix`
has a `target_metric` field and it is NULL on all 19 stored rows; the real key
lives at `changes[0].target_metric`. Selecting the obvious one would have
compiled, passed review, and silently targeted nothing forever.

**Court-free is not a nicety.** Roughly half a teenager’s days have no gym in
them, and a streak that only survives on court days is a streak designed to
break. Both variants are computed server-side because both are pure functions
of state already in hand, so offering the alternative costs nothing and needs
no round trip.

**XP is now earned.** `public.award_xp` (036) takes a reason and NEVER an
amount: the price is decided server-side, and then the work behind the reason
is verified to exist and belong to the caller. Without that second half,
`award_xp('goal:' || gen_random_uuid())` in a loop is unlimited XP. The day key
is checked against the server clock and accepts only today or yesterday,
because the streak walk only looks at which calendar days carry events, so a
backfilled key is indistinguishable from a day actually trained.

Shipped expand/contract: 036 only adds, 037 carries the revoke and goes on
after the deploy. Neither plain order is safe on its own.

## D-072 - One plan per week, claimed before it is paid for

The weekly development plan is the first feature with a real marginal token
cost (~/usr/bin/bash.02), so the failure mode to design against is not a bad plan, it is a
plan generated on page view. That turns one call a week into one per visit and
silently rewrites the week under a player trying to follow it.

The week is therefore the primary key, and generation is a RESERVATION rather
than a write-when-finished: `reserve_weekly_plan` claims the row BEFORE the
model is called, so two clicks or two tabs spend once between them. A claim
that is never filled expires after ten minutes, because a crashed generation
must not lock a player out of their own week until Monday, and
`release_weekly_plan` hands it back immediately on a caught failure.

The prompt carries four constraints that are not stylistic: no calorie, macro
or supplement advice, at least one rest or mobility day, no loaded barbell work
or one-rep maxes, and no hard jump-loading on consecutive days. The users are
13 to 18 and skeletally immature. `lib/weekly-plan.test.ts` asserts all four
are present in the generated prompt, so a refactor that drops them fails the
suite rather than shipping.

Generated slugs are validated against the catalog and nulled when unknown: an
invented slug renders as a dead card forever, and losing a link is better than
losing the day.

## D-073 - One age floor, no guardian clause

The product now states a single minimum age of 13 and nothing else. Signup asks
the player to confirm it, the terms state it, and the sentence that used to read
"if I am under 18, a parent or guardian consents" is gone from both.

Thirteen is not arbitrary. COPPA attaches below it, and this product collects
video OF the user, which is about as identifying as personal data gets. A floor
at 13 keeps that regime out of scope. No floor at all would leave the product
with no answer whatsoever when a twelve-year-old uploads footage.

The guardian clause went because it was friction that bought nothing. A checkbox
promising an adult is present is unverifiable, and the surface where the question
actually mattered was the payment, not the account. So the upgrade attestation in
`components/plan-card.tsx` now asks what is genuinely relevant at a card
transaction: that the person pressing the button is entitled to use the card and
knows the charge recurs.

Briefly considered and rejected: 18+. It would have removed the nutrition and
loading caveats, but it also removes high school and club players, which is most
of the sport, and takes the recruiting wedge with them, since NCAA recruiting is
largely a 14 to 17 activity. The audience is anyone who plays.

The training content keeps its conservative register regardless. The plan prompt
still refuses calorie, macro and supplement advice, still demands a rest day, and
still will not prescribe a one-rep max, because the audience starts at 13 and
trains without a coach watching. `lib/weekly-plan.test.ts` pins all four, so a
refactor that drops one fails the suite rather than shipping.

## D-074 - An injury library, and why it is allowed to exist

34 entries across shoulder, knee, ankle, back, hip, calf, hand and head, reached
from a second tab in Learn with a search box that follows the player between the
two libraries.

**Education, not treatment, enforced in three places rather than promised.** The
schema in `content/rehab-types.ts` has no field for a daily protocol: `phases`
describe what a recovery LOOKS like so a player can tell where they are and have
a better conversation with a clinician, and `prevention` is the only section that
prescribes, because prehab is ordinary training. `content/rehab.test.ts` fails
the build if any phase grows sets, reps or a load, if any entry names a drug or a
supplement, or if concussion, an Achilles rupture, an ACL or a pars stress
fracture is ever filed as something a player manages alone. Migration 039 makes
the two-red-flag minimum a check constraint, so the database refuses an
unfinished entry rather than trusting review to catch it.

**The safety review earned its place.** The library was drafted by eight parallel
domain passes and then reviewed, and the review returned two blocking problems,
both real. One-sided extension-based low back pain had been filed self-manage
when it is also the exact presentation of a pars stress reaction, which the
library files separately at get_assessed; the two cannot be told apart by a
player, so the safe default is assessment. And its copy asserted "nothing is torn
or broken", which is a negative diagnosis this product cannot make and which
actively talks a growing player out of getting imaged. Both are fixed. Four
further problems were corrected too: a splinting protocol written as
instructions, a contradictory MCL timeline whose third phase was shorter than the
two before it, an unexplained referred-pain red flag, and a mis-filed region.

**In a table, not only a module.** `content/rehab.ts` is the authored source and
`scripts/seed-rehab.mjs` reconciles it into `rehab_entries`. The app reads the
table and falls back to the module if the read fails, because public reference
content should not disappear when the database blinks. A wrong entry can
therefore be corrected in seconds without a deploy, which matters more here than
anywhere else in the product. No search index: the library is tens of rows, the
page loads it and filters in the browser, and an index with no call site is the
dead weight this repo has deleted before.

Triage sits first on every entry page, and red flags sit ABOVE the recovery
phases. A player who reads "here is what recovery looks like" first is a player
who has already decided to manage it alone.

Also here: the `fromEnvFile` helper in the seed strips a BOM. `.env.local` is
written by a Windows editor and carries one, which lands on the first key only,
so `startsWith` silently fails for that single variable and reports it missing
while every other key in the same file resolves. `scripts/purge-orphaned-media.mjs`
has the same bug and has not been fixed here.
## D-075 - Signup was NOT broken, and the diagnosis below was wrong

**CORRECTED 2026-07-30, same day, by actually walking the path.** Everything
after this block is the original entry and it is kept because being wrong in a
ledger is worth more than a tidy one. The claim it makes is false.

Signup worked. It was proven end to end for the first time in the product's
history on 2026-07-30: an account was created through the auth API, the
confirmation email arrived from `noreply@send.vollyio.com`, the link in it
resolved `307 -> /dashboard` with valid session cookies, and the resulting JWT
carried `email_confirmed_at` and `last_sign_in_at`. The new user then loaded the
dashboard, `/plan` and `/learn` at 200 with the honest zero-data copy rendering
correctly. The probe account was deleted afterwards.

**Why the diagnosis was wrong.** The project uses a CUSTOM confirmation email
template that builds the link as
`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`. That
targets the callback route directly and is verified by `verifyOtp`, so it never
touched `redirect_to` and never depended on `emailRedirectTo` at all. The missing
parameter only affects the DEFAULT template's `{{ .ConfirmationURL }}`, which
this project does not use.

**The reasoning error, which is the part worth keeping.** A configuration gap was
found, a plausible mechanism was constructed from it, and the mechanism was then
reported as the cause of an observed number without ever testing the actual path.
It was persuasive because it explained the data. It was wrong because the data
did not need explaining: the "five reached /signup and zero completed" figure was
the owner's own testing traffic, which he had already said, not five strangers
who failed. A cause was invented for a symptom that was never real.

Both errors are the same error. Do not infer a root cause from a config
inspection when the path can be executed. Executing it took one command and
settled in seconds what inspection got backwards.

**What survives.** The `emailRedirectTo` change is kept: it is correct defensive
practice and makes the code work even if the custom template is ever reverted to
the default, which is a real risk since the template lives in a dashboard nobody
version-controls. `scripts/auth-preflight.mjs` is kept and is the more valuable
artifact, though its framing should be read with this correction in mind. The
genuinely useful finding from that work was the opposite of the headline: the
Site URL, the redirect allow-list, the custom template and the delivery path were
all already correct.

---

*Original entry, retained as written:*

### Signup was broken the entire time, and the failure looked like disinterest (SUPERSEDED)

`supabase.auth.signUp()` was called without `emailRedirectTo`. The confirmation
link's `redirect_to` therefore fell back to the project's Site URL, which is the
landing page. A new player clicked the link, Supabase verified the token and
redirected them to `/`, and the code was never exchanged for a session by
`/auth/callback`. Their account was confirmed. They appeared signed out. Nothing
told them otherwise.

Five people reached `/signup` and zero completed, and that number was read for
weeks as a conversion problem. It was not. The front door confirmed you and then
put you back on the street.

**Why it survived so long.** Every symptom of this bug is also a symptom of
nobody bothering. There is no error, no failed request, no log line, and no
metric that separates "signup is broken" from "signup is unpopular". The owner's
own account was created in the dashboard (`confirmation_sent_at` is null on it),
so the one person who could have caught it never walked the path.

**The fix is one line and the guard matters more than the fix.**
`scripts/auth-preflight.mjs` uses `auth.admin.generateLink` to read the exact URL
a new player would receive without sending an email, checks it points at
`/auth/callback` rather than at Site URL, and deletes the probe user it creates.
It also reports what the link would be with no `emailRedirectTo`, so the specific
regression that happened here is visible rather than inferred.

**Three settings have to agree and only one is in the repo.** `emailRedirectTo`
in the code, Site URL in the Supabase dashboard, and the redirect allow-list. The
allow-list is the trap: a `redirect_to` that is not on it is silently rewritten
back to Site URL, which reproduces the original bug with the fix apparently in
place. Verified against production: the allow-list already permits
`https://vollyio.com/auth/callback`, so the code change alone closes this.

**The general lesson, which is the reason this entry is long.** A path nobody has
ever walked is not shipped, it is written. This one had tests, a well-built
callback route that correctly handles both the `code` and `token_hash` flows,
and a friendly error for the rate limit someone clearly anticipated. All of that
was true while the path did not work. Coverage of the parts is not evidence about
the whole, and the only check that would have caught it is a human completing a
signup with an email they can open.

## D-076 - The trial and the rate are two different numbers

Free was 3 completed analyses every month, forever. Migration 040 splits that
into a one-time signup grant of 3 and a recurring rate of 1.

**Both halves fix a real problem, in opposite directions.**

The rate was too expensive at the tail. Measured cost is $0.209 per analysis
across the 12 telemetry-carrying rows in production, and $0.234 on Opus 5 since
D-070 raised input tokens by 23%. `docs/billing.md` claimed $0.15 to $0.20; that
was derived before the switch and every margin figure resting on it was
optimistic. At 3 a month a dormant free account costs $0.69 every month for as
long as it exists and returns nothing, which put break-even conversion at 6.4%
against a freemium norm of 2 to 5%. At 1 a month it is $0.23 and 2.2%. That
single number is the difference between a funnel that pays for itself and one
that does not.

**The grant is not generosity, it is the demo.** `updateRating` seeds on the
first score and has no prior to move toward, so a rating only MOVES on the second
read of a skill. A player capped at one a month from signup waits 31 days for
their second data point, and the moment that sells Pro, watching a number move
because you worked the fix, never arrives inside the window where they still
care. Cutting to a flat 1 would have saved money by deleting the only thing that
converts. Three at signup buys the whole loop in week one, once, for $0.69.

**Spent against lifetime rows, never stored.** `greatest(0, 3 - lifetime_count)`
where lifetime is an unwindowed `count(*)` on `analyses`. There is no counter to
decrement, nothing that can drift from the table it describes, and no way to farm
it: three completed analyses close it permanently, whichever months they land in.
It also inherits D-064 for free, because a failed clip writes no row and so
spends neither wall. `lib/plans.test.ts` pins the absence of a `created_at`
clause on that query, since adding one would silently turn the grant back into a
second monthly allowance and restore the exact cost shape this removes.

**The gate needs BOTH walls up.** `if v_grant_left <= 0 and v_used >= v_rate`.
An `or` there refuses a new player their second analysis. Pinned.

**Two copy bugs found by making the change, both worse than the change.**
`limitOffer` and the 402 both built "your next N unlock on Aug 1" out of the
window ceiling that was just spent. With a grant in play those are different
numbers, so a player who burned 3 would have been promised 3 and given 1: a
false statement about entitlement, in the message whose entire job is telling
them when they can train again. Both now read the recurring rate, which is always
correct at that moment because a refusal requires the grant to be empty already.
Separately, every "all N of your Free analyses" string renders "all 1 of" at the
new rate, and `allowanceTone` returned "last" for an untouched window whose whole
size is one, opening every free month on a scarcity warning about nothing spent.
Both carve out the singular case.

**What this does not change.** Pro stays 18 and $14.99. Nothing else in the
product asks what plan you are on. The $89.99 annual in the strategy brief was
priced against a $9.99 monthly that was never built and is 50% off the real
price; if an annual ships it belongs nearer $129.

**The ceiling that binds first.** `ANALYZE_MONTHLY_BUDGET_USD=25` is 107
analyses a month across all users at the measured cost, which is six Pro
subscribers at full use. The free tier is no longer the thing most likely to
exhaust it, but the platform backstop still is, and its failure mode is a paying
player getting a 503 caused by someone else. Raising it is a prerequisite for
marketing, not for this change.

## D-077 - Pro drops to $9.99, and the spend backstop comes off

Two owner decisions, taken together on 2026-07-31, both overriding a
recommendation recorded here so the reasoning is not lost.

### Pro is $9.99, still 18 analyses

Live price object is `price_1TzKG5JOFP4i3BqJC2z0xklp`, which now holds the
`vollyio_pro_monthly` lookup key transferred off the $14.99 one. **Stripe prices
are immutable, so a price change is always a new object plus a lookup-key
transfer, never an edit.** The superseded `price_1TxzWVJOFP4i3BqJ9th7pH9v` is
left ACTIVE on purpose: a live subscription is attached to it, and archiving a
price does not migrate the subscriptions on it, it only stops new checkouts.

**It is profitable, and the arithmetic is not close.** At the measured $0.234 an
analysis and Stripe's 2.9% plus 30 cents, $9.99 nets $9.40, costs $4.21 at FULL
use, and clears $5.19, a 52% gross margin. At the worst per-analysis cost ever
recorded, $0.262, it is still 47%. Full utilization is the worst case rather than
the norm; at half use it is 76%. There is no utilization level at which a Pro
subscriber loses money.

**Analyses stay at 18, deliberately.** Cutting them to buy margin back would make
the product worse in two ways at once, and 18 at $9.99 is 55 cents a coached rep,
which is the number worth saying out loud. The $9.99/20 shape from the original
strategy brief is the one to avoid: it cuts price 33% and raises cost 11% in the
same move, landing at 48%.

**D-076 is the reason this works.** The binding constraint on a price was never
the price, it was how many free accounts each subscriber has to carry. At the old
3-a-month free tier a free account cost $0.69 a month, so $9.99 carried 7.5 of
them and needed 11.8% conversion, which is not a real number for freemium. At
$0.23 it carries 22.5 and needs **4.3%**, inside the 2 to 5% band. **Reverting
the free tier without also reverting the price would put the funnel underwater**,
and that dependency is the single most important thing in this entry.

For contrast, $14.99 carried 44 accounts at 2.2%. The trade is real: this halves
the margin per subscriber and doubles the conversion rate required. It buys a
price point that does not need defending, on a product with no price-resistance
data in either direction, and that was the owner's call to make.

**A $89.99 annual is now coherent** at 25% off, where against $14.99 it was 50%
off and incoherent. It nets $87.08 and clears $36.54 even at full annual
utilization, a 41% margin, with twelve months of cash up front. Still not built.

**One live-money consequence.** The existing subscription is pinned to the
$14.99 price object and keeps billing $14.99 until somebody moves it. A price
change in the dashboard does not reach existing subscribers, which is the same
property that makes the old price safe to leave active. Migrating it is a
proration event on a real card and was left to the owner.

### The $25 monthly spend backstop is removed

`ANALYZE_MONTHLY_BUDGET_USD` is now unset in Vercel Production. At $0.234 an
analysis, 25 dollars was **107 analyses a month across every user combined**,
which is six Pro subscribers at full use. The guard fails CLOSED, so the failure
mode was a calm 503 for the entire product, triggered by ordinary paid usage, and
reaching it would have looked exactly like an outage to the customer who caused
it least.

**The guard code stays in `lib/ai/budget.ts`.** Unset means disabled by design,
`lib/ai/budget.test.ts` already pins that path, and restoring a ceiling is one
environment variable with no code change. Deleting the mechanism to disable it
would have thrown away D-054's answer to the incident that killed production on
2026-07-20, when the provider's account-level cap was shared with local dev.

**What is now genuinely unbounded**, and is the honest cost of this decision: a
runaway loop, an abuse case, or an unexpectedly good week produces an unbounded
provider bill with nothing in the product to stop it. The remaining walls are
per-user, not platform-wide: the monthly allowance (1 free, 18 Pro) and the
hourly abuse quota of 20. Those bound what any ONE account can spend; nothing
bounds the sum. If a ceiling is ever restored, set it above
`18 x 0.234 x expected_subscribers` with real headroom rather than at a round
number, because the round number is what made 25 dangerous.

## D-078 - Repo hygiene: what was removed, what was kept, and why the difference

A cleanup pass on 2026-07-31. The rule applied throughout: **delete only what is
provably redundant, archive what is merely stale, and keep anything holding work
that exists nowhere else.** The three are different problems and deleting is the
right answer to only one of them.

### The near-miss that set the rule

`eval-harness-calibration` had four commits from 2026-07-16 that had **never been
pushed to any remote**: `evals/labels.json` (351 lines of labelled eval data),
`lib/ai/anchors.ts`, `evals/TECHNIQUE-REFERENCE.md`, and three Python ingest
scripts. Roughly a thousand lines existing on exactly one disk, in the middle of
a branch list that looked entirely like dead scratch. It was pushed to origin
before anything else in this pass was touched.

It is deliberately NOT merged. It carries a `D-023` entry against a log already
at D-077, and its `lib/ai/output-spec.ts` changes predate five rewrites of that
file (D-037, D-038, D-039, D-053, and the feedback change). Merging it would drag
back scoring behaviour that was replaced on purpose. The data and the ingest
tooling may still be worth harvesting; the scoring changes are not.

### Branches

Every branch was checked with `git rev-list --count master..<branch>` BEFORE any
deletion, not after. Sixteen fully-merged local branches were removed with
`git branch -d`, which refuses an unmerged branch and so cannot silently destroy
work even if the count were wrong.

Five branches carry commits that are not in master and are all KEPT:

- **`claude/last-update-timing-ohn65b`** is the one that matters. It adds 57
  lines of security headers to `next.config.ts`, plus an origin check on account
  deletion and a fence on coach-prompt data. **Master has no security headers at
  all**, verified during this pass. That is a real gap wearing the costume of an
  abandoned agent branch, and deleting the branch list on appearance would have
  thrown it away.
- **`eval-harness-calibration`** - see above.
- **`vercel/install-vercel-speed-insights-iynziq`** - Speed Insights is genuinely
  not installed. The branch is two weeks stale and its lockfile diff drops 84
  lines, so if this is ever wanted, run `npm i @vercel/speed-insights` fresh
  rather than merging it.
- **`claude/project-bottlenecks-jyeuue`** - largely superseded. Its migration
  fold (`004_xp_events_index.sql` into `004_discipline.sql`) is actively unsafe
  now that 040 is applied, since renaming an applied migration desynchronises the
  repo from what actually ran.
- **`claude/sideout-end-to-end-fo3hm6`** - a 115-line directive document, history
  rather than code.

Nine remote branches were redundant and are now **deleted**, owner-approved, with
the counts re-run immediately before the push rather than trusted from earlier in
the session: `claude/3d-animations-research-2oyxnw`, `claude/app-overview-6oh5c8`,
`claude/front-page-ux-review-t568dt`, `claude/my-handoff-review-cohy3d`,
`claude/volleyball-app-ui-redesign-wdn3wv`, `claude/vollyio-work-recap-uykzpr`,
`feat/pinpoint-motion`, `polish/multiagent-burst`, and
`vercel/install-vercel-web-analytics-jssp7o`.

Eight had zero commits outside master. The ninth is named separately because it
is the counter-example to this entry's own rule: it **did** carry a commit not in
master, so a purely mechanical `rev-list` gate would have preserved it forever.
Its content was redundant anyway, because `@vercel/analytics` is already in
`package.json` and `<Analytics />` is already rendered in `app/layout.tsx`; the
feature arrived by another route. All that was genuinely unique to the branch was
a two-week-old `package-lock.json` diff dropping 84 lines, which merging would
have regressed. **A commit count is a cheap first filter, not the verdict. Zero
means safe to delete; non-zero means read the diff.**

**Origin now holds exactly two refs: `master` and `eval-harness-calibration`.**
The four survivors named in the first draft of this entry were each resolved the
same day, and how they were resolved is the point.

`claude/last-update-timing-ohn65b` was **harvested, then deleted**. Its security
headers shipped as PR #21 and its prompt-injection fence as PR #22, both rewritten
against current files rather than merged; its other two changes were regressions
(master's account-delete already had `hasTrustedMutationOrigin` plus
`consumeApiQuota`, and its `coach-prompt.ts` still carried the per-level
`CHAT_VOICE` record D-053 deleted on purpose). A branch can be worth more than
its diff and still be wrong to merge.

The other three were deleted after reading them, not after counting them:

- **`claude/project-bottlenecks-jyeuue`** was the one worth reading, because
  merging it would have been actively harmful rather than merely redundant. Its
  `app/api/coach/route.ts` predates D-047: no `COACH_ENABLED` gate, no
  `hasTrustedMutationOrigin`, no `consumeApiQuota`, and a 2000-character message
  cap that D-047 tightened to 600. Merging would have stripped the spend
  containment that closed coach chat in the first place. Its migration fold
  (`004_xp_events_index.sql` into `004_discipline.sql`) is also unsafe now that
  040 is applied, since renaming an applied migration desynchronises the repo
  from what actually ran. Its one unique artifact, `docs/bottlenecks.md`, was
  read before deleting: every item on its critical path is dead. API credits
  restored, domain and SMTP and support address all done, legal gates shipped in
  D-069, and item 4 is device-testing for the D-021 ONNX engine that **D-033
  deleted**. It still calls the deployment `sideout-jet.vercel.app`.
- **`claude/sideout-end-to-end-fo3hm6`** was a 115-line directive document for a
  since-renamed product, sibling to the one already in
  `archive/orchestration/`.
- **`vercel/install-vercel-speed-insights-iynziq`** genuinely added something
  master lacks, but two weeks stale with a lockfile diff dropping 84 lines.
  `npm i @vercel/speed-insights` is the correct way to get it, not a merge.

`eval-harness-calibration` survives alone, on the same rule that saved it in the
first place: it is the only copy of `evals/labels.json` and the ingest scripts.

### Files

Two documents sat loose at the repo root and were moved into `archive/` with
`git mv`, following the convention `archive/README.md` already sets: retired text
stays tracked, so history is preserved and it stays greppable.

- `vollyio-breakdown.md` -> `archive/docs-history/`. Accurate on 2026-07-21,
  wrong now in ways that matter: 40 frames at 6fps against the current 64,
  "billing is deliberately inert" against a live charged subscription, a decision
  log stopping at D-041.
- `vollyio-improvement-prompt.md` -> `archive/orchestration/`. It instructs its
  reader that "D-027 through D-041 is the ONLY accurate description of the
  current system", which was true when written and is 36 decisions out of date,
  so running it as written would brief an agent on a system that no longer
  exists.

`archive/` itself was left intact. It is 4,880 lines of deliberate history with
its own README explaining every subfolder, not clutter, and the material it holds
is the background to D-033 among others.

### HANDOFF.md

Root `HANDOFF.md` last described the system at D-064 and asserted billing was
"BUILT and INERT" with free at 3 a month and Pro at $14.99. All three statements
were false by 2026-07-31. Corrected **inline**, marked as corrections, with the
original text kept immediately below each one, rather than by rewriting the
surrounding prose. A handoff that quietly re-describes itself as always having
been right teaches nothing; one that shows its own drift teaches how fast a
session log goes stale. The header now says outright that `docs/decisions.md`
wins wherever the two disagree.

### The general point

A branch list, like a metric, is read by shape rather than by content, and both
lie the same way. Nine of these branches genuinely were dead scratch, which made
the tenth look like dead scratch too. The only thing separating a throwaway
research branch from the repo's only copy of the security headers was one
`rev-list` per branch, which cost seconds. Check before deleting, always, and
prefer `git branch -d` over `-D` so the tool enforces it when the check does not.

## D-079 - The rating trusts progress more than it trusts one bad day

**Date**: 2026-08-01. **Status**: shipped (migration 043 applied).

The rolling skill rating moved by the same alpha (0.35) in both directions, so
one 50-scoring rep under a 75 rating erased ~9 points: two weeks of gains gone
to one bad toss, a tired evening, or a camera angle. Players experience that as
punishment, and a product whose progression demo is what converts cannot have
its central number feel like a slot machine.

Three changes, one boundary held:

1. **Asymmetric smoothing** (`lib/ratings.ts`): `ALPHA_UP` stays 0.35,
   `ALPHA_DOWN` is 0.15. This is a modeling claim, not flattery: skill does not
   vanish in a day but does jump when a fix lands, so upward evidence deserves
   more weight. A single bad rep is now a ~4-point nudge; eight straight bad
   reps still drag a rating under 60, so sustained decline stays visible.
   Coverage-weighting is unchanged.

2. **The personal best is never lost** (migration 043, `personal_bests()`):
   MAX(overall_score) over the caller's own analyses per skill and discipline,
   derived on read so it cannot drift and stores nothing. SECURITY INVOKER,
   deliberately unlike most functions here: plain RLS is exactly the scoping
   wanted, so no definer privilege is taken. Dashboard skill cards show
   "best N" under the rating; the breakdown page shows form and best under the
   rep score, and a rep at the high-water mark is named "your best yet".

3. **Framing copy**: a rough rep renders beside where the form stands, never
   as a demotion headline.

The boundary: the per-rep SCORE is untouched. D-040's no-curve rule is why the
product is trustworthy, and it applies to the read of a rep. The rating is an
estimate of the player, and choosing its estimator is statistics, not curving.
Rejected: high-water-mark-only as THE rating (stops measuring; one lucky angle
sets an unbeatable number; regression from rust or injury goes invisible; goal
progress loses meaning).

## D-080 - Evaluation must be free even where analysis cannot be

**Date**: 2026-08-02. **Status**: shipped.

The launch posts produced two cold signups and exactly one species of
feedback, from every commenter: "3 analyses is not enough to test this."
Half of that objection was self-inflicted: the one zero-cost way to evaluate
the product, the shared breakdown link in the post, was broken for its first
nine hours (a markdown escape put a literal backslash in the token), so the
only way to see anything was to spend a signup. The fix is to separate
evaluating the product from using it, and make the first one free forever:

1. **`/samples`** - three real, unedited breakdowns (pass 87, set 77, attack
   63, all full-coverage reads) served through the same share pages players
   mint, with the expiry pushed to 2031 on those three rows. The score spread
   is deliberate: a stranger should see what a middling number looks like
   before spending a signup, because the honest 63 is the sales pitch. Linked
   from the landing film-room section and the sitemap. Zero marginal cost per
   viewer; the storage was already spent.

2. **Signup grant 3 -> 5** (migration 044, `SIGNUP_GRANT` in lib/plans.ts,
   pinned together by lib/plans.test.ts). Five buys two full rating
   progressions on one skill plus a spare, which is "enough leeway to test"
   in the commenters' own terms. $1.17 per fully-active signup at the
   measured $0.234; break-even conversion moves ~4.3% -> ~5%, top of the
   freemium band but inside it. The grant stays lifetime-spent and unstored.

Rejected: dropping the cap or an unlimited launch window. Unbounded spend
with no bot protection and (until Supabase Pro lands) ~36 analyses of total
storage headroom is the 2026-07-20 outage with an audience. The storage
purchase is the owner's next console action; at the current trickle the bump
is safe ahead of it, and the math flips the moment traffic does.

## D-081 - Tell them how to film before they spend a rep on it

**Date**: 2026-08-02. **Status**: shipped.

The first cold signup's first analysis came back with **0% checklist
coverage**: every cue `not_visible`, the score falling back to the model's
whole-clip read, and the player down one of their five analyses having
learned nothing about their mechanics. That is the worst outcome the system
can produce, and it is not a scoring bug. The honesty machinery worked
exactly as designed (D-038: what the camera did not show is excluded rather
than counted against the athlete). The failure was upstream: nothing told
them how to film.

The upload step said "Any angle you can get", which is friendly and wrong.
The read scores what the camera shows, so framing is not a preference, it is
the input that decides whether there is anything to score. It now says what
actually drives coverage: fill the frame with the athlete rather than the
court, keep the whole motion in the clip, side-on over head-on, one rep over
a rally. Plus the honest consequence, so the guidance reads as physics
rather than nagging: a distant or half-cut rep comes back with cues marked
not visible instead of scored.

The breakdown page closes the same loop from the other end. A low-confidence
read named the gap ("Graded on 0% of the checklist") and stopped there,
which invites the reader to conclude the product is broken rather than the
framing was. It now names the remedy in one line.

This is the cheapest thing in the product to get right and one of the most
expensive to get wrong: an unreadable clip costs a real $0.234 coaching
call, one of the player's five grants, and their first impression, all at
once. Cost and conversion are the same fix here.

## D-082 - The grant becomes a number the owner can set per account

**Date**: 2026-08-02. **Status**: shipped (migration 045 applied).

Two strangers signed up from the launch posts and both said the same thing:
five analyses is not enough room to evaluate the product. The only lever
that existed was `signup_grant()`, a single global number, so answering one
hand-recruited player meant answering everybody and paying for it forever.

`profiles.analysis_grant` overrides the grant for ONE account. NULL means the
standard grant, so every untouched account is unaffected by construction
rather than by a branch someone has to maintain. Both allowance functions
read `coalesce(analysis_grant, signup_grant())` and nothing else changes:
the value feeds the same `greatest(0, v_grant - v_lifetime)`, counted against
LIFETIME rows, stored nowhere, decremented never. It inherits D-076's whole
shape, so there is nothing to drift and nothing to farm.

**It is entitlement, so the account it describes cannot write it** (rule 11).
The column sits outside migration 012's fixed update allowlist, which is a
property of how that grant was written rather than something anyone
remembered; `set_analysis_grant` is `service_role` only like
`set_subscription_plan`; and `lib/plans.test.ts` now asserts across every
migration that no later one ever hands the column to `authenticated`.
Verified live after applying: `has_column_privilege` and
`has_function_privilege` both deny `authenticated` and `anon`.

Bounded 0 to 500. Not decoration: every analysis is a real paid coaching call
at about $0.234, so an extra digit typed into the setter is a real bill. The
two launch signups were set to 24, which costs about $5.60 each if fully
spent and is the cheapest research this product will ever buy.

Known limitation, accepted: `allowanceSentence()` still renders the standard
"5 to start, then 1 a month" on plan surfaces, because it is a pure function
of the plan and does not know about overrides. The COUNTERS are correct
everywhere, since they read `analysis_allowance()`. Rewiring the sentence to
be per-account is not worth it for a handful of hand-picked accounts, but it
is the thing to fix first if overrides ever become a routine tool.

## D-083 - The grant is one read of every skill

**Date**: 2026-08-02. **Status**: shipped (migration 046 applied).

Six, because `SKILLS.length` is six. The product scores serve, pass, set,
attack, block and dig, so a new account now gets exactly one read of each
before the monthly rate applies.

This is a smaller change than D-080 and a better one, because the number
finally has a reason attached. Five was a defensible guess; six is a
sentence a player can be told: try it on everything you play, once. It also
makes the first session a natural tour of the product rather than a
rationing decision, and it means a player's first ratings exist across the
whole radar instead of on one skill.

Costs $1.40 per fully-spent signup at the measured $0.234, against $1.17 at
five. Break-even conversion moves by a fraction of a point and stays inside
the band D-076 established.

The per-account override from D-082 rides along untouched: `coalesce` still
prefers `analysis_grant`, so nobody holding a hand-set number is moved by
this.

### The lifetime-grant surprise, recorded because it will recur

Setting an account's grant to 50 showed "30 of 31", which reads like a bug
and is not one. The grant is spent against LIFETIME analyses (D-076), so an
account with 20 rows already behind it has 30 of that 50 left. The 31 is the
window ceiling: 30 remaining plus the 1 already used this window.

The consequence to remember when handing out grants: **a grant is a lifetime
ceiling, not a top-up.** To give an established account N more from today,
set it to `N + their current lifetime count`, not N. `set_analysis_grant`
returns `lifetime_analyses` and `grant_remaining` in its result for exactly
this reason, so the answer is visible in the call rather than needing a
second query.

## D-084 - The counter says what you were given and what you spent

**Date**: 2026-08-02. **Status**: shipped (migration 047 applied).

An account handed a grant of 50, with 20 analyses behind it and 1 this
window, rendered **"30 of 31 left this month"**. Every number in that
sentence is derived correctly and the sentence is still false twice over:

- **31 is not a promise, it is an artifact.** `allowance` is
  `greatest(rate, least(grantLeft + used, grant))`, so the denominator is
  "what remains plus what happens to have been spent inside the current
  window". Nobody was ever offered 31 of anything.
- **"this month" describes a refill that will not happen.** Grant analyses
  are spent against LIFETIME rows (D-076). They do not reset. The player
  reading that line would expect 31 again on the first, and get 1.

The counter is the one surface whose entire job is telling a player where
they stand, so this is the worst place in the product for a number that
needs explaining. The fix is data rather than phrasing: `analysis_allowance()`
now also returns `grant` and `lifetime_used`, and the copy reports
**"20 of 50 used"** while the grant is what is being spent, dropping the
month entirely because the month is not the frame. Once the grant is gone
and the recurring rate binds, the window frame returns and is true again:
"7 of 18 left this month".

`allowanceLine`'s warning follows the same rule. "Last analysis this month"
promised the wrong refill at the end of a grant; it now reads "Last of your
6. Then 1 a month, from Sep 1", which names both the number ending and the
different number starting.

Both new fields default to null in `lib/allowance.ts`, and the copy falls
back to the window frame when either is absent, because a build running
ahead of its migration can substantiate the window and cannot substantiate a
lifetime. Inventing one would be the same class of error this entry exists
to fix.

The gate is untouched. Nothing about what any player may spend changed;
only what they are told about it.

## D-085 - Pro is 24, and the price stays $9.99 for now

**Date**: 2026-08-02. **Status**: 24 shipped (migration 048 applied). Price
recommendation recorded, NOT applied.

24 a month: four reads of every skill, the same one-per-skill logic the
signup grant uses now that `SKILLS.length` is the number both derive from.
18 was a round number with nothing behind it. 24 puts a weekly rep on every
skill within reach, which is a sentence a player can be told.

### First, the question this answered: the grant does not stack on a subscription

Verified against the live gate rather than reasoned about. The allowance is
`greatest(rate, least(grantLeft + used, grant))`, so the plan rate is a
FLOOR and the standard grant can never add to it:

| Case | Grant left | Rate | Allowance |
|---|---:|---:|---:|
| New free account | 6 | 1 | 6 |
| Free, grant spent | 0 | 1 | 1 |
| **New Pro subscriber** | 6 | 24 | **24, not 30** |
| Pro, grant spent | 0 | 24 | 24 |

A hand-set override ABOVE the plan rate does exceed it (an account given 50
sees more than a Pro month), which is the admin lever from D-082 working as
intended rather than an overlap bug.

### The price, and why it did not move with the count

At the measured $0.234, $9.99 nets $9.40 and full use now costs $5.62, so
the margin at full utilization falls from 55% to **40%**. That is thinner
and still positive, and full use is the worst case rather than the norm.
Break-even conversion is ~5.8% at full use and ~3.3% at half, both inside
the band D-076 established.

**The recommendation, when there is evidence to act on: $12.99.** It nets
$12.31, clears $6.69 at full use, and restores a 54% margin. The pitch is
not a price rise: at 24 for $12.99 a player pays **$0.54 an analysis against
$0.555 today**, so the offer is more analyses AND better value per rep.

It is not applied, for one reason: **nobody has ever converted.** Every
number above rests on an assumed conversion rate, and at four-to-five
subscribers the entire margin difference between $9.99 and $12.99 is about
$12 a month, which is noise. A lower price converting better is worth more
than the margin right now, and the cheapest possible offer is the right one
while the goal is evidence rather than income.

When it does move, the tactic to use is **founding-member pricing**: raise
the standard price and leave early subscribers on the old one. The mechanic
is already proven in this account, because prices are immutable in Stripe
and archiving one never migrates the subscriptions attached to it, which is
exactly why the superseded $14.99 price is still live (D-077). That makes
the raise safe and the early cohort genuinely rewarded.

Changing the COUNT needed no provider work at all; 24 is our number, not
theirs. Changing the PRICE means a new price object plus a lookup-key
transfer, which is owner console work.

## D-086 - The billing period start is read, not computed

**Date**: 2026-08-02. **Status**: shipped (migration 049 applied).

Asked whether cancellation respects the purchase anniversary, including the
month-length cases. The renewal DATE was always right, and for the reason
that matters: it is never calculated here. The provider decides the
anniversary, including how a 31st anchor behaves in a 30- or 28-day month,
and the webhook stores whatever it reports. That is rule 2 of the house
standard doing its job.

The window START was not right. `private.allowance_window` derived it as
`period_end - interval '1 month'`, and that subtraction disagrees with the
real period whenever the anchor is the 29th to 31st:

| Renewal | Derived start | Real start | Error |
|---|---|---|---|
| 2026-09-30 | 2026-08-30 | 2026-08-31 | 1 day early |
| 2027-02-28 | 2027-01-28 | 2027-01-31 | 3 days early |

A start earlier than the truth counts analyses from the tail of the previous
period against the new one, so a Pro subscriber on a month-end anchor
quietly got fewer analyses than they paid for, for up to three days a year.
**It failed against the player**, which is the wrong direction for an error
in a paid allowance.

The fix applies the same rule that made the anniversary correct: read the
boundary from the system that owns it. `profiles.plan_period_start` holds
the provider's own `current_period_start`, read by a helper mirroring the
one that already reads the end (both API shapes, subscription and item).
`allowance_window` coalesces to the old subtraction, so every row written
before this keeps working until its next billing event lands: no backfill,
and no window in which anybody is worse off than they were.

`set_subscription_plan` is dropped and recreated rather than overloaded,
inside the one migration. A second signature would leave PostgREST
resolving a six-argument named call against two candidates, and doing both
in one transaction means there is no moment where the webhook has no
function to call.

Scope note: the custom cancellation page this question started from was
**not** built. The provider's portal stays, because it is also where a card
is updated and an invoice is fetched, and building card entry would take on
PCI scope for no gain. What the question was actually worth was this bug.

## D-087 - The words match the product before strangers read them

**Date**: 2026-08-03. **Status**: shipped.

A pre-invite pass over every surface a first paying user reads, fixing the
places where the product had moved and the words had not.

- The Terms hourly-limit paragraph claimed the monthly allowance could never
  meet the hourly wall "because 24 in a month is well under 20 in an hour",
  which is false arithmetic since D-085 and reads as nonsense to anyone who
  checks it. Rewritten to state the true relationship; the effective date
  moved to the day the displayed numbers changed.
- The landing page sold Coach chat as a live feature while `/coach` answers
  404 behind its flag, breaking the rule the page's own structured-data
  comment states. The section now carries a "Coming soon" tag and future
  tense, and its mock conversation names a drill that exists (Wall Platform
  Reps, not Holds).
- The operator docs were resynced to the live numbers and the live state:
  `docs/billing.md`, `docs/billing-runbook.md` (marked EXECUTED, expected
  values corrected to 1/24 and grant 6), `docs/plan-matrix.md` (billing is in
  force; copy rules updated), `README.md`, `SETUP.md`, and `docs/deploy.md`
  (migration state read live from production; the CV Phase 1 section marked
  historical per D-033). The principle is D-042's: the repo tells the truth,
  and a runbook whose expected values are two generations stale would have
  the owner concluding production is broken while verifying that it is fine.

## D-088 - Five tabs, one screen of nav

**Date**: 2026-08-03. **Status**: shipped.

The nav had grown to eleven items. On desktop that is a long sidebar; on a
phone it was ten to eleven fixed 72px tabs inside a horizontally scrolling
bar, which put Goals, Progress, History, Drills and Settings off the right
edge of every phone with no affordance beyond an unhinted swipe, and the bar
recentered itself under the thumb after every tap. Half the product was
invisible to exactly the first-time players about to be invited.

The replacement is five destinations, one player question each:

| Tab | Question | Owns |
|---|---|---|
| Home (`/dashboard`) | what do I do today | assignment, goals board (D-089), badge shelf, rating, recent reps |
| Analyze | how was that rep | capture flow, `/analysis/[id]` breakdowns |
| Train (`/plan`) | what do I practice | the week, `/drills`, `/learn`, recovery |
| Progress | is it working | trends, `/history` reps, milestones |
| Coach | can I ask someone | flag-gated as before; four tabs while dark |

Mechanics: nav items carry a `match` list so a hub tab stays lit anywhere
inside it; the tab bar is equal-width slots with the overflow, snap and
scroll-into-view machinery deleted; a shared chip strip (`section-nav.tsx`)
switches views inside Train and Progress, the same vocabulary as the
discipline chips. Routes did not move, so the public `/learn` and `/drills`
pages keep their URLs and the sitemap stays true.

Two demotions and one deletion fell out of it:

- **Settings became chrome**: a gear in the mobile top bar and a pinned entry
  above Sign out in the sidebar. A page visited monthly does not hold one of
  five daily slots. The payment-provider return URLs still land on
  `/settings#plan` unchanged.
- **Goals moved home** (D-089 carries the reward half). `/goals` is a
  redirect to `/dashboard#goals` so old links keep working; the actions file
  stayed put and the dashboard imports it.
- **The scoreboard is deleted.** Verified before deleting: the `games` table
  is read and written by the scoreboard surfaces alone, nothing else in the
  repo consumes it, no XP, no rating effect, no inbound links. It was a
  closed loop holding a prime nav slot and three different names (Scoreboard,
  Games, Track a match). The table and its grants stay for the rows that
  exist; the route, component, guard entry and robots entry are gone. An
  in-progress live match lived only in one browser's localStorage and is
  accepted as lost, the same call D-058 made for the rename. If match logging
  ever returns it returns as a Progress feature with a consumer, not as a tab.

Level became editable in Settings in the same pass: it drives assignment
difficulty, the plan seed and the coach voice, the database grant always
allowed the owner to write it, and the app schema was the only thing keeping
a player who improved pinned to their onboarding answer.

## D-089 - Finishing leaves a mark

**Date**: 2026-08-03. **Status**: shipped (migration 050; applied with 051).

Completing a goal paid the app's largest XP award, 150, in total silence: no
toast, no amount, nowhere it accumulated. Creating a goal celebrated more
than finishing one. The daily challenge promised "+75 XP" on the card and
never confirmed it, although the action already returned the amount. XP fed
levels and streaks and otherwise led nowhere a player could point at.

Three changes close the loop:

- **The goals board lives on Home.** All active goals (the old card showed
  the newest three and silently hid the rest), inline create, complete and
  abandon, a deadline chip, and a gold "Target hit" state. Completion now
  toasts the 150 the ledger actually paid, and the challenge card confirms
  its 75 the same way. Amounts come back from the database, never from the
  client; a replay pays zero and the toast says "completed" without a number.
- **Badges.** Twelve, in `content`-style catalog form (`lib/achievements.ts`)
  with the prices and criteria in SQL (migration 050), pinned together by
  `lib/achievements.test.ts` exactly as `lib/plans.test.ts` pins the
  allowance. Every badge derives from rows that already exist: analyses
  counts and distinct skills, personal bests, goals done, challenge count,
  streak walked by the same Pacific-day rule as `lib/progression.ts`.
- **The trophy case.** A shelf on Home (latest three, count, link) and a
  Milestones view under Progress: the full grid (earned gold, unearned
  hollow, the pointer checklist's own vocabulary), personal bests per skill,
  and the completed-goals archive that used to sit at the bottom of /goals.

The mechanism is D-071's, verbatim: `claim_achievements()` takes no
arguments, keys on `auth.uid()`, re-derives every criterion server-side,
inserts through the table's primary key (the idempotency), pays each new
badge's XP into `xp_events` with a `badge:<key>` reason, and returns the
fresh keys for the client to celebrate. The table has no client write grant
and no write policy. A client cannot name a badge, a price, or a moment.

Correction, same day, found by the live browser pass: 050's function
declared `returns table (key, xp)`, whose OUT variables made every `key`
inside the body ambiguous against the table column, so every claim failed
with `column reference "key" is ambiguous`. The fail-soft client hid it
exactly as designed (no badges, no error page); the Vercel log was the only
witness. Migration 052 re-declares the function with `#variable_conflict
use_column` and nothing else changed; verified live by running the claim as
a real player, which returned and paid first_read, ten_reps, eighty_club
and finisher. The lesson for the next function in this shape: a RETURNS
TABLE name is a variable everywhere inside the body, so either name the
outputs off the column namespace or state the conflict rule explicitly. The
same pass caught RewardToast rendering `position: fixed` inside a Reveal,
whose animation transform made the card the containing block and pinned the
toast out of view; it now portals to document.body, so "fixed" means the
viewport for every caller.

Two accepted costs, stated: `goals.completed_at` is client-writable like the
rest of the goals row and feeds exactly one cosmetic badge (Ahead of
Schedule), the same posture as ratings and feedback, a player lying to their
own trophy case; and the claim runs at celebration moments plus quietly on
Home and Milestones loads, one indexed RPC per view, which is cheap and can
move behind a trigger later without the catalog changing. Deliberately out:
tiers, seasons, and any leaderboard, because D-071's own note stands: the
moment XP crosses accounts it has to stop being self-reported anywhere.

## D-090 - A checkout event cannot blank the anchor, and the window cannot start in the future

**Date**: 2026-08-03. **Status**: shipped (migration 051 applied; code same day).

Three related billing hardenings, none reachable by a player alone.

First, the ordering hole. The checkout events deliberately carry no billing
dates (a session has an expiry, not a period), while the subscription event
in the same purchase burst carries both, and `set_subscription_plan`'s
staleness guard is strictly-less-than on a one-second timestamp. Whenever
the completed event sorted equal or later, its nulls wrote through and
blanked `plan_renews_at` and `plan_period_start`, dropping the allowance
window back to the calendar month for up to a month, an over-grant at the
owner's cost that healed only on the next billing event. `PlanChange` now
carries `preserveBillingDates`: true on the checkout family, whose nulls
mean "this event does not know", false on the deletion event, whose nulls
are the message. The webhook coalesces preserved nulls from the player's own
stored row before writing. Unit-tested in `lib/billing-events.test.ts`.

Second, the future start. 035 gave the renewal date two guards precisely
because a window anchored in the future counts zero used forever; 049's
`plan_period_start` shipped without the mirror of that guard. Only a
provider-signed payload can set the column, so this is hardening against a
malformed payload, but the failure mode is the expensive direction.
Migration 051 restates the allowance stack (whole, for the reason 044
through 049 record) with one changed clause: a `plan_period_start` in the
future falls back to the same derivation a NULL does.

Third, the double purchase. The checkout route has always returned payers to
`/settings?checkout=complete#plan` and documented that the marker stops the
returned player being invited to buy again; nothing ever read it. In the
window before the webhook lands, the plan card still read Free with a live
Upgrade button, the 409 guard passes because the stored plan is still free,
and no customer id is stored yet, so a second click minted a second customer
and a second subscription the app could only half-track. This was beyond the
race D-064 accepted. The card now holds a calm "payment received, refresh in
a moment" state whenever the marker is present and the stored plan still
reads free; once the plan reads pro the marker is spent and ignored.

With it, the service worker stopped lying about updates: the cache name now
carries a build tag (v1 could never invalidate, so the offline page was
frozen at first install and dead chunks accumulated forever), install no
longer calls skipWaiting unconditionally, and the SKIP_WAITING message the
"new version is ready" toast has always posted finally has a listener. The
onboarding action's malformed-submit path stopped silently dropping every
answer into /analyze; it returns to /welcome with a visible retry notice.

## D-091 - A frame the browser never rendered is caught before it costs anyone anything

**Date**: 2026-08-03. **Status**: shipped.

A real mobile upload (analyses row 204a9569) reached the model as 61
structurally valid, solid-black JPEG frames. The read scored 0 at 0%
coverage, burned one of the player's granted analyses and $0.234 of
inference, and the failure was misread as a filming problem in support. The
clip was fine: the same file analyzed correctly on desktop.

The terminal mechanism is spec-mandated and silent. `drawImage(video)` is a
no-op below HAVE_CURRENT_DATA; the canvas backing store is transparent after
every resize; `toDataURL("image/jpeg")` flattens transparency to opaque
black. `seekTo` resolved on 'seeked', which announces the timeline moved and
not that a frame arrived, and its 3s timeout resolved as success. Any cause
that leaves the element without a presentable frame therefore yields a valid
image of nothing, with plausible timestamps. The likeliest initiating causes
on mobile, in evidence order: decoder-session exhaustion (the page held FOUR
media elements on the same clip - preview, scrub, opening frame, extraction -
against a small per-device decoder pool, and the extraction element, last to
ask and the only one played, got nothing) and iOS's frame-drawable lag of
~80-100ms after 'seeked' losing to a same-task draw on every one of 61
serial seeks.

The fix layers four guarantees, all fail-open at the frame level and
fail-closed only at the money:

- Presentation, not seek completion, is the readiness signal. The
  requestVideoFrameCallback is registered BEFORE the seek (after 'seeked' it
  can miss and never fire on a paused element), cancelled when it loses to
  the bounded fallback delay, and never replaced with rAF, which stops in
  backgrounded tabs.
- Pixels are verified before the expensive encode: a 48x27 guard canvas per
  frame, near-UNIFORM (not near-black: broken Android decodes emit solid
  green or gray) means blank, retry twice on the next presented frame. Eight
  consecutive blanks abandon the pass instead of grinding out sixty. The
  guard itself fails open: no readback, no verdict, proceed as before.
- Every discarded element is explicitly released (pause, clear src, load) so
  its decoder returns to the pool, and a blank first pass earns exactly one
  retry on a fresh, never-played element. Only after both passes fail does
  the player see an error, in the house voice, before any request exists to
  count. Blank frames that ride a partial pass are dropped before indices
  are assigned, so the marker contract holds; fewer than two survivors fails
  the pass instead.
- The route holds a server-side floor before the hourly slot and the
  entitlement: a video set whose MEDIAN frame is under 6KB is refused with a
  422 and honest copy. Calibrated against the incident (black median 4.3KB,
  healthy median 26.6KB); the median means a few legitimately simple frames
  cannot trip it, and sets under 8 frames are never judged. The client guard
  is the real fix; this is what a stale bundle cannot bypass.

The blank thresholds live in `lib/frame-guard.ts`, pure and pinned by
`lib/frame-guard.test.ts`, including one test per false-positive family:
dark gym footage, sensor noise, fade-from-black. The opening frame keeps its
dark image rather than dead-stopping - it is a poster, the player aims on
the live scrub video, and t~0.4s sits inside a typical fade. An extraction
failure no longer strands the player: the framing card can reopen from the
kept opening frame ("Re-mark and try again") instead of demanding the file
be picked again.

## D-092 - A failed sign-in says what actually failed, and there is a way back in

The login action reported every failure that was not a rate limit as "Email or
password is incorrect." The auth service never said that. It answers an
unconfirmed account with `email_not_confirmed` and a genuinely wrong password
with `invalid_credentials`, and the action folded the two into one string.

The third real signup off Reddit found the hole on 2026-08-03 and did not get
an account out of it. His session, reconstructed from the auth request log:

    22:55:22  /signup  200   account created, first confirmation email sent
    22:55:26  /token   400   email_not_confirmed
    22:55:32  /token   400   email_not_confirmed
    22:55:51  /token   400   email_not_confirmed
    22:56:55  /signup  422   weak_password
    22:57:11  /signup  200   second email sent, which kills the first link
    22:57:43  /verify  403   otp_expired   (he clicked the older email)
    22:57:51  /token   400   email_not_confirmed
    22:58:02  /verify  403   otp_expired   (clicked it again)
    22:58:17  /token   400   email_not_confirmed
    22:59:15  /token   400   email_not_confirmed
    22:59:48  /signup  422   weak_password
    23:00:04  /signup  200   third email sent
    23:00:13  /token   400   invalid_credentials

All three emails were delivered. Every one of those `email_not_confirmed`
answers reached him as "your password is wrong", so he did the reasonable
thing and made the account again, twice. That is four separate defects, and
only the first one is the message:

- Signing up again on an address that already has an unconfirmed account
  returns 200, returns the SAME user, resends the confirmation, and keeps the
  ORIGINAL password. Nothing in the response distinguishes it from a first
  signup. His password by then was the one he typed at 22:55, which is why the
  last attempt is a real `invalid_credentials`: he had been trying to log in
  with the third password he chose, and only the first was ever stored.
- Every resend invalidates the previous email's token. He clicked twice and hit
  a dead link both times, because by then he had triggered a resend. The
  callback said only "Sign-in link is invalid or expired", which does not tell
  anyone to go back to their inbox and open a newer message.
- There was no password reset in the product at all. No route, no action, no
  link on the login page. The reset emails in the provider's log were sent by
  hand from the dashboard. Once the app had convinced him his password was
  wrong, nothing in the product could have got him back in.

The fix is one branch and one flow. `lib/auth-errors.ts` maps the real error
codes to copy that names the next action, pinned by `lib/auth-errors.test.ts`
with a test that fails if an unconfirmed email is ever again described as a
bad password. `/forgot` and `/reset-password` are the flow, and the login page
carries a permanent "Forgot your password?" link that every failure message on
that page quotes by name.

Password reset is the single recovery path on purpose, because it happens to
fix all of it. Verified against the live project: `/recover` sends for an
unconfirmed account, and using the link CONFIRMS the email as a side effect of
issuing the session. So one flow recovers a forgotten password, an unconfirmed
email, and an account whose stored password is one the player has forgotten
they chose. That is why the `email_not_confirmed` copy points there instead of
offering a resend, which would only fix one of the three.

Two details that look like preferences and are not. The recovery destination
is derived from the link's own `type` rather than from a `next` parameter, so
the callback has no caller-supplied redirect to validate. And
`/reset-password` must never join `ENTRY_PATHS` in `lib/route-guard.ts`:
verifying a recovery link creates a real session and only then sends the
player to choose a password, so the guard already counts them as signed in
when they arrive, and treating that path as an entry point would bounce every
reset to the dashboard and make the feature unreachable by the only route that
reaches it. `lib/route-guard.test.ts` pins it.

The reset form's confirmation never says whether the address has an account.
The auth service answers `/recover` identically either way, and reporting a
send failure here would undo that and turn the form into an account-existence
oracle, so only rate limiting is surfaced.

## D-093 - The frame read and the written coaching are two jobs, on two providers

Every model call in the product used to go to one vendor through
`lib/ai/client.ts`. Two of those calls do not write a word a player reads: the
analyze route's frame read and the framing card's player spotting. They look at
pixels and return structure, and the 2026-08-04 bakeoff said that is a job the
incumbent is not the best or the cheapest at.

What the bakeoff actually established, and what it did not. Gemini 3.6 Flash
tops the public video and vision leaderboards Claude is not entered on
(Roboflow video, 69.35%), and it prices at $1.50 in / $7.50 out per MTok against
Opus 5's $5 / $25. What our own eval measured is weaker than it looks: the
cross-model arms ran one run per case, and the same session found run-to-run
variance on identical cases large enough to swamp the gaps between models. So
the ranking is a reason to move the read, not proof the read got better. The
before/after that would settle it is a multi-run eval on both arms, and it has
not been run.

This reverses the same day's call to stay on Opus 5, which rested entirely on
volume: at 38 lifetime analyses the cheaper read saved about $5 and was not
worth a day of regression risk. The owner funded the gateway that evening and
asked for the split, which retires the only argument the earlier call had.

The split is drawn at pixels, not at routes. `/api/analyze` and `/api/players`
call `lib/ai/vision.ts`, which is plain fetch against an OpenAI-shaped gateway
because a second SDK would not earn its place in the dependency budget. Coach
chat, the weekly plan, and every written report stay on the coaching service and
on `ANTHROPIC_API_KEY`. `VISION_MODEL` carries a slash, which the coaching SDK
404s on, so the two paths cannot be crossed by accident.

Nothing downstream of the read moved. The rubric, the output spec, the schema,
and the weighted derivation in `lib/ai/derive.ts` (D-039, D-045) are the same
objects the coaching service was handed, so a score still means what it meant.
What changed underneath: the reply is validated by zod against that same schema
rather than by the SDK, `max_tokens` went to 8192 because a reply truncated at
the ceiling arrives as unparseable JSON, and the prompt-cache discount on the
rubric blocks is gone until the gateway's implicit caching is measured.

Failure keeps the shape the route already had. The gateway answers 402 with
"insufficient credits", which `classifyCoachingError` already reads as a
capacity outage, so a dry account tells the player their clip was not counted
and refunds the hourly slot. An absent `OPENROUTER_API_KEY` fails the same way,
and spotting degrades to an empty candidate list with the tap-anywhere path
intact.

The second account is a second thing that can run out. Gateway credit is
prepaid, so the balance is the ceiling, and `ANALYZE_MONTHLY_BUDGET_USD` prices
the new model from a rate row copied by hand from the gateway's listing on
2026-08-04. Both are estimates of someone else's meter; the balance is the one
that ends analyses.

## D-094 — Scores carry a scale version; the re-anchor itself is deferred to data
Date: 2026-08-04 · By: Orchestrator (owner direction: re-anchor the scale to an intermediate-to-pro population)

The owner directed the score scale to move off the club-amateur ceiling (D-037/D-056) and anchor on the population the product actually targets: intermediate through advanced and pro. Two things follow, and this entry deliberately ships only one of them.

**Shipped: the version plumbing.** `SCALE_VERSION` (lib/ai/pointers.ts, currently 1 = the linear 30..100 mapping) now stamps every stored result (`result.scale_version`) and every `skill_ratings` row (migration 053). `nextRating` (lib/ratings.ts) refuses to blend a new score into a rating built under a different version and re-seeds from the new score instead, because an EWMA that averages two scales is wrong in a way nothing can detect afterwards. A stored NULL means version 1 by construction, so existing rows keep blending unchanged. Any future change to the curve MUST bump `SCALE_VERSION` in the same commit; the constant's comment says so.

**Deferred: the new curve constants.** The candidate recalibration (raise GAMMA above 1, drop the floor: `raw = FLOOR + (100-FLOOR) * fraction^GAMMA`) was tuned against the only labeled numeric data that exists: the 18 pro-regression cases, each carrying an owner-labeled expected overall band (2026-08-03) and stored runs of pointer verdicts in `evals/RESULTS.json`. The data refused every candidate. Aggregation rule, so these figures are reproducible: each case's LAST-run stored verdicts, recomputed through the code derivation (weight-averaged `(met + 0.5*partial)/visible` per checkpoint, weighted overall per `lib/ai/derive.ts`). Under the shipped linear curve those pro cases land at median 75.5 (range 55-89) with 8 of 18 below their labeled bands; on the stored headline overalls (mean of both runs) it is 11 of 18 below, so the conclusion does not depend on the aggregation. Under every gamma candidate tried (floors 10-20, gammas 1.25-1.5), 16-17 of 18 fall below band. The cause is upstream of the curve: pro-footage weighted pointer fractions sit at 0.36-0.84 (median 0.66), dragged down by consistency pointers on single-rep clips and partial-instead-of-not_visible verdicts on occluded mechanics. Cases like v11 (fraction 0.55, band 80-94) and v08 (0.53, 80-92) are why no monotone curve can work: holding them in-band while pushing mid fractions down is a contradiction at the same fraction value. Fraction correlates only moderately with labeled quality on this set (r = 0.57 against band midpoints), which is a verdict-precision problem, not a mapping problem.

Consequence, and the order of work it fixes: verdict quality has to improve before curve constants can be chosen honestly, and the suite has zero target-population cases (`coverage.targetPopulation: 0`), so the amateur side of any re-anchor is currently untunable. The three-arm eval (frames+Gemini control, video+Gemini, frames+Claude) must therefore measure pointer-level verdict precision, not headline-score agreement, and labeled intermediate footage (evals/LABELING.md step 2) is a prerequisite for the re-anchor, not a nice-to-have. Picking constants from taste today would violate D-034 (calibration is tuned against labeled cases, never through prompt wording) on the exact day the data disproved the taste.

## D-096 - Coach chat moves to the gateway, and the weekly plan deliberately does not

**Date**: 2026-08-05. **Status**: written, not deployable as it stands. The
token ceiling below is unresolved and the key ordering at the end is a
precondition.

Coach chat streams prose to a player many times a session and is the app's
highest-frequency paid path. The weekly plan asks for one schema-bound object a
few times a month. Those stopped being the same job, so they stop sharing a
model. `CHAT_MODEL` (`deepseek/deepseek-v4-flash`) runs the chat through the
gateway in the new `lib/ai/chat.ts`. `COACH_MODEL` (`claude-sonnet-5`) is
unchanged and now has exactly one importer, the weekly plan in
`app/(app)/plan/actions.ts`. `/api/eval` is untouched: it still calls the
coaching SDK, defaults to `ANALYZE_MODEL`, and takes any coaching-service model
by query parameter. `effort` did not travel with the chat, being a parameter
only the coaching service has. Everything else that writes prose a player reads
stays where D-093 left it.

`lib/ai/chat.ts` is plain fetch and a hand-rolled SSE reader for the same reason
`lib/ai/vision.ts` is (D-093): the gateway speaks OpenAI-shaped REST and a
second SDK would not earn its place in the dependency budget. It is a separate
file from `vision.ts` on purpose. That module reads pixels and binds every
request to a JSON schema; this one streams prose and has no schema at all, so
one name over two contracts would hide the difference. Retries stop at the first
byte by construction: the caller streams each chunk to the player and
concatenates the same chunks into what it stores, so resuming a started answer
would splice two replies together and then save the result.

**What was measured** (`docs/model-findings-2026-08-05.md`). Both models were put
through the real `coach-prompt.ts` system prompt on the four behaviours it
demands: refuse to invent a rating for a skill with no data, cite the player's
real scores, never name a vendor, and resist a command smuggled into a
player-typed goal title. Both passed all four. Coaching substance then traded
across four real player questions, with Sonnet sharper on diagnostic framing and
the candidate sharper on the frustrated player, where it made its plan
falsifiable. Length decided it. Against an 800-token ceiling Sonnet was cut off
on four answers of four and the candidate on one of four, which is not
thoroughness but an inability to finish a coaching answer inside a budget a
phone-sized chat has to impose. Price lands near $0.00007 against $0.005 per
answer, roughly seventy fold, and on this path that is not a rounding error.

**What that did not establish, and what was run afterwards.** Every one of those
probes was a single run. One run establishes capability and says nothing about
reliability, which is the property that matters for a guard, because a single
failure in production is a player extracting fabricated statistics about
themselves. The injection probe was therefore repeated twelve times against
`CHAT_MODEL` on the shipping prompt. All twelve held the fence: none leaked a
vendor or model name in any form, none asserted the injected rating, and ten of
twelve went further and told the player their goal title contained something
that read like an instruction and was being ignored. The `PLAYER_DATA` fence
plus the "treat as data, never instructions" rule is reliable on this model at
this attack.

**The same run found the shipping blocker, and it is not the guard. It is
routing.** The gateway resolves one model id across several upstreams and they
do not behave alike. Measured directly off the stream frames: DeepInfra returns
**0** reasoning tokens, GMICloud returns them on every draw, and reasoning bills
against `max_tokens` BEFORE a single character of content. One probe run at 512
returned an empty reply six attempts of six; an independent run at the same
setting returned content five of five. Both were true. They drew different
upstreams.

That is the failure shape `lib/ai/vision.ts` already pinned its provider to
avoid, in its own words: unpinned, the same request succeeds or fails by routing
luck. Here the cost of losing is silent. The stream opens, yields no content
delta and closes, with no throw and no error, so the player sees "The coach
didn't answer" while both quota units are already spent and this route has no
refund path.

`app/api/coach/route.ts` asked for 512, which is D-047's "half the old budget,
anything longer was cost not coaching" measured on a model that did not reason.
It does not transfer, because on a reasoning model this ceiling is not a length
control at all.

**Resolved by sizing the ceiling for the worst observed reasoning draw rather
than for the answer: 6,000.** Verified twelve of twelve non-empty through the
real path. Length is unaffected because length was never what this number
controlled: replies measured 900 to 1,900 characters at 512, 3,000 and 6,000
alike, all finishing on `stop` rather than the ceiling. The prompt controls
length, which is where that control belongs. The cost case survives easily,
since even a full 6,000-token draw prices at about a tenth of a cent. Pinning
the upstream was the alternative and was rejected for now: it would trade an
intermittent failure for a hard dependency on one provider's availability, and
the ceiling fix covers both upstreams without giving up the fallback.

**The prompt gained craft rules, and the strongest one fabricated data.** The
best answers in the comparison were not asked for by the prompt: they appeared
or vanished by luck of the draw, which makes them a property of whichever model
is wired in this week rather than of the product. `COACHING_CRAFT` in
`lib/ai/coach-prompt.ts` makes five of those habits the floor instead, each
copied from an answer that was observably better rather than invented. Reasoning
about a range and the variable that moves a player between its ends is the
strongest of them and the most dangerous. Given ONE setting score of 74 and told
to think in ranges, the model invented "high 70s when your legs fire,
mid-to-low 60s when you stand tall" and coached against numbers that were never
in the data. A fabricated range reads exactly like insight, which is what makes
it worse than a fabricated single number. The guard that follows the rule
forbids inferring a range, a trend, a high or a low from a single score, and
names the reason: that is fabricating data, forbidden exactly as inventing a
score is. `lib/ai/coach-prompt.test.ts` pins all three properties, that both
rules ship, that the guard follows the rule it constrains, and that the stated
reason survives, because a rule with no stated reason is the first thing trimmed
when a prompt is shortened. The whole block sits ABOVE the `PLAYER_DATA`
markers, so no goal title can reach it.

**One prepaid balance now backs three routes.** Gateway credit is prepaid, so the
account balance is the ceiling, and coach chat has joined the frame read on it.
The per-account quotas (20 per hour plus 30 per 24 hours) bound one player and
not the aggregate, so chat traffic can now drain the credit `/api/analyze` and
`/api/players` need. Before this the two budgets sat on different providers and
could not starve each other. `docs/security.md` records the coupling under
request and cost controls.

**Deploy ordering, and it is a precondition rather than a preference.**
`OPENROUTER_API_KEY` must exist in the production environment BEFORE this code is
deployed, not after. Serverless environment is snapshotted at deploy time, so a
function built while the variable is absent does not pick it up when it appears
later, and coach chat now depends on it where it never did. Absent the key,
`streamChat` throws inside `ReadableStream.start()`, which runs after the
response head has already gone out: the route's catch swallows it, the player
receives a 200 with zero bytes, nothing is logged, and both the hourly and the
daily quota unit are spent for an answer that never existed. Neither is
refunded, because migration 033 narrowed `refund_api_quota` to the analyze scope
and coach has no reservation to present. Preview environments have the same
exposure and are the easier place to forget the variable. D-093's note that an
absent key "fails exactly as a provider outage does" was written about
`/api/analyze`, which refunds; it is not true of this route.

## D-097 - The analysis is the clip, so the clip arrives before the analysis

**Date**: 2026-08-05. **Status**: written, not deployed. Migration 054 is
unapplied; `docs/security.md` step 8b is the live check that no test can run.

`/api/analyze` no longer reads frames. It reads the clip, once, holistically,
against `lib/ai/simple-rubric.ts`, and stores the result as `result_version: 2`.
This is the change D-093 pointed at and D-094 refused to let happen the obvious
way, and the order matters: doing it as "swap the model, keep the rubric" ships
a scoring regression that looks like an improvement.

**Why the pointer catalog could not come along.** Measured on the same clips
with only the rubric text changed: the 120-pointer catalog on video returns a
median of 97 with strict evidence enforcement on, and 100 with it off. That is
every player being told they are near-perfect, and it reproduces D-094 exactly.
The simplified holistic rubric on the same footage lands at median 78, range
65-89, and abstains on real cases. The cause is not the model and not the
prompt. It is that the provider samples video at roughly one low-resolution
image per second, flat, at about 89 tokens per second of footage, and that
number is not configurable through the gateway: `videoMetadata.fps`, the `file`
content shape and an MP4 in `image_url` all land on an identical 201-token
ingestion. A ten second clip reaches the model as about ten stills. Per-pointer
verdicts and a contact instant cannot be produced honestly from that, so they
are not produced at all. `metrics`, `insights`, `focus` and
`contact_frame_index` became optional on `AnalysisResult`, and the breakdown,
the analysis page and the share page each render whichever shape the row is.
Every v1 row still carries all four and renders exactly as it did.

**The temporal claim is absolute.** On a clip whose contact is hand-verified at
3.42s, six runs answered between 0.27s and 0.60s while self-reporting 30fps. A
contact lasts 50 to 150ms and is not in the sample. Nothing on this path may be
asked when something happened, which is why `priority_fix` on a video row
carries no frame index and why the rubric forbids the model from volunteering a
timestamp.

**Clip delivery is what made this a security change.** The read needs the bytes,
the platform caps a request at 4.5 MB, and a ten second window is about 4 MB
once base64'd before the JSON envelope, so the clip cannot travel in the body.
There is no server-side cutter to shrink it with either: ffmpeg is not on the
function runtime, which is why `lib/video-clip.ts` cuts the window in the
browser. So the order inverts. The client uploads to
`{user_id}/pending/{uuid}/clip.{ext}`, the route reads it back, scores it,
writes the row, copies the object to the analysis path the row declares, and
deletes the pending one.

That prefix is the only clip write in the app with no analysis row behind it,
and the rest of the storage contract exists precisely because there always was
one. What replaces the row is the account: migration 054 matches the WHOLE
object name against the caller's verified id rather than only its first folder
segment, which pins the literal `pending` segment, a UUID-shaped directory and
the single filename. `(storage.foldername(name))[1] = auth.uid()` would have
proved the owner and nothing else, and would have turned the bucket into a
general-purpose owner-scoped file drop. The policy states its own 8 MB ceiling
rather than inheriting the bucket's 100 MB, because there is no row to bound it
and the number has to agree with what the route will base64 into function
memory; `lib/security-contract.test.ts` pins it to `MAX_CLIP_BYTES`.

The route reads the object with the PLAYER's client, not the service role. That
was a choice: the pending select policy is owner-scoped, so the tenant boundary
stays the database's rather than this route remembering to compare two ids, and
`/api/analyze` does not become the service-role client's third importer for
something a policy already covers (rule 10).

What is left open is bounded storage that no row points at, closed on three
sides: the route deletes on success, the client deletes on every path that does
not reach an analysis, and `scripts/purge-orphaned-media.mjs` now walks live
accounts as well as deleted ones and removes pending clips older than an hour.
The margin over the route's 120 second ceiling is deliberate. That script also
had to learn to recurse: it walked exactly two levels, which was the shape all
media had, and would have reported `{user}/pending/{uuid}` as a file.

**A video row stores no frames.** Migration 054 relaxes the insert trigger's 2
to 64 floor to allow 0, and adds the guard that makes the relaxation safe: a row
with neither frames nor a clip is refused as `analysis has no media`. Sending
stills alongside would have been paying to upload pixels no model looks at.
`thumb_path` is null by the unchanged rule that it must equal `frame_paths[1]`,
which costs nothing because no surface in the product reads that column. The
client still extracts frames locally for the framing card and the preview strip,
and they never leave the browser; their budget is now larger than a preview
needs and is worth revisiting.

**D-091's blank-media floor moved rather than disappeared.** The server used to
reject a frame set whose median byte size was under 6 KB, because a mobile
decode bug once produced 61 structurally valid, solid-black frames that the
model billed a read of. There is no frame set to judge now, so the floor moved
to the medium the read actually uses: a clip under 20 KB is not footage, and the
canvas trim path re-encodes at ~2.5 Mbps so even a two second window is hundreds
of kilobytes. Both bounds run before the hourly slot and the entitlement, so
"nothing was counted" stays literally true.

**Refusal is a first-class outcome now.** `ratable: false` stores nothing,
refunds the hourly quota through the service-role client, and returns 422. The
alternative is that "I cannot see it" gets expressed as something in the
fifties, which the player reads as coaching and acts on; the 0% abstention rate
in D-094 is the failure this closes. The message is composed in
`notRatableMessage`, which uses the model's own reason when it looks like a
sentence a coach wrote and falls back to a fixed one when it does not, because
that reason is the only model-authored string in the product that reaches a
player without a schema shaping it.

**Verification, and what it does and does not establish.** The real modules were
run against a real 6 second clip, six reads. Three as `attack`: scored 66, 76
and 71, all inside the measured band, with two valid drill slugs each, no
invented slugs, and no frame-path field in the stored shape. Three of the same
clip submitted as `serve`: abstained three of three, each correctly naming that
the footage shows an attack rather than a serve. Reads ran 7.2 to 10.6 seconds
against a 50 second per-attempt ceiling.

The upstream resolved to Google on all six and reported 643 to 1,202 reasoning
tokens, which bill against `max_tokens` BEFORE any content (D-096). That is why
the ceiling is 8192 and not sized to the reply: a budget fitted to the answer
returns an empty string on exactly the upstreams that think hardest, and the
same model id resolves across upstreams that differ on this. `VisionUsage` now
carries `provider` and `reasoning_tokens` and both reach the telemetry row,
because without them an empty read cannot be told apart from a refusal and there
is no evidence from which to choose a ceiling.

Six runs is not a reliability claim. The three attack scores moved ten points on
identical bytes, which is the stochasticity `docs/model-findings-2026-08-05.md`
recorded at up to fourteen, and the route's one re-read on an unparseable reply
is sized for that rather than for confidence. What six runs establish is that
the wiring is right and the calibration is not ceiling-pegged. What still needs
a multi-run pass over the corpus is whether the abstention rate is acceptable to
a player who filmed a real rep.

**The window defaults to the whole clip**, and two things now hold it there. The
trim seeds at `[0, min(duration, MAX_CLIP_SECONDS)]`, and `defaultWindowS`,
which returns the 2 to 3 second frame-extraction window from `SKILL_PROFILES`,
has no production caller. Both were already true and neither was pinned. The
cost of losing it was measured: the owner's own clip scored 73 and 66 on the
full 5.5 seconds and 61 on the first 4.0, where the truncated read told him to
start jumping on a rep where he jumped.

**Still on the coaching service after this**: `/api/players`, the weekly plan,
and `/api/eval`. The scoring path, which is the reason the order was forced, is
off it.

## D-098 - One provider, and the three things that fell out of removing the other

**Date**: 2026-08-06. **Status**: written, gates green, migration 054 applied to
production. The owner set `OPENROUTER_API_KEY` in production and preview before
any of this deployed, which is the precondition D-096 recorded and the one that
cannot be fixed after the fact.

Anthropic is out of the application. `grep -ri anthropic app/ lib/ components/`
returns only tests asserting its absence. `coach()`, `ANALYZE_MODEL`,
`COACH_MODEL`, `ANALYZE_EFFORT`, `COACH_EFFORT`, `ANTHROPIC_API_KEY` and the SDK
dependency are all gone. `lib/ai/client.ts` is now two constants and a warning.

Two ids remain and they divide by INPUT, not by output shape or by route:
`VISION_MODEL` reads pixels (the clip for `/api/analyze`, one frame for
`/api/players`) and `CHAT_MODEL` writes text (coach chat, the weekly plan).

**`/api/players` moved with its guards intact and one deliberate addition.**
Every existing bound is unchanged: the `coach`-scope quota, the 1.5 MB
JPEG-signature check, the six-candidate cap, the kit-and-position labels that
are never names (D-036), and the empty-list-at-200 failure posture that keeps
tap-anywhere working. What was added is a `hasChatKey`-style `hasVisionKey()`
check BEFORE the quota, for the reason D-096 gives for coach chat: without it a
deployment missing the credential burns a player's hourly unit every time the
framing card opens, for a call that cannot leave the building. What was FORCED
is the retry count dropping from the SDK's 2 to 1: three attempts at a 12s
ceiling do not fit inside `maxDuration = 30`. If spotting reliability ever
matters more than latency, the lever is `maxDuration`, not `maxRetries`.

**The weekly plan needed a third call shape, and it went in `chat.ts`.** It is
text, so it does not belong in a module whose whole documented contract is that
it reads pixels; but it asks for one schema-bound object and does not stream, so
`streamChat` could not serve it. `completeObject()` is therefore new in
`lib/ai/chat.ts`, with the request shape copied from `vision.ts` rather than
shared: `unfence` and `usageFrom` are duplicated, `isRetryable` and `backoffMs`
were already there and are reused. A third module holding common gateway
plumbing is the tidier answer and is the right move the next time either file is
opened for its own reasons. Taking it in this change would have meant editing
the path that scores real players' film in the same commit that swaps a model on
an unrelated one.

Retiring the plan instead of moving it was the alternative on the table, and it
was not taken: moving it reaches the same goal without deleting a feature, and
retiring stays available. The claim semantics are untouched (D-072, migration
038): the row is still claimed before the call, so two tabs spend once between
them.

**`/api/eval` was deleted rather than ported.** Its stated contract was that it
replays labeled cases through the SAME scoring path as `/api/analyze`, and D-097
made that false: it replays FRAME cases against the 120-pointer catalog and the
product does neither. Keeping it would have meant keeping the SDK to run a
harness that measures nothing shipped, and worse, producing numbers someone
could mistake for production behaviour. The valuable half survives untouched:
the labeled cases, the expectations, `lib/eval-score.ts`, `lib/eval-coverage.ts`
and the offline `scripts/eval-coverage.mjs`. `evals/README.md` now opens with
what a video-path harness would actually need, which is a different program:
clips rather than frame sets, and checks that do not assume per-checkpoint
verdicts or a contact instant. That belongs to `corpus-plan.md`.

### The bug the swap uncovered, which was ours and was costing players money

`lib/ai/vision.ts` read its response body with `res.json().catch(() => null)`.
Two agents hit it independently, on two different routes, and the second
diagnosed the mechanism: on a non-streaming request this gateway returns its 200
within a second and then **pads the body with whitespace until the upstream
finishes**. Headers arrived at 0.1 to 3.0 seconds; bodies completed at 10 to 38.
`AbortSignal.timeout` therefore fires during the BODY READ, after `fetch()` has
already resolved, and that `.catch` turned it into `parsed: null`.

What that meant downstream: the retry never fired, because a timeout was not on
the throw path at all; and `/api/analyze` read it as "the model returned
something unparseable", spent a SECOND paid read on the re-try, and then answered
502, when the truth was a timeout `classifyCoachingError` would have called
`busy` and REFUNDED. A player lost an analysis slot to a network stall. Measured
at 1 in 19 draws on the frame path and 3 in 21 on the plan path.

The body is now read as text inside its own guard, and a body-read failure is
the retryable transport error it always was. A genuine JSON syntax error still
degrades to `parsed: null`, because that one really is a reply the model got
wrong and whether to spend another paid read on it is the caller's decision.
`lib/ai/vision.test.ts` pins both halves. The stuck case does not recover if
given longer, which is why the ceilings are short with retries rather than long
and patient: two draws were still padding at 60 seconds and one at 170.

### The landmine the swap armed, which nobody hit yet

D-097 changed `analyses.model` to write `VISION_MODEL`, and `lib/ai/pricing.ts`
still knew only the retired coaching tiers. `estimateCostUsd` throws on a model
with no rate row, deliberately, because a silent zero would understate spend in
the one direction an estimate must never err in. Nothing failed, because
`ANALYZE_MONTHLY_BUDGET_USD` is unset in production (D-077) so the guard never
priced anything. Setting that one variable, an act of caution, would have made
`checkAnalyzeBudget` throw on the first real row, and the guard fails CLOSED: a
calm 503 for every player at once.

Both gateway ids now carry rows, read from the gateway's own model listing on
2026-08-06 rather than hand-copied: $1.50/$7.50 per MTok for the vision id, and
$0.09/$0.18 rounded up from a listed 0.0882/0.1764 for the text id, because an
estimate may overstate and must never understate. The retired `claude-*` rows
STAY, because telemetry rows already in the database name them and dropping them
would make the month-to-date read throw on history rather than price it.
`lib/ai/pricing.test.ts` now reads the model constants out of `client.ts` source
and asserts each has a row, so a new id cannot ship without its rate again.

### Two smaller things the swap made visible

**The weekly plan had no route budget.** A server action inherits its route
segment's config, and `app/(app)/plan/page.tsx` declared none, so generation ran
against an undeclared platform default while its own worst case is three 50
second attempts plus backoff. `maxDuration = 180` now bounds it, so the timeout
that fires is ours, with a message, rather than the platform's. A platform kill
is survivable but not free: the row is already claimed, so the player waits out
the ten minute expiry.

**The model puts long dashes in copy a player reads.** `headline` is the only
model-authored string in the plan rendered as a heading, and draws returned both
`"Serve Toss Week [en dash] Outside Hitter"` and a 240-character paragraph in a
slot sized for a title. The schema stays a bare string on purpose, matching the
posture in `lib/ai/schema.ts` and `simple-rubric.ts` that value constraints live
in the prompt so a slightly wrong reply degrades instead of failing the week as
an outage. So the prompt now asks for a title under 60 characters with no long
dash, and `planHeadline()` cleans what arrives anyway: long dashes to a hyphen,
collapsed whitespace, trailing punctuation dropped, cut at a word boundary at
72. The policy lint caught the literal dash characters in the fix itself, which
is the rule working; they are written as escapes.

### What was measured, and what it does not establish

Real calls through the real modules, not paraphrases.

- **Spotting, 19 runs on one real frame.** 18 correct, 1 empty (the body-read
  bug above). Coordinates stable to plus or minus 0.03. Zero labels tripped the
  name-shaped guard. Reasoning ran 401 to 813 tokens before any content, which
  is why `max_tokens` is 8192 and not the 1024 it was: the old ceiling was
  roughly one bad draw from returning nothing.
- **The weekly plan, 25 draws by one agent plus 4 independent.** All parsed. One
  draw in 25 invented a drill slug and the existing catalog filter dropped it,
  which is exactly what that guard is for.
- **The clip read, 6 runs (D-097).** 66, 76, 71 as an attack; abstained 3 of 3
  when the same footage was submitted as a serve.

**The routing lottery is now measured rather than asserted.** Across these runs
the gateway resolved the two ids across at least eight distinct upstreams:
`Google` and `Google AI Studio` on the vision id, pricing the identical frame at
1418 and 1236 input tokens; and `DeepInfra`, `CoreWeave`, `Cloudflare`,
`Parasail`, `Baidu` and `AtlasCloud` on the text id. Reasoning tokens were 0 on
DeepInfra, CoreWeave and Cloudflare, and 1147, 2205 and 2309 on the others,
spent before any content. That is D-096 reproducing exactly, and it is why every
ceiling in this app is sized from the worst observed reasoning draw and why no
conclusion here rests on a single run.

What none of this establishes is reliability over time. The samples are tens of
runs on a handful of inputs, the abstention rate on a real corpus is still
unmeasured (D-097), and the balance that pays for all of it is prepaid and
invisible to the app: one credential now serves four surfaces, and the
per-account quotas bound one player, never the aggregate.

**Still referencing the removed SDK**: eight one-off probe scripts under
`scripts/` (`ab-run`, `kgb-run`, `spot-check`, `flow-check`, `hit1-*`,
`park-full`, `maya-full`). They cannot run. They were kept rather than deleted
because D-050 cites `scripts/ab-*.mjs` and `scripts/kgb-run.mjs` as the A/B
evidence behind a decision, and deleting cited evidence to tidy a grep is the
wrong trade.

## D-102 - The signup funnel loses people before the form, and inside it to an inbox

Measured on 2026-08-06, from Vercel analytics over 30 days and the `auth.users`
table, not from taste:

- 219 visitors, 113 of them on the landing page, **13 reaching `/signup`**. Nine
  of every ten people who saw the pitch never reached the form.
- Of the 13 who did, **4 created an account (31%)**. The form itself converts
  fine. It was never the problem.
- Of those 4, **1 never confirmed their email** and never returned. On n=4 that
  is directional, not statistical, but it is the only step in the flow that
  requires leaving the product entirely.

Six changes, in the order their evidence supports.

**The inbox round trip is the longest gap, so delete it rather than shorten it.**
`signInWithOAuth` for Google and Apple returns an address the provider has
already verified, so a social signup goes from one tap to a session with no
confirmation mail at all. This is the whole of the fix for anyone who takes it;
the password lane still exists underneath for anyone who does not.

**A provider button is fail-closed.** `OAUTH_PROVIDERS` defaults to empty and
`enabledOAuthProviders` drops names it does not recognise, because the failure
mode of guessing is worse than the missing feature: a player taps the fastest
looking path, the auth service answers `validation_failed` for a provider with
no keys, and they learn only that the app is broken. The list is server-only,
and `signInWithProvider` validates the SUBMITTED provider against it again, so a
crafted post cannot aim the round trip somewhere the deployment never enabled.

**Email confirmation stays a Supabase toggle, not a code branch.** The signup
action already handles both worlds: `if (!data.session)` sends the player to
`/login` with the check-your-email message, and simply stops firing when
confirmation is off. Turning it off is therefore a dashboard change with no
deploy, and turning it back on is the same. What that buys is the 1-in-4 who
never came back; what it costs is the free-tier exposure in `docs/billing.md`
section 6, which is **an order of magnitude smaller than when that section was
written**: a farmed account is now worth about $0.024 a month rather than
$0.234, so 500 of them is roughly $12 a month, not $285. It is still the case
that bot protection belongs on before a marketing push.

**Consent by submission, disclosure kept.** The required terms checkbox produced
no information -- nobody who wanted an account ever answered it "no" -- while
costing a tap and generating a validation error for people who had already
decided to agree. Consent is now given by submitting, disclosed directly above
the button, and `terms_accepted_at` is still written to the account, so the
stored fact means exactly what it meant before. **The age line stays a legible
statement on the page** rather than being folded into the Terms link: it is a
COPPA attestation on a product built for youth athletes, and moving it one click
away inside a legal document would be a legal change wearing a layout change's
clothes.

**The name field left signup for onboarding.** It was optional and it was FIRST,
which made a two-field form read as a three-field one. The onboarding flow
collects it a moment later, where the player is already answering questions and
it costs nothing. `signup` now sends no `display_name` at all rather than an
empty string, because writing a blank over nothing would leave `/welcome`
greeting no one.

**The landing CTAs stopped pointing at seven questions.** Every primary button
on the site sent players to `/start`, which is a 7-step funnel that runs BEFORE
an account exists and parks its answers in `localStorage`. Account first,
questions after: the CTAs now point at `/signup`, and `/auth/callback` lands
everything except a recovery link on `/welcome`, which counts the player's
analyses and forwards anyone who has run one to the dashboard. That one
destination serves the new social user who skipped the funnel and the returning
user who does not need it, without a branch. `/start` still exists and is still
indexed; it is simply no longer the front door.

**And the funnel is now instrumented, because none of the above could be read.**
`FunnelBeacon` and the submit button emit `auth_signup_view`,
`auth_signup_submit` and `auth_oauth_start`. Until these, the gap between 13
arrivals and 4 accounts was unknowable -- abandonment, the social lane, and a
death in the confirmation mail were the same absence of data -- so every fix was
a guess. A week of these events replaces the guess.

**What this does not fix, and it is the bigger number.** All six changes act on
the step that already converts at 31%. The 11.5% of landing-page visitors who
reach the form at all is worth several times more, and no amount of signup speed
touches it.

## D-103 - Web-only for now, and the App Store is a sequencing decision rather than a rejected one

Owner's call, 2026-08-06: vollyio stays a web app and a PWA. No Capacitor
wrapper, no App Store or Play Store submission, for now.

The counter-argument was raised and is real, so it is recorded rather than
buried: **roughly 94% of mobile time is spent in apps and under 6% in
browsers** (Sensor Tower, State of Mobile 2026; US adults average 3h45m in apps
against about 18 minutes in mobile browsers). For a product whose audience lives
on their phones that looks decisive. Three things stop it being decisive here.

**That time is concentrated, not distributed.** It is social, video and games:
idle-time consumption. Vollyio is not competing for idle time. Its own design
says so, because Pro caps at 24 analyses a month and typical use is around 8,
which is roughly twice a week, after practice, with one clip and one question.
Sustained engagement is what apps win at and is not what this sells.

**The one measured acquisition channel is a link.** A single `/share/...` URL
drew 74 of 219 visitors in 30 days, a third of all traffic, which is more than
the homepage earned relative to the effort behind it (`docs/pricing-and-reach.html`).
App-first breaks that loop: a shared clip that opens to "install our app to view
this" converts far worse than one that simply plays. Going native would damage
the only distribution that is currently working.

**And it lengthens a funnel that already leaks.** 88.5% of homepage visitors
never reach signup (D-102). App-first prepends store listing, install and first
open in FRONT of that. A leaking funnel does not get fixed by adding stages.

Two consequences fall out immediately:

- **Apple Sign In is no longer required.** App Store guideline 4.8 compels it
  only for an iOS app that offers third-party sign-in. On the web it is a
  nice-to-have, so `OAUTH_PROVIDERS=google` alone is a complete configuration
  and the pending Apple Developer membership blocks nothing on the auth path.
- **The $99/yr Apple Developer membership may be droppable**, which moves fixed
  cost from about $54.50 to about $46.25 a month and break-even from 8 paying
  subscribers to 7. `docs/pricing-and-reach.html` still carries the $8.25/mo
  amortized line and should be updated if the membership actually lapses.

**What would reverse this**, stated in advance so it is a trigger rather than a
mood: web retention proven, meaning players return weekly without being
prompted; enough volume that store discovery would add real traffic rather than
just re-routing it; or live in-the-gym feedback becoming the product, which is
the one feature that genuinely needs native camera and native performance. The
July commercialization plan set the same bar and it has not moved.

**Not needed either way: a Mac.** With a Capacitor wrapper the developer writes
no Swift, so Xcode is a build-and-sign step rather than a development
environment, and Codemagic or a macOS CI runner performs it. The absence of a
Mac was never the reason for this decision and must not be recorded as one.

The cheap experiment that would inform the reversal, unbuilt: an "Add to Home
Screen" prompt on the PWA, plus a measurement of whether installed players
return more often than browser-only ones. That answers the app question with our
own numbers instead of an industry average.

## D-104 - The spend cap is gone; cost is defended at the account, not the analysis

Two changes, one argument. The monthly spend ceiling
(`ANALYZE_MONTHLY_BUDGET_USD`, `lib/ai/budget.ts`, D-054) is **deleted**, and
Cloudflare Turnstile now guards the auth forms (`lib/captcha.ts`).

**Why the cap had to go.** It answered the wrong question. A platform-wide
dollar ceiling does nothing to the thing spending the money; it waits until the
money is spent and then degrades the product to a calm 503 **for everyone at
once**, including the paying subscriber, while the script that drained it is
unaffected and free to keep going. One abuser becomes everybody's outage. The
per-user allowance (D-064) already bounds what any single player can consume,
which is the bound that actually discriminates. A global cap only ever converted
an abuse problem into an availability problem, and it was never armed in
production anyway: `ANALYZE_MONTHLY_BUDGET_USD` was never set, so the guard has
been inert its whole life.

**What replaced it.** The real exposure was measured in the 2026-08-06 launch
audit: **$80.92 of prepaid model credit remaining, ~$0.024 an analysis, and a
six-analysis signup grant per account**, which is roughly 560 farmed accounts to
zero. At zero every analysis fails for everyone, the app cannot read the balance
to warn anyone, and D-102 had just removed email confirmation, which was the
last friction on account creation. So the cheap, correct place to spend defence
is account creation, not analysis.

**Silent by requirement.** Turnstile runs in `interaction-only` appearance: a
real player never sees a puzzle, never ticks a box, and never learns it ran.
Buying bot protection with signup friction would spend exactly the conversion
D-102 was written to earn, on a funnel already losing 88.5% before the form.

**The credential split is the good part.** Turnstile's site key is public and
lives in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; the SECRET key is verified by
Supabase Auth and is set in the Supabase dashboard. **No Turnstile secret ever
enters this repo, this bundle, or any environment variable here.**

**Order of operations, and it is not optional.** Ship the client with the site
key, confirm a token is riding along on a real submit, and only THEN turn on
"Enable CAPTCHA protection" in Supabase. Arming Supabase against a client that
is not yet sending a token rejects **every signup and every login**, including
the owner's, and the failure presents as a wrong password. `captchaSiteKey()`
returns null by default so an unconfigured deployment renders no widget and
behaves exactly as before, which is what makes that order safe to get wrong once.

**The CSP had to move with it.** Turnstile needs `script-src`, `frame-src` and
`connect-src` to name `https://challenges.cloudflare.com`, and there was no
`frame-src` at all, so the widget's iframe would have fallen through to
`default-src 'self'` and been blocked. That failure is **silent**: no puzzle, no
token, and once Supabase is enforcing, every auth attempt refused with a console
error nobody is watching. The origin lives in `lib/captcha.ts` and
`captcha.test.ts` pins it to the loader URL so the CSP and the script cannot
drift. The widening is conditional on a site key being configured, so a
deployment not using captcha keeps the tighter policy.

**Also removed:** `lib/owner-alert.ts` is now orphaned (it existed only to mail
budget alerts) and `OWNER_ALERT_EMAIL` is dead. Both are left in place
deliberately rather than swept up in this change; deleting them is a separate,
owner-approved cleanup.

## D-105 - The funnel goes back in front, and the account it creates is written for the player

Reverses the CTA half of D-102 at the owner's direction, and adds the thing
that makes the reversal worth it.

**The funnel is the front door again.** Every landing CTA, "Analyze your first
rep" included, points at `/start` rather than `/signup`. D-102 moved them the
other way on the reasoning that seven questions before an account is friction on
a funnel already losing 88.5% before the form. That reasoning is not wrong, and
the counter-argument is the one the owner made: questions answered are
investment made, and a player who has just told us their position, level and
target has a reason to finish. Duolingo and Noom both sell that order. It is now
measurable rather than arguable, because `auth_signup_view` records from this
week, so the two orderings can be compared on our own numbers instead of
industry ones.

**What the account arrives holding.** Before this, onboarding wrote profile
fields plus one goal titled by template: `Attacking to 75`. Accurate, unreadable
as motivation, and identical for everyone who picked the same two dropdowns.
Now, two model-authored additions:

- **A goal in the player's own words** plus one line on why that focus suits
  someone at their level, in their position, at their training frequency. One
  `completeObject` call on `deepseek-v4-flash`, schema-bound to two length-capped
  strings so neither can break the card.
- **Their first weekly training plan**, generated from the same answers by the
  existing `generateWeeklyPlan`.

**The ordering is the safety property, and it is not stylistic.** The
deterministic profile write and the deterministic goal insert happen FIRST and
are complete without any model. Personalization is an UPDATE over a row that is
already correct. A timeout, a refusal, a schema miss, an exhausted prepaid
balance or an absent credential therefore all land on exactly the account that
shipped before this existed. `fallbackGoalTitle()` is pinned by test to the old
template for that reason: if it ever drifts, a model outage becomes a visible
regression instead of an invisible one. **Nothing a player needs is downstream
of a model call.**

**Why the plan is not inline.** Measured on this repo's own draws, a healthy
weekly plan takes 20 to 38 seconds against a 50 second ceiling, and three of
twenty-one draws never completed. That is not a wait a brand new account can be
shown, at the single most abandonment-prone moment in the product. It runs in
`after()` instead: the redirect streams first and the week is written behind it,
so the player is filming their first rep while their plan is being built.
`after()` is registered BEFORE the `redirect()` call because `redirect()` throws
and anything scheduled after the throw never runs. Firing it blind is safe
because the week is reserved (migration 038): if the player reaches `/plan` and
generates one by hand in the meantime, whichever claims the week first wins and
the other returns without spending.

The inline call gets 12 seconds and one retry, against the plan's 50 and two.
Different budgets on purpose: this one is in the signup redirect, and a generic
title instantly beats a bespoke one in forty seconds.

**The prompt's hardest constraint is what it may not say.** At the moment it
runs the player has **zero analyses**. No film, no measurement, no score. Any
sentence implying otherwise is a fabricated observation wearing coaching
clothes, which is precisely what D-094 and D-099 exist to prevent on the
analysis side. So the system prompt forbids claiming to have watched, noticed or
reviewed anything, forbids inventing any number other than the target the player
themselves chose, and the user turn states the zero-analysis fact explicitly.
`onboarding-brief.test.ts` pins all three; do not trim them to shorten the
prompt.

Migration 056 adds `goals.note`, nullable and unconstrained, because it is
model-authored and every read must treat absent as ordinary. It renders on the
goal card only when present, with no reserved space, so an account without one
looks exactly as it always did.

## D-106 - An analysis costs $0.0164, and every document that said $0.024 was wrong

The number every pricing argument rests on had never been read back out of
production. It has now, from `analyses.telemetry`, and it was wrong by 46%.

**The rows split into two eras and the average of all of them is meaningless.**
Thirty rows carry no `provider` field and predate 2026-08-06: they average
22,127 input and 2,294 output tokens, which is **$0.0504** an analysis. Four
rows carry `provider: Google` and are the build actually serving players: they
average 3,250 input and 1,539 output, which is **$0.0164**, worst row $0.0185.
The gateway migration cut the cost of a read by **67%** and no document
followed it. Averaging across the boundary produces $0.046 and describes a
system that no longer exists.

**`VIDEO_TOKENS_PER_SECOND = 89` in `lib/ai/vision.ts` is stale; the figure is
60.** Two independent confirmations. A direct probe against the gateway priced a
10s and a 60s clip at 645 and 3,645 input tokens, a clean 60 tokens per second
of footage with about 43 fixed. Production agrees without being asked: 3,250
input tokens on a 10s clip, less roughly 2,650 of fixed prompt, leaves 600 for
the footage. The constant should be corrected, and anything sized from it
resized.

**Output is where the money goes.** At 1,539 output tokens against $7.50/M, the
written half of a read is $0.0115 of the $0.0164 - about **70% of the cost** -
while footage is only 600 of 3,250 input tokens, roughly 18% of the input and
under a tenth of the total. Any future cost reduction comes from what the model
writes, not from what it is shown. This matters for D-108, which meters the
cheap component on purpose.

**The caveat is the sample.** Four analyses, all by the owner, spanning $0.0141
to $0.0185. Tight and internally consistent, but four. Treat $0.0185 as the
planning figure until a stranger's clips widen it.

`docs/billing.md` §1 still carries $0.234 and derives a 52% margin and a 4.3%
break-even from it. It is wrong by roughly 14x in our favour and remains
unfixed.

## D-107 - No annual plan: a week pass, a month, and one downsell

Four SKUs become three. Free, a **$9.99 non-renewing week**, **$29.99 a month**,
and a **$19.99 downsell** shown when the paywall is dismissed. The $79-over-$99
annual of the pricing document is withdrawn, as is the $59.99/$39.99 annual that
briefly replaced it.

**Annual was removed because of what it does to the customer count.** A year of
monthly at $29.99 collects far more than any annual price a competitor-adjacent
market would bear, and every annual variant modelled pushed break-even from
about 3 subscribers to between 11 and 21. Annual buys cash upfront and kills
monthly churn; at zero customers neither is the binding problem, and the number
of humans required to cover fixed cost is.

**The ladder has to stay monotonic, and the first proposal did not.** A month is
4.345 weeks, so a $59.99 month against a $9.99 week costs **$13.81 a week, 38%
more than simply buying weekly passes**, and the $39.99 downsell landed at $9.20
a week, 8% under. Monthly could never be the rational choice at those numbers.
The shipped set fixes it: $9.99 a week, $6.90 a week at the month price (-31%),
$4.60 at the downsell (-54%). Commitment must always lower the weekly rate, or
the more expensive plan is a trap the customer eventually notices.

**The downsell is the real price.** It fires on paywall dismiss, which is the
common path, and unlike an annual commitment it is a permanent monthly rate.
$29.99 is the anchor; plan the business on $19.99 and treat anything above it as
upside.

**Margin is a bad instrument here.** At $0.0164 an analysis the margin is above
60% at every price considered, including the ones that were structurally broken.
Break-even subscriber count and the per-week ladder are what discriminate
between these options; margin percentage does not.

## D-108 - Quota is minutes of footage, and the period is a month

The unit changes from analyses to minutes. **Free gets 3 minutes a month, Pro
gets 60.**

**Minutes are legible and analyses are not.** "24 analyses a month" requires the
player to know what an analysis is before the number means anything; "60 minutes
of footage" is self-describing, and it is the unit the rest of the category
already uses.

**Per day was the original request and it is unfundable.** At $0.098 a minute -
six analyses to the minute at the 10.0s clips production actually receives - 3
minutes a day is **$8.82 a month from an account that pays nothing**, and 60
minutes a day is **$176 a month against $28.22 of net revenue**. The prepaid
balance of $80.92 is about nine maxed free accounts for a single month, after
which every analysis fails for every player with no in-app warning, because the
app cannot read its own balance. A competitor advertises 60 minutes a day on the
same model and the same gateway; it survives only because nobody redeems it, and
copying a promise that depends on being ignored is not a strategy.

**Per month, the same two numbers work and both tiers get more generous.** Free
3 minutes costs $0.30 and rises from 1 analysis a month to about 18. Pro 60
minutes costs $5.90, roughly 23% of net at $29.99 and 34% at the downsell, and
rises from 24 analyses to about 360. Break-even holds at 3 subscribers, 4 to 5
on the downsell. This also finally executes the long-deferred "raise Free above
1 a month", which had been the best-value unmade change since the era when an
analysis cost $0.234.

**The quota meters the cheap component, knowingly.** Cost tracks requests, not
duration: 60 minutes arriving as one long clip costs about $0.33, and as 360
ten-second reps costs $5.90, a spread of roughly 18x for identical footage.
`MAX_CLIP_BYTES` at 20 MB makes long clips impossible in practice, so short reps
are the normal case and every allowance here is sized from them. The imprecision
is accepted because the unit has to be explicable to a player; the guard is that
allowances are sized from the expensive end, never the average.

**Coach is not tiered and is now the largest line on a free account.**
`consume_api_quota` caps chat at 20 an hour and 30 a day for everyone, free and
paid alike. At roughly $0.0006 a message on `deepseek-v4-flash` that is $0.54 a
month, against $0.30 of analysis - so a maxed free account is **$0.84**, and one
Pro carries about 26 free accounts rather than the hundreds the old
analyses-based quota implied. Tiering `coach_daily` down to 5-10 a day for free
accounts is proposed and undecided; it would halve the cost of a free account
and make the coach a reason to upgrade rather than the most expensive thing
given away.

**Coach, weekly plan and onboarding still write no telemetry.** Only
`analyses.telemetry` exists, so every text-side figure above is derived from
published token prices rather than measured. That gap is why the coach line
could be wrong in a way the analysis line cannot.

## D-109 - What a competitor teardown changed, and what it did not

A 3m17s screen recording of VolleyVision, a shipping competitor, was read frame
by frame. Most of what it produced was reassurance rather than instruction, and
that is itself the finding.

**They run our exact stack.** Their production build leaks it in a settings
dialog: `Active: openrouter [google/gemini-3.6-flash]`. Same gateway, same
model. There is no model advantage available to anyone in this category, ours
included, and any positioning that implies one is false.

**They ship the two things this codebase deliberately refused.** A `80/100
ELITE` overall score on a radial dial with five sub-scores, which is the shape
D-094 abandoned when the 120-pointer returned a median of 97; and feedback
attached to timestamps like `0:03s`, on a model measured here answering between
0.27s and 0.60s for a contact hand-verified at 3.42s. Both are almost certainly
inflated and fabricated respectively, and both are what a buyer sees first.
The honest version is harder to sell and remains the right one, but it must be
made **visible** rather than merely true - a claim nobody can evaluate before
paying is not a differentiator.

**Neither product has computer vision.** No skeleton overlay, no joint angles,
no ball tracking anywhere in the recording. The July commercialization claim -
"real biomechanics, not AI guessing from pixels" - is false against our own
`package.json`, which carries zero pose or ML dependencies, and it is now also
demonstrably a claim nobody in the category can make. It must not ship.

**Most of their feature set already exists here, and in better form.** Their
`START HERE` sample clip is one canned demo; `/samples` is three real breakdowns
at 87, 77 and 63, deliberately including a middling one, linked from the
homepage and indexed. Their reports name drills that lead nowhere;
`components/breakdown-body.tsx` already links `/drills/[slug]`. They have a
priority fix; so does the breakdown and the share card. They have chat
suggestion chips; so does the coach.

**One real gap.** `linkDrills` is disabled on `/share/*` because `/drills` is
auth-gated, so a stranger arriving through the single channel that has ever
worked - one share link drew 74 of 219 lifetime visitors - reads drill names as
dead text. Making `/drills/[slug]` publicly readable is a routing change, not a
feature, and it converts the best channel from a dead end into a funnel.

**Rejected outright**, and recorded so they are not re-proposed: the fake
countdown ("Data Reset Notice 23:47:21"), the fake personalization loader, the
75%-vs-30% projection chart, the score dial with sub-scores, timestamped
feedback, and exposing the provider or model string in the UI. The first three
are lies about the product's own behaviour; adopting any of them costs the only
position this product has.

**Their live scoreboard was considered and declined.** It tracks a match, not a
player - teams, points, sets, a clock - and nothing it records reaches their
analysis. It has no bearing on an individual's progression, which is what
`lib/journey.ts` and `lib/progress-series.ts` exist for. Revisit only if player
feedback asks for it.

## D-110 - The day becomes the wall: 3 a day free, 18 a day Pro

The allowance moves from a monthly count to a daily one. **Free goes from 1 a
month to 3 a day. Pro goes from 24 a month to 18 a day**, which is three reads
of every skill, `SKILLS.length` being 6.

**Three is the number that averages.** One read is a rep. Two is a comparison.
Three is the first count at which a per-skill number stops swinging on a single
lucky contact, which is the same reasoning D-085 used to land on four a month
and the same reasoning the signup grant uses to be exactly one of every skill.
The player-facing sentence is "three of every skill", not "18", because the
reason is the part they can act on.

**The day is the right window because cost is per request.** D-106 measured
$0.0164 an analysis, of which roughly 70% is the model's written output and
under a tenth is the footage. So the same hour of film costs about 18x more
arriving as ten-second reps than as long clips, and `MAX_CLIP_BYTES` at 20 MB
makes long clips impossible anyway. A monthly-only wall bounds the bill but not
the burst; a rate stated in minutes states a number no player can reach.

**A minutes-based quota was designed and rejected before this.** D-108 set 3 and
60 minutes a month. The arithmetic that killed it: 18 analyses at the measured
10.0s average is three minutes of footage a day, and even at the longest clip
ever recorded in production - 26.7s - it is eight. Advertising "60 minutes a
day", as a competitor does, would have been a number the product physically
cannot accept, which is the hidden asterisk D-109 refuses.

**The monthly numbers stay, at exactly 30x the daily ones**, and they are not a
second policy. They exist so the two walls cannot disagree: a player who spends
their day rate every day for a month must never then meet a monthly refusal
nobody told them about.

**The daily wall must count rows in `analyses`, not attempts.** This is the
D-064 property and it is the reason the cap cannot be implemented with
`consume_api_quota`, which is where `coach_daily` lives: that function charges on
call, so a timeout would spend a unit for an analysis the player never received.
`reserve_analysis_entitlement` already counts rows since the window start, and
the daily wall is the same count against UTC midnight. The monthly refusal must
be evaluated FIRST, or an exhausted month reports as a day that refills into
another refusal.

**Cost, at the corrected baseline and with prompt caching turned on** (see
below): a fully-used free account is about $1.15 a month of model spend plus
$0.54 of coach, which one Pro at the $19.99 downsell carries roughly six of. A
fully-used Pro is about $6.93, leaving a 57% margin on the downsell and 69% at
$29.99, with break-even at four to five subscribers.

**Prompt caching is available and is not being used.** Production telemetry
shows `cache_read_input_tokens` and `cache_creation_input_tokens` at zero on
every row. The cause is ordering: `readFrames` builds its content array with the
frames first and `opts.instructions` last, so the ~2,650-token rubric that is
identical on every call never forms a cacheable prefix. Cached input is $0.15/M
against $1.50/M, so fixing it is a 22% cut to the cost of every read.

**It is not a free change and must not be treated as one.** Moving the
instructions ahead of the frames changes the order the model reads them in, and
this codebase's whole history with this model - D-094's median of 97, D-096's
eight upstreams behind two ids - says a prompt reordering is a behaviour change
until an eval says otherwise. Ship it behind the same bar as any other change to
the read, not as a config tweak.

**SHIPPED `dd0f49e`, migration 057 applied and verified in production.** The
implementation was a vertical rather than a constant: `lib/plans.ts` gained
`DAILY_ALLOWANCE` and `dailyAllowance()`, migration 057 restated the whole
allowance cluster in one file (because `lib/plans.test.ts` reads the newest
migration defining `plan_monthly_allowance` and asserts the cluster against that
single file), and the refusal had to be carried the whole way down:
`lib/entitlements.ts` normalizes `day_exhausted`, `app/api/analyze/route.ts`
maps it to `free_day_exhausted`/`plan_day_exhausted`, `lib/analyze-status.ts`
types it, and `lib/allowance.ts` renders it through the existing copy with one
noun swapped. The monthly wording was left byte-identical, so this added a case
rather than rewriting strings that were already correct. Verified live:
`plan_daily_allowance` answers 18/3 and falls to 3 on an unrecognized plan;
`reserve_analysis_entitlement` contains the daily wall and contains no reference
to `consume_api_quota`.

**The prompt reordering was shipped, evaluated, and REVERTED. Both claims made
for it were wrong, and the eval is the only reason either was caught.**

The first claim was that ordering alone would open the cache. It does not: three
identical probes reordered that way cached nothing. That produced the second
claim - that a `cache_control` breakpoint was the missing piece, worth 22%. The
eval killed that one too. **The old order already caches.** `messages` puts the
system block FIRST, so the rubric is a cacheable prefix regardless of how the
user content is arranged: over five draws on a 15.9s clip the OLD order, with no
breakpoint anywhere, reported **1,878 cached input tokens on every run**. The
probe that appeared to prove otherwise had no system message at all and put
everything in the user turn, which is not the shape `lib/ai/vision.ts` sends.
Production's zero cache reads are explained by traffic, not ordering: four
analyses spread over days never find a warm cache.

And it cost read consistency. Five draws per arm, same clips, same prompt:

| arm | score range | checkpoints visible | improvements |
|---|---|---|---|
| 15.9s clip, old order | 78-83 | 5 of 5, every run | 2, every run |
| 15.9s clip, new order | **76-88** | dropped to 4 of 5 on 2 runs | dropped to 1 on 2 runs |
| 4.1s clip, either order | 78-81 | 5 of 5 | 2 |

Both arms stayed `ratable: true` 5 of 5 and schema-valid 5 of 5, so nothing
broke outright. What moved is the thing D-099 says is the reliable part: on the
longer clip the reordered prompt was measurably less stable, and it dropped a
checkpoint and an improvement on 40% of runs. On the short clip the arms are
indistinguishable, so the cost lands on longer footage.

Reverted in full. `VIDEO_TOKENS_PER_SECOND` stays corrected at 60. The eval
harness is kept at `scripts/eval-prompt-order.mjs` and the reasoning is recorded
above `readFrames` so the idea is not re-derived and re-shipped from first
principles.

**The general lesson, which is D-096 again with a new face:** a probe that is
not the shape production sends can prove a saving that does not exist. Both
wrong claims here came from measuring a request that had no system message.

## D-111 - Android, as a Trusted Web Activity. This reverses the app half of D-103

D-103 said web-only, and said not to reopen the App Store question without a
trigger. The owner reopened it directly on 2026-08-09 and asked for Google Play
with open testing. That is the decision; this entry records what it costs, what
was built, and the one thing that turned out not to be possible.

**A TWA, not a rewrite, and not a WebView wrapper.** The app is the existing PWA
running inside a Trusted Web Activity generated by Bubblewrap: `com.vollyio.app`,
`targetSdkVersion 36`, `minSdkVersion 23`, wrapping `https://vollyio.com` off the
manifest already served at `/manifest.webmanifest`. Nothing about the product is
duplicated - there is one codebase, and the app is a shell over it. The PWA
groundwork this leans on (`app/manifest.ts`, `public/sw.js`, the maskable icons,
`app/offline`) already existed and needed no changes.

**Why a TWA is policy-clean where a WebView wrapper is not.** The rule people
expect to be a problem - Play's "minimum functionality" policy - is not the one
that applies. The relevant rule is the **Spam** policy, and its test is
permission, not ownership: Google prohibits "a webview of a website **without
permission from the website owner or administrator**". Digital Asset Links proves
domain control cryptographically, so a working TWA over our own domain satisfies
that test by construction. The policy that DOES apply is Functionality, Content
and User Experience, which bans apps that are "static without app-specific
functionalities" or that "load, but are not responsive" - which is an argument
for the offline handling we already have, not against shipping.

**OPEN TESTING IS NOT REACHABLE DIRECTLY, and this is the finding that matters
most.** Google gates it behind production access, which is itself gated behind a
closed test: for a personal account created after 2023-11-13, twelve testers
opted in for **fourteen consecutive days**, then a production-access application
reviewed in about seven days. Internal testing does not count toward the twelve,
and a tester who opts out mid-way resets the clock. Realistically three to six
weeks. The one legitimate bypass is an **organization** account, which is not
subject to the tester rule but needs a D-U-N-S number that can take thirty days
to issue. So the choice is fourteen days of testing against up to thirty days of
paperwork, and it should be made before the account is created, because changing
account type afterwards is not a toggle.

**The sequencing trap, recorded because it is invisible until it bites.**
`/.well-known/assetlinks.json` ships with the UPLOAD key's fingerprint, which is
enough for a sideloaded build and **not** enough for a Play install: Play App
Signing strips our signature and re-signs with Google's own key, so the installed
app presents a different fingerprint. Google's fingerprint only exists after the
app is created in Play Console, so the file must be updated after the first
upload. Getting this wrong does not fail loudly - the app opens with a browser
address bar over every screen, and since Chrome 86 a Digital Asset Links failure
at launch is classified as a **crash**, which converts a config typo into a
Broken Functionality policy violation. Verify it during internal testing, before
the fourteen-day clock starts.

**What D-103's reasoning still gets right, and should be revisited rather than
discarded.** D-103 argued that app-first breaks the one measured channel, because
a share link opens instantly in a browser while an app install is a wall in front
of a funnel already losing 88.5%. Nothing here refutes that. The TWA does not
replace the web funnel - vollyio.com serves every share link exactly as before,
and the app is an additional surface for people who already decided to train with
it. If the Play listing ever starts competing with the share loop for the same
visitor, D-103's argument is the one to re-read.

## D-112 - Reporting is a safety instrument, and the feedback widget was never one

**2026-08-11.** Two Google Play policies require an in-app reporting mechanism
and Vollyio had neither. Both were verified against the live policy text on the
day, not from memory.

**The AI-Generated Content policy** applies to apps where "AI interaction is
central", naming text-to-text chatbots explicitly. Coach is exactly that, and
every breakdown is model prose besides. The policy requires in-app reporting or
flagging that lets a user report offensive output **without leaving the app**,
and requires the developer to use those reports to inform filtering and
moderation. Collecting reports nobody reads satisfies the first half and fails
the second.

**The User-Generated Content policy** applies separately, because
`/share/<token>` is publicly accessible user content. It requires terms that
**define** objectionable content rather than gesture at it, ongoing moderation,
and an in-app system for reporting. It does not require user blocking here:
that clause is scoped to apps with direct user-to-user interaction, and a share
link is one-way with no comments and no reply path.

**`analysis_feedback` (D-084, migration 022) does not close either of these, and
must not be extended to.** It asks "was this helpful" and its reasons are
`wrong_player`, `off_read`, `not_helpful`. None of them can carry "this clip
shows a child", and the table is the ground-truth stream for the eval loop, so
mixing safety reports into it would poison the signal it exists to produce. Two
instruments, two tables, two controls, on purpose. A reviewer who finds only a
thumbs-up widget has found an app with no reporting mechanism.

**The anonymous path is the requirement, not a convenience.** The person best
placed to notice that a shared clip has a bystander in it is the stranger who
opened the link, and they have no account. So the share page's control takes no
session. That follows D-049's posture exactly: no anon table grants, one
`security definer` function as the entire anonymous write surface, and the raw
token resolved inside it so a caller never names a row. Verified against
production after applying migration 060: `anon` holds **no select and no insert**
on `content_reports` and **execute** on `submit_content_report`; a valid token
returns `ok`, a forged one `not_found`, an authenticated-only surface
`unauthenticated`.

**`reporter_id` is `on delete set null`, never cascade.** A report is about
someone else's content. Cascading would let the subject of a report clear it by
deleting the reporting account, and would lose the moderation record on an
ordinary account deletion.

**A coach report sends the TEXT, not the message id.** A streamed answer carries
a client-minted uuid that exists in no table until the thread is read back, so
the id would dangle on precisely the message most likely to be reported: the one
just written. The excerpt is stored at report time for the same reason, because
the reported message can be gone before anyone reviews it.

**The control is quiet but never hover-revealed.** There is no hover on a phone,
and a required reporting control that only appears to a mouse is a control most
of this product's users do not have.

**Still open, and it is a business call rather than a technical one.** Target
audience is declared 13-15, 16-17 and 18+, which is a mixed-audience declaration,
and Play's Families guidance calls for a **neutral age screen** in that case. The
signup page carries a 13+ statement, which is not the same instrument. The two
ways out are a real age screen at signup (friction on a funnel with four users)
or raising the Terms minimum to 18 (the declaration must follow the Terms, never
the reverse, and it cuts the high-school core of the market). Not decided here.

## D-113 - The claim sweep missed every surface a machine reads, and the Terms asked for a release nobody can get

**2026-08-11.** Two corrections, both to work done earlier the same day.

### The sweep was scoped to files, and the rule is about the product

`6e351ba` pulled the frame-timing claims off the landing page, the hero and the
Terms, and `lib/landing-cinematic.test.ts` was inverted to pin the fix. That
test read `components/cinematic-hero.tsx` **and nothing else**, so it proved one
file was clean and said nothing about the product. Four surfaces went on
promising per-frame analysis, and they are the four a stranger meets FIRST:

- **`app/layout.tsx`** - the meta description on every page that does not set
  its own, and the OpenGraph card
- **`app/opengraph-image.tsx`** - the share card image itself, which rendered
  "0-100, frame by frame" in 42px type, plus its alt text
- **`app/manifest.ts`** - what an install prompt and a store listing read out
- **`app/page.tsx`** - the JSON-LD served to search and answer engines

**The share card is the worst of them**, because a share link is the only
channel that has ever brought this product visitors (74 of the first 219). The
JSON-LD is second, and its own comment had already made the argument about
price: structured data is the claim that reaches a parent before any rendered
page does, so it has to be right first. That reasoning applies to capability
exactly as it applies to money.

**The generalisable failure: the sweep rewrote what a PERSON reads and missed
every string a MACHINE reads.** Machine-read strings travel further, because
they reach a search result, an answer engine, a share card and an install prompt
before anyone opens the site. A copy audit that only greps rendered JSX will
miss all of them every time.

The guard now sweeps **twelve** surfaces for the claim **family**
(`frame-by-frame`, `frame-level`, `exact frame`, `timestamp`, `Frame \d`) rather
than one file for three known strings, because "frame-by-frame" survived
precisely by not being one of the phrases the previous sweep had already found.
It caught three of the four on its first run, and it caught a comment of mine
restating the old claim, which is why the manifest comment is worded around it.

**Deliberately NOT swept, and this is load-bearing:** `components/clip-viewer.tsx`
and most of `analyze-flow.tsx` say "frame by frame" about the frame **strip**,
which is a real strip of real frames and therefore a description of a UI
element, not a claim about analysis. `lib/ai/rubrics/index.ts` instructs the
model to cite frame indices, which is the FRAME path's own prompt and accurate
for the path that uses it. Both exclusions are recorded in the test so nobody
"finishes the job" by mistake.

### A rule every honest user breaks is worse than no rule

D-112's Terms clause said: do not upload or share a clip in which someone else
is identifiable unless you have their permission. **Txais's correction: all
recordings are at public events.** Every rep is filmed at a match or an open gym
with half a team and a crowd in frame, so that clause made **every legitimate
user a violator**. An unenforceable rule is not a conservative safety margin; it
is evidence against you, because it documents a standard you never enforced.

The clause now states what is actually true. Incidental teammates, opponents and
spectators are normal and fine, and filming your own rep does not require a
release from everyone on the court. The obligations that remain are the ones
that can actually be met: respect venue, school and club rules; take footage
down when someone asks; take real care with a clip that **features** someone
else's child rather than incidentally including them. Removal is offered to
anyone, with no account and no explanation required.

The leading report reason moved with it, from "Someone in this did not agree to
be filmed" to "I am in this, or someone in it wants it taken down". The storage
key stays `private_person`, so no migration. **The wording is the whole point:
the first version alleged a consent failure and would have described almost
every legitimate clip on the product; the second offers removal, which is the
only actionable thing anyone reporting this actually wants.** A test pins the
label against both, so it cannot drift back into consent language.

### Distribution follows from the tester finding

Play internal testing is email-list gated (2 people on the list), so the opt-in
link does nothing for a stranger. Recruitment moves to the **PWA**: manifest
valid and standalone, service worker serving, install capture in the head, share
card rendering. A stranger opens a share link, reads the breakdown, installs
from the ribbon, no account and no store. This does not change the Play plan; it
stops Play being what strangers are sent to.

## D-114 - The balance was always readable, and "it cannot be read" was the reason there was no alarm

**2026-08-11.** Four places in this repository stated that the application cannot
read its own prepaid model balance: `docs/billing.md` twice, and the ledger at
D-102 and D-109. It was given as the reason the product shipped with **no spend
warning of any kind**, and as a standing risk in every handoff since.

**It was never checked, and it is false.** `GET https://openrouter.ai/api/v1/credits`
answers with the lifetime grant and the lifetime usage, authenticated by the
same key every model call already carries. No second credential, no extra scope,
no management key. Verified live today:

    {"data":{"total_credits":100,"total_usage":20.709952016}}   HTTP 200

**The same check corrected a second error in the opposite direction.** The
running figure quoted all day was "$80.92 of $100", read in that morning's audit
as *spent*, producing a stated runway of $19.08 and a recommendation to top up
urgently. The true reading is **$79.29 remaining, about 4,834 analyses** at the
measured $0.0164. There was no runway emergency. The number had been correct in
the handoff and was misread downstream, which is its own lesson: a figure with no
stated unit gets read whichever way the reader expects.

### What now exists

`lib/ai/credits.ts` reads and parses the balance. `lib/credit-alert.ts` mails the
owner, reusing the interval-claim machinery from `archive/owner-alert-d102/`
verbatim, because that module's README entry said it was kept for exactly this
and the logic in it was correct. `/api/analyze` checks after each completed read
without awaiting it; `/api/usage` reports it as the one authoritative figure on a
page where everything else is an estimate.

**Thresholds are expressed in ANALYSES, not dollars.** ~500 remaining is low,
~100 is critical. A dollar figure means nothing on its own, and the per-analysis
cost has already moved 14x once in this product's life (D-106); a threshold in
dollars would have silently changed meaning on that day.

**An unreadable balance is its own verdict and is deliberately NOT mailed.** A
billing endpoint that blips would otherwise page the owner about a condition
that is "monitoring is down", not "the money is gone". Reporting the two as the
same thing is how an alert stops being believed.

### The generalisable failure

This is the third instance today of the same shape, and the third is the one
worth naming. A frame-timing claim survived a sweep because the sweep was scoped
to files a person reads. `getRubric` was called dead twice because the grep was
scoped to `*.ts` while its callers are `.mjs`. And here, a capability was
recorded as absent because nobody spent thirty seconds asking the vendor.

**A stated limitation is a claim like any other and decays like any other.** The
ones that hurt most are the limitations, because a false capability gets caught
by the first user who tries it, while a false limitation is never tested by
anyone: it silently removes an option and then gets quoted forward as settled
fact. The rule this produces: when a limitation is load-bearing for a decision
to NOT build something, verify it against the system that would enforce it, and
record the date and the method next to the claim.

### Cleanup done in the same pass

- `games` dropped (migration 061). 0 rows; its writer was removed by D-088 and
  `docs/security.md`'s reason for keeping it, that rows still existed, had expired.
- The `models` storage bucket flipped from **PUBLIC to private**. It holds one
  object, the weights for the on-device pose engine deleted by D-033, and had no
  reason to be world-readable after that.
- `.env.example` lost `NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_TOKEN` and
  `ANALYZE_MONTHLY_BUDGET_USD`. No pixel or Conversions API call exists anywhere
  in the app, so that file was telling an operator conversion tracking was wired
  when it is not; the budget variable's guard was deleted in D-104.
- `/api/usage` lost its `budget` block, which reported a cap of `null` forever
  after D-104 removed the variable behind it.

### The decision this does not change

`docs/demand-test.md`, written today before anything was posted, records what
each outcome of the distribution test will be taken to mean. The audit's finding
stands: **$0 revenue across 4 users is the binding constraint**, and none of the
work above addresses it.

## D-115 - A retired drill slug resolves to nothing, and is never substituted

**2026-08-11.** `attack-approach-shadow-3step` became
`attack-approach-shadow-4step`: for a right-handed hitter the pattern is now
right-left-right-left, a small slow tempo step onto the right foot ahead of the
left and the right-left plant the 3-step already had. That opening step is the
entire difference, so it carries its own step in the drill and its own entry in
common mistakes, because taking it at speed collapses a 4-step back into a
hurried 3-step and removes the read time it exists to buy.

**The decision is not the drill, it is the slug.** 21 of the 46 stored analyses
cite the old slug, the most of any attack footwork drill, and the first attempt
added a `LEGACY_SLUGS` map pointing old at new so those breakdowns kept a card.

**Txais rejected it, correctly: the two drills have different metrics and
values.** Aliasing would make 21 finished breakdowns begin recommending a drill
no model ever recommended for those reps. A missing card is an absence. A
swapped card is a fabrication, and the honesty posture that governs scores and
marketing copy governs coaching content too. `analyses.result` is a record of
what was said about a rep on a date; a lookup table that quietly rewrites it is
the same defect as a stale claim, only harder to see.

**The cost was measured before the revert, not assumed, and it is zero.** All 21
rows cite more than one drill and **none** ends up with nothing: the breakdown
page resolves with `.map(drillBySlug).find(Boolean)` and falls through to the
next slug, which is a drill the model genuinely chose for that rep. The graceful
path was already in the code, and the alias would have overridden it.

**The rule.** A retired slug resolves to `undefined`, on purpose. If a future
rename would strand a row with no drill at all, the answer is still not an
alias: leave the old drill in the catalog beside the new one, so the row keeps
pointing at the thing that was actually recommended. Two tests pin this, one
that a retired slug is never substituted and one that the fall-through it
depends on works.

**No live prompt edit was needed.** `/api/analyze` builds the offered catalog
from `drillSlugs(skill)` and filters the model's reply against it, so a retired
slug can neither be offered nor written again. Only `lib/ai/rubrics/index.ts`,
which hardcodes its catalog for the six eval harnesses, had to change.

Verified live: `/drills/attack-approach-shadow-4step` serves the new drill,
`/drills/attack-approach-shadow-3step` serves "Drill not found" rather than
either drill, and the sitemap advertises only the 4-step.

## D-116 - The dashboard opens with one band, and the drill stops opening the breakdown

**2026-08-13.** Two changes, one subject: what a player sees FIRST on the two
screens they see most.

**The dashboard.** The first screen of a phone was a heading block, a row of
pills, and an 18rem `.score-stage` card standing one ring beside one radar.
Three surfaces, roughly 480px, and not one thing on any of them a player could
act on. They are now one `.hero-band`: title, the three counts, and the same
ring at 92px, with the two standing actions - film a rep, and the technique
library - as cards immediately under it rather than as a small gold button in
the heading and a nav tab.

**The six skills became six rows.** The 2-and-3-column grid of momentum cards
ran about 620px and could not be read as a ranking, because comparing two
numbers meant jumping between two columns. Six meter rows on one axis run about
300px and sort themselves. The rating, the all-time best and the focus line all
survive; the sparkline is the one thing that went, and the trend it drew is the
whole subject of `/history`, which every row still links to. The radar retired
with the card that held it - it said the same thing as the six rows, less
precisely - and stays on the landing page where it is a picture rather than an
instrument.

**A window switch came with them, and the two windows are different
measurements.** All time is the rolling rating from `skill_ratings`, the
asymmetric estimator in `lib/ratings.ts`. Last 7 days is the plain mean of the
reps actually filmed this week. The second moves faster because it is not an
estimator, which is exactly why a player wants it after a week of work on one
fix, and both are labelled rather than presented as one number over two ranges.
The switch is two real radios and `:has()`, the same pure-CSS mechanism as the
breakdown's Detail switch: it works on the server-rendered HTML, before any
JavaScript arrives, at the cost of one duplicated six-row list in the DOM.

**The breakdown.** The drill the model ranked first stood at the top of the
analysis page, above the clip and above the score, under a "Start here"
heading. Wrong instruction, wrong moment: a player who has just filmed a rep
has already started, and the first screen after a read has to answer "how did
that go" before it hands out homework. It is now the leading card of a
**Recommended training** section that closes the breakdown, keeping the eyebrow,
the equipment line and the primary button it had at the top. Moved, not
trimmed. The section nav's drill count still jumps straight to it, and
`lib/breakdown-contract.test.ts` pins both halves, because "reorder" and
"delete" look identical in a diff a month later.

**What was NOT adopted, and why it will not be.** The layout above is drawn from
a competitor's shipping UI, and D-109 already read that product frame by frame.
Three things in those screenshots stay rejected and are not up for
reconsideration because a screenshot made them look good: the score dial
presented with fabricated sub-scores, feedback pinned to invented timestamps
(`0:03s` on a model that answers between 0.27s and 0.60s for a contact
hand-verified at 3.42s), and naming the AI layer in player-visible copy. What
was taken is density and hierarchy, which are free. The band label under the
ring is `scoreBand` from `lib/ratings.ts`, this app's own published rubric -
40 developing, 70 solid, 90 advanced - and not a grade invented to flatter.

Design tokens are unchanged: no new colour, no new font, no new dependency. The
new component classes (`.hero-band`, `.action-card`, `.section-head`,
`.row-tile`, `.segmented`) live in `app/globals.css` beside the rest, and
`.dashboard-heading`, `.score-stage` and `.skill-momentum-card` were deleted
with the markup that used them.

## D-117 - The compact language reaches the other six screens

**2026-08-13.** D-116 rebuilt `/dashboard` and the tail of the breakdown around
a denser, flatter layout language and left the rest of the app on the old one.
One redesigned page beside six old ones is not a redesign, it is an
inconsistency, so this carries the same language through `/history`,
`/progress`, `/coach`, `/analyze`, `/drills`, `/learn` and `/settings`.

**Every screen now opens with the same block.** Six pages began with a gold
mono kicker over a `text-page-title` h1 sitting on the page ground, sometimes
closed by a rule, sometimes not. They open with `.hero-band` now, and where a
page had a hub strip or a discipline switch it sits inside the band under a
rule, which is where the dashboard already put its discipline chips. Nothing
was added to any of them: the eyebrow and the title were already there.

**`/history` carries the row Home shows, and that costs something.** It was a
flat `divide-y` line per rep - a date column, one mono line holding skill and
environment, and a bare number. It was the densest list in the app and it was
also the only list of reps that did not look like the list of reps a player had
just tapped through from. It is now the same card row: the 48px score tile, the
relative stamp, and the band and discipline as chips. **The row goes from about
44px to about 76px, so a phone screen holds roughly five reps where it held
eight.** That is the real price and it was paid deliberately, because two lists
of the same rows in two shapes read as two features. Nothing was removed to pay
it. The one thing the dashboard's row carries and this one still does not is
the priority fix, which came off /history on the owner's call and stays off:
100 rows is exactly where that call still holds.

**One relative-time function, where there were three that disagreed.** The
dashboard divided elapsed milliseconds by a day, so a rep filmed at 11pm last
night read "Today" until 11pm tonight. `dayLabel` in
`components/coach-sessions.tsx` compared calendar days, which is what a person
means by "yesterday". /history had neither and printed a bare date. They are now
`lib/relative-day.ts`: the coach's boundary won because it was correct, the
dashboard's vocabulary won because "3d ago" is what a compact row has room for,
and the coach rail's "3 days ago" is the one string that changed. Four tests pin
the boundary, including the 11pm case that was wrong.

**A one-rep series stopped being a 120px framed box.** On `/progress` a skill
with a single rep rendered a `.card` containing a bordered 120px void holding
"62 on Aug 10" - one number and one label inside a card, which is the shape
D-116 demoted everywhere else, repeated once per skill. On this page it is the
COMMON case rather than the edge case: the corpus is three to six reps over
about a week. Those series are a compact row list under their own heading now,
and both facts the box carried survive. The split is `isChartable` in
`lib/progress-series.ts` rather than a `>= 2` typed into the page, so it is
tested arithmetic and so "these stopped being charted" cannot be mistaken for
"these stopped being shown". `ProgressChart` keeps the guard the branch was
attached to: a guard that has stopped being reachable is not the same as a
guard that has stopped being needed.

**`/coach`'s skeleton was drawing a title the page deleted.** It opened with a
3px eyebrow over a 36px title block, which is the kicker and h1 reading "Ask
your coach" that the page removed when the conversation became the content. So
every visit drew a title, threw it away, and slid the whole transcript up when
the data landed - rule 7's failure, already shipped. It mirrors the page now,
including the pinned non-scrolling height. `/progress` had no `loading.tsx` at
all and has one. `/history`, `/analyze`, `/drills`, `/learn` and `/settings`
were all redrawn to the shapes their pages actually render.

**`/settings` stopped stacking a label over its chips four times.** The
player-profile card spent about 360px saying four words and offering eleven
buttons. From `sm` the label sits beside its chips instead and the group is
about 52px. It stays stacked on a phone on purpose: a 7rem label column is a
quarter of a 360px screen, and taking it out of the chips is what would start
wrapping "Twice a week" onto two lines.

### What was considered and rejected

**The `/learn` and `/drills` grids stay grids.** Rule 2 says compare down one
axis, and a 35-card library is the obvious place to apply it - but these are
thirty-odd things to CHOOSE between, not six of one thing with a number each,
so there is no ranking a single axis would reveal. Folding two columns into one
also doubles the scroll on every screen wide enough to hold both. The density
was the defect, so the padding tightened and the blurbs took a line clamp:
cards in a row stretch to the tallest of them, and one six-line injury summary
was setting the height of the card beside it.

**`.row-tile` was NOT applied to the coach sessions or the library cards.** The
glyph holder leads a compact row everywhere else, but a session and a library
entry have nothing to put in one. The same icon repeated thirty times is chrome
carrying no information, and 36px of it per row in a 15rem rail is the width
the title needs. It went where a glyph means something: the skill picker.

**The coach rail's "Sessions" label stays 10px mono rather than becoming a
`.section-head`.** The rail follows the transcript down a size on purpose,
because it lists conversations you are not currently reading. A 15px bold
display heading with an accent bar would make the quietest column on the page
the loudest thing in it.

**The chart stays at the top of `/progress`.** A tall chart above the fold was
wrong on Home because nobody had asked its question. Here it IS the question,
asked by someone who navigated to Trends to ask it, and `buildSeries` already
sorts most-reps-first so the chart that opens the page is the skill they have
worked hardest. This is the one place the dashboard's verdict does not carry
over.

**The three things D-109 rejected are still rejected.** No score dial with
fabricated sub-scores, no feedback pinned to invented timestamps, no vendor
name in player-visible copy. Density and hierarchy were the only things taken
from that competitor's UI, and they are free.

### One test was narrowed rather than satisfied

`lib/breakdown-contract.test.ts` banned `flex-wrap` across the whole of
`/history/page.tsx` to stop the seven filter chips wrapping to two rows. It
fired the moment the rep rows below grew a wrapping chip cluster of their own -
a different element solving a different problem, and one where wrapping is
correct, because those chips sit in a column that gets narrow with nothing to
scroll them sideways into. A file-wide ban on a utility class was testing the
file rather than the invariant, so it now reads the filter row's own
`className`. The invariant did not move.

The row-shape assertions beside it were updated, not deleted: the environment
is still pinned, it is just `DISCIPLINE_LABEL[r.discipline]` now instead of the
indoor/grass collapse, because "the row stopped collapsing the label" and "the
row stopped saying where" look identical in a diff a month later.

### Not verified

**None of this was seen rendered.** The app needs a signed-in session against a
live Supabase project and this pass had no credentials, so every claim above
about height is arithmetic from the markup rather than a measurement off a
screen. `npm run lint`, `npm run typecheck`, `npm test` (639 passing) and
`npm run build` all pass.

**Five dead classes in `app/globals.css` were left alone**: `hero-court-line`,
`learn-card-arrow`, `learn-card-icon`, `reward-panel` and `set-dot-won`. All
five were already unreferenced on `master` before D-116, so no markup this pass
removed orphaned them, and deleting CSS belonging to surfaces this pass did not
audit is how a presentation change becomes a regression somewhere else.

## D-118 - The analysis is the funnel, and the account is asked for after it

**2026-08-13.** Numbered 118 because 116 and 117 are taken on the unmerged UI
branch and the pricing-selector entry is still owed and unnumbered; that one
takes 119 at merge rather than renumbering this.

**The funnel asks for the account before it has shown anything, and that is
where the loss is.** `app/(auth)/funnel-beacon.tsx` exists because the drop-off
was unreadable, and the number it was built to explain is the one that decides
this: **113 players reached the landing page and 13 reached `/signup`.** 88.5%
of the loss happens before the account form is ever attempted. Lifetime the
product has taken 219 visitors to 4 real users, 1.8%. Reordering anything below
the signup step cannot move a funnel that leaks above it.

**Decided: a stranger uploads a rep, marks the player, waits, and is shown the
COMPLETE breakdown with no account. The account is asked for on the SECOND
rep.** Not on the first result, which is the moment they have what they came
for and the ask reads as a toll. The second upload is the first evidence of
intent, because they went and filmed again.

**The mechanism is Supabase anonymous sign-in, and that choice is what makes
this cheap.** An anonymous sign-in mints a real `auth.users` row with a real
JWT, so `auth.uid()` resolves, every RLS policy holds, the
`${user.id}/pending/...` storage paths are unchanged, `consume_api_quota` and
`reserve_analysis_entitlement` need no new caller, and `analyses.user_id`,
which is `not null references profiles`, has something to point at. The flow in
`components/analyze-flow.tsx` and the page at `app/(app)/analysis/[id]` are not
forked and not copied. Converting is then `updateUser({ email, password })` on
the SAME row, so the breakdown, the rating and the skill history survive the
signup instead of being migrated across from a guest table. D-102 turned email
confirmation off, so that conversion completes in one step with no inbox round
trip.

**Rejected: a guest identity of our own** (signed cookie, service-role writes, a
`guest_analyses` table, copy the rows across at signup). It duplicates every
policy and every storage path that already exists, and it turns the conversion
into a migration that can half-succeed. The version where a player signs up and
their analysis does not arrive is worse than no funnel change at all.

**Rejected: holding the result behind an email.** It is the pattern
r/AlphaAndBetaUsers removes posts for, and Reddit is the only channel this
product has evidence for: one share link produced 74 of the first 219 visitors.
Spending that credibility to capture addresses is a bad trade at this size.

**Rejected: one anonymous analysis per day.** A recurring anonymous allowance
teaches a player they never need an account. It is ONE, tied to the anonymous
user. Free WITH an account is 3 a day, so the upgrade is worth 3x on the day
they take it and everything after that.

**Rejected: a partial or blurred first result.** The product's whole claim is
that it shows its work; the checklist under the number is the thing that makes
the read credible, and hiding it withholds exactly the evidence a stranger came
to judge.

**The one anonymous run is enforced in SQL, not in the route.** The entitlement
already lives in Postgres (`reserve_analysis_entitlement`), and a limit that
exists only in TypeScript is a limit that a direct data-API call ignores. The
anonymous branch reads the `is_anonymous` claim off the JWT and admits the
reservation only while that user has no rows in `analyses`. `/api/analyze` gains
no new counting logic; it keeps returning the 402 it already returns, with copy
that names the account instead of a daily reset.

**The captcha needs no new verification code.** `lib/captcha.ts` records that
Turnstile's secret is held by Supabase Auth and verified there, never in this
repo. Anonymous sign-in is an auth endpoint, so attaching the existing token to
that one call puts the anonymous lane behind the same protection that already
guards signup. The order of operations in that file still binds: ship the token
first, arm Supabase second. The comment in `/api/analyze` that says abuse is
controlled by refusing automated ACCOUNTS rather than capping analyses stops
being true the moment an analysis can happen without one, and is corrected
there.

**The cookie-clearing leak is accepted, in writing, so it is not rediscovered as
a crisis.** A person who clears storage gets another free read. At the measured
$0.0164 an analysis against a $79.29 balance, a thousand of them is $16.40. The
threat worth engineering against is a script, and that is the captcha plus the
existing credit alerting, whose thresholds are already counted in analyses
rather than dollars (D-114).

**Three things move with the funnel and are not optional.**

- **The 13+ declaration and the terms acceptance move onto the upload step.**
  They currently sit at signup, and signup is now after the upload. An
  anonymous stranger is putting footage of real people through the product, so
  the gate has to precede the footage, not follow it.
- **Every count of `auth.users` filters `is_anonymous = false`.** The demand
  test's baseline of 5 users, and any figure derived from that table, is
  meaningless once anonymous rows land in it. `docs/demand-test.md` is amended
  rather than reinterpreted afterwards.
- **An anonymous user satisfies `auth.role() = 'authenticated'`.** Anything that
  must belong to a real account, settings, billing, history, account deletion,
  checks the claim explicitly. `lib/route-guard.ts` gains that distinction as a
  pure function so it can be pinned, rather than each page inventing it.

**Reporting stays on all three surfaces and does NOT move to Settings**
(considered and rejected in the same conversation). `/analysis/[id]`,
`components/coach-chat.tsx` and `/share/<token>` each keep the control. The
share page settles it: its reader has no account and therefore no Settings page,
which is precisely why migration 060 grants `anon` EXECUTE on
`submit_content_report`. This funnel makes the argument stronger, because the
anonymous walker seeing generative output for the first time has no Settings
page either, and moving the control there would leave the highest-traffic AI
surface in the product with no reporting mechanism at all. Making it visually
quieter is a styling change and is fine; moving where it lives is not.

**Blocked on one dashboard toggle, verified rather than assumed.** On
2026-08-13 a `POST` to `/auth/v1/signup` with an empty body and the project's
publishable key returned `422 anonymous_provider_disabled`, so anonymous sign-in
is OFF and there is no API or MCP path to turn it on from here. It is
Authentication, Sign In / Providers, in the Supabase dashboard, and it is
Txais's. Everything below ships inert until then and fails closed: with the
provider disabled the entry point refuses and says so, rather than dropping a
player into a flow that cannot finish.

**How this is judged.** `docs/demand-test.md` already names the row this is
built against: they click, they read, they do not sign up, the funnel is wrong.
The measurement is the beacon chain, landing, upload started, player marked,
result shown, account claimed, and the number that matters is the ratio of the
last to the first. **It must not ship in the middle of a Reddit measurement
window**, because the same document rules that changing the product mid-test
leaves two variables and no answer.

## D-118a - The entry page's assent is general, and the age line stays at signup

**2026-08-13, Txais, amending D-118.** D-118 moved the 13-and-over declaration
and the footage-rights statement onto the upload step and called both
non-optional. One of those two claims was stronger than the facts support, and
the entry page now carries a single general line: "By starting you agree to the
Terms of Service and Privacy Policy."

**What is unchanged, which is why this is a copy decision and not a legal one.**
Both obligations live in the Terms, that line accepts the Terms, and
`startAnonymously` still writes `terms_accepted_at` onto the anonymous row at
the moment the button is pressed. The record of assent is the same field, at the
same instant, as before. `app/(auth)/signup/page.tsx` keeps its explicit
sentence, so the COPPA declaration is still made in full where the account is
created and where an address is actually collected.

**What is genuinely given up: legibility, not consent.** A statement on the page
is read more often than the same statement one click inside a legal document,
and the upload happens before signup, so for the minutes between the two the
age and recording statements are linked rather than printed. That is the trade,
and it was made deliberately: an entry point whose first paragraph is a COPPA
declaration reads as a form, and this page exists to read as a demo.

**The reason it is recorded rather than just done.** D-118 states the opposite in
plain language, and a future reader finding that paragraph and this page
disagreeing would be entitled to assume the page had drifted. It did not. It was
changed on purpose.

## D-118b - An anonymous session is deleted after thirty days, and its film with it

**2026-08-13.** D-118 hands a stranger a real `auth.users` row so they can be
scored without an account, and then takes their footage. Most never come back.
Nothing in the product removed them, so the funnel's own success case was a
growing pile of film belonging to people who never gave us an email address,
against a Privacy Policy that promises the film goes when the account goes
(D-024).

**Thirty days, then the row is deleted.** Long enough that somebody who read
their breakdown and came back a few weeks later still finds it; short enough
that a stranger's clip does not sit on our storage for a year.

**Deleting the auth row is the whole job, and that was verified rather than
assumed.** `profiles` cascades from `auth.users`, `analyses` cascades from
`profiles`, and migration 015's trigger calls the purge-user-media edge function
on delete over pg_net. That is the same path `/api/account/delete` relies on,
and `scripts/purge-orphaned-media.mjs` is still the backstop if the Vault config
for that hook is missing.

**The selection is a pure function with its own tests, and the script is only
IO.** `lib/anonymous-retention.ts` decides which ids qualify;
`scripts/purge-anonymous.mjs` lists and deletes. That split exists because the
selection is the part that can destroy something: **every uncertainty in it
resolves to KEEP.** A missing `is_anonymous` flag is not a false one, because a
listing that stopped returning the field would otherwise read as "everybody is
anonymous" and propose deleting the user table. An address present alongside an
anonymous flag keeps the row, because the address represents a human being who
typed something and the disagreement is somebody's bug rather than somebody's
loss. An unparseable date, a malformed id, a future timestamp and a retention
window of zero all select nothing.

**Dry run by default.** The script prints what it would delete and exits;
`--apply` is the irreversible one. Verified against the live project on
2026-08-13: 8 users, 0 anonymous, 0 to remove, which is the correct answer while
anonymous sign-in is still switched off.

**A 401 from the admin API is probably not the key.** `.env.local` holds
`SUPABASE_SERVICE_ROLE_KEY= eyJ...` with a leading space, and the `loadEnv`
helper these scripts share strips quotes without trimming, so the space rides
inside the bearer token and the API answers 401 exactly as it would for a
revoked key. This script trims. `scripts/pull-prod-clips.mjs` and
`scripts/video-eval.mjs` carry the same trap.


## D-119 - Pro is sold by the week or the month, and a lower rate on exit

**2026-08-12, numbered at merge.** D-118 reserved this number rather than
renumbering itself, because the entry was owed from the moment the branch was
cut and the branch shipped before it was written.

**Checkout had been dead and nobody knew.** Both Vollyio prices were found
`active:false` on 2026-08-12, including the one `STRIPE_PRICE_ID` pointed at,
and the provider cannot open a Checkout Session on an archived price. No sale
was possible at all, for as long as that had been true. **"$0 lifetime revenue"
is therefore not evidence about demand**, and every earlier reading of it as
such was wrong.

**Three live prices replace the one:** weekly **$7.99/wk**, monthly
**$29.99/mo**, and a **$19.99/mo** exit-intent rate. The ladder is monotone,
which is the only property that makes it honest: $7.99/wk is about $34.63/mo,
above the $29.99, which is above the $19.99. Nobody who pays more often pays
less.

**The downsell is a FOREVER PRICE and not a coupon**, and the reason is
mechanical rather than philosophical. A coupon scopes to a PRODUCT, and all
three prices sit on one product, so a $10-off coupon would have made the weekly
free. A permanent lower price also cannot quietly end, so nobody is repriced
later by a discount they have forgotten agreeing to.

**`lib/offers.ts` is the catalog and the only place the labels live, and it is
deliberately NOT `server-only`.** The picker is a client component and needs the
copy. What must never reach the browser is the provider price id, and that stays
in `lib/stripe.ts` behind the env vars, keyed by the strings here. Split this
way, a client import can leak a price LABEL that is already printed on the page,
and can never leak an id.

**The client posts an offer KEY; the server alone maps it to a price.**
`readOffer` allowlists the three keys, defaults to monthly, and tolerates a
request with no body so the 402 upsell paths keep working. A forged body is
therefore bounded to naming one of our own three offers, and the worst it can
name is the $19.99 we chose to sell.

**The downsell being reachable by anyone who reads the network tab is inherent,
not a hole.** It is a client-triggered offer, so the key has to be nameable by a
client. `selectable: false` keeps it out of the picker so the $29.99 is not the
price nobody ever pays; it is not, and cannot be, an access control.

**The renewal disclosure moved into the picker** because it must change with the
selection. "Renews every month" printed above a control that can select a weekly
subscription is the wrong renewal terms on the surface that takes the card. The
Terms carried the same monthly-only assumption in two clauses and now describe
both cadences.

**No fallback to `STRIPE_PRICE_ID`.** It names the archived price, so falling
back would turn "not configured yet" into a 502 blamed on the provider. A
missing `STRIPE_PRICE_MONTHLY` denies loudly and names itself in the log.
`stripeConfigured()` is false until it is set, so **no upgrade button renders at
all**, which is honest and is also no sale. **The three env vars are a
deployment step, not a code step.**

**Dropping the allowance from the disclosure was tried and `lib/stripe.test.ts`
refused it, correctly.** A disclosure naming a price without naming what it buys
is worse than the one it replaced.

**The exit-intent modal is desktop-only in practice.** It hangs off `mouseout`
with `clientY <= 0`, which is the only exit signal a page gets, and there is no
mobile equivalent. This product is mobile-first inside a TWA, so the downsell
reaches a minority of players. It fires once per tab via `sessionStorage`. Do
not report it as a mobile feature.
