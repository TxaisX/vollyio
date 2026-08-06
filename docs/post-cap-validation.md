# Post-cap validation runbook

_Executes when live AI calls are possible again: the provider's monthly spend
cap resets 2026-08-01 00:00 UTC, or earlier if the owner raises the cap or
splits keys (HANDOFF "Open items" 1). Everything here is one command or one
browser visit; the thinking is already done._

## Pre-checks (runnable today, no model calls)

All three passed 2026-07-21; re-run them on the day to confirm nothing rotted.

> **The first two commands below no longer run (D-098).** `/api/eval` was
> removed with the Anthropic SDK, and `EVAL_TOKEN` with it. They tested the
> dev-only gate, not the cap, so the cap checks further down still stand. What
> replaced the harness is described at the top of `evals/README.md`.

```sh
npm run dev -- -p 3222
curl -H "Authorization: Bearer $EVAL_TOKEN" "http://localhost:3222/api/eval?case=zzz-none"
# expect: {"cases":0,...}
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3222/api/eval?case=zzz-none"
# expect: 404 (gate closed without the token)
node scripts/run-evals.mjs --base http://localhost:3222 --case zzz-none
# expect: full coverage report, zero cases run, no RESULTS.json damage
```

Do NOT run `eval:run` for real before the cap lifts: the eval route calls the
model directly (no AI_MOCK branch, by design), and `run-evals.mjs` persists
error entries into `evals/RESULTS.json` that its resume logic then skips
without `--force` — a capped dry run poisons the baseline.

## On the day, in order

1. **Owner confirms access**: cap reset or the new split keys are live
   (dev key in `.env.local`, production key in Vercel only).
2. **Eval baseline**: dev server on 3222, then
   `npm run eval:run` (resumable; ~15-minute per-case timeout; 2 runs/case for
   stability), then `npm run eval:baseline`. Commit the regenerated
   `evals/BASELINE.md` + `evals/BASELINE.json` (`evals/RESULTS.json` stays
   local by design; it is gitignored).
   **Honesty note**: with 0/18 active cases carrying a `weakest_metric` label
   and 0 intermediate/expert cases, this run yields overall-band agreement and
   run-to-run stability only; most verdicts will read "unverified" and that is
   the correct output. No coaching-quality claim until the owner labels
   (`evals/LABELING.md`). This run IS the D-053 check: compare the band
   distribution against the pre-D-053 baseline, looking for the
   visible-only judging rule lifting clean reps out of the hedged 80s and for
   90+ appearing where the footage earns it.
3. **Real dense-clip save** (proves 016/017 at real scale): one analyze from a
   phone with a full trim window (dense set, up to 40 frames). Confirm the
   `analyses` row saves, `telemetry` is non-null, `frame_paths` uploaded, and
   the clip plays on the results page.
4. **Spend report sanity**: visit `/api/usage` on local dev (signed in).
   Month-to-date figures should appear with per-analysis cost near the
   derived ~$0.15-0.20 (D-027; 2026-07-21 partial-month data already measured
   ~$0.19 before cache reads).
5. **Budget guard live check** (no model call; the guard fires before the
   coaching call): set `ANALYZE_MONTHLY_BUDGET_USD=0.01` locally with AI_MOCK
   off, submit an analysis, confirm the calm "out of capacity, clip wasn't
   counted" state renders, then unset.
6. **Device checklist**: the seven-item real-phone pass in `HANDOFF.md`,
   receipts to `archive/receipts/device-verify-YYYY-MM-DD.md`.
