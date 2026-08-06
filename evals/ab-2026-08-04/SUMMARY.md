# Three-arm analysis eval — 2026-08-04

The reference run for future model changes. Raw per-run data (pointer verdicts,
token usage, timings) sits beside this file; `analysis-output.txt` is the
computed comparison. Method and pre-registered decision rules: the arms
comparison document of 2026-08-04 (session scratchpad) and D-094.

## Arms

| Arm | Evidence | Model | Cases | Runs |
|---|---|---|---|---|
| Stored production | up to 64 frames | claude-opus-5 (effort low) | 36 prod clips | 1 (historical, from `analyses.result`) |
| A | same stored frames | google/gemini-3.6-flash | 36 prod + 18 pro | 3 |
| B | the real clip, base64 video via the gateway (provider pinned google-vertex) | google/gemini-3.6-flash | 36 prod | 3 |

`prod-*` cases are the owner's real product clips pulled from storage
(unlabeled, so verdict "unverified" by design). The 18 pro cases carry
owner-labeled expected bands (2026-08-03).

## Headline: the provider, not the modality, is the variable that matters

**Gemini 3.6 Flash under the current prompts is ceiling-pegged and never
abstains.** On the owner's real clips, stored Opus median 65 vs Gemini 97 (both
modalities); Gemini scored above the stored result on 36 of 36 clips. On the
labeled pro cases, Gemini landed ABOVE the owner's expected band on 17 of 18
(eleven flat 100s) where Opus was 10 in / 8 below. Pointer mix tells the
mechanism:

| status | stored Opus | A frames+Gemini | B video+Gemini |
|---|---:|---:|---:|
| met | 22.7% | 80.7% | 88.3% |
| partial | 37.9% | 11.1% | 11.7% |
| missed | 9.3% | 0.6% | 0.0% |
| not_visible | 30.2% | 7.6% | **0.0%** |

Video-Gemini marked zero pointers not_visible and zero missed across 36 clips
x 3 runs. The abstention discipline (D-038) — uncertainty must never move a
score — is simply not being followed by this model under prompts that were
tuned against Claude. Opus errs harsh but discriminates (fraction correlates
r=0.57 with labeled quality, D-094); Gemini as prompted grades everyone 88-100
and discriminates almost nothing.

**Consequence: the D-093 provider split must not ship as-is.** It is still
uncommitted and OPENROuter key is not in prod, so nothing live is affected;
production still runs Opus frames, which this run measured as the
best-calibrated of the three configurations. Shipping the split without
verdict-discipline work would have collapsed the product's scale to
"everyone gets an A".

## Modality (B vs A, same model)

- Score effect minor: B - A mean +2.1 (median +0.5); B higher on 18/36.
- Stability comparable: median 3-run spread 4.0 (B) vs 4.5 (A); A had one
  46-point outlier case.
- Contact-moment agreement between arms: median |diff| 0.6s, p90 6.2s —
  too loose to trust either arm's contact time without labels.
- **Cost: video is ~3x cheaper.** Mean per-run tokens 6,395 in / 3,028 out
  (video, $0.032) vs 49,058 in / 3,020 out (frames, $0.096). Token math
  confirms ~1 fps provider-side sampling (~250-300 video tokens per clip
  second) — the 6-30 fps our extraction sends is not what the gateway's video
  path sees.
- Latency p50 ~5s both arms (vs ~50s/run for Opus frames).

## Costs of this eval

- Gemini (216 prod runs + 54 pro runs + smokes): ~$16 measured from captured
  usage at $1.50/$7.50 per MTok.
- Opus: 18 pro cases x 3 runs completed server-side after the client driver
  was cancelled; results were discarded but the spend (~$8-10 est.) is real
  and visible in the provider console dated 2026-08-04. One further x2-run
  baseline predates this session (evals/RESULTS.json).

## What this decides (per the pre-registered rules)

The "all arms fail abstention precision" branch is the operative one for
Gemini: fix the verdict-discipline problem (prompt hardening against
never-abstain, possibly per-provider calibration) and re-run before any
adoption decision. Until then D-093 stays on hold, Opus frames stays the
shipped configuration, and the scale re-anchor (D-094) stays blocked on
trustworthy verdicts. Labeling the 36 prod cases (owner, ~2 min each) is the
highest-leverage next step: it converts this entire archive into pass/fail
ground truth for every future arm.
