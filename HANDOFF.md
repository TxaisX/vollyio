# Handoff - vollyio

_Rewritten 2026-08-27 (D-131). The authoritative account of the system is
`docs/decisions.md`; this file only says where the project stands._

## Status

Vollyio is no longer developed or sold. On 2026-08-27 the owner closed it as a
paid product; the reasoning and the numbers are in `docs/decisions.md` D-131
and in `docs/business-position.md`. The repository is public and
source-available (see `LICENSE`): read it, clone it, learn from it. The live
site stays up, free, on a free model and free hosting, and is operated only by
the owner.

## What still runs

- `vollyio.com`: the web app, every feature, no paid tier. Analyses run on the
  one free vision id in `lib/ai/client.ts` under the privacy floor in
  `lib/ai/routing.ts`.
- The Android app (separate private repository) talks to the same API.

## What does not

- Billing. `BILLING_ENABLED` is off in production, so nothing sells, the plan
  card shows no purchase, and the allowance cap is not enforced. The Stripe and
  Play code paths remain in the tree and answer 503 or 409 as documented in
  `docs/security.md`.
- Calibration. `evals/CALIBRATION.md` describes the paid reader this one
  replaced; nothing has been measured on the free id beyond what D-131 records.

## If you are reading this to learn

Start with `docs/decisions.md` from D-027 onward, then `docs/security.md`,
then `evals/CALIBRATION.md`. The decision log is the part worth the time: it
records what was measured, what it cost, and why each choice went the way it
did, including the ones that turned out wrong.
