// Full-coverage frame corpus for pose-engine evaluation (D-032).
//
// Short clips (rep-length, the product's actual use case) are extracted at
// native frame rate: every frame. Long recordings (full sessions, minutes each)
// are sampled densely enough to catch every rally without spending the entire
// budget decoding one video.
//
// Extracted at 1280 long edge because the engine captures at 1280 regardless,
// so keeping 4K would cost roughly ten times the disk and decode time for
// pixels no model ever sees.
//
// Source clips are never modified. Output is gitignored.

import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const SOURCE = process.env.EVAL_VIDEO_DIR ?? "D:/Videos/Volleyball";
const OUT = path.join(process.cwd(), "public", "evalframes-full");
const LONG_EDGE = 1280;
// A clip at or under this length is treated as rep-length and taken whole.
const SHORT_CLIP_S = 40;
// Sampling rate for long session recordings.
const LONG_CLIP_FPS = 3;

async function probe(file) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=r_frame_rate",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const lines = String(stdout).trim().split(/\s+/);
  const rate = lines.find((l) => l.includes("/"));
  const dur = Number(lines.find((l) => !l.includes("/")));
  let fps = 30;
  if (rate) {
    const [n, d] = rate.split("/").map(Number);
    if (n > 0 && d > 0) fps = n / d;
  }
  return { fps, duration: Number.isFinite(dur) ? dur : 0 };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const files = (await readdir(SOURCE)).filter((f) => f.toLowerCase().endsWith(".mp4"));
  const manifest = [];
  let totalFrames = 0;

  for (const name of files) {
    const file = path.join(SOURCE, name);
    let info;
    try {
      info = await probe(file);
    } catch {
      console.error(`skip (unreadable): ${name}`);
      continue;
    }
    if (!(info.duration > 0.2)) continue;

    const short = info.duration <= SHORT_CLIP_S;
    const sampleFps = short ? info.fps : LONG_CLIP_FPS;
    const slug = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 50);
    const dir = path.join(OUT, slug);
    await mkdir(dir, { recursive: true });

    const started = Date.now();
    try {
      await run(
        "ffmpeg",
        [
          "-v", "error",
          "-i", file,
          "-vf", `fps=${sampleFps.toFixed(4)},scale='min(${LONG_EDGE},iw)':-2`,
          "-q:v", "4",
          "-y",
          path.join(dir, "f_%05d.jpg"),
        ],
        { maxBuffer: 1 << 26 },
      );
    } catch (err) {
      console.error(`extract failed ${name}: ${err?.message ?? err}`);
      continue;
    }

    const produced = (await readdir(dir)).filter((f) => f.endsWith(".jpg")).sort();
    for (let i = 0; i < produced.length; i++) {
      manifest.push({
        src: `/evalframes-full/${slug}/${produced[i]}`,
        clip: name,
        t: Number((i / sampleFps).toFixed(3)),
        mode: short ? "native" : "sampled",
      });
    }
    totalFrames += produced.length;
    console.log(
      `${name}: ${produced.length} frames @${sampleFps.toFixed(1)}fps ` +
        `(${short ? "native" : "sampled"}, ${info.duration.toFixed(0)}s, ` +
        `${((Date.now() - started) / 1000).toFixed(0)}s)`,
    );
  }

  await writeFile(
    path.join(OUT, "manifest.json"),
    JSON.stringify({ count: manifest.length, frames: manifest }),
  );
  console.log(`\nTOTAL ${totalFrames} frames -> ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
