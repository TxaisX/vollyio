# Sideout

Sideout is a volleyball skill-analysis and coaching web app: a player uploads a
short clip, taps the athlete to analyze, and gets a mechanics breakdown of their
serve, pass, set, attack, block, or dig. The read is done entirely by the
coaching service (a vision model) watching the frames; there is no on-device ML.
Every score is derived from a concrete pointer checklist and marks what it could
not see, so the product never claims more than the footage supports.

Live: https://sideout-jet.vercel.app

## Stack

- Next.js 16 (App Router, React 19). Middleware is `proxy.ts`, not `middleware.ts`.
- Supabase (auth + Postgres 17, row-level security on every table).
- The coaching service (a vision model) runs server-side only; the browser never
  sees its key. It is never vendor-named in the UI or docs; the only vendor string
  in the repo is the `ANTHROPIC_API_KEY` env var.
- Tailwind v4 design tokens, hand-rolled motion, no chart/state/animation libraries.
- Deployed on Vercel; a push to `master` auto-deploys production.

## How scoring works

Scores are computed from a checklist, never free-scored by the model (D-039). Each
skill has four observable cues at each of five checkpoints (120 pointers total),
and the model judges every cue as met, partial, missed, or not-visible. The number
is then derived in code: the fraction of cues met over the cues that were visible,
mapped onto the score band. A checkpoint the footage never shows is excluded from
the overall rather than counted against the athlete (D-038), and the results page
renders the full checklist under each bar so a score explains itself line by line.
No display curve softens the number (D-040), and the coaching service watches the
whole trim window at uniform dense coverage rather than a few picked frames (D-041).

## Quickstart

See `SETUP.md` for environment variables, the Supabase project, and running the
app. In short: `npm install`, provide `.env.local`, then `npm run dev` (:3000).
Gates before any commit: `npm run lint`, `npm run typecheck`, `npm test`,
`npm run build`.

## Documentation

- `docs/README.md` - index of the living documentation set.
- `docs/decisions.md` - the decision log; **D-027 onward is the accurate account
  of the current system.**
- `docs/security.md` - the access-control authority (endpoint, database, storage).
- `HANDOFF.md` - current project state and the exact next step.
- `archive/` - historical material and evidence for retired systems (do not treat
  as current).
