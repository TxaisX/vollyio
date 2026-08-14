// Expand the calibration corpus with public footage.
//
// The production corpus is what it is: 47 clips, 30 of them attacks, none at
// all for block or dig, and every one filmed by a handful of people at one
// level. A map fitted on that can only learn the middle. The bottom and the top
// of the scale have to come from footage of beginners and of professionals, and
// that is what this pulls in.
//
// Windows are cut BLIND, evenly spaced, with no attempt to detect a rep. That
// is deliberate: a window that turns out to hold no rep at all is labeled
// "cannot rate" by the reviewer and becomes ground truth for the refusal lane,
// which production currently has zero evidence about. Junk is not waste here.
//
// Clips stay local (evals/corpus is gitignored) and are for private calibration
// only, as evals/SOURCING.md says.
//
//   node scripts/source-clips.mjs [--list evals/sources.json] [--out evals/corpus]
//     [--windows 5] [--seconds 8] [--only serve] [--limit N]
//
// Requires yt-dlp and ffmpeg on PATH.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const args = {};
{
  const rest = process.argv.slice(2);
  for (let i = 0; i < rest.length; i++) if (rest[i]?.startsWith("--")) args[rest[i].slice(2)] = rest[++i];
}
const LIST = args.list ?? "evals/sources.json";
const OUT = args.out ?? "evals/corpus";
const CACHE = args.cache ?? "evals/footage";
const WINDOWS = Number(args.windows ?? 5);
const SECONDS = Number(args.seconds ?? 8);
const LIMIT = args.limit ? Number(args.limit) : Infinity;

const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH ?? "ffprobe";

mkdirSync(OUT, { recursive: true });
mkdirSync(CACHE, { recursive: true });

const sources = JSON.parse(readFileSync(LIST, "utf8")).filter(
  (s) => !args.only || s.skill === args.only,
);

const manifestPath = path.join(OUT, "manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : [];
const have = new Set(manifest.map((m) => m.id));

function slugOf(url) {
  const m = url.match(/(?:v=|shorts\/|video\/|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return (m?.[1] ?? url.replace(/[^A-Za-z0-9]/g, "").slice(-11)).slice(0, 11);
}

function duration(file) {
  try {
    const out = execFileSync(ffprobe, [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", file,
    ]).toString().trim();
    const n = Number(out);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

let added = 0;
for (const src of sources) {
  if (added >= LIMIT) break;
  const slug = slugOf(src.url);
  const cached = readdirSync(CACHE).find((f) => f.startsWith(slug) && !f.endsWith(".part"));
  let file = cached ? path.join(CACHE, cached) : null;

  if (!file) {
    console.log(`downloading ${src.skill}: ${src.url}`);
    try {
      execFileSync(
        "yt-dlp",
        [
          "-f", "best[height<=720][ext=mp4]/best[ext=mp4]/best",
          "--no-playlist", "--no-warnings", "--quiet",
          "-o", path.join(CACHE, `${slug}.%(ext)s`),
          src.url,
        ],
        { stdio: ["ignore", "ignore", "pipe"], timeout: 180_000 },
      );
    } catch (err) {
      console.log(`  skip: download failed (${String(err.message).split("\n")[0].slice(0, 80)})`);
      continue;
    }
    const found = readdirSync(CACHE).find((f) => f.startsWith(slug) && !f.endsWith(".part"));
    if (!found) {
      console.log("  skip: nothing downloaded");
      continue;
    }
    file = path.join(CACHE, found);
  }

  const total = duration(file);
  if (!total) {
    console.log(`  skip: unreadable duration for ${file}`);
    continue;
  }

  // Trim the leading and trailing 8%: titles, intros and end cards are not
  // reps, and a corpus full of them wastes the reviewer's attention rather
  // than testing the refusal lane, which one or two junk windows already do.
  const usableStart = total * 0.08;
  const usableEnd = total * 0.92;
  const usable = Math.max(0, usableEnd - usableStart);
  const count = Math.max(1, Math.min(WINDOWS, Math.floor(usable / SECONDS)));
  const step = count > 1 ? (usable - SECONDS) / (count - 1) : 0;

  for (let i = 0; i < count; i++) {
    const id = `src-${slug}-w${i + 1}`;
    if (have.has(id)) continue;
    const start = usableStart + step * i;
    const dest = path.join(OUT, `${id}.mp4`);
    try {
      // Re-encoded rather than stream-copied: a copy cuts on keyframes, so the
      // window drifts by up to a second and the clip can open mid-rep. Sized
      // to what a phone uploads, because that is the footage the prompt was
      // written against.
      execFileSync(
        ffmpeg,
        [
          "-v", "error", "-y",
          "-ss", start.toFixed(2), "-i", file, "-t", String(SECONDS),
          "-vf", "scale='min(720,iw)':-2",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
          "-an", "-movflags", "+faststart",
          dest,
        ],
        { stdio: ["ignore", "ignore", "pipe"], timeout: 180_000 },
      );
    } catch (err) {
      console.log(`  window ${i + 1} failed: ${String(err.message).split("\n")[0].slice(0, 70)}`);
      continue;
    }
    if (!existsSync(dest) || statSync(dest).size < 20_000) continue;
    manifest.push({
      id,
      file: `${id}.mp4`,
      skill: src.skill,
      discipline: src.discipline,
      duration_s: SECONDS,
      // No shipped_score: production never saw these. `level` is the SOURCE's
      // claim about the athlete, never a label about the rep; only the reviewer
      // labels reps.
      source_level: src.level ?? null,
      source: src.url,
      note: src.note ?? null,
    });
    have.add(id);
    added++;
  }
  console.log(`  ${src.skill} ${slug}: ${count} windows from ${total.toFixed(0)}s`);
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
const bySkill = {};
for (const m of manifest) bySkill[m.skill] = (bySkill[m.skill] ?? 0) + 1;
console.log(`\nsource-clips: +${added} clips, corpus now ${manifest.length}`);
console.log(`  by skill: ${Object.entries(bySkill).map(([k, v]) => `${k}=${v}`).join(" ")}`);
