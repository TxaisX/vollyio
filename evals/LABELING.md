# Labeling the eval suite

The harness is capable but starved: 18 active cases, all pro-level, 0 labeled,
0 scored runs, baseline provisional (D-031). This is the owner's path from that
state to a real scored baseline. Nothing here invents a label; `unknown` is a
legitimate, valuable answer.

See the current state any time with `node scripts/eval-coverage.mjs`
(or `npm run eval:coverage`).

Blocker to know up front: the scored run in step 3 calls the coaching service,
which is down on the monthly spend cap until the owner raises the limit (see
`HANDOFF.md`). Labeling and sourcing (steps 1 and 2) need no API and can be done
now; the scored run waits for the cap.

## 1. Label the 18 active cases (about two minutes each)

Watch the rep, then record the decision. Two windows:

- Watch: `node scripts/review-evals.mjs`, then open http://localhost:4750. Arrow
  keys walk the reps (Left/Right within a video, Up/Down between videos). The case
  id shown there is the id you label.
- Label: `node scripts/label-case.mjs` (or `npm run eval:label`) walks every
  unlabeled active case in the terminal. It asks your initials once, then per case:
  - `weakest_metric`: the metric key whose fault most limits this rep. The valid
    keys for the skill are printed for you.
  - `unknown`: the footage genuinely does not isolate a single fault. This records
    a reviewer-confirmed abstention, which is a real answer, not a coverage gap.
  - `skip`: leave the case untouched for now.
  - acceptable alternatives: up to two other keys you would also accept.

Label a single case with `node scripts/label-case.mjs <case-id>`. After a pass,
re-check with `node scripts/eval-coverage.mjs`: the `weakest_metric` line should
climb from 0/18.

## 2. Source intermediate and expert footage (rubric criterion 6)

Every active case is pro-level, so the suite cannot measure the target population.
Bring the intermediate/expert share to at least 40% of the set. The fast path is
your own footage and consenting teammates. Otherwise follow `evals/SOURCING.md`:

1. Download locally: `yt-dlp -f mp4 <url> -o clip.mp4`.
2. Trim to one athlete performing one skill:
   `ffmpeg -ss <start> -to <end> -i clip.mp4 -c copy rep.mp4`.
3. Ingest (deterministic, production-sized frames):
   `node scripts/ingest-eval-clip.mjs rep.mp4 --skill <skill> [--discipline indoor|grass] [--frames 10]`.
4. Label the emitted case with step 1.

## 3. Scored baseline and 3-run stability (needs the API restored)

Once the spend cap is raised:

1. Local coverage gate first: `node scripts/eval-coverage.mjs --strict` must exit 0
   (no blocking gaps) once the cases are labeled. This is the enforcing gate; the
   CI step of the same name is report-only, because `evals/cases/*.json` is
   gitignored local scratch and never reaches CI. The one case set that IS
   tracked is `evals/cases-pro-regression/`, the set `BASELINE.json`'s ids
   resolve to; run it with `node scripts/run-evals.mjs --cases evals/cases-pro-regression`.
2. Start a local server, and set the coaching key plus `EVAL_TOKEN` in the
   environment (the eval route returns 404 without the token and off loopback).
3. Score with stability:
   `node scripts/run-evals.mjs --runs 3 --base http://localhost:<port>`. A case
   whose runs spread more than 8 points gets an extra run recorded automatically.
4. Freeze it: `node scripts/make-baseline.mjs --label "first-scored"`. It refuses to
   write from empty results without `--force`, so a real baseline stops being
   provisional on merit rather than by assertion.

## 4. Release gates

Compare the baseline against `docs/analysis-validation-roadmap.md`:

- Unsupported-claim rate at most 5%.
- Correct abstention at least 95%.
- Stability: median 3-run range at most 5 points, p95 at most 8, over at least 10 cases.

A failing gate is a finding, not a defeat: diagnose which skill or pointer drifts
and fix the narrowest thing (pointer wording, or the RAW_FLOOR / RAW_CEILING knobs
against the labels, never prompt-hunting, per D-034). Record every number,
including failures, in `evals/BASELINE.md`.
