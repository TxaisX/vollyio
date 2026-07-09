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

## Open questions / loose ends
- **Migration tracking is empty** (`list_migrations` → `[]`) though all 7 tables exist → schema applied out-of-band (SQL editor / `execute_sql`), not via tracked migrations. Future migration workflow must account for this.
- **`supabase/migrations/005_clips.sql` NOT applied** — no `clips` table in DB. Untracked in git.
- **Two files numbered `004`**: `004_discipline.sql` (referenced in SETUP.md) and `004_xp_events_index.sql` (untracked). Naming collision to resolve.
- **Untracked in git**: `.agents/`, `.claude/`, `.mcp.json.bak`, `The fix is a full restart of Claude Code.md`, `sideout-perfection-orchestration-prompt.md`, `skills-lock.json`, `004_xp_events_index.sql`, `005_clips.sql`. Decide keep-vs-gitignore-vs-commit.

## Exact next step
Awaiting direction. No task in flight.

## Run / deploy quickref
`npm run dev` (:3000) · `npm run build` · `npm run typecheck` · `node --test` · `vercel deploy [--prod]`. Build hits `EPERM: unlink .next/...` (OneDrive lock) → `Remove-Item -Recurse -Force .next` and rebuild.

---

## Session log
- **2026-07-08** — Verified Supabase MCP connectivity (resolved stale-connection bug), inventoried the 7 public tables + migrations, established this in-repo handoff. Read-only; no source edits.
