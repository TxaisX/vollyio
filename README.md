# Vollyio

Vollyio is a volleyball skill-analysis and coaching web app: a player uploads a
short clip, taps the athlete to analyze, and gets a mechanics breakdown of their
serve, pass, set, attack, block, or dig. The read is done entirely by the
coaching service (a vision model) watching the frames; there is no on-device ML.
Every score is derived from a concrete pointer checklist and marks what it could
not see, so the product never claims more than the footage supports.

Live: https://vollyio.com

## Stack

- Next.js 16 (App Router, React 19). Middleware is `proxy.ts`, not `middleware.ts`.
- Supabase (auth + Postgres 17, row-level security on every table). Exactly one
  module can bypass row security: `lib/supabase/service.ts` reads
  `SUPABASE_SERVICE_ROLE_KEY`, and its two importers (the payment webhook; the
  analyze route's telemetry and quota-refund calls) are each recorded with
  their reason in `docs/security.md` rule 10. Every other request runs as the
  signed-in player.
- The coaching service runs server-side only; the browser never sees its key.
  One credential now covers every model call, reading and writing both. It is
  never vendor-named in the UI or docs; the vendor-named strings in the repo are
  env var names, model ids and code paths (`OPENROUTER_API_KEY`, the two ids in
  `lib/ai/client.ts`, the `STRIPE_*` variables, `app/api/stripe/`), never
  anything a player reads.
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

## Plans

Free is 6 completed analyses at signup, once, then 1 a month,
resetting on the 1st (D-076). Pro is $9.99 a month for 18. The count reads
stored analysis rows, so a clip that fails, times out, or hits a capacity
outage costs the player nothing and needs no refund path.

The paid path is built end to end and is LIVE (D-078): `BILLING_ENABLED`,
`ENFORCE_FREE_CAP`, and all three provider values are set in production, so
metering is on, the upgrade button renders, and money moves. Checkout still
answers 503 in any environment missing the provider key, price, or endpoint
secret, rather than selling an allowance nothing is enforcing.
`docs/billing.md` is the authority on the model; `SETUP.md` lists the
environment variables and says which are secret.

## Quickstart

See `SETUP.md` for environment variables, the Supabase project, and running the
app. In short: `npm install`, provide `.env.local`, then `npm run dev` (:3000).
Gates before any commit: `npm run lint`, `npm run typecheck`, `npm test`,
`npm run build`.

## Documentation

- `docs/README.md` - index of the living documentation set.
- `docs/decisions.md` - the decision log; **D-027 onward is the accurate account
  of the current system.**
- `docs/security.md` - the access-control authority (endpoint, database, storage),
  including the billing verification steps that prove a player cannot write their
  own plan.
- `docs/billing.md` - plans, allowances, and what is built versus switched off.
- `docs/deploy.md` - environments, gates, environment variables, rollout order.
- `HANDOFF.md` - current project state and the exact next step.
- `archive/` - historical material and evidence for retired systems (do not treat
  as current).
