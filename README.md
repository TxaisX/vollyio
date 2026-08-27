# Vollyio

Vollyio is a volleyball skill-analysis and coaching web app: a player uploads a
short clip, marks the athlete, and gets a coach's read of their serve, pass,
set, attack, block, or dig, with strengths, one priority fix, and drills. The
read is done entirely by a vision model watching the clip; there is no
on-device ML.

**Status (2026-08-27): closed as a product, kept as a record.** After seven
weeks of building and measuring, the owner concluded that an automated
technique grade cannot be made trustworthy alone from the footage players film,
and that individual players have not been shown to pay for one. The full
reasoning, with every number, is in `docs/decisions.md` D-131 and
`docs/business-position.md`. The site stays up, free, on the same models it shipped
with (about a dollar a month, capped by a prepaid balance), and is operated
only by the owner. This repository is public and source-available so
that anyone can read and learn from it; see `LICENSE` for what that does and
does not permit.

Live: https://vollyio.com

## What is worth reading

- `docs/decisions.md`, D-027 onward. Every change records what was measured,
  what it cost, and why it went the way it did, including the ones that were
  wrong.
- `evals/CALIBRATION.md`. Why a 0 to 100 score from a video model collapses
  into twenty points, measured on 415 clips, and what did and did not fix it.
- `docs/security.md`. The access-control authority: who may call what, and the
  live probes that prove a player cannot write their own plan.
- `docs/business-position.md` and `docs/demand-test.md`. The commercial read,
  and the demand test that was written and never run.

## Stack

- Next.js 16 (App Router, React 19). Middleware is `proxy.ts`, not `middleware.ts`.
- Supabase (auth + Postgres 17, row-level security on every table). Exactly one
  module can bypass row security: `lib/supabase/service.ts`, whose four
  importers are each recorded with their reason in `docs/security.md` rule 10.
- The coaching service runs server-side only; the browser never sees its key.
  One credential covers every model call. The vendor-named strings in the repo
  are env var names, model ids and code paths, never anything a player reads.
- Tailwind v4 design tokens, hand-rolled motion, no chart/state/animation libraries.
- Deployed on Vercel; a push to `master` auto-deploys production.

## How scoring works

The clip is read once, holistically, against `lib/ai/simple-rubric.ts`: one
score out of 100, what the player did well, what to fix, which checkpoints the
footage actually showed. The provider samples video at roughly one
low-resolution frame per second, so nothing on this path claims a precise
instant. A clip with no gradeable rep in it is refused rather than scored
(D-126). The number's limits are measured and written down in
`evals/CALIBRATION.md`; read that before trusting it.

## Plans

There is one: free. `BILLING_ENABLED` is off in production, so nothing sells
and the allowance cap is not enforced. The billing code paths remain in the
tree and fail closed as `docs/security.md` documents.

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
- `docs/billing.md` - plans, allowances, and what is built versus switched off.
- `docs/deploy.md` - environments, gates, environment variables, rollout order.
- `HANDOFF.md` - where the project stands.
- `archive/` - historical material for retired systems (do not treat as current).
