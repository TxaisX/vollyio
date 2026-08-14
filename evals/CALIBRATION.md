# Calibrating the score

The loop that replaces the dormant frame harness (see `README.md`, D-098). It
measures the path that actually ships: one clip, one read, `lib/ai/simple-rubric.ts`.

## Why it exists

Measured 2026-08-13 over 47 real player clips replayed through the shipped
prompt: 45 scored, **min 71, median 78, max 92, sd 5.0**. A 0-100 scale using 21
points of itself. Every rep any player has uploaded came back "Solid" or
"Advanced". The number cannot say "your best one yet" and it cannot say "that
rep did not work", so it is decoration rather than coaching.

Two further findings from the same run, both invisible in production because
production stores neither:

- **96% of reads claimed all five checkpoints visible.** The abstain lane is
  written, wired, and effectively never fires on real footage.
- **1 refusal in 47.** `ratable: false` returns a 422 and stores nothing, so the
  live refusal rate was previously unknowable.

## What the expanded corpus showed, and why calibration alone will not fix it

415 clips: 47 from production, 368 cut blind from public footage spanning
beginners' tutorials to Olympic highlights, 57 to 80 per skill. 180 scored, 234
refused, run 2026-08-13.

**The model does not separate skill levels.** Mean raw score by the footage's
own level: developing 81.7, intermediate 80.2, advanced 81.9, pro 83.5. Footage
from beginners' tutorials scores level with footage of advanced players, and the
single highest score in the corpus (96) went to a window cut from a "jump serve
basics" instructional video.

**A third of the score is dice.** Thirteen clips read three times each: pooled
within-clip read noise sd 3.5, against a between-clip sd of 5.9. That is a
reliability of 0.64, so roughly a third of the variance a player sees is the
same clip read twice. Two reps under about seven points apart are not
distinguishable. Taking the median of three reads cuts noise variance threefold
and lands reliability near 0.85, which is why multi-draw is a measurement
decision here and not a preference.

**A score can survive seeing nothing.** One block clip returned 88 with zero of
five checkpoints marked visible.

## The one fix that is already proven

61 clips from the corpus, stratified across skill and level, read three times
each (`scripts/multidraw-report.mjs`). Correlating the first draw against the
second measures the reliability of a single read directly, assuming nothing
about how the noise is distributed:

| reads averaged | reliability | cost per analysis |
|---|---|---|
| 1 (ships today) | 0.64 | $0.0164 |
| 2 | 0.78 | $0.0328 |
| 3 | 0.84 | $0.0492 |
| 5 | 0.90 | $0.0820 |

Three reads clears the 0.75 gate with margin, for three cents. They must be
issued in PARALLEL: the route's budget is `maxDuration = 120` against a 50
second per-read timeout, so three sequential reads do not fit and three
concurrent ones do.

**It buys reliability and it does not buy discrimination.** Under the median of
three, the levels stay flat: developing 80.5, intermediate 79.7, advanced 82.2,
pro 84.8. Averaging removes noise; it cannot create an ordering that was never
in the judgement. That is the cleanest evidence that the remaining problem is
what the model thinks, not how many times it is asked.

## The reader, not the curve

40 clips stratified across level, same prompt, same schema, two models
(`scripts/arm-compare.mjs`):

| arm | scored | refused | median | sd | range used | claims full visibility | pro minus developing |
|---|---|---|---|---|---|---|---|
| `gemini-3.6-flash` (ships) | 40 | 0 | 81 | 7.9 | 48 | 78% | +0.2 |
| `gemini-3.1-pro-preview` | 35 | 5 | 78 | 21.4 | 80 | 53% | +7.8 |

The pro tier uses the scale, refuses, and admits what it cannot see. It scored
an intermediate attack 18 and a pro dig 42, where the shipping model has never
returned anything under 48 across 415 clips.

The single clearest case is the clip the shipping model scored **96**, the
highest in the whole corpus. The pro tier refuses it: *"the footage consists of
a static multi-exposure graphic followed by disconnected video fragments,
meaning there is no single, continuous serving rep to evaluate."* That is
correct. The top score in the corpus was awarded to a title card.

