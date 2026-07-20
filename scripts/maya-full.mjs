// The owner's question: what does the shipped pipeline score the FIRST HIT in
// the Maya Ogbogu clip? Frames from disk, spot -> pick the attacker -> ring ->
// indoor attack analysis, exactly as the product runs it.
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { getRubric } from "../lib/ai/rubrics/index.ts";
import { outputSpec } from "../lib/ai/output-spec.ts";
import { analysisSchema } from "../lib/ai/schema.ts";
import { METRICS } from "../lib/ai/metrics.ts";
import { toProductScale } from "../lib/score-scale.ts";
import { deriveMetric, POINTERS } from "../lib/ai/pointers.ts";

const ROOT = process.cwd();
const USE_BUNDLE = true;

const env = await readFile(path.join(ROOT, ".env.local"), "utf8");
const client = new Anthropic({ apiKey: env.match(/ANTHROPIC_API_KEY=(.+)/)[1].trim() });

const bundle = JSON.parse(await readFile(path.join(ROOT, "ab", "trackbundle.json"), "utf8"));
const c = bundle.cases.find((x) => x.clip.includes("Ogbogu"));
const frames = c.frames.map((f) => ({ ...f }));

// Spot on the frame where the hitter is loading (index 4, ~4.5s).
const SPOT_AT = 7;
const spotSchema = z.object({
  players: z.array(z.object({ label: z.string().max(80), x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).max(6),
});
const spot = await client.messages.parse(
  {
    model: "claude-opus-4-8",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: frames[SPOT_AT].data } },
          {
            type: "text",
            text:
              "List the people in this frame who are clearly PLAYING volleyball and close enough to assess, most prominent first, up to six. " +
              "For each: a short physical description a user could match at a glance (kit or shirt color, distinguishing detail, where they are on the court; never a name or a guess about identity), " +
              "and the position of their torso center in normalized image coordinates (x 0 at the left edge to 1 at the right, y 0 at the top to 1 at the bottom). " +
              "Only include people you can actually see well enough to describe; distant background players and spectators are excluded. An empty list is a valid answer.",
          },
        ],
      },
    ],
    output_config: { effort: "low", format: zodOutputFormat(spotSchema) },
  },
  { maxRetries: 2 },
);
const players = spot.parsed_output.players;
console.log(`SPOTTED (frame at t=${frames[SPOT_AT].time_s}s):`);
players.forEach((p, i) => console.log(`  ${i + 1}. (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) ${p.label}`));

// Pick the attacker: the candidate described at the net in the dark jersey on
// the far side. Fall back to #1.
const pick =
  players.find((p) => /dark|black|navy/i.test(p.label)) ?? players[0];
console.log(`\nPICKED: ${pick.label}`);

const buf = Buffer.from(frames[SPOT_AT].data, "base64");
const meta = await sharp(buf).metadata();
const r = Math.round(Math.min(meta.width, meta.height) * 0.055);
const cx = Math.round(pick.x * meta.width);
const cy = Math.round(pick.y * meta.height);
const svg = Buffer.from(
  `<svg width="${meta.width}" height="${meta.height}">` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#0f212c" stroke-width="${Math.round(r * 0.34)}" opacity="0.55"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e8b93b" stroke-width="${Math.round(r * 0.2)}"/></svg>`,
);
const ringedBuf = await sharp(buf).composite([{ input: svg }]).jpeg({ quality: 80 }).toBuffer();
await writeFile(path.join(ROOT, "ab", "maya-ringed.jpg"), ringedBuf);
frames[SPOT_AT] = { ...frames[SPOT_AT], data: ringedBuf.toString("base64") };

const content = frames.flatMap((f, i) => [
  { type: "text", text: `Frame ${i}, t=${f.time_s}s` },
  { type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.data } },
]);
content.push({
  type: "text",
  text:
    `The player marked exactly who to analyze: a hollow gold ring is drawn around the focus athlete in frame ${SPOT_AT}. ` +
    "That ringed person is the subject in EVERY frame: follow the same individual across the whole sequence by kit, build, and court position. " +
    "Every score, metric note, insight, and change refers to them alone. Ignore every other person, and ignore the ring itself when judging form (it is a marker, not part of the athlete or the scene).",
});
content.push({ type: "text", text: "Discipline: indoor. Player level: beginner. Analyze this spike rep sequence across the whole clip." });

const res = await client.messages.parse(
  {
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: [
      { type: "text", text: getRubric("attack", "indoor"), cache_control: { type: "ephemeral" } },
      { type: "text", text: outputSpec("attack", "beginner"), cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content }],
    output_config: { effort: "low", format: zodOutputFormat(analysisSchema("attack")) },
  },
  { maxRetries: 3 },
);
const raw = res.parsed_output;
const derived = METRICS.attack.map((m) => {
  const d = deriveMetric("attack", m.key, raw.metrics[m.key]?.pointers);
  return { key: m.key, label: m.label, ...d, score: toProductScale(d.raw) };
});
const obsScores = derived.filter((d) => d.observed).map((d) => d.score);
const overall = obsScores.length
  ? Math.round(obsScores.reduce((a, b) => a + b, 0) / obsScores.length)
  : toProductScale(raw.overall_score);
console.log(`\nOVERALL: ${overall}`);
console.log(`subject: ${raw.subject_check?.analyzed} [${raw.subject_check?.marker_match}]`);
for (const m of METRICS.attack) {
  const d = derived.find((x) => x.key === m.key);
  const marks = d.statuses.map((st) => st.status === "met" ? "+" : st.status === "partial" ? "~" : st.status === "missed" ? "x" : ".").join("");
  console.log(`  ${m.label.padEnd(24)} ${d.observed ? String(d.score).padStart(3) : "n/v"}  [${marks}]  ${raw.metrics[m.key].note.slice(0,90)}`);
}
console.log(`fix: ${raw.changes[0].title} -- ${raw.changes[0].detail}`);
console.log(`summary: ${raw.summary}`);
