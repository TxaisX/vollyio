// One production-faithful analysis of the owner's clip: same rubric, output
// spec, schema parse, coherence clamp, and product-scale mapping as the
// shipped /api/analyze route.
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { getRubric } from "../lib/ai/rubrics/index.ts";
import { outputSpec } from "../lib/ai/output-spec.ts";
import { analysisSchema } from "../lib/ai/schema.ts";
import { METRICS } from "../lib/ai/metrics.ts";
import { coherentOverall } from "../lib/ratings.ts";
import { toProductScale } from "../lib/score-scale.ts";

const ROOT = process.cwd();
const CLIP = "20260719_093134.mp4";

const env = await readFile(path.join(ROOT, ".env.local"), "utf8");
const client = new Anthropic({ apiKey: env.match(/ANTHROPIC_API_KEY=(.+)/)[1].trim() });

const bundle = JSON.parse(await readFile(path.join(ROOT, "ab", "trackbundle.json"), "utf8"));
const c = bundle.cases.find((x) => x.clip === CLIP);

const buf = Buffer.from(c.frames[0].data, "base64");
const meta = await sharp(buf).metadata();
const r = Math.round(Math.min(meta.width, meta.height) * 0.055);
const cx = Math.round(c.mark.point.x * meta.width);
const cy = Math.round(c.mark.point.y * meta.height);
const svg = Buffer.from(
  `<svg width="${meta.width}" height="${meta.height}">` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#0f212c" stroke-width="${Math.round(r * 0.34)}" opacity="0.55"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e8b93b" stroke-width="${Math.round(r * 0.2)}"/></svg>`,
);
const ringed = (await sharp(buf).composite([{ input: svg }]).jpeg({ quality: 80 }).toBuffer()).toString("base64");

const frames = c.frames.map((f, i) => ({ ...f, data: i === 0 ? ringed : f.data }));
const content = frames.flatMap((f, i) => [
  { type: "text", text: `Frame ${i}, t=${f.time_s}s` },
  { type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.data } },
]);
content.push({
  type: "text",
  text:
    "The player marked exactly who to analyze: a hollow gold ring is drawn around the focus athlete in frame 0. " +
    "That ringed person is the subject in EVERY frame: follow the same individual across the whole sequence by kit, build, and court position. " +
    "Every score, metric note, insight, and change refers to them alone. Ignore every other person, and ignore the ring itself when judging form (it is a marker, not part of the athlete or the scene).",
});
content.push({ type: "text", text: "Discipline: grass. Player level: beginner. Analyze this spike rep sequence across the whole clip." });

const res = await client.messages.parse(
  {
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: [
      { type: "text", text: getRubric("attack", "grass"), cache_control: { type: "ephemeral" } },
      { type: "text", text: outputSpec("attack", "beginner"), cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content }],
    output_config: { effort: "low", format: zodOutputFormat(analysisSchema("attack")) },
  },
  { maxRetries: 3 },
);
const raw = res.parsed_output;
const mm = raw.metrics;
const scaled = (n) => toProductScale(n);
const metricScores = METRICS.attack.map((m) => scaled(mm[m.key].score));
const overall = coherentOverall(scaled(raw.overall_score), metricScores);

console.log(`OVERALL: ${overall}  (was 42 live before D-034/D-035)`);
console.log(`subject: ${raw.subject_check?.analyzed} [${raw.subject_check?.marker_match}]`);
console.log(`scene: ${raw.scene_read}`);
for (const m of METRICS.attack) {
  console.log(`  ${m.label.padEnd(24)} ${String(scaled(mm[m.key].score)).padStart(3)}  ${mm[m.key].note}`);
}
console.log(`priority fix: ${raw.changes[0].title} -- ${raw.changes[0].detail}`);
console.log(`summary: ${raw.summary}`);