Its reliability is also higher, measured the same way: test-retest r 0.71
against flash's 0.64, so one pro read is worth about two flash reads. Measured
cost is $0.0438 a read against $0.0185, and 27.1 seconds against 13.1.

**Level ordering is still weak** at r = 0.194, and the levels are not cleanly
monotone (intermediate lands below developing). Source level is a claim about
the athlete, not the eight seconds in the window, so it cannot settle this.
Coach labels can.

### On the footage that actually matters

The candidate read all 47 real player clips (`evals/candidate-vs-shipping.md`):

| | shipping | candidate |
|---|---|---|
| min / median / max | 71 / 78 / 92 | **18 / 62 / 88** |
| sd | 5.0 | **17.1** |
| range used | 21 | **70** |

Median 62, a 70-point range, a floor at 18, and agreement with the shipping
model at the top end. That is the distribution this whole exercise was trying to
reach through calibration, arriving instead from one constant, with no map
applied at all.

### The correction: a wide range is not a correct range

Two things were wrong with the comparison above, both found by checking the
footage rather than the numbers.

**The harness was not marking the subject.** Production always names who to
analyze (D-062, D-100), and this harness sent no marker until 2026-08-13. On
two-player footage that lets two models grade two different people and calls the
difference a disagreement about technique. `scripts/pull-prod-clips.mjs` now
carries `subject_check.analyzed` into the corpus for the 32 clips whose shipped
read confirmed the marker, and `scripts/video-eval.mjs` sends it.

Re-run over those 32, with the subject named:

| arm | n | refused | min | median | max | sd | range |
|---|---|---|---|---|---|---|---|
| shipping, unmarked | 31 | 0 | 71 | 78 | 92 | 4.9 | 21 |
| shipping, marked | 26 | 3 | 72 | 78 | 92 | 5.6 | 20 |
| candidate, unmarked | 31 | 0 | 18 | 60 | 88 | 17.4 | 70 |
| candidate, marked | 29 | 2 | 38 | 58 | 90 | 17.2 | 52 |

The compression is not a marker artifact: the shipping model reads 78 either
way. The candidate's spread mostly survives, but its extreme low end was partly
one: its floor moves 18 -> 38.

**And its low reads were wrong on the footage.** Frames pulled from
`prod-02eb77fa` and `prod-22bee58a` show the marked player making a full
approach, leaving the sand with visible spray, cocking the arm and swinging at
contact height above the net. The candidate described both as pushing the ball
over without getting off the ground. That is not a stricter judgement of a rep,
it is a wrong account of what happened.

The reverse also holds. On `prod-d9a34f8f` the marked setter's hands are turned
away from the camera for most of the clip and the shipping model still returned
81 with a confident description of technique it cannot have seen.

**So neither reader is validated, and they fail on different clips.** A model
swap on the strength of a wider histogram would have shipped confident wrong
low scores in place of confident wrong high ones. Contact sheets for the ten
widest disagreements are rendered to `evals/review/` for exactly this check.

That is why `lib/eval-gate.ts` has a `noise_below_signal` gate and why the
ordering, not the placement, is the thing to fix first. A monotone map widens
whatever it is given: applied to this corpus it turns a 48-point range into 82,
which makes an uninformative number look more precise rather than making it more
true. **The map ships only once rank correlation against coach labels proves
there is an ordering worth stretching.**

## A first determination, from frames

Eleven production clips judged off twelve-frame contact sheets, recorded in
`evals/labels.json` under `labeled_by: claude-frames` so a coach's labels can
never be confused with them. Against those reads:

| | mean signed error | mean absolute error |
|---|---|---|
| shipping (`3.6-flash`) | **+18.0** | 18.0 |
| candidate (`3.1-pro`) | -13.9 | 16.9 |

