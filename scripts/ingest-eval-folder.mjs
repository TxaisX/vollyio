// Split every video in a folder into plays and stage them for eval cases.
//
// Motion-based splitting: a small grayscale frame stream is diffed to build
// an activity curve; sustained activity between calm valleys (or hard cuts)
// becomes a play. Each play gets a trimmed window, production-sized frames
// (mirroring scripts/ingest-eval-clip.mjs sizing), and a smaller frame set
// for skill classification. Output is an intermediate staging file per play
// in evals/work/plays/; scripts/classify-plays.mjs turns staged plays into
// final evals/cases/*.json once the skill vote settles.
//
// Usage:
//   node scripts/ingest-eval-folder.mjs "<folder>" [--maxPlays 6]
//
// Requires ffmpeg + ffprobe on PATH (or FFMPEG_PATH / FFPROBE_PATH).

import { execFileSync, execFile } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const MAX_FRAMES = 12;
const MAX_BODY_BYTES = 4_000_000;
const FRAME_DIM = 1568;
const CLASSIFY_DIM = 512;
const CLASSIFY_FRAMES = 6;
const MAX_PLAY_SECONDS = 45;
const MIN_PLAY_SECONDS = 2.5;
const PAD_S = 1.0;
const SCAN_FPS = 6;
const SCAN_W = 96;
const SCAN_H = 54;

const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH ?? "ffprobe";

const [, , folder, ...rest] = process.argv;
if (!folder) {
  console.error("usage: node scripts/ingest-eval-folder.mjs <folder> [--maxPlays 6]");
  process.exit(1);
}
const args = {};
for (let i = 0; i < rest.length; i += 2) args[rest[i]?.slice(2)] = rest[i + 1];
const maxPlays = Math.max(1, Number(args.maxPlays ?? 6));

const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".mkv", ".m4v"]);

function probeDuration(file) {
  return Number(
    execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], {
      encoding: "utf8",
    }).trim(),
  );
}

// Grayscale downscaled raw frames -> mean abs diff curve at SCAN_FPS.
function motionCurve(file) {
  const raw = execFileSync(
    ffmpeg,
    [
      "-v", "error",
      "-i", file,
      "-vf", `fps=${SCAN_FPS},scale=${SCAN_W}:${SCAN_H},format=gray`,
      "-f", "rawvideo",
      "-",
    ],
    { maxBuffer: 512 * 1024 * 1024 },
  );
  const frameBytes = SCAN_W * SCAN_H;
  const n = Math.floor(raw.length / frameBytes);
  const curve = [];
  for (let i = 1; i < n; i++) {
    let sum = 0;
    const a = (i - 1) * frameBytes;
    const b = i * frameBytes;
    for (let p = 0; p < frameBytes; p += 4) {
      sum += Math.abs(raw[b + p] - raw[a + p]);
    }
    curve.push({ t: i / SCAN_FPS, d: sum / (frameBytes / 4) });
  }
  return curve;
}

function smooth(values, w) {
  return values.map((_, i) => {
    let a = 0;
    let c = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(values.length - 1, i + w); j++) {
      a += values[j];
      c++;
    }
    return a / c;
  });
}

// Activity segments between calm valleys; hard cuts (huge diffs) split too.
function splitPlays(curve, duration) {
  if (curve.length < 4) return [{ startS: 0, endS: Math.min(duration, MAX_PLAY_SECONDS) }];
  const ds = smooth(curve.map((c) => c.d), 2);
  const mean = ds.reduce((a, b) => a + b, 0) / ds.length;
  const std = Math.sqrt(ds.reduce((a, b) => a + (b - mean) ** 2, 0) / ds.length);
  const active = mean + 0.25 * std;
  const cut = Math.max(mean + 3 * std, 28); // hard scene change

  const segments = [];
  let start = null;
  for (let i = 0; i < ds.length; i++) {
    const t = curve[i].t;
    const isCut = curve[i].d >= cut;
    if (ds[i] >= active && !isCut) {
      if (start == null) start = t;
    } else if (start != null && (isCut || ds[i] < active * 0.75)) {
      segments.push({ startS: start, endS: t });
      start = null;
    }
  }
  if (start != null) segments.push({ startS: start, endS: duration });

  // Merge close neighbours, pad, clamp, drop slivers, split overlong.
  const merged = [];
  for (const s of segments) {
    const last = merged[merged.length - 1];
    if (last && s.startS - last.endS < 1.2) last.endS = s.endS;
    else merged.push({ ...s });
  }
  const plays = [];
  for (const s of merged) {
    let a = Math.max(0, s.startS - PAD_S);
    let b = Math.min(duration, s.endS + PAD_S);
    if (b - a < MIN_PLAY_SECONDS) continue;
    while (b - a > MAX_PLAY_SECONDS) {
      plays.push({ startS: a, endS: a + MAX_PLAY_SECONDS });
      a += MAX_PLAY_SECONDS;
    }
    plays.push({ startS: a, endS: b });
  }
  if (plays.length === 0) {
    plays.push({ startS: 0, endS: Math.min(duration, MAX_PLAY_SECONDS) });
  }
  return plays.slice(0, maxPlays);
}

