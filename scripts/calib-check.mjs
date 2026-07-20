// Validation for the D-034 scoring recalibration: replay the owner's live rep
// (the one production scored 42) through the NEW standard, at the shipped
// effort and one tier up, and print where the numbers land. Mirrors the
// analyze route: same rubric, same output spec, same ring-marked frame flow.
//
// Run with:
//   node --import ./scripts/ab-register.mjs scripts/calib-check.mjs

import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";

import { getRubric } from "../lib/ai/rubrics/index.ts";
import { outputSpec } from "../lib/ai/output-spec.ts";
import { toProductScale } from "../lib/score-scale.ts";

const ROOT = process.cwd();
const CLIP = "20260719_093134.mp4";
const MODEL = "claude-opus-4-8";
const LEVEL = "beginner";
const DISCIPLINE = "grass";

function keyFromEnv(env) {
  const m = env.match(/ANTHROPIC_API_KEY=(.+)/);
  return m ? m[1].trim() : null;
}

async function ringed(b64, point) {
  const buf = Buffer.from(b64, "base64");
  const meta = await sharp(buf).metadata();
  const w = meta.width;
  const h = meta.height;
  const cx = Math.round(point.x * w);
  const cy = Math.round(point.y * h);
  const r = Math.round(Math.min(w, h) * 0.055);
  const svg = Buffer.from(
    `<svg width="${w}" height="${h}">` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#0f212c" stroke-width="${Math.max(6, Math.round(r * 0.34))}" opacity="0.55"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e8b93b" stroke-width="${Math.max(4, Math.round(r * 0.2))}"/>` +
      `</svg>`,
  );
  const out = await sharp(buf).composite([{ input: svg }]).jpeg({ quality: 80 }).toBuffer();
  return out.toString("base64");
}

async function run(client, frames, effort) {
  const content = frames.flatMap((f, i) => [
    { type: "text", text: `Frame ${i}, t=${f.time_s}s` },
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.data } },
  ]);
  content.splice(0, 0, {
    type: "text",
    text:
      "The player marked exactly who to analyze: a hollow gold ring is drawn around the focus athlete in frame 0. " +
      "That ringed person is the subject in EVERY frame: follow the same individual across the whole sequence by kit, build, and court position. " +
      "Every score, metric note, insight, and change refers to them alone. Ignore every other person, and ignore the ring itself when judging form.",
  });
  content.push({
    type: "text",
    text: `Discipline: ${DISCIPLINE}. Player level: ${LEVEL}. Analyze this spike rep sequence across the whole clip.`,
  });

  const res = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: { effort },
      system: [
        { type: "text", text: getRubric("attack", DISCIPLINE), cache_control: { type: "ephemeral" } },
        { type: "text", text: outputSpec("attack", LEVEL), cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content }],
    },
    { maxRetries: 3 },
  );
  return res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

function pull(text) {
  // The reply is free text following the rubric's output guidance; pull the
  // overall and metric numbers with a tolerant scan rather than a schema, since
  // this is a calibration probe, not the product path.
  const overall = text.match(/overall[^0-9]{0,20}(\d{1,3})/i)?.[1] ?? "?";
  const metrics = [...text.matchAll(/(approach_footwork|jump_timing|arm_swing|contact_height|power_followthrough)[^0-9]{0,20}(\d{1,3})/gi)]
    .map((m) => `${m[1]}=${m[2]}`);
  return { overall, metrics };
}

async function main() {
  const env = await readFile(path.join(ROOT, ".env.local"), "utf8");
  const client = new Anthropic({ apiKey: keyFromEnv(env) });

  const bundle = JSON.parse(await readFile(path.join(ROOT, "ab", "trackbundle.json"), "utf8"));
  const c = bundle.cases.find((x) => x.clip === CLIP);
  if (!c) throw new Error(`${CLIP} not in trackbundle`);

  const frames = c.frames.map((f) => ({ ...f }));
  frames[0] = { ...frames[0], data: await ringed(frames[0].data, c.mark.point) };
  console.log(`${CLIP}: ${frames.length} frames, ring at (${c.mark.point.x.toFixed(2)}, ${c.mark.point.y.toFixed(2)})`);
  console.log(`live production score before recalibration: 42 (indoor rubric)\n`);

  for (const effort of ["low", "high"]) {
    for (let r = 0; r < 2; r++) {
      const text = await run(client, frames, effort);
      const { overall, metrics } = pull(text);
      const mapped = metrics.map((m) => {
        const [k, v] = m.split("=");
        return `${k}=${toProductScale(Number(v))}`;
      });
      console.log(`effort=${effort} run=${r + 1}  raw: ${metrics.join(" ")}`);
      console.log(`               product scale: ${mapped.join(" ")}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
