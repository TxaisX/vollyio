# Sourcing calibration clips

The eval harness (see `README.md`) needs real reps with known skill types and
coach-labeled score bands. This file is the sourcing pipeline: a curated,
type-identified clip list gathered from public platforms, and the workflow that
turns a downloaded clip into a case.

Platform note: the cloud session that curated this list cannot reach video
CDNs, so downloading happens on a local machine (e.g. `yt-dlp <url>`). Keep
sourced frames for private calibration only — don't publish or redistribute
them — and prefer your own footage where you can film it.

## Workflow

1. Download locally: `yt-dlp -f "mp4" <url> -o clip.mp4`
2. Trim to ONE athlete performing one or a few reps of ONE skill
   (`ffmpeg -ss <start> -to <end> -i clip.mp4 -c copy rep.mp4`).
3. Ingest: `node scripts/ingest-eval-clip.mjs rep.mp4 --skill serve [--discipline indoor] [--frames 10]`
   - Samples frames uniformly (deterministic — same clip, same case),
     sized and budgeted like the production request.
4. Label `expected` in the emitted JSON (score band, weakest metric) and drop
   it in `evals/cases/`.
5. Set the coaching key and `EVAL_TOKEN`, then run `node scripts/run-evals.mjs` locally.

Labeling guidance: tutorial slow-motion footage is great for *fault
identification* cases (the flaw is unmistakable) but poor for *timing* metrics
(tempo, read) — prefer real-speed reps for those; note it in `expected.notes`.

## Curated clips (type-identified 2026-07-11)

### Serve
| Clip | Type | Why it calibrates |
|---|---|---|
| youtube.com/watch?v=7yseUMmvKPw | Jump serve (topspin), slow-mo | Single athlete, full toss→approach→contact chain visible |
| youtube.com/watch?v=qd5UVYmBjQM | Standing float serve, slow-mo | Clean float mechanics: checked follow-through visible |
| youtube.com/shorts/MPmRiCadruU | Jump float, form short | Modern short-form framing, same as user uploads |
| youtube.com/shorts/SWGhtifrWsU | Float serve, slow-mo short | Second float sample for consistency checks |
| youtube.com/watch?v=PZ6BYglNt2Y | Collegiate jump serve, game | Real-speed game rep (timing metrics valid) |
| youtube.com/watch?v=kgXAm48Ash0 | Jump serve, slow-mo (Mitch Stahl) | High-level form for the top of the score band |
| youtube.com/watch?v=WhXt-RqHQIM | Jump serve basics, slow-mo | Developing-level form for the bottom of the band |

### Set
| Clip | Type | Why it calibrates |
|---|---|---|
| youtube.com/watch?v=lEkr3qgIDlI | Overhead set fundamentals | Isolated hand-position / stance / footwork demo segments |

### Attack
| Clip | Type | Why it calibrates |
|---|---|---|
| youtube.com/watch?v=FMtUqoxfR50 | Spike, slow-mo tutorial | Full approach→jump→swing→landing chain, single athlete |
| youtube.com/watch?v=y7DboXOZDJs | Spike full form | Timing, approach, arm swing, landing in one rep |
| youtube.com/shorts/AcbBI7M9uzg | Arm swing short | Isolated arm-swing metric case |
| youtube.com/watch?v=FAW_oKzB71Q | Top-10 slow-mo spikes | Compilation → several distinct athletes/cases from one video |
| youtube.com/watch?v=u-WhjYYocBs | Arm swing tutorial pt 1 | Deliberate fault demonstrations to label as weakest_metric |
| youtube.com/watch?v=WSieqgGFfk0 | Ball contact + body position | Contact-height metric cases |

### Pass
| Clip | Type | Why it calibrates |
|---|---|---|
| youtube.com/watch?v=o0AduQRRq-I | Serve receive tutorial | Platform/posture demos at real speed |
| youtube.com/playlist?list=PLO2VV5yy714KKOtZDjeGUsZixWv6J2sQj | Passing playlist | Bulk source: pick single-athlete segments |

### Block
| Clip | Type | Why it calibrates |
|---|---|---|
| tiktok.com/@vballrecruiter09/video/7485543486868049182 | Block technique, slow-mo | Footwork + penetration visible; TikTok framing |

### Dig
Thin in public search results — best sourced from the passing playlist's
defense segments or your own filmed reps. Every skill needs at minimum: one
clearly-developing rep, one solid rep, one advanced rep, per discipline where
possible.
