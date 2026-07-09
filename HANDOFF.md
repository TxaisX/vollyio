# Handoff — sideout

_Last updated 2026-07-08. This file is the persistent project handoff — kept in-repo, updated each session._

## Goal
Sideout — volleyball skill-analysis + AI coaching web app. Next.js 16.2.10 (App Router, React 19.2), Supabase (auth + Postgres 17), Anthropic SDK server-side ("the coaching service" — never vendor-named in UI). Deployed on Vercel, repo `github.com/TxaisX/sideout`.

## State
- **Supabase MCP connected and healthy** — earlier stale-connection bug resolved (the `flpww`/`tbbie` server mixup in `The fix is a full restart of Claude Code.md`). MCP binds to the correct project.
  - Project: **sideout**, ref `tbbievneojaxkkjvcwjp`, org `ojvxtqcefdsthcfprauv`, region us-west-2, Postgres 17.6.1, `ACTIVE_HEALTHY`.
- **`public` schema — 7 tables, RLS enabled on all:** profiles (1 row), analyses (3), skill_ratings (3), xp_events (4), goals (0), games (0), chat_messages (0).
- Git: on `master`, **even with `origin/master`**. Last commit `61761ba` "State: merged to master + redeployed (both workstreams live)". History: Phase 1a/1b + Phase 2 complete (21 components, 17 QA defects cleared, Lighthouse 99/100 landing+login, view-transition layer live).

## Key decisions / standing rules
See `AGENTS.md` + `docs/decisions.md` D-001: no attribution trailers, no vendor names in UI (AI = "the coaching service"), design tokens locked in `app/globals.css` @theme (navy/chalk/gold/teal; Space Grotesk / Instrument Sans / IBM Plex Mono), middleware is `proxy.ts` not `middleware.ts`, dependency budget gated via the 10.5 viability gate.

## Orchestration doc gaps — CLOSED (branch `docs/close-orchestration-gaps`, commit 3306212, not pushed)
- **`docs/backend.md`** written (Dave's data/state/platform layer). **`docs/deploy.md`** written (Thomas's deploy + CI).
- **D-004** (coaching-service model split) recorded in `docs/decisions.md`.
- **`docs/ledger.md`** Status column reconciled to its ALL-PASS header; section-10 grants set to final state.
- **CI now exists**: `.github/workflows/ci.yml` runs tsc + test + build on push/PR (the DoD's machine floor).
- **`/learn` + `/api/eval` audited** (`docs/qa-learn-eval.md`) and fixed: metadata/boundaries/44px targets on Learn, em-dash sweep of `content/technique.ts` (0 remain), `/api/eval` fidelity + retries + error masking + citation validation.
- **Git triaged**: spec, HANDOFF, migrations now tracked; local agent tooling (`.agents/`, `.claude/`, `skills-lock.json`, `.mcp.json.bak`, the restart note) gitignored.

## Remaining loose ends (informational, not blocking)
- **Migration tracking still empty** (`list_migrations` → `[]`) — schema applied out-of-band; documented in `backend.md`. A future migration workflow must account for it.
- **`005_clips.sql` still NOT applied** — no `clips` table live (file now tracked). Apply when the clip feature ships.
- **Two `004_*` migrations** (`004_discipline.sql`, `004_xp_events_index.sql`) — order-independent; fold into one ordinal if the sequence is ever rebased.
- **Numeric Lighthouse not in CI** (tool not installed); verified manually 99/100. Optional `@lhci/cli` job later.

## Exact next step
Review branch `docs/close-orchestration-gaps` and **merge to `master` + push** when ready (not pushed this session; CI will run on push). Nothing else in flight.

## Run / deploy quickref
`npm run dev` (:3000) · `npm run build` · `npm run typecheck` · `node --test` · `vercel deploy [--prod]`. Build hits `EPERM: unlink .next/...` (OneDrive lock) → `Remove-Item -Recurse -Force .next` and rebuild.

---

## Session log
- **2026-07-08** — Verified Supabase MCP connectivity (resolved stale-connection bug), inventoried the 7 public tables + migrations, established this in-repo handoff. Read-only; no source edits.
- **2026-07-08 (2)** — Closed the orchestration doc + CI gaps (see section above): wrote backend.md/deploy.md/qa-learn-eval.md, recorded D-004, reconciled ledger, added CI, audited + fixed `/learn` and `/api/eval`, git-triaged untracked files. Gates green (tsc / test 18-0 / build 55 routes). Committed to branch `docs/close-orchestration-gaps` (3306212); not pushed/merged.
