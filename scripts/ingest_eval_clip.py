#!/usr/bin/env python3
"""Turn a local volleyball clip into an eval case for evals/cases/ WITHOUT Node.

A dependency-free (stdlib + ffmpeg) twin of scripts/ingest-eval-clip.mjs, for
machines that have ffmpeg but no Node runtime. Same uniform sampling and same
base64 body budget, so cases produced either way exercise the identical request
shape as production. Adds --discipline grass and --level (the .mjs predates both).

Usage:
  python scripts/ingest_eval_clip.py <clip.mp4> --skill attack [--discipline grass]
    [--level intermediate] [--start 2.0] [--end 9.5] [--frames 10] [--id my-case]
    [--out evals/cases]

Requires ffmpeg (and ffprobe) on PATH, or set FFMPEG_PATH / FFPROBE_PATH.
After running: open the JSON and fill in `expected` (see evals/TECHNIQUE-REFERENCE.md).
"""
import argparse, base64, json, os, re, shutil, subprocess, sys, tempfile

SKILLS = ["serve", "pass", "set", "attack", "block", "dig"]
DISCIPLINES = ["indoor", "beach", "grass"]
LEVELS = ["beginner", "intermediate", "expert", "pro"]
MAX_FRAMES = 12
MAX_BODY_BYTES = 4_000_000
FRAME_DIM = 1568

FFMPEG = os.environ.get("FFMPEG_PATH", "ffmpeg")
FFPROBE = os.environ.get("FFPROBE_PATH", "ffprobe")


def fail(msg):
    sys.exit(f"ingest_eval_clip: {msg}")


def probe_duration(path):
    """Clip duration in seconds. ffprobe if present, else parse ffmpeg stderr."""
    if shutil.which(FFPROBE):
        out = subprocess.run(
            [FFPROBE, "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", path],
            capture_output=True, text=True,
        ).stdout.strip()
        try:
            d = float(out)
            if d > 0:
                return d
        except ValueError:
            pass
    # Fallback: read "Duration: HH:MM:SS.xx" from ffmpeg -i stderr.
    err = subprocess.run([FFMPEG, "-i", path], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", err)
    if not m:
        fail("could not read clip duration (is ffmpeg installed?)")
    h, mnt, s = m.groups()
    return int(h) * 3600 + int(mnt) * 60 + float(s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("clip")
    ap.add_argument("--skill", required=True, choices=SKILLS)
    ap.add_argument("--discipline", default="indoor", choices=DISCIPLINES)
    ap.add_argument("--level", default=None, choices=LEVELS)
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=None)
    ap.add_argument("--frames", type=int, default=10)
    ap.add_argument("--id", default=None)
    ap.add_argument("--out", default="evals/cases")
    a = ap.parse_args()

    if not os.path.exists(a.clip):
        fail(f"clip not found: {a.clip}")

    duration = probe_duration(a.clip)
    start = max(0.0, a.start)
    end = min(duration, a.end if a.end is not None else duration)
    if not end > start:
        fail(f"--start/--end window is empty (clip is {duration:.2f}s)")

    frame_count = min(MAX_FRAMES, max(2, a.frames))
    span = end - start
    times = [round((start + span * (i + 0.5) / frame_count) * 100) / 100
             for i in range(frame_count)]

    work = tempfile.mkdtemp(prefix="sideout-eval-")
    try:
        quality, dim = 4, FRAME_DIM  # mjpeg q:v 2(best)..7(smallest)
        while True:
            frames = []
            for i, t in enumerate(times):
                f = os.path.join(work, f"f{i}.jpg")
                subprocess.run(
                    [FFMPEG, "-y", "-v", "error", "-ss", str(t), "-i", a.clip,
                     "-frames:v", "1", "-vf", f"scale='min({dim},iw)':-2",
                     "-q:v", str(quality), f],
                    check=True,
                )
                with open(f, "rb") as fh:
                    frames.append({"time_s": t,
                                   "data": base64.b64encode(fh.read()).decode()})
            body = sum(len(f["data"]) for f in frames)
            if body <= MAX_BODY_BYTES * 0.9 or (quality >= 7 and dim <= 960):
                break
            if quality < 7:
                quality += 1
            else:
                dim = max(960, round(dim * 0.8))

        stem = re.sub(r"[^a-z0-9-]", "-", os.path.splitext(os.path.basename(a.clip))[0].lower())
        case_id = a.id or f"{a.skill}-{a.discipline}-{stem}"
        os.makedirs(a.out, exist_ok=True)
        out_path = os.path.join(a.out, f"{case_id}.json")

        case = {
            "id": case_id,
            "skill": a.skill,
            "discipline": a.discipline,
            "source": os.path.basename(a.clip),
            "frames": frames,
            "expected": {
                "overall_min": 0,
                "overall_max": 100,
                "weakest_metric": "",
                "notes": "TODO: label this rep (see evals/TECHNIQUE-REFERENCE.md): score band + weakest metric.",
            },
        }
        if a.level:
            case["level"] = a.level

        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump(case, fh, indent=2, ensure_ascii=False)

        kb = round(sum(len(f["data"]) for f in frames) / 1024)
        print(json.dumps({"outPath": out_path, "frames": len(frames),
                          "window": [start, end], "payloadKb": kb}))
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
