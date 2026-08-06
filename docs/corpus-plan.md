# Building a reference corpus from real analyses

Status: **agreed direction, nothing built.** Written 2026-08-05.

## The problem this solves

Every score the app produces is anchored to prose bands somebody wrote by hand.
Those bands were rewritten twice on 2026-08-05 alone: the first version asked
"what level is this player" and pushed every rep to 5.5 out of 10; the second
asked "how well was this rep executed" and moved the same clips to 72-91 out of
100. Both were defensible when written. Neither could be checked, because
**there is no ground truth anywhere in this product**. Zero of the 36 stored
real clips carry a human rating.

That is the actual blocker, and no amount of prompt work removes it. A corpus
does, by replacing an absolute claim ("this rep is a 78") with a relative one
("this rep is better than 3 in 4 of the sets we have seen"). The second claim is
checkable, survives a rubric rewrite, and gets more accurate as the product is
used rather than less.

## Phases

Each phase is useful on its own and none requires the next.

### 1. Distribution. No machine learning involved

Completed analyses already store their full result in `analyses.result`. Add one
read-only RPC returning the per-skill score distribution, keyed on nothing the
caller supplies, and the app can immediately say where a rep sits among its
peers instead of only what number a prompt produced.

Cost: one migration. No new dependency, no external call, no new data captured.

### 2. Seed the ground truth

**The model ranks. The human anchors.** That split is the whole phase, and it is
what keeps the manual effort small.

Measured 2026-08-05: re-anchoring the scale from the population bands to the
execution bands moved every score by roughly 20 points, and the rank correlation
between the two runs was **0.708**. The clips that came top stayed top and the
ones that came bottom stayed bottom. The model's ORDERING survives a total
rewrite of the scale; its LEVEL does not survive a reworded paragraph.

So the model does the part that scales — ordering every upload, forever, free —
and the owner supplies only the few points that fix where that ordering sits on
0-100.

Why the model cannot do the second part, stated plainly because the temptation
to skip this phase is strong and the failure is silent: on one set of clips the
same model returned a median of 55, 78 and 97 depending only on how the rubric
was worded, and nothing in any of those runs indicated which was right. The v1
bands were caught by the owner looking at a set and saying it should be a 7.5.
Store the model's own numbers as reference points and the loop closes on itself:
retrieval tells the next call that reps like this score 78, it returns 78, and
the corpus becomes perfectly self-consistent and possibly entirely wrong. D-094
is what that looks like at scale.

How little is needed: enough to place a line, not to build a dataset. One clip
that is clearly good, one clearly poor, and a few through the middle to check
it. Five to ten, chosen from where it matters — the clips the model is least
certain about, or where two rubric versions disagreed most. Eight well-chosen
labels beat thirty random ones.

Two things make it cheaper still. **Comparison beats scoring**: "is this set
better than that one" is faster and far more consistent for a human than "score
this out of 100", and a few dozen comparisons produce a ranking the scale can be
fitted to. And **it need not be a session**: rate clips in the lab as they pass
through. The corpus does not have to exist before the product ships, only before
phase 4.

### 3. Embeddings

A pgvector column on the analysis, holding an embedding of the analysis TEXT:
the summary plus the improvements. Not the video, and not the frames.

Text is the right target here for a reason worth stating, because the instinct
is to reach for video embeddings. The vision provider samples video at roughly
one low-resolution image per second (see `lib/ai/vision.ts`), so a video
embedding would encode about ten blurry stills. The written analysis is a
denser, cleaner description of what the model actually perceived than the pixels
it perceived it from.

### 4. Retrieval-augmented scoring

At analysis time, retrieve the nearest prior analyses and include them in the
prompt as calibration anchors, each with its score. The model then grades
against real previous reps rather than against a paragraph of prose somebody
guessed at.

This is what makes the system improve as it is used, and it is the point of the
whole exercise. It is also reversible: the retrieval either tightens agreement
with the labelled set from phase 2 or it does not, and that is a measurement,
not an opinion.

## Two constraints that are not negotiable

**This is retrieval, not fine-tuning.** The gateway cannot fine-tune this model,
and at the data volumes involved fine-tuning would be worse than retrieval even
if it could. Nothing here trains anything. That is a feature: a bad retrieval
corpus is fixed by deleting rows, where a bad fine-tune is fixed by starting
over.

**Reading one player's rep to calibrate another's crosses the tenant boundary
that `docs/security.md` exists to protect.** Row security scopes every table to
`user_id = auth.uid()`, and a retrieval query that spans accounts is by
definition a query that does not. Before any embedding is written:

- Restrict the corpus to rows whose owner gave the existing one-time
  training-data consent. That consent already exists in the analyze flow and is
  the legal basis; nothing else in the product currently relies on it.
- Store no identifier on the embedded record. The corpus needs the coaching text
  and the score, and it needs neither who filmed it nor which analysis it came
  from.
- Add the corpus table, its grants, and the retrieval function to the security
  matrix in the same change, with an answer to why the read cannot run as the
  signed-in player. Rule 10 applies: "it was easier than writing the policy" is
  the wrong answer.

## What this does not fix

The corpus makes the scale internally consistent and relatively anchored. It
does not make the underlying read more capable: the provider still samples about
one image per second, still cannot resolve a 50 to 150 millisecond contact, and
still must never be asked for a timestamp. A larger corpus of confident,
imprecise reads is still imprecise. Phase 2 is what keeps it honest.
