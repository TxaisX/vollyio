// Contact sheets, three clips per image, for bulk frame review.
//
// One image per clip is the readable format and it is too slow to get through
// a 422-clip corpus. Three clips stacked as three rows of six frames keeps each
// frame large enough to see a jump, an approach and a landing, which is the
// level a band call actually needs, and cuts the number of looks by two thirds.
//
//   node scripts/make-sheets.mjs --skill attack [--limit 30] [--out evals/review/bulk]
//
// Writes an index.json alongside so a reviewer knows which row is which clip:
// the rows carry no burned-in text, because drawing labels needs a font stack
// that is not guaranteed on every machine this runs on.

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const args = {};
{
  const rest = process.argv.slice(2);
  for (let i = 0; i < rest.length; i++) if (rest[i]?.startsWith("--")) args[rest[i].slice(2)] = rest[++i];
}
const CORPUS = args.corpus ?? "evals/corpus";
const OUT = args.out ?? "evals/review/bulk";
const PER = 3;
const LIMIT = args.limit ? Number(args.limit) : Infinity;

const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
const manifest = JSON.parse(readFileSync(path.join(CORPUS, "manifest.json"), "utf8"));
const labels = existsSync("evals/labels.json")
  ? JSON.parse(readFileSync("evals/labels.json", "utf8")).by_id ?? {}
  : {};
const results = existsSync("evals/video-results.json")
  ? JSON.parse(readFileSync("evals/video-results.json", "utf8")).cases ?? {}
  : {};

mkdirSync(OUT, { recursive: true });

// Unlabeled first, and one window per source video before a second window of
// any of them: two windows of the same tutorial are near-duplicates, and a
// review that spends its first hour on one video learns one video.
// --scored-only: review where the mistakes live. The model already refuses
// most title cards and presenters; a label on a clip it correctly refused
// changes nothing. Every measured error so far has been a clip it SCORED,
// either a non-rep given 89+ or a real rep given about 14 points too many.
const scoredOnly = args["scored-only"] !== undefined;
const pool = manifest
  .filter((m) => (!args.skill || m.skill === args.skill) && !labels[m.id])
  .filter((m) => !scoredOnly || typeof results[m.id]?.score === "number")
  .sort((a, b) => a.id.localeCompare(b.id));
const byVideo = new Map();
const rest = [];
for (const m of pool) {
  const v = String(m.id).replace(/-w\d+$/, "");
  if (byVideo.has(v)) rest.push(m);
  else byVideo.set(v, m);
}
const ordered = [...byVideo.values(), ...rest].slice(0, LIMIT);

const index = [];
for (let i = 0; i < ordered.length; i += PER) {
  const group = ordered.slice(i, i + PER);
  const name = `${args.skill ?? "all"}${scoredOnly ? "-scored" : ""}-${String(i / PER + 1).padStart(3, "0")}`;
  const out = path.join(OUT, `${name}.png`);
  index.push({
    sheet: `${name}.png`,
    rows: group.map((m) => ({
      id: m.id,
      skill: m.skill,
      discipline: m.discipline,
      level: m.shipped_score != null ? "production" : m.source_level,
      raw: results[m.id]?.score ?? (results[m.id]?.refusals ? "refused" : null),
    })),
  });
  if (existsSync(out)) continue;

  const tmp = mkdtempSync(path.join(tmpdir(), "sheet-"));
  try {
    const strips = group.map((m, j) => {
      const strip = path.join(tmp, `r${j}.png`);
      execFileSync(ffmpeg, [
        "-v", "error", "-y", "-i", path.join(CORPUS, m.file),
        "-vf", "fps=6/8,scale=300:-2,tile=6x1", "-frames:v", "1", strip,
      ]);
      return strip;
    });
    execFileSync(ffmpeg, [
      "-v", "error", "-y",
      ...strips.flatMap((s) => ["-i", s]),
      "-filter_complex",
      strips.length === 1 ? "[0:v]scale=1800:-2[v]" : `${strips.map((_, k) => `[${k}:v]`).join("")}vstack=inputs=${strips.length}[v]`,
      "-map", "[v]", "-frames:v", "1", out,
    ]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

writeFileSync(
  path.join(OUT, `index-${args.skill ?? "all"}${scoredOnly ? "-scored" : ""}.json`),
  JSON.stringify(index, null, 2),
);
console.log(`make-sheets: ${index.length} sheets for ${ordered.length} clips (${args.skill ?? "all skills"})`);
