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
3. Ingest (pick the one your machine supports):
   - **Node:** `node scripts/ingest-eval-clip.mjs rep.mp4 --skill serve [--discipline indoor|beach|grass] [--frames 10]`
   - **No Node (ffmpeg only):** `python scripts/ingest_eval_clip.py rep.mp4 --skill serve [--discipline grass] [--level intermediate] [--frames 10]`
   - Both sample frames uniformly (deterministic — same clip, same case),
     sized and budgeted like the production request, and emit an identical
     case JSON. The Python twin also accepts `--level` and `--discipline grass`.
4. Label `expected` against `evals/TECHNIQUE-REFERENCE.md` (score band, weakest
   metric) and drop the JSON in `evals/cases/`.
5. Run `GET /api/eval` locally with a real key.

Labeling guidance: tutorial slow-motion footage is great for *fault
identification* cases (the flaw is unmistakable) but poor for *timing* metrics
(tempo, read) — prefer real-speed reps for those; note it in `expected.notes`.

## Amateur cases — the priority gap

The 23 labeled cases (v01–v12) are all **pro** highlights: they validate the top
of the scale but every one has an empty `weakest_metric` (flawless reps, nothing
to detect) and none exercise the amateur ladder the app actually recalibrated to
(`lib/ai/anchors.ts` `AMATEUR_STANDARD`). What the set needs next:

- **Amateur reps with real faults**, labeled with a `weakest_metric` and a band
  in the 40–70 range, at `--level intermediate` (or `beginner`). These are what
  prove the model *finds the fault* and *scores it honestly*, the whole point of
  the recalibration.
- Coverage target: per skill, at least one clearly-**developing** rep, one
  **solid** rep, one **advanced** rep, per discipline where possible.
- The curated list below already flags developing-level and deliberate-fault
  clips (e.g. "Jump serve basics" WhXt-RqHQIM, "Arm swing tutorial — deliberate
  fault demonstrations" u-WhjYYocBs) — start there.

**Blocker (needs a human): source clips must be downloaded locally.** This
environment cannot reach video CDNs, so someone has to `yt-dlp` the clips (or
supply their own footage) onto the machine; then the Python cutter above turns
each into a case with no Node required. Everything downstream (cut → label →
run) is ready.

## Batch machinery (`scripts/batch_ingest.py`)

Scaling the set = adding reviewed rows to a manifest, then:
`python scripts/batch_ingest.py evals/manifest.json`. It downloads (cached) and
cuts each row into a case; it never invents labels (`expected` stays TODO).

**Hard lesson — every row MUST carry a trim window (`start`/`end`).** A batch run
without windows was tried and produced junk: sampling 10 frames across a whole
10-minute tutorial yields talking-head/title-card frames, not one rep, and the
source list's per-clip "type" and any guessed `level` do not survive contact
with the actual frames (a "float-serve slow-mo" clip was really a wide junior
match). So the real per-clip work, the thing that can't be automated, is:

1. Watch the clip; find ONE athlete performing ONE rep of the named skill.
2. Set `start`/`end` to that rep's window (a few seconds).
3. Confirm the skill/discipline from the frames; assign `level` only if the
   footage actually justifies it, else leave it off.
4. After ingest, **verify the montage** before labeling (`evals/work/` or a
   quick ffmpeg tile) — a case you haven't looked at is not a case.

This is why "100 of each level" is a curation project, not a download job.
Downloads and cutting are solved; steps 1–4 are per-clip human judgment. A
tighter, verified set (a few correctly-trimmed, honestly-leveled reps per
skill×level×discipline cell) is a better benchmark than hundreds of raw grabs.

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
