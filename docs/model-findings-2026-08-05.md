# Model findings, 2026-08-05

Measurements behind the move to Gemini 3.6 Flash on video, and a costed
candidate for coach chat. Everything here was run against real clips and the
repo's own prompts, not reasoned from documentation.

## The rubric was the variable, not the model

Same model, same clips, same modality. Only the rubric text changed.

| Rubric | Median | Range | not_visible |
|---|---|---|---|
| 120-pointer, strict evidence on | 97 | 82-100 | 8.3% |
| 120-pointer, strict off | 100 | 96-100 | 0.4% |
| Simplified holistic | 78 | 65-89 | abstains on real cases |

The pointer path on video tells every player they are near-perfect. That
reproduces D-094 exactly, and it is why "swap the engine but keep the
per-checkpoint UI" is not available: the verdicts that UI renders cannot be
produced honestly from about ten low-resolution stills.

Scale wording alone moved the median across 55, 78 and 97 on one set of clips,
with nothing in any run indicating which was right. Rank correlation across a
complete re-anchor was **0.708** — ordering survives what level does not. That
asymmetry is the basis of the corpus plan in `corpus-plan.md`.

## What the provider actually does with video

Sampled at roughly **one low-resolution image per second, and it is not
configurable**. Cost is flat at ~89 tokens per second of footage, measured from
2.2s to 9.96s. A ten second clip therefore reaches the model as about ten
stills, against 64 frames at 1024px on the frame path.

`videoMetadata.fps`, the `file` content shape, and `image_url` carrying MP4 data
all land on an identical 201-token ingestion, so none of them is a lever. The
native Gemini API does expose the control; no Google key exists in this
environment, so it is unreachable today.

The consequence is temporal and absolute: **this path cannot answer "when".** On
a clip whose contact is hand-verified at 3.42s, six runs answered between 0.27s
and 0.60s while self-reporting 30fps. A contact lasts 50 to 150ms and is simply
not in the sample. Never ask this path for a timestamp.

## Recognition contaminates the score

An elite attack clip scored **88-91 across four runs** here. Run standalone with
no rubric, the same model returned **96**, and its reasoning named the athlete,
the two universities he played for, and his 45-inch vertical.

That number is therefore partly résumé rather than pixels, and it cannot
generalise: the overwhelming majority of clips this product sees are of people
the model has never heard of. A scale that quietly rewards being recognisable
would rate a recruit's highlight above an identical swing from an unknown. It is
also a plausible contributor to the ceiling-pegging D-094 measured.

Both reads independently found the same single fault (shoulders squaring early
to the angle), and their strengths overlapped four for four. The disagreement is
about level, not about what is in the footage.

## Reliability

Two full passes over the same 38 clips: the first produced one abstention and
two hard failures, the second produced neither, and individual scores moved by
up to 14 points. **Abstention and outright failure are both stochastic**, so a
single clean run proves nothing. In production every one of those failures is a
player who filmed a rep and got nothing back, so the route needs a retry and
honest failure copy rather than treating a parse miss as an analysis.

The rubric also scored a 32-second multi-rep video without abstaining, silently
picking one rep. It asks about a single rep and has no guard against this.

## Coach chat: a costed candidate, not a decision

Coach chat is the highest-frequency paid path in the app. Live gateway rates:

| Model | Input /MTok | Output /MTok | Modalities |
|---|---|---|---|
| `deepseek/deepseek-v4-flash` | $0.09 | $0.18 | text |
| `anthropic/claude-sonnet-5` | $2.00 | $10.00 | text, image, file |

Coach chat is text-only by construction (16 KB body cap), so the modality gap
costs nothing. Per answer the difference lands near **$0.00007 against $0.005**,
roughly seventy fold, driven partly by rate and partly by Sonnet being two to
four times more verbose on identical questions.

Both models were probed against the real `coach-prompt.ts` system prompt on the
four behaviours it demands: refuse to invent a rating for a skill with no data,
cite the player's real scores, never name a vendor, and resist a command
smuggled into a player-typed goal title. **Both passed all four.** The injection
probe matters most, because goal titles and display names are free text a player
controls, and it is a real attack surface rather than a hypothetical one.

This is four probes at one run each. It establishes capability and says nothing
about reliability, which is the property that matters for a guard: run the
injection probe at least ten times before trusting it, because a single failure
in production is a player extracting fabricated statistics about themselves.

Note also that gateway popularity rankings measure price and bulk throughput,
not fitness for a coaching task. The cheapest capable model wins that ranking by
construction.

### Quality, separately from guardrails

Guardrails are a floor. Four real player questions were then put to both models
on the same context: what to work on this week, why the attack score swung from
79 to 61, what to change about getting blocked, and a frustrated "I've been
stuck at 74 for weeks".

**Length decided it.** Against an 800-token ceiling, Sonnet was cut off on all
four answers; DeepSeek was cut off on one and averaged around 600. That is not
thoroughness, it is an inability to finish a coaching answer inside a budget a
chat UI has to impose, and it argues against Sonnet for a surface the copy rules
require to be readable on a phone.

On substance they traded. Sonnet's sharpest moment was diagnostic framing: "when
your legs load and drive, you're in the high 70s. When you don't, you're in the
low 60s. That gap is your ceiling right now." DeepSeek's best was the frustrated
player, where it observed that twelve analyses had produced no rating change,
concluded the player needed to change how they practise rather than practise
more, and then made the plan falsifiable: run this drill for two or three
sessions, record a new analysis, and if the score does not move the problem is
elsewhere. Telling a player what would prove the advice wrong was not asked for
by the prompt and is the strongest single answer either model produced.

Both held the voice: no praise padding, precise about the deficit, no
therapy-speak.

**Conclusion: comparable coaching, DeepSeek fits the medium better, at roughly
one seventieth the cost on the highest-frequency paid path.** The caveat is the
same one that applies to everything else here: four questions at one run each,
with a token cap that penalised Sonnet's completeness. If coach chat is where
the product should feel premium, Sonnet's phrasing edge on analytical questions
is real and worth paying for. That call belongs to whoever owns the voice.