function extractFrames(file, times, dim, quality, workDir, tag) {
  return times.map((t, i) => {
    const out = path.join(workDir, `${tag}-${i}.jpg`);
    execFileSync(ffmpeg, [
      "-y", "-v", "error",
      "-ss", String(t),
      "-i", file,
      "-frames:v", "1",
      "-vf", `scale='min(${dim},iw)':-2`,
      "-q:v", String(quality),
      out,
    ]);
    return { time_s: Math.round(t * 100) / 100, data: readFileSync(out).toString("base64") };
  });
}

function slugify(name, index) {
  const words = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !["the", "and", "1080p", "720p", "h264", "youtube"].includes(w))
    .slice(0, 4);
  const hint = words.join("-") || "clip";
  return `v${String(index + 1).padStart(2, "0")}-${hint}`.slice(0, 48);
}

const files = readdirSync(folder)
  .filter((f) => VIDEO_EXT.has(path.extname(f).toLowerCase()))
  .sort();
if (files.length === 0) {
  console.error(`no videos found in ${folder}`);
  process.exit(1);
}

const outDir = path.join("evals", "work", "plays");
rmSync(path.join("evals", "work"), { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const workDir = mkdtempSync(path.join(tmpdir(), "sideout-folder-"));

const manifest = [];
try {
  files.forEach((name, vi) => {
    const file = path.join(folder, name);
    const duration = probeDuration(file);
    const slug = slugify(name, vi);
    const plays = splitPlays(motionCurve(file), duration);
    plays.forEach((p, pi) => {
      const span = p.endS - p.startS;
      const count = Math.min(MAX_FRAMES, Math.max(6, Math.round(span * 1.2)));
      const times = Array.from({ length: count }, (_, i) => p.startS + (span * (i + 0.5)) / count);

      let quality = 4;
      let dim = FRAME_DIM;
      let frames;
      for (;;) {
        frames = extractFrames(file, times, dim, quality, workDir, `${slug}-p${pi}`);
        const bytes = frames.reduce((a, f) => a + f.data.length, 0);
        if (bytes <= MAX_BODY_BYTES * 0.9 || (quality >= 7 && dim <= 960)) break;
        if (quality < 7) quality += 1;
        else dim = Math.max(960, Math.round(dim * 0.8));
      }

      const ct = Array.from(
        { length: CLASSIFY_FRAMES },
        (_, i) => p.startS + (span * (i + 0.5)) / CLASSIFY_FRAMES,
      );
      const classifyFrames = extractFrames(file, ct, CLASSIFY_DIM, 6, workDir, `${slug}-c${pi}`);

      const playId = `${slug}-p${pi + 1}`;
      writeFileSync(
        path.join(outDir, `${playId}.json`),
        JSON.stringify({
          play_id: playId,
          source_video: name,
          video_slug: slug,
          play_index: pi + 1,
          play_count: plays.length,
          duration_s: Math.round(duration * 100) / 100,
          window: { startS: Math.round(p.startS * 100) / 100, endS: Math.round(p.endS * 100) / 100 },
          frames,
          classify_frames: classifyFrames,
        }),
      );
      manifest.push({ playId, video: name, window: [p.startS, p.endS].map((x) => Math.round(x * 10) / 10) });
    });
    console.log(`${slug}: ${duration.toFixed(1)}s -> ${plays.length} play(s)`);
  });
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

writeFileSync(path.join("evals", "work", "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`staged ${manifest.length} plays from ${files.length} videos -> ${outDir}`);
