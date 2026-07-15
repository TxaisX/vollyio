#!/usr/bin/env python3
"""Batch-build eval cases from a manifest: download -> trim -> ingest.

Turns scaling the eval set into "add reviewed rows to a manifest". Each row is a
sourced clip with its type already decided by a human/curator; this script does
the mechanical download + frame-cut, producing a case JSON per row with `level`
set. It does NOT invent labels: `expected` stays a TODO for a reviewed labeling
pass (see evals/TECHNIQUE-REFERENCE.md). Downloads are cached and reused.

Manifest (JSON list):
[
  {"url":"https://youtu.be/ID","skill":"serve","discipline":"indoor",
   "level":"beginner","start":3.0,"end":9.0,"id":"serve-indoor-dev-01",
   "note":"why this clip / level basis"}
]
Only url + skill are required; discipline defaults indoor, level omitted -> unset.

Usage:
  python scripts/batch_ingest.py evals/manifest.json [--limit N] [--skill serve]
    [--clips-dir .cache/clips] [--out evals/cases]

Requires yt-dlp (python -m yt_dlp) + ffmpeg. Network needed for downloads.
"""
import argparse, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INGEST = os.path.join(ROOT, "scripts", "ingest_eval_clip.py")


def download(url, clips_dir):
    """Download url (cached by video id) and return the local file path."""
    os.makedirs(clips_dir, exist_ok=True)
    # Deterministic name via yt-dlp's --print filename after --no-download would
    # need a JS runtime; instead template on id and glob for the result.
    tmpl = os.path.join(clips_dir, "%(id)s.%(ext)s")
    r = subprocess.run(
        [sys.executable, "-m", "yt_dlp", "-f", "worst[ext=mp4]/worst",
         "--no-playlist", "-o", tmpl, "--print", "after_move:filepath", url],
        capture_output=True, text=True,
    )
    path = r.stdout.strip().splitlines()[-1] if r.stdout.strip() else ""
    if path and os.path.exists(path):
        return path
    # Already downloaded: yt-dlp prints the existing path to stderr/stdout too;
    # fall back to scanning the cache for the id in the url.
    for f in os.listdir(clips_dir):
        vid = url.rsplit("/", 1)[-1].split("?")[0].split("=")[-1]
        if vid and vid in f:
            return os.path.join(clips_dir, f)
    print(f"  ! download failed: {url}\n    {r.stderr.strip()[-300:]}", file=sys.stderr)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--skill", default=None)
    ap.add_argument("--clips-dir", default=os.path.join(ROOT, ".cache", "clips"))
    ap.add_argument("--out", default=os.path.join(ROOT, "evals", "cases"))
    ap.add_argument("--allow-untrimmed", action="store_true",
                    help="ingest rows with no start/end window (produces junk on "
                         "full-length videos; off by default on purpose)")
    a = ap.parse_args()

    entries = json.load(open(a.manifest, encoding="utf-8"))
    if a.skill:
        entries = [e for e in entries if e.get("skill") == a.skill]
    if a.limit:
        entries = entries[:a.limit]

    ok = fail = 0
    for i, e in enumerate(entries, 1):
        url = e.get("url")
        skill = e.get("skill")
        if not url or not skill:
            print(f"[{i}/{len(entries)}] skip: needs url+skill"); fail += 1; continue
        if not a.allow_untrimmed and (e.get("start") is None or e.get("end") is None):
            print(f"[{i}/{len(entries)}] skip (no start/end window): {e.get('id') or url} "
                  f"-- trim to one rep first (see evals/SOURCING.md)"); fail += 1; continue
        print(f"[{i}/{len(entries)}] {skill}/{e.get('discipline','indoor')}/{e.get('level','?')} {url}")
        clip = download(url, a.clips_dir)
        if not clip:
            fail += 1; continue
        cmd = [sys.executable, INGEST, clip, "--skill", skill,
               "--discipline", e.get("discipline", "indoor"), "--out", a.out]
        if e.get("level"):
            cmd += ["--level", e["level"]]
        if e.get("start") is not None:
            cmd += ["--start", str(e["start"])]
        if e.get("end") is not None:
            cmd += ["--end", str(e["end"])]
        if e.get("id"):
            cmd += ["--id", e["id"]]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0:
            print(f"    -> {r.stdout.strip()}"); ok += 1
        else:
            print(f"    ! ingest failed: {r.stderr.strip()[-300:]}"); fail += 1

    print(f"\nbatch done: {ok} cases built, {fail} failed. "
          f"Next: label `expected` in each new evals/cases/*.json, then export_labels.py.")


if __name__ == "__main__":
    main()
