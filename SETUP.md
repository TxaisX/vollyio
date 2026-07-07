# Sideout — setup

## 1. Supabase
1. Create a project at supabase.com.
2. Project Settings → API: copy the **Project URL** and the **anon/publishable key**.
3. Apply the schema — either reconnect the Supabase MCP to this project, or paste each file into the SQL editor in order:
   - `supabase/migrations/001_core.sql`
   - `supabase/migrations/002_analysis.sql`
   - `supabase/migrations/003_phase2.sql` (Phase 2 tables; optional until those features ship)
4. Authentication → URL Configuration: set the Site URL and add the deployed domain as a redirect URL.

## 2. Environment
Copy `.env.local.example` to `.env.local` and fill in:
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
```
vercel deploy              # preview
vercel deploy --prod       # production
```
