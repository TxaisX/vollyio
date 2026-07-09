# Component & Route Ledger

Source of truth for progress. Lifecycle: PENDING → IN-PROGRESS → SIERRA-VERIFYING → PASS (or FAIL with defect ref).
Line numbers in section 4 drift; confirm against the file. Sierra re-verifies each item and adds anything missed.

> **STATUS 2026-07-08: ALL PASS.** Phase 1 implemented every component + route; Phase 2 (Sierra) filed 17 defects (0 blocker, 8 major, 9 minor) → all cleared in the fix loop and re-verified (build/tsc/test green, targeted checks + live drive pass). No open blocker/major on any component or route. The **Key gaps** column is preserved as the original audit snapshot (what each item was graded against); the **Status** column reflects the final, cleared result. Per-defect detail: `docs/qa.md`; report cards: `docs/reportcards.md`.
>
> **Post-mission surfaces:** `/learn` and `/api/eval` were merged from a parallel stream and did NOT go through this mission. They were audited separately afterward — see `docs/qa-learn-eval.md`.

## Components (21)

### Foundation & navigation
| Component | Key gaps (from audit) | Status |
|---|---|---|
| motion.tsx | CountUp SSR 0 / no aria-label / integer-only / `to` restart from 0 / threshold strands tall content; Reveal div-only | PASS |
| cursor-glow.tsx | hardcoded gold rgb; reduced-motion/fine-pointer captured once, no matchMedia listener; getBoundingClientRect per move no rAF; Magnetic setTimeout uncleared | PASS |
| motif.tsx | add `focusable="false"`; enforce sizing (replaced-element default is a trap) | PASS |
| landing-nav.tsx | no mobile menu (links unreachable <768px); no skip link; Log in <44px; unlabeled nav, CTAs outside it; scroll handler no rAF; anchors need scroll-margin-top | PASS |
| app-nav.tsx | tab-bar active color-only (WCAG 1.4.1) vs sidebar; text-[9px] sub-legible; unlabeled landmarks/no list semantics; links <44px; no pressed feedback | PASS |
| pwa-register.tsx | no update lifecycle; swallows failures; no load-gate/env guard | PASS |

### Data visualization
| Component | Key gaps | Status |
|---|---|---|
| score-ring.tsx | no role/aria/title, null=bare dash; hardcoded gold glow; number unclamped vs arc caps; reduced-motion unrounded float; sizes don't scale; fixed box overflow @360 | PASS |
| radar.tsx | all-null collapse; null-vs-zero inconsistent; labels overflow at L/R vertices; ad-hoc text-[10px] (aria-label added prior burst) | PASS |
| sparkline.tsx | no label; <2pt fallback reads as skeleton; flat series renders at bottom; no non-finite guard; direction by shape only | PASS |
| metric-bar.tsx | clearTimeout ignored (fires after unmount); no progressbar; score unclamped overflow; long label crowds value @360 (min-w-0) | PASS |
| skill-icons.tsx | add focusable=false; optional title/aria-label prop; unknown-skill fallback glyph | PASS |

### Feature & interactive
| Component | Key gaps | Status |
|---|---|---|
| recorder.tsx | bespoke Stop (needs shared coral class); no SR recording feedback/live region/labeled video; focus dropped on phase transitions; MediaRecorder unguarded; video no aspect-ratio (CLS) | PASS |
| analyze-flow.tsx | "instead" chips <44px; preview empty copy over-promises; focus not moved to step-02; no per-button pending | PASS |
| clip-viewer.tsx | off-palette navy ring; zero-frame NaN "1/0" crash; thumb border-only no aria-current; strip labeling diverges; autoplay ignores reduced-motion + no announce | PASS |
| filmstrip.tsx | drop dead `h-18`; add list semantics; defend empty frames | PASS |
| coach-chat.tsx | no role=log/aria-live; no speaker attribution; typing indicator no label; error outside live region; raw whitespace-pre-wrap no markdown; bespoke Retry | PASS |
| share-card.tsx | whole palette hardcoded on canvas; no document.fonts.ready; title truncation no ellipsis; no canvas-fail error; trigger <44px | PASS |
| scoreboard.tsx | scoring no live region; serving/set/match visual-only; controls <44px; match-over headline no break-words @360; pre-hydration placeholder no skeleton (hydration jump) | PASS |
| goals.tsx | progress bar no progressbar semantics; errors not aria-describedby/aria-invalid, form noValidate; focus dropped after submit, no announce | PASS |
| skill-picker.tsx | not a radiogroup (independent aria-pressed, no arrow nav, no group name, no heading assoc); selected color-only | PASS |
| xp-toast.tsx | add manual dismiss (keyboard user stuck 4s) | PASS |

## Routes
| Route | Key gaps | Status |
|---|---|---|
| `/` landing | metadataBase/OG/title (DONE prior burst); mobile nav unreachable @360 (landing-nav) | PASS |
| root layout | title.template + OG (DONE prior burst); no global-error.tsx | PASS |
| `/offline` | title+noindex (DONE); dead end, no "Try again"/back | PASS |
| `/login` `/signup` | error roles/aria-invalid + titles + CTA (DONE prior burst); still no pending/disabled feedback (double-submit) | PASS |
| `(app)/layout` | skip link + noindex (DONE); no error.tsx in group; logout no pending/mobile; tab bar omits Goals+History | PASS |
| `/dashboard` | ring/radar anchor (DONE); silent `?? []` fallbacks; title via template | PASS |
| `/analyze` | strong; skill-picker radiogroup; title | PASS |
| `/analysis/[id]` | no custom not-found; loading mismatches 2-col; signed-url fail blank; no generateMetadata | PASS |
| `/coach` `/goals` `/scoreboard` `/history` | titles; silent fetch→empty; scoreboard scoring announce | PASS |
| `/drills` `/drills/[slug]` | [slug] no generateMetadata/generic title; bad slug → framework 404 | PASS |
| loading skeletons | generic `(app)/loading.tsx` mismatches chat/2-col/scoreboard/lists | PASS |

## Section 10 grants
| Grant | Status |
|---|---|
| 10.1 colors/fonts zero-violation | ENFORCED (ongoing) |
| 10.2 animation unlocked + optional lib | DONE — view-transition layer shipped (section 7); no third-party motion lib adopted (none cleared the 10.5 gate; hand-rolled primitives sufficed) |
| 10.3 volleyball visuals (docs/assets.md) | N/A by design — none earned placement; assets.md intentionally empty |
| 10.5 MCP/tooling gate (docs/tooling.md) | N/A by design — no added MCP server cleared the viability gate; tooling.md intentionally empty |
| 10.6 branding: favicon 16/32/48, apple-icon, maskable manifest, OG mark, on-page logo | DONE |
| section 7 view-transition layer | DONE (a2a5a78) — 4 patterns + `::view-transition-*` CSS + reduced-motion zeroing; `experimental.viewTransition` enabled |
