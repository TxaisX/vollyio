# Analysis eval harness

> **DORMANT as of 2026-08-05 (D-098). The runner cannot run.** This harness
> replays FRAME cases against the 120-pointer catalog, and `/api/analyze` no
> longer does either: it reads the whole clip once against
> `lib/ai/simple-rubric.ts` (D-097). The dev-only `/api/eval` route was deleted
> with the Anthropic SDK it depended on, so `scripts/run-evals.mjs` has nothing
> to call. Everything else here is intact and still worth having: the labeled
> cases, the expectations, `lib/eval-score.ts`, `lib/eval-coverage.ts`, and
> `node scripts/eval-coverage.mjs`, which is offline and free and still works.
>
> Reviving it is not a port. A video-path harness needs CLIPS rather than frame
> sets, so the case format changes, and it needs checks that do not assume
> per-checkpoint verdicts or a contact instant, because the video path can
> produce neither. That work belongs to `docs/corpus-plan.md`, not to a patch of
> this file. What is written below describes the frame-path loop as it was, and
> is kept as the record of it.

Measure coaching-analysis quality instead of eyeballing it. Each **case** is a
real frame set plus an expert **expectation**; the dev-only runner replayed
cases through the exact scoring path as `/api/analyze` and reported agreement.

**A check that never ran is never reported as a check that passed.** Unlabeled
cases come back `unverified`, not `pass`, and are excluded from the pass-rate
denominator. Run `node scripts/eval-coverage.mjs` before trusting any number.

## The loop

1. **Capture** — run the app in dev, open `/analyze?debug`, pick a skill +
   discipline, and record/upload a rep. The debug panel appears (no API call is
   spent). Click **Download eval case** to save the extracted frames as JSON.
   Keep pose tracking on so the export carries its `measurements` block.
2. **Label** — `node scripts/label-case.mjs [case-id]` walks the decisions.
   It never guesses; every value is typed by a person.
3. **Add** — drop the file into `evals/cases/`.
4. **Check coverage** — `node scripts/eval-coverage.mjs` (offline, free).
5. **Run** — with the coaching key and a long random `EVAL_TOKEN` set,
   `node scripts/run-evals.mjs`. Add `--measurements off` to replay every case
   vision-only for an A/B against its grounded run.
> **RESULTS.json is a recording, not a live file (2026-08-13).** The harness
> that wrote it drove `/api/eval`, which was deleted, so `run-evals.mjs` went
> with it. `make-baseline.mjs` still freezes a baseline from that recording and
> now says so when it runs. The live harness is `npm run eval:run`
> (`scripts/video-eval.mjs`), which replays real clips through the shipped
> rubric and writes `evals/video-results.json` in a different shape.

6. **Freeze** — `node scripts/make-baseline.mjs --label "<what changed>"` writes
   `evals/BASELINE.json` and `evals/BASELINE.md` from the recorded run.

## Two case directories, and why

`evals/cases/` is **gitignored local scratch**. Whatever you capture lands there
and stays on your machine.

`evals/cases-pro-regression/` is **tracked**, and it is the set the committed
`BASELINE.json` ids resolve to. It exists so a fresh clone can reproduce the
baseline; without it the baseline would be a number nobody could re-derive.
Point the runner at it explicitly:

```
node scripts/run-evals.mjs --cases evals/cases-pro-regression
```

`--cases` defaults to `evals/cases`, so the capture loop above is unchanged.

## Case format (`evals/cases/*.json`)

```json
{
  "id": "serve-indoor-toss-drift",
  "skill": "serve",
  "discipline": "indoor",
  "level": "intermediate",
  "frames": [{ "time_s": 1.2, "data": "<base64 jpeg, no prefix>" }],
  "measurements": null,
  "expected": {
    "overall_min": 45,
    "overall_max": 65,
    "weakest_metric": "toss_quality",
    "acceptable_weakest_metrics": ["body_alignment"],
    "strongest_metric": "arm_swing",
    "labeled_by": "tx",
    "labeled_at": "2026-07-20",
    "notes": "toss drifts behind the shoulder every rep"
  }
}
```

### `measurements`

The on-device motion-tracking block captured alongside the frames, in the shape
`lib/ai/schema.ts` validates (`version`, `capture`, `units`,
`reps`, `session`, `omitted_below_confidence`). The runner feeds it to the model
exactly as `/api/analyze` does, so grounded scoring is measured rather than
assumed. `null` means the case never captured one, and the
`measurements_replayed` check reports `skipped` rather than passing. A block
that fails validation is dropped **and logged**; it is never silently treated as
absent.

### What counts as a label

- `overall_min` / `overall_max` — a real band. `0`-`100` is a placeholder that
  admits every score; the harness treats it as unlabeled, not as a pass.
- `weakest_metric` — the metric key whose fault most limits the rep. An empty
  string is unlabeled, not an abstention.
- `weakest_metric_unknown: true` — a reviewer looked and judged that the footage
  does not resolve one fault. This is a real answer and is reported separately
  from "nobody has looked yet".
- `acceptable_weakest_metrics` — up to two alternatives a reviewer would also
  accept (roadmap: primary constraint plus alternatives).
- `strongest_metric` — optional.
- Metric keys per skill are in `lib/ai/metrics.ts`.

## What the runner checks (`lib/eval-score.ts`, unit-tested)

| Check | Fires when | Skipped when |
|---|---|---|
| `overall_in_range` | a real band is labeled | no band, or a 0-100 placeholder |
| `weakest_metric` | a key or acceptable alternative is labeled | unlabeled, or reviewer-confirmed unknown |
| `strongest_metric` | a key is labeled | unlabeled |
| `citations_valid` | always | never |
| `measurements_replayed` | the case carries a block | no block captured |

`stability` (with `runs > 1`) reports the overall-score spread across repeats.

### Verdicts

- `pass` — every check that ran passed, and at least one label-driven check ran.
- `fail` — some check that ran failed.
- `unverified` — nothing failed, but no label-driven check ran. The case proved
  nothing. `passRate` is computed over `pass + fail` only.

## Coverage

`node scripts/eval-coverage.mjs [--json] [--strict]` runs offline and reports
case counts by level, skill and discipline; how many active cases carry each
label type; and blocking gaps. `--strict` exits non-zero when a gap exists, so
it can gate CI.

Coverage is also embedded in every `/api/eval` response (`coverage`,
`coverage_gaps`, `coverage_report`, `summary`) and printed by
`scripts/run-evals.mjs`, so a pass rate cannot be read without it.

## Baseline

`evals/BASELINE.json` + `evals/BASELINE.md`, produced by
`scripts/make-baseline.mjs`. It records coverage next to results per the
roadmap's "coverage cannot be hidden" rule, and marks itself **provisional**
whenever a blocking gap exists. The script refuses to write from an empty
`RESULTS.json` unless `--force` is passed (which produces a coverage-only,
explicitly provisional artifact).

## Notes

- The route is **dev-only** (404 in production) and requires a real API key —
  `AI_MOCK` output is hard-coded and won't reflect quality.
- Per `docs/analysis-validation-roadmap.md`, professional footage is a
  regression set. Intermediate and expert cases are the product eval and must
  come from real footage of that population.
