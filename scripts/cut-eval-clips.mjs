// Cut each active eval case's clip window out of its source video into
// evals/clips/<case-id>.mp4, for the eval route's video mode (?video=1).
//
// Sources are matched by the exact `source` filename recorded on the case.
// Native resolution capped at 1080 tall: never upscaled, because interpolated
// pixels add tokens and no information. Audio is kept deliberately: a real
// player clip carries it, and ball contact is audible signal.
//
//   node scripts/cut-eval-clips.mjs --source <dir with the original videos>
//     [--case <id prefix>] [--force]

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const args = {};
const rest = process.argv.slice(2);
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--force") args.force = "1";
  else if (rest[i]?.startsWith("--")) args[rest[i].slice(2)] = rest[++i];
}
if (!args.source) throw new Error("--source <dir> is required.");

const CASES = "evals/cases";
const OUT = "evals/clips";
mkdirSync(OUT, { recursive: true });

const available = readdirSync(args.source);
const byName = new Map(available.map((f) => [f, f]));

let cut = 0;
let missing = 0;
for (const f of readdirSync(CASES).filter((f) => f.endsWith(".json"))) {
  const c = JSON.parse(readFileSync(path.join(CASES, f), "utf8"));
  if (c.excluded) continue;
  if (args.case && !c.id.startsWith(args.case)) continue;
  const out = path.join(OUT, `${c.id}.mp4`);
  if (existsSync(out) && !args.force) {
    console.log(`${c.id}: already cut`);
    continue;
  }
  const src = byName.get(c.source);
  if (!src) {
    console.log(`${c.id}: SOURCE MISSING (${c.source})`);
    missing++;
    continue;
  }
  const { startS, endS } = c.window ?? {};
  if (typeof startS !== "number" || typeof endS !== "number") {
    console.log(`${c.id}: no window on case, skipped`);
    continue;
  }
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-ss", String(startS), "-to", String(endS),
      "-i", path.join(args.source, src),
      "-vf", "scale=-2:'min(1080,ih)'",
      "-c:v", "libx264", "-crf", "26", "-preset", "veryfast",
      "-c:a", "aac", "-b:a", "64k",
      "-movflags", "+faststart",
      out,
    ],
    { stdio: ["ignore", "inherit", "inherit"] },
  );
  const mb = (statSync(out).size / 1e6).toFixed(1);
  console.log(`${c.id}: cut ${(endS - startS).toFixed(1)}s -> ${mb} MB`);
  cut++;
}
console.log(`\n${cut} cut, ${missing} missing sources -> ${OUT}/`);
