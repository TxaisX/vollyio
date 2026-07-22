# Eval baseline

Recorded 2026-07-22 at `4c3bebf`.

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
Target population (intermediate/expert): 0/18 (0%)
Checks (this run):
  overall_in_range     7/18 passed, 0 skipped
  weakest_metric       NEVER RAN, 18 skipped
  strongest_metric     4/17 passed, 1 skipped
  citations_valid      18/18 passed, 0 skipped
GAP: 0 active cases at intermediate/expert. The suite cannot measure the stated target population.
GAP: 0 of 18 active cases carry a weakest_metric label, so the constraint-diagnosis check never fires. Needs human labeling.
GAP: 18 active cases have neither a weakest_metric nor a reviewer-confirmed weakest_metric_unknown flag; they are unlabeled, not abstentions.
```

18 active cases | band 18 | weakest 0 | strongest 17 | target-level 0 | 3 blocking gaps

## Blocking gaps

- 0 active cases at intermediate/expert. The suite cannot measure the stated target population.
- 0 of 18 active cases carry a weakest_metric label, so the constraint-diagnosis check never fires. Needs human labeling.
- 18 active cases have neither a weakest_metric nor a reviewer-confirmed weakest_metric_unknown flag; they are unlabeled, not abstentions.

## Results

- scored cases: 18 (failed runs: 0)
- verdicts: 2 pass, 16 fail, 0 unverified
- pass rate over verifiable cases: 0.11
- run-spread: median 6, max 22
- checks that never ran: weakest_metric

## Per case

| id | skill | discipline | overall | band | verdict | grounded |
|---|---|---|---|---|---|---|
| v01-8k-finals-rally-beachvolleyballworld-p1 | serve | beach | 61 | Solid | fail | no |
| v01-8k-finals-rally-beachvolleyballworld-p2 | dig | beach | 73 | Solid | fail | no |
| v01-8k-finals-rally-beachvolleyballworld-p3 | pass | beach | 68 | Solid | fail | no |
| v01-8k-finals-rally-beachvolleyballworld-p4 | block | beach | 62 | Solid | fail | no |
| v01-8k-finals-rally-beachvolleyballworld-p5 | attack | beach | 79 | Solid | fail | no |
| v02-aqowl8xfnirpswrq5w7ovan1srf5krblmulphdt1qvwr-p1 | serve | grass | 53 | Developing | fail | no |
| v02-aqowl8xfnirpswrq5w7ovan1srf5krblmulphdt1qvwr-p2 | attack | grass | 56 | Solid | fail | no |
| v03-aqods4-loj5peh0b8jsf6m634r1gnhjk9hbabyz8tkwm-p1 | set | grass | 72 | Solid | fail | no |
| v03-aqods4-loj5peh0b8jsf6m634r1gnhjk9hbabyz8tkwm-p2 | set | grass | 54 | Developing | fail | no |
| v05-his-vertical-jump-is-p1 | attack | indoor | 75 | Solid | fail | no |
| v06-is-taylor-crabb-most-p1 | block | beach | 63 | Solid | fail | no |
| v07-powerful-ace-volleyball-shorts-p1 | serve | indoor | 81 | Advanced | pass | no |
| v07-powerful-ace-volleyball-shorts-p2 | serve | indoor | 60 | Solid | pass | no |
| v08-taylor-crabbs-welcome-to-p1 | attack | beach | 65 | Solid | fail | no |
| v09-power-behind-yuji-nishida-p1 | serve | indoor | 84 | Advanced | fail | no |
| v10-what-an-amazing-spike-p1 | attack | indoor | 59 | Solid | fail | no |
| v11-wild-rally-ends-in-p1 | dig | beach | 66 | Solid | fail | no |
| v12-videoplayback-mp4-p1 | attack | indoor | 81 | Advanced | fail | no |

## What this baseline is not

Regenerate with `node scripts/make-baseline.mjs` after a real run. Numbers here
come only from recorded runs and the case files; nothing is estimated.
