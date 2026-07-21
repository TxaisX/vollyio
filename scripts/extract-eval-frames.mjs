// Builds a frame corpus from the owner's volleyball library for pose-engine
// evaluation (D-032 investigation).
//
// Frames rather than video: the engine is evaluated per frame anyway, ffmpeg
// decodes far faster than a browser can, and 200 stills are a corpus the
// browser can iterate in minutes instead of streaming 41 GB.
//
// Source clips are never modified. Output is gitignored.

import { execFile } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const SOURCE = process.env.EVAL_VIDEO_DIR ?? "D:/Videos/Volleyball";
const OUT = path.join(process.cwd(), "evals", "footage", "evalframes");
const FRAMES_PER_CLIP = Number(process.env.FRAMES_PER_CLIP ?? 10);
// Long edge. Well above what the engine captures, so downscaling stays the
// engine's decision rather than being baked into the corpus.
const LONG_EDGE = 1920;

async function duration(file) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    file,
  ]);
  const value = Number(String(stdout).trim().split(/\s+/)[0]);
  return Number.isFinite(value) ? value : 0;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const entries = (await readdir(SOURCE)).filter((f) => f.toLowerCase().endsWith(".mp4"));
  const manifest = [];

  for (const name of entries) {
    const file = path.join(SOURCE, name);
    let dur = 0;
    try {
      dur = await duration(file);
    } catch {
      console.error(`skip (unreadable): ${name}`);
      continue;
    }
    if (!(dur > 0.5)) {
      console.error(`skip (no duration): ${name}`);
      continue;
    }

    const slug = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 60);
    // Skip the very start and end: clips often open mid-handling or on a
    // pocketed camera, which is not what the engine is being judged on.
    const from = dur * 0.08;
    const to = dur * 0.92;
    const step = (to - from) / Math.max(1, FRAMES_PER_CLIP - 1);

    for (let i = 0; i < FRAMES_PER_CLIP; i++) {
      const t = from + step * i;
      const out = path.join(OUT, `${slug}_${String(i).padStart(2, "0")}.jpg`);
      try {
        await run("ffmpeg", [
          "-v", "error",
          "-ss", t.toFixed(3),
          "-i", file,
          "-frames:v", "1",
          "-vf", `scale='min(${LONG_EDGE},iw)':-2`,
          "-q:v", "3",
          "-y", out,
        ]);
        manifest.push({
          src: `evals/footage/evalframes/${path.basename(out)}`,
          clip: name,
          t: Number(t.toFixed(2)),
        });
      } catch (err) {
        console.error(`frame failed ${name} @${t.toFixed(2)}: ${err?.message ?? err}`);
      }
    }
    console.log(`${name}: ${FRAMES_PER_CLIP} frames (${dur.toFixed(1)}s)`);
  }

  await writeFile(
    path.join(OUT, "manifest.json"),
    JSON.stringify({ generatedFrom: SOURCE, count: manifest.length, frames: manifest }, null, 2),
  );
  console.log(`\n${manifest.length} frames -> ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