The shipping model is high on **every single clip**, never low, by about 18
points. Its ordering is usable; its placement is not. That is precisely the
failure a monotone map exists to fix, and it is the argument for calibrating
rather than swapping.

Two clips settle the candidate's case on their own. `prod-2873531a` and
`prod-45f6ee8b` are **byte-identical files** (same MD5, the same upload analyzed
twice). The candidate scored them **42 and 73**. The shipping model scored them
78 and 81. A 31-point swing on the same bytes is not strictness.

Two more findings the gates had no evidence for until now:

- `prod-706ea215` shows repeated indoor attack reps with full extension. The
  shipping model REFUSED it. That is a **false refusal**, the failure that costs
  a player a rep they filmed correctly.
- `prod-d9a34f8f` is branded promo footage where the marked setter is turned
  away and the contact is never visible. Both models scored it, 81 and 42. That
  is a **missed refusal** by both.

Rank correlation between the shipping model's ordering and these reads is 0.56
over the scorable clips, in the same neighbourhood as D-094's 0.708. It is weak
evidence: most of the production reads landed on the same band, because that
footage is homogeneous. Real spread has to come from the sourced corpus, and
the band calls themselves want a coach's confirmation before any map is fitted
on them.

## The finding that outranks calibration

**Every clip the model scored has now been reviewed frame by frame: 180 of 180,
all six skills complete.** The result did not move once past the first fifty.

| | |
|---|---|
| clips the model scored | 180 |
| gradeable reps among them | 68 |
| **no gradeable rep** | **113 (62%)** |
| of those, refused by the shipped rule | **1** |
| model bias on real reps | **+16.6** |
| scores given to non-reps | min 48, **median 81**, max 96 |

The median score for footage with no rep in it is 81, which is also the corpus
median for real reps. **The number cannot distinguish a rep from a screen
recording.** The non-rep rate was 53% at 55 labels, 62% at 107, 62% at 180: it
is a property of what the model chooses to score, not of sampling.

### What the 113 non-reps are

| count | category |
|---|---|
| ~40% | coverage of play: a match, a rally, a warmup, a wide multi-athlete drill |
| ~30% | graphics: diagrams, title cards, slideshows, captions, drawn annotations, promo banners |
| ~10% | **no ball at all** — shadow approaches, dry footwork, mimed hands |
| ~10% | a presenter talking to camera |
| rest | subject never performs the skill; screen recordings; montages |

Two categories are not obvious and both cost this review a mistake. **Coverage
of play is the biggest** and the least likely to look wrong: real volleyball,
sharply filmed, often better than anything a player uploads. And **shadow reps
with no ball** fooled this reviewer twice before the models caught it.

### Two completed skills tell the identical story

`pass`: 16 scored, 12 not gradeable. `set`: 27 scored, 17 not gradeable. Same
ratio, same bias, same shape as the corpus overall.

### It is not a sourced-footage artifact

Of 34 labeled PRODUCTION clips, 13 are not gradeable — 38% of what real users
uploaded. Among them a **screen recording of a phone** with the Android status
bar in frame (scored 72), two USA Volleyball tournament matches (92 and 90),
sideways match footage rotated 90 degrees (71), and a wide gym warmup (77).

The single sharpest case: one distant grass tournament file was analysed four
times, three times as a `set` and once as an `attack`. It scored 74, 76, 78 and
74. **The same footage, asked two different questions, answers the same
number**, because it is not reading a rep.

### Duplicates

Five groups, thirteen analyses, five distinct videos. **47 production analyses
are 39 distinct clips.**

### The fix, iterated against the labels

`evals/variants/refusal-v3.txt`, `v4` and `v5` rewrite the abstain rule to ask
"is there a gradeable rep by the subject here". They are applied as an extra
system block by `scripts/video-eval.mjs --extra-system`, so a wording change is
measured against the labeled set before it is written into the shipped rubric.

v4 adds the two tests that did the work:

1. **Is the subject the one playing the ball?** A ball must be in play and the
   subject must be the person playing it. Not approaching while somebody else
   plays it, not standing on court during somebody else's rally, not swinging
   at nothing.
