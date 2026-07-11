# Sideout — setup

## 1. Supabase
1. Create a project at supabase.com.
2. Project Settings → API: copy the **Project URL** and the **anon/publishable key**.
3. Apply the schema — either reconnect the Supabase MCP to this project, or paste each file into the SQL editor in order:
   - `supabase/migrations/001_core.sql`
   - `supabase/migrations/002_analysis.sql`
   - `supabase/migrations/003_phase2.sql` (Phase 2 tables; optional until those features ship)
   - `supabase/migrations/004_discipline.sql` (beach support: scopes skill ratings per discipline)
4. Authentication → URL Configuration: set the Site URL and add the deployed domain as a redirect URL.

## 2. Environment
Copy `.env.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY` (server-side only — never prefix with NEXT_PUBLIC)
- `AI_MOCK=true` to run the full flow with canned results at no cost
- `BILLING_ENABLED` left empty until a paid tier ships

Mirror the same variables to Vercel: `vercel env add <NAME> production` (and `preview`).

## 3. Run
```
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
node --test lib/ratings.test.ts
```

If a build fails with `EPERM: unlink .next/...`, OneDrive locked a build file — `Remove-Item -Recurse -Force .next` and rebuild.

## 4. Deploy
The Vercel project is connected to `github.com/TxaisX/sideout` — any push to `master` auto-deploys to production (sideout-jet.vercel.app). The CLI is only needed for ad-hoc previews:
```
vercel deploy              # preview
vercel deploy --prod       # production (equivalent to pushing master)
```

## 5. Agent sessions (cloud / mobile)
`.mcp.json` connects two MCP servers on session start (each prompts an OAuth grant on first use):
- **supabase** — bound to project `tbbievneojaxkkjvcwjp` (database, logs, advisors, migrations).
- **vercel** — deployment status and logs for the connected project (D-011).

Cloud sessions (claude.ai/code from a phone or browser) get the full repo but no `.env.local`, so anything needing live keys can't run in-session — use `AI_MOCK=true` for the coaching flow, and rely on unit tests + `npm run typecheck`, then verify on the live site after the auto-deploy. Production env vars live in Vercel, not the repo.
