# Eval baseline

Recorded 2026-07-20 at `2728cb9` (harness-capability-build).

**Provisional.** This baseline does not support any product accuracy claim. See blocking gaps below.

## Coverage

```
Cases: 23 total, 18 active, 5 excluded
  level: pro=18
  skill: serve=5 dig=2 pass=1 block=2 attack=6 set=2
  discipline: beach=8 grass=4 indoor=6
Label coverage (active cases):
  overall band       18/18 (100%)
  weakest_metric     0/18 (0%)
    reviewer-confirmed unknown: 0
    unlabeled (needs a human):  18
  strongest_metric   17/18 (94%)
  measurement block  0/18 (0%)
Target population (intermediate/expert): 0/18 (0%)
GAP: 0 active cases at intermediate/expert. The suite cannot measure the stated target population.
GAP: 0 of 18 active cases carry a weakest_metric label, so the constraint-diagnosis check never fires. Needs human labeling.
GAP: 0 of 18 active cases carry a captured measurement block, so the on-device measurement path is untested. Needs re-capture with pose tracking on.
GAP: 18 active cases have neither a weakest_metric nor a reviewer-confirmed weakest_metric_unknown flag; they are unlabeled, not abstentions.
```

18 active cases | band 18 | weakest 0 | strongest 17 | measurements 0 | target-level 0 | 4 blocking gaps

## Blocking gaps

- 0 active cases at intermediate/expert. The suite cannot measure the stated target population.
- 0 of 18 active cases carry a weakest_metric label, so the constraint-diagnosis check never fires. Needs human labeling.
- 0 of 18 active cases carry a captured measurement block, so the on-device measurement path is untested. Needs re-capture with pose tracking on.
- 18 active cases have neither a weakest_metric nor a reviewer-confirmed weakest_metric_unknown flag; they are unlabeled, not abstentions.

## Results

- scored cases: 0 (failed runs: 0)
- verdicts: 0 pass, 0 fail, 0 unverified
- pass rate over verifiable cases: n/a (no verifiable case)
- run-spread: median n/a, max n/a
- every check ran at least once

## Per case

| id | skill | discipline | overall | band | verdict | grounded |
|---|---|---|---|---|---|---|

## What this baseline is not

Regenerate with `node scripts/make-baseline.mjs` after a real run. Numbers here
come only from recorded runs and the case files; nothing is estimated.