2. **How many people are playing?** A match, a rally, a full-court drill, a
   warmup, a queue taking turns, or anything with a crowd, scoreboard or
   broadcast graphics is COVERAGE OF PLAY, not a rep.

Over the **complete labeled set of 181 clips**:

| rule | non-reps refused | good clips refused | correct | |
|---|---|---|---|---|
| shipped | **1 of 113** | 0 of 68 | 69/181 | **38%** |
| v4 | **83 of 113** | 12 of 68 | 139/181 | **77%** |
| **v7** | 73 of 113 | **6 of 68** | 135/181 | 75% |

38% to about 76%, either way. v4 and v7 are within two points of each other on
total accuracy and trade differently, which is the real choice:

- **v4** catches more non-reps (83) and wrongly refuses 12 real reps.
- **v7** halves the false refusals to 6 and gives back ten catches.

v7 was written by diagnosing v4's twelve false refusals, which fell into exactly
three groups, all now carved out explicitly:

1. **A casual game is not "coverage of play".** Five of the twelve were dusk
   grass rec rallies among three or four friends, which is the ordinary footage
   this product exists to grade. The clause now refuses on crowds, scoreboards,
   officials, broadcast graphics, full six-a-side teams or drill queues, and
   explicitly not on a small-sided rally where one athlete can be followed.
2. **"No ball in this frame" is not "no ball in this clip".** Four were real
   drills where the ball is simply out of the one-per-second sample. The rule
   now requires the ball to be absent across the WHOLE sequence.
3. **Several reps by one athlete is a rep, not a montage.** Three were the same
   person playing ball after ball, which is the best footage anyone gets.

Six false refusals survive in v7, and half of them are the no-ball claim firing
on clips where a ball was recorded present. That is the next target, and the
carve-out for group 1 also cost one genuine arena serve, which is the tension
to watch: the more precisely "coverage of play" is defined, the more real
match-adjacent reps slip through it.

**Recommendation: v7.** A false refusal is the failure a player actually
experiences, and 6 in 68 is within reach of the 5% gate, where 12 in 68 is not.

### Two labels this review got wrong, the same way

