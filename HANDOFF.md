# Handoff — sideout

_Last updated 2026-07-10. This file is the persistent project handoff — kept in-repo, updated each session._

## Goal
Sideout — volleyball skill-analysis + AI coaching web app. Next.js 16.2.10 (App Router, React 19.2), Supabase (auth + Postgres 17), Anthropic SDK server-side ("the coaching service" — never vendor-named in UI). Deployed on Vercel, repo `github.com/TxaisX/sideout`.

## State
- **Supabase MCP connected and healthy** — earlier stale-connection bug resolved (the `flpww`/`tbbie` server mixup in `The fix is a full restart of Claude Code.md`). MCP binds to the correct project.
  - Project: **sideout**, ref `tbbievneojaxkkjvcwjp`, org `ojvxtqcefdsthcfprauv`, region us-west-2, Postgres 17.6.1, `ACTIVE_HEALTHY`.
- **`public` schema — 7 tables, RLS enabled on all:** profiles (1 row), analyses (3), skill_ratings (3), xp_events (4), goals (0), games (0), chat_messages (0).
- Git: on `master`, **even with `origin/master`** at `d8dae40`. History: Phase 1a/1b + Phase 2 complete (21 components, 17 QA defects cleared, Lighthouse 99/100 landing+login, view-transition layer live). The D-005 motion and hardening patch is currently uncommitted.

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
Review the current uncommitted D-005/D-006/D-007 product, motion, and hardening patch, then commit and push when ready. It adds a generated premium landing/auth campaign, refines the app shell/dashboard, fixes Learn card fragmentation, adds milestone reward feedback, contains the mobile tab bar, adds live reduced-motion handling and policy lint, and removes post-mission em-dash regressions.

## Prior next step (superseded)
Review branch `docs/close-orchestration-gaps` and **merge to `master` + push** when ready (not pushed this session; CI will run on push). Nothing else in flight.

## Run / deploy quickref
`npm run dev` (:3000) · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` · `vercel deploy [--prod]`. Build hits `EPERM: unlink .next/...` (OneDrive lock) → `Remove-Item -Recurse -Force .next` and rebuild.

---

## Session log
- **2026-07-10 (premium campaign)** — Generated and registered a 63.1 KiB volleyball hero, rebuilt landing/login/signup, refined app-shell/dashboard hierarchy, and added one-time campaign motion. Desktop, exact 390px/360px, reduced motion, lint, tsc, 18/18 tests, and 55-route build pass. Not deployed.
- **2026-07-09 (UI motion)** — Fixed Learn's fragmented inline cards, added shared reward feedback to milestone surfaces, and contained the mobile tab bar. Verified with desktop, exact 390px, and exact 360px browser metrics; reduced motion, lint, tsc, 18/18 tests, and 55-route build pass.
- **2026-07-09** — Re-ran the perfection prompt as a fresh audit against completed `master`. Verified all project-owned source and orchestration artifacts, closed reduced-motion/copy/lint enforcement gaps, and kept the 21-component + route ledger all-pass. Gates: policy lint, tsc, tests 18/18, build 55 routes.
- **2026-07-08** — Verified Supabase MCP connectivity (resolved stale-connection bug), inventoried the 7 public tables + migrations, established this in-repo handoff. Read-only; no source edits.
- **2026-07-08 (2)** — Closed the orchestration doc + CI gaps (see section above): wrote backend.md/deploy.md/qa-learn-eval.md, recorded D-004, reconciled ledger, added CI, audited + fixed `/learn` and `/api/eval`, git-triaged untracked files. Gates green (tsc / test 18-0 / build 55 routes). Committed to branch `docs/close-orchestration-gaps` (3306212); not pushed/merged.
