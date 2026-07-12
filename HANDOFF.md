# Handoff — sideout

_Last updated 2026-07-11. This file is the persistent project handoff — kept in-repo, updated each session._

## Goal
Sideout — volleyball skill-analysis + AI coaching web app. Next.js 16.2.10 (App Router, React 19.2), Supabase (auth + Postgres 17), Anthropic SDK server-side ("the coaching service" — never vendor-named in UI). Deployed on Vercel, repo `github.com/TxaisX/sideout`.

## State
- Git: on `master`, even with `origin/master`, working tree clean. History: Phase 1a/1b + Phase 2, premium campaign, CV Phase 1 (on-device pose tracking, D-008), the focus-player pipeline, the 2026-07-11 mobile-upload fixes, and the free-tier onboarding funnel (D-012: `/welcome` quiz → goal → `/analyze?skill=`, breakdown value chips + #1 fix framing + closing share card) all shipped. 48/48 tests, tsc clean, policy lint clean, 57-route build.
- **Deployed to production** at sideout-jet.vercel.app (Vercel project `txais-xiong-s-projects/sideout`). The Vercel project is **git-connected**: any push to `master` auto-deploys production — no CLI or specific machine required.
- **MCP servers travel with the repo** (`.mcp.json`): Supabase (project-bound) and Vercel (D-011). Any session — including claude.ai/code from a phone — gets both after a per-user OAuth grant.
  - Supabase project: **sideout**, ref `tbbievneojaxkkjvcwjp`, org `ojvxtqcefdsthcfprauv`, region us-west-2, Postgres 17, `ACTIVE_HEALTHY`.
- **`public` schema — 7 tables, RLS enabled on all:** profiles, analyses, skill_ratings, xp_events, goals, games, chat_messages.
- Cloud sessions have no `.env.local` (see `SETUP.md` section 5): use `AI_MOCK=true`, unit tests + typecheck in-session, verify on the live site post-deploy.

## Key decisions / standing rules
See `AGENTS.md` + `docs/decisions.md` D-001: no attribution trailers, no vendor names in UI (AI = "the coaching service"), design tokens locked in `app/globals.css` @theme (navy/chalk/gold/teal; Space Grotesk / Instrument Sans / IBM Plex Mono), middleware is `proxy.ts` not `middleware.ts`, dependency budget gated via the 10.5 viability gate.

## Orchestration doc gaps — CLOSED (merged to `master`)
- **`docs/backend.md`** written (Dave's data/state/platform layer). **`docs/deploy.md`** written (Thomas's deploy + CI).
- **D-004** (coaching-service model split) recorded in `docs/decisions.md`.
- **`docs/ledger.md`** Status column reconciled to its ALL-PASS header; section-10 grants set to final state.
- **CI now exists**: `.github/workflows/ci.yml` runs policy lint + tsc + test + build on push/PR (the DoD's machine floor).
- **`/learn` + `/api/eval` audited** (`docs/qa-learn-eval.md`) and fixed: metadata/boundaries/44px targets on Learn, em-dash sweep of `content/technique.ts` (0 remain), `/api/eval` fidelity + retries + error masking + citation validation.
- **Git triaged**: spec, HANDOFF, migrations now tracked; local agent tooling (`.agents/`, `.claude/`, `skills-lock.json`, `.mcp.json.bak`, the restart note) gitignored.

## Remaining loose ends (informational, not blocking)
- **Migration tracking still empty** (`list_migrations` → `[]`) — schema applied out-of-band; documented in `backend.md`. A future migration workflow must account for it.
- **`005_clips.sql` still NOT applied** — no `clips` table live (file now tracked). Apply when the clip feature ships.
- **Two `004_*` migrations** (`004_discipline.sql`, `004_xp_events_index.sql`) — order-independent; fold into one ordinal if the sequence is ever rebased.
- **Numeric Lighthouse not in CI** (tool not installed); verified manually 99/100. Optional `@lhci/cli` job later.

## Current next step
Nothing in flight; the 2026-07-11 funnel + mobile-upload work is deployed and device-verified. Candidate next moves, in rough order: watch whether new signups complete quiz → first analysis; monetization (D-012 records the premium seam: free diagnosis, paid fixes/insights/drills via `canAnalyze` + `BILLING_ENABLED`; needs pricing + Stripe decisions); deferred features (Overall Game option, onboarding motion-tracking demo, launch-teaser remix once the media plan/network allowances exist).

## Run / deploy quickref
`npm run dev` (:3000) · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`. Push to `master` deploys production; `vercel deploy [--prod]` only for ad-hoc previews. Build hits `EPERM: unlink .next/...` (OneDrive lock, local machine only) → `Remove-Item -Recurse -Force .next` and rebuild.

---

## Session log
- **2026-07-12 (analysis fidelity, D-013)** — Full pose landmarker added with lite fallback (engine reports loaded variant); real-timestamp monotonic clock replaces the synthetic 30fps tick in the pose worker; model contract gains optional `scene_read` + `rep_scores` (rendered on the breakdown: coach's opening line + "Rep by rep" card with spread); new measured checkpoints `knee_flexion_at_plant` + `shoulder_hip_separation`. Also shipped earlier same day: score bands + coherence guard, eval ingest CLI + `evals/SOURCING.md`. Gates: tsc, policy lint, 52 tests, 57-route build. Next for analysis quality: calibration baseline (`evals/BASELINE.md`) once clips can be downloaded, then on-device ball tracking (P3 in D-013's roadmap; hooks already in place).
- **2026-07-11 (funnel)** — Competitive teardown of two consumer coaching apps (frame-by-frame screen recordings + store listings), then shipped D-012: `/welcome` onboarding (level · focus · target · echo; first writer of `profiles.level`; creates a goal), signup → `/welcome`, `/analyze?skill=` preselect, breakdown value chips/#1-fix kicker/closing share card. Deferred: billing (seam recorded in D-012), Overall Game option, onboarding CV demo. Gates: tsc, policy lint, 48 tests, 57-route build. **Verified live on device 2026-07-11**: signup → welcome quiz → analyze (skill preselected) → breakdown, plus the gallery-upload and extra-frames fixes. A 13s vertical launch teaser (real app screens, synthesized soundtrack) sits in `assets/sideout-launch-teaser.mp4` — repo-only, deliberately not in `public/`, so nothing on the live site serves it.
- **2026-07-11 (mobile upload fixes)** — First cloud session from claude.ai/code. Fixed Android jumping to the camera instead of the gallery on "Upload a clip" (wildcard `accept` → explicit MIME list; frame-by-frame screen-recording diagnosis confirmed the user had tested a frozen `…projects.vercel.app` deployment URL — production URL is the one to verify on). Fixed `/api/analyze` 400 "Bad request." on gallery clips: the planner stores up to 24 frames so `extra_frame_count` legitimately exceeds 12 when the send set is small; schema now bounds by shared `MAX_STORED_FRAMES`. Photo picker capped at 12 with a friendly error. 48/48 tests, tsc, policy lint, build green; deployed via push to `master` (`cc30a0a`).
- **2026-07-10 (mobile enablement)** — Prepped the repo for phone/cloud work: added the Vercel MCP server to `.mcp.json` (D-011), tracked `.env.example`, rewrote SETUP.md (auto-deploy + agent-sessions section) and this handoff to current state.
- **2026-07-10 (focus player)** — Iterated the focus-player pipeline to a head-anchored POI dot with region-zoomed tracking, framed crops, and start-time-bounded analysis (`components/analyze-flow.tsx` and friends, bdd6414 → 0c89dc6). 47/47 tests, tsc, policy lint, prod build, Playwright smoke all green; deployed to production.
- **2026-07-10 (premium campaign)** — Generated and registered a 63.1 KiB volleyball hero, rebuilt landing/login/signup, refined app-shell/dashboard hierarchy, and added one-time campaign motion. Desktop, exact 390px/360px, reduced motion, lint, tsc, 18/18 tests, and 55-route build pass. Not deployed.
- **2026-07-09 (UI motion)** — Fixed Learn's fragmented inline cards, added shared reward feedback to milestone surfaces, and contained the mobile tab bar. Verified with desktop, exact 390px, and exact 360px browser metrics; reduced motion, lint, tsc, 18/18 tests, and 55-route build pass.
- **2026-07-09** — Re-ran the perfection prompt as a fresh audit against completed `master`. Verified all project-owned source and orchestration artifacts, closed reduced-motion/copy/lint enforcement gaps, and kept the 21-component + route ledger all-pass. Gates: policy lint, tsc, tests 18/18, build 55 routes.
- **2026-07-08** — Verified Supabase MCP connectivity (resolved stale-connection bug), inventoried the 7 public tables + migrations, established this in-repo handoff. Read-only; no source edits.
- **2026-07-08 (2)** — Closed the orchestration doc + CI gaps (see section above): wrote backend.md/deploy.md/qa-learn-eval.md, recorded D-004, reconciled ledger, added CI, audited + fixed `/learn` and `/api/eval`, git-triaged untracked files. Gates green (tsc / test 18-0 / build 55 routes). Committed to branch `docs/close-orchestration-gaps` (3306212); not pushed/merged.