`prod-706ea215` was recorded as band 7 ("repeated indoor attack reps, full
extension") and `src-WhXt-RqHQIM-w2` as band 8 ("continuous approach, arm swing,
jump"). Both were re-reviewed at 3 to 4 fps across the whole clip after the
variants refused them. **Neither contains a ball in any frame.** Both are
shadow approach and swing demonstrations, and both models were right to refuse.

The error is systematic and worth naming: this reviewer twice inferred "rep"
from approach-and-swing motion without confirming a ball was ever contacted. It
is the same handicap the model has, from the same evidence, and it is why the
contact test in v4 is load-bearing rather than pedantic.

The correction also revises an earlier claim in this file: the shipping rule's
false-refusal rate is **0 of 24**, not 1 in 13. Its abstain lane is correct when
it fires. It just fires once in thirty-one.

## Why the map still cannot be fitted, and what would fix it

25 clips labeled from frames. The scorable bands land at:

`60, 60, 60, 60, 60, 60, 60, 60, 70, 70, 80, 80, 89`

There is no low end. Not because the reviewer would not use it, but because
**this corpus contains almost no gradeable bad reps.**

Production footage is homogeneous: a handful of recreational players of similar
standard, so nearly every real rep is the same competent band. Sourced
instructional footage was supposed to supply the ends, and it does not: blind
eight-second windows from tutorials land on presenters, animated diagrams and
title cards far more often than on a demonstrated fault. Even the video whose
whole subject is "20 mistakes you must avoid" yields a studio presenter and a
fisheye wide shot rather than a gradeable bad serve. Twelve of the 25 labels are
`cannot rate`, and they came from exactly the places a bad rep was expected.

The anchor question is therefore not the binding constraint. Refitting with the
recreational band moved from 60 to 70 gives:

| rec anchor | corpus median | sd | range |
|---|---|---|---|
| 60 | 61 | 7.3 | 51 |
| 70 | 70 | **4.6** | 45 |

At 70 the map collapses the scale to sd 4.6, which is the compression this whole
exercise exists to remove, because eight labels at one value cannot define a
slope wherever they sit. **No anchor choice rescues a label set with no
variance.**

What would fix it is footage of people executing badly, filmed the way players
actually film: real beginners at a club practice, not YouTube tutorials about
beginners. Twenty gradeable reps spread from poor to excellent would do more for
this than another two hundred blind tutorial windows.

## The rule this loop obeys

D-034: calibration is tuned against labeled cases, never through prompt wording.
D-094 is the receipt. The same model, re-anchored by prompt three times in one
week, moved its median 55 -> 78 -> 97 while its rank correlation against labels
held at 0.708. It knows which rep is better. It does not know where to put the
number. So `lib/scale.ts` takes the ordering from the model and does the
placement in code, against anchors a coach set.

## The loop

```
node scripts/pull-prod-clips.mjs      # real player clips -> evals/corpus (private)
node scripts/source-clips.mjs         # public footage for the ends of the scale
node scripts/video-eval.mjs           # replay the shipped prompt, record raw scores
node scripts/label-clips.mjs          # blind coach labeling at localhost:4751
node scripts/fit-scale.mjs            # fit the map, write evals/scale-report.md
```

`evals/corpus/` and `evals/video-results.json` are gitignored: the corpus is
players' own film and sourced footage kept for private calibration only.
`evals/labels.json` and `evals/scale-report.md` are small and are the record of
what a coach actually said, so they are worth tracking.

### Labeling

`scripts/label-clips.mjs` shows one clip at a time and **never shows the model's
score.** Anchoring is the failure being fixed; a reviewer who can see 78 writes
down 78. The ten bands are the rubric's own bands, so a label lands directly on
the scale being calibrated:

| key | band | means |
|---|---|---|
| 1 | No technique | nothing recognisable for this skill |
| 2 | Beginner | beginner mechanics |
| 3 | Improvising | gets the ball up, not repeatably |
| 4 | Rough | recognisable, a fault changed the outcome |
| 5 | Developing | shape is right, details break under speed |
| 6 | Competent | executes it, with a habit that costs consistency |
| 7 | Good | works, fundamentals there, two things to sharpen |
| 8 | Strong | sound throughout, one clear refinement |
| 9 | Excellent | complete and repeatable, rest is stylistic |
| 0 | Flawless | you would teach the skill with this clip |
| X | cannot rate | wrong skill, too far, cut off, too dark |

**X is not a skipped clip, it is a label.** Sourced windows are cut blind, with
no attempt to find a rep, so a window holding no rep is exactly the negative
case the refusal lane has never been measured against.

### Fitting

`scripts/fit-scale.mjs` runs in one of two modes and says which:

- **PROVISIONAL** when there are fewer than 8 labels. It applies the
  measured-compression map in `lib/scale.ts` and shows the shape of the change.
  Not evidence about any individual rep.
- **FITTED** once labels exist. Isotonic regression (pool adjacent violators)
  through the labeled pairs, which assumes only monotonicity, the one property
  there is evidence for. The report then carries the number that decides whether
  calibrating is legitimate at all: **rank correlation between the model's
  ordering and the coach's.** If the model cannot order reps, no monotone map
  rescues the scale and the fix is upstream of the map.

## What calibration cannot do on its own

The map is monotone, so it can only move scores the model actually emits. On the
production corpus the model never emitted below 71, so calibration alone widens
the middle but cannot reach the bottom of the scale. The bottom opens through
two other mechanisms, both in `lib/scale.ts`:

- **the coverage cap**, which stops a rep the footage barely showed from
  claiming a high score, and
- **the refusal lane**, which keeps unreadable clips out of the distribution
  instead of compressing them into the fifties.

Sourced beginner footage is the third piece: a corpus with no bad reps in it
cannot prove that a bad rep scores badly.
