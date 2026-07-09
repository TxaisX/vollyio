# Analysis eval harness

Measure coaching-analysis quality instead of eyeballing it. Each **case** is a
real frame set plus an expert **expectation**; the dev-only runner replays cases
through the exact scoring path as `/api/analyze` and reports agreement.

## The loop

1. **Capture** — run the app in dev, open `/analyze?debug`, pick a skill +
   discipline, and record/upload a rep. The debug panel appears (no API call is
   spent). Click **Download eval case** to save the extracted frames as JSON.
2. **Label** — open the JSON and fill in `expected`:
   - `overall_min` / `overall_max` — the score band a coach would give this rep.
   - `weakest_metric` — the metric key that should score lowest (the real fault).
     Optional: `strongest_metric`.
   - Metric keys per skill are in `lib/ai/metrics.ts`.
3. **Add** — drop the file into `evals/cases/` (it's git-ignored by nothing; commit
   the ones you want tracked).
4. **Run** — with `ANTHROPIC_API_KEY` set, hit
   `GET /api/eval` (or `/api/eval?runs=2` to also measure run-to-run stability).
   You get a `passRate` and per-case `checks`.

## Case format (`evals/cases/*.json`)

```json
{
  "id": "serve-indoor-toss-drift",
  "skill": "serve",
  "discipline": "indoor",
  "frames": [{ "time_s": 1.2, "data": "<base64 jpeg, no prefix>" }, "…"],
  "expected": {
    "overall_min": 45,
    "overall_max": 65,
    "weakest_metric": "toss_quality",
    "notes": "toss drifts behind the shoulder every rep"
  }
}
```

## What the runner checks (`lib/eval-score.ts`, unit-tested)

- **overall_in_range** — the model's overall score falls in the expected band.
- **weakest_metric / strongest_metric** — the model's lowest/highest-scoring
  metric matches the labeled one (does it find the real fault?).
- **citations_valid** — every cited `frame_index` (insights + priority fix) is in
  range.
- **stability** (with `?runs>1`) — the overall score doesn't swing more than the
  tolerance across repeated runs.

## Notes

- The route is **dev-only** (404 in production) and requires a real API key —
  `AI_MOCK` output is hard-coded and won't reflect quality.
- This is a starting harness; add cases across skills and both disciplines so a
  frame-sampling or prompt change can be judged by the change in `passRate`.
