// Turn a local volleyball clip into an eval case for evals/cases/.
//
// The in-app capture path (analyze-flow + lib/frames.ts) picks frames by
// motion peaks; this CLI samples uniformly instead so a given clip always
// produces the same case — determinism is what a calibration set wants.
// Frame sizing and the body budget mirror lib/frames.ts (VIDEO_FRAME_DIM,
// MAX_BODY_BYTES) so cases exercise the same request shape as production.
//
// Usage:
//   node scripts/ingest-eval-clip.mjs <clip.mp4> --skill set [--discipline indoor]
//     [--start 2.0] [--end 9.5] [--frames 10] [--id set-indoor-my-case]
//     [--out evals/cases]
//
// Requires ffmpeg + ffprobe on PATH (or FFMPEG_PATH / FFPROBE_PATH).
// After running: open the JSON and fill in `expected` (see evals/README.md).

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Mirrors lib/skills.ts (scripts stay dependency-free of the TS graph).
const SKILLS = ["serve", "pass", "set", "attack", "block", "dig"];
const DISCIPLINES = ["indoor", "beach"];
// Mirrors lib/analysis-types.ts / lib/frames.ts.
const MAX_FRAMES = 12;
const MAX_BODY_BYTES = 4_000_000;
const FRAME_DIM = 1568;

const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH ?? "ffprobe";

function fail(msg) {
  console.error(`ingest-eval-clip: ${msg}`);
  process.exit(1);
}

const [, , input, ...rest] = process.argv;
if (!input || input.startsWith("--")) {
  fail("first argument must be the clip path (mp4/mov/webm)");
}
const args = {};
for (let i = 0; i < rest.length; i += 2) {
  if (!rest[i]?.startsWith("--") || rest[i + 1] === undefined) {
    fail(`malformed flag near "${rest[i]}"`);
  }
  args[rest[i].slice(2)] = rest[i + 1];
}

const skill = args.skill;
if (!SKILLS.includes(skill)) fail(`--skill must be one of: ${SKILLS.join(", ")}`);
const discipline = args.discipline ?? "indoor";
if (!DISCIPLINES.includes(discipline)) {
  fail(`--discipline must be one of: ${DISCIPLINES.join(", ")}`);
}

const duration = Number(
  execFileSync(
    ffprobe,
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", input],
    { encoding: "utf8" },
  ).trim(),
);
if (!Number.isFinite(duration) || duration <= 0) fail("could not read clip duration");

const start = Math.max(0, Number(args.start ?? 0));
const end = Math.min(duration, Number(args.end ?? duration));
if (!(end > start)) fail(`--start/--end window is empty (clip is ${duration.toFixed(2)}s)`);

const frameCount = Math.min(MAX_FRAMES, Math.max(2, Number(args.frames ?? 10)));

// Uniform timestamps across the window, nudged off the exact endpoints.
const span = end - start;
const times = Array.from({ length: frameCount }, (_, i) => {
  const t = start + (span * (i + 0.5)) / frameCount;
  return Math.round(t * 100) / 100;
});

const workDir = mkdtempSync(path.join(tmpdir(), "sideout-eval-"));
try {
  // Re-encode down if the base64 payload would blow the request budget,
  // mirroring the shrink loop in lib/frames.ts.
  let quality = 4; // ffmpeg mjpeg q:v — 2 (best) .. 7 (smallest) used here
  let dim = FRAME_DIM;
  let frames;
  for (;;) {
    frames = times.map((t, i) => {
      const file = path.join(workDir, `f${i}.jpg`);
      execFileSync(ffmpeg, [
        "-y", "-v", "error",
        "-ss", String(t),
        "-i", input,
        "-frames:v", "1",
        "-vf", `scale='min(${dim},iw)':-2`,
        "-q:v", String(quality),
        file,
      ]);
      return { time_s: t, data: readFileSync(file).toString("base64") };
    });
    const bytes = frames.reduce((a, f) => a + f.data.length, 0);
    if (bytes <= MAX_BODY_BYTES * 0.9 || (quality >= 7 && dim <= 960)) break;
    if (quality < 7) quality += 1;
    else dim = Math.max(960, Math.round(dim * 0.8));
  }

  const id =
    args.id ?? `${skill}-${discipline}-${path.parse(input).name.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
  const outDir = args.out ?? "evals/cases";
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${id}.json`);

  writeFileSync(
    outPath,
    JSON.stringify(
      {
        id,
        skill,
        discipline,
        source: path.basename(input),
        frames,
        // Deliberately empty. Writing placeholder values here (a 0-100 band, an
        // empty weakest_metric) produced cases that looked labeled and either
        // always passed or silently skipped. An empty `expected` is honest: the
        // coverage report counts it as unlabeled and names it.
        expected: {
          notes: "Unlabeled. Run: node scripts/label-case.mjs " + id,
        },
        // Attach the on-device measurement block here to make this case
        // exercise the grounded scoring path (see evals/README.md).
        measurements: null,
      },
      null,
      2,
    ),
  );

  const kb = Math.round(frames.reduce((a, f) => a + f.data.length, 0) / 1024);
  console.log(
    JSON.stringify({ outPath, frames: frames.length, window: [start, end], payloadKb: kb }),
  );
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
