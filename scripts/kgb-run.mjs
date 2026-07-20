// Kill gate B: after a player is marked on the first frame, who still has hold
// of that player later in the clip — the on-device tracker, or the model?
//
// Run with:
//   node --import ./scripts/ab-register.mjs scripts/kgb-run.mjs
//
// Scoring avoids the circularity that ruined the first fidelity metric, where
// the detector both produced a crop and graded it. Neither arm grades itself
// here. Instead each arm's claimed position is drawn onto the frame, the two
// drawn frames are shown to judges alongside the marked first frame, and the
// judges say which mark is on the same person. The judges never learn which
// mark came from which arm, and the drawing order is randomised per comparison.
//
// Abstention is scored separately from error on purpose. For a product whose
// position is that it does not assert what it cannot support, "I lost them" is
// a correct answer and must not be averaged in with "that is the wrong person".

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "ab");
const MODEL = "claude-opus-4-8";
const EFFORT = "low";
const JUDGE_MODEL = "claude-opus-4-8";
const JUDGE_EFFORT = "high";
const JUDGES = 3;
// Which send frames get judged. Frame 0 carries the mark, so it is the anchor
// and not a test. Later frames are harder than earlier ones, which is the point.
const COMPARE_AT = [2, 4, 5, 7];

function keyFromEnv(env) {
  const m = env.match(/ANTHROPIC_API_KEY=(.+)/);
  return m ? m[1].trim() : null;
}

function flip(seed) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 2 === 0;
}

async function sizeOf(b64) {
  const meta = await sharp(Buffer.from(b64, "base64")).metadata();
  return { w: meta.width, h: meta.height };
}

// A hollow ring, so the body underneath stays fully visible. A filled marker
// would hide the very thing the judge has to identify.
function ringSvg(w, h, marks) {
  const r = Math.round(Math.min(w, h) * 0.055);
  const parts = marks
    .map(
      (m) =>
        `<circle cx="${Math.round(m.x * w)}" cy="${Math.round(m.y * h)}" r="${r}" ` +
        `fill="none" stroke="${m.color}" stroke-width="${Math.max(3, Math.round(r * 0.22))}"/>` +
        `<text x="${Math.round(m.x * w)}" y="${Math.round(m.y * h) - r - 8}" ` +
        `font-family="sans-serif" font-size="${Math.round(r * 1.1)}" font-weight="bold" ` +
        `fill="${m.color}" text-anchor="middle">${m.label}</text>`,
    )
    .join("");
  return Buffer.from(`<svg width="${w}" height="${h}">${parts}</svg>`);
}

async function draw(b64, marks) {
  const buf = Buffer.from(b64, "base64");
  const { w, h } = await sizeOf(b64);
  const out = await sharp(buf)
    .composite([{ input: ringSvg(w, h, marks), top: 0, left: 0 }])
    .jpeg({ quality: 82 })
    .toBuffer();
  return out.toString("base64");
}

function img(data) {
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data } };
}

const TRACK_SCHEMA = {
  type: "object",
  properties: {
    frames: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          found: { type: "boolean" },
          x: { type: "number" },
          y: { type: "number" },
          note: { type: "string" },
        },
        required: ["index", "found", "x", "y", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["frames"],
  additionalProperties: false,
};

async function modelTrack(client, c) {
  const first = await draw(c.frames[0].data, [
    { x: c.mark.point.x, y: c.mark.point.y, color: "#00E5FF", label: "TARGET" },
  ]);
  const content = [
    {
      type: "text",
      text:
        "Frame 0. One player is ringed and labelled TARGET. That specific person is the " +
        "subject for every following frame.",
    },
    img(first),
  ];
  c.frames.slice(1).forEach((f, i) => {
    content.push({ type: "text", text: `Frame ${i + 1}, t=${f.time_s}s` });
    content.push(img(f.data));
  });
  content.push({
    type: "text",
    text:
      "For each frame after frame 0, give the position of the TARGET player's torso centre " +
      "in normalized image coordinates, where x=0 is the left edge, x=1 the right edge, " +
      "y=0 the top and y=1 the bottom.\n\n" +
      "If you cannot tell which person is the target in a frame, or the target has left the " +
      "frame, set found=false. Saying you lost them is a correct and useful answer. Guessing " +
      "a plausible-looking player is not: a confident wrong answer is the worst outcome here. " +
      "When found=false, still give your best-guess x and y but the note must say why you are " +
      "unsure.",
  });

  const res = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: { effort: EFFORT, format: { type: "json_schema", schema: TRACK_SCHEMA } },
      messages: [{ role: "user", content }],
    },
    { maxRetries: 3 },
  );
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    return { track: JSON.parse(text).frames, usage: res.usage, firstMarked: first };
  } catch {
    return { track: [], usage: res.usage, firstMarked: first };
  }
}

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    same_as_target: {
      type: "string",
      enum: ["A", "B", "BOTH", "NEITHER"],
      description: "which ringed person is the same individual as the TARGET in the first image",
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    reasoning: { type: "string" },
  },
  required: ["same_as_target", "confidence", "reasoning"],
  additionalProperties: false,
};

async function judgeFrame(client, markedFirst, comparison) {
  const content = [
    { type: "text", text: "First image: the reference. One player is ringed and labelled TARGET." },
    img(markedFirst),
    {
      type: "text",
      text:
        "Second image: a later moment in the same clip. Two positions are ringed, A and B. " +
        "They may be on the same person.",
    },
    img(comparison),
    {
      type: "text",
      text:
        "Which ring, A or B, is on the same individual as the TARGET in the reference image?\n\n" +
        "Use body position, movement continuity, build, kit and role on court. Answer BOTH only " +
        "if both rings genuinely sit on that same person. Answer NEITHER if neither ring is on " +
        "the target, including when a ring sits on empty court or on a different player. " +
        "Do not assume one of them must be right.",
    },
  ];
  const res = await client.messages.create(
    {
      model: JUDGE_MODEL,
      max_tokens: 1500,
      thinking: { type: "adaptive" },
      output_config: { effort: JUDGE_EFFORT, format: { type: "json_schema", schema: VERDICT_SCHEMA } },
      messages: [{ role: "user", content }],
    },
    { maxRetries: 3 },
  );
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function main() {
  const env = await readFile(path.join(ROOT, ".env.local"), "utf8");
  const apiKey = keyFromEnv(env);
  if (!apiKey) throw new Error("no ANTHROPIC_API_KEY in .env.local");
  const client = new Anthropic({ apiKey });

  const bundle = JSON.parse(await readFile(path.join(OUT, "trackbundle.json"), "utf8"));
  const cases = bundle.cases.filter((c) => c.frames?.length >= 4 && c.mark);
  console.log(`${cases.length} clips\n`);
  await mkdir(OUT, { recursive: true });

  const results = [];
  for (const c of cases) {
    process.stdout.write(`${c.clip}: model track... `);
    const { track, usage, firstMarked } = await modelTrack(client, c);
    const byIndex = new Map(track.map((t) => [t.index, t]));

    const comparisons = [];
    for (const idx of COMPARE_AT) {
      if (idx >= c.frames.length) continue;
      const m = byIndex.get(idx);
      const e = c.engineTrack?.[idx];

      const modelClaim = m && m.found ? { x: m.x, y: m.y } : null;
      const engineClaim = e?.point ?? null;

      // An arm that declines to answer is not judged; abstention is tallied on
      // its own. Judging a refusal against a guess would reward guessing.
      if (!modelClaim && !engineClaim) {
        comparisons.push({ idx, modelAbstain: true, engineAbstain: true, verdicts: [] });
        continue;
      }

      // Randomised per clip AND per frame so a judge cannot learn that A is
      // always one arm.
      const modelIsA = flip(`${c.clip}#${idx}`);
      const marks = [];
      if (modelClaim)
        marks.push({ ...modelClaim, color: "#FFD400", label: modelIsA ? "A" : "B" });
      if (engineClaim)
        marks.push({ ...engineClaim, color: "#FF4FA3", label: modelIsA ? "B" : "A" });
      const comparison = await draw(c.frames[idx].data, marks);

      const verdicts = [];
      for (let j = 0; j < JUDGES; j++) {
        const v = await judgeFrame(client, firstMarked, comparison);
        if (v) verdicts.push(v);
        process.stdout.write(".");
      }
      const toArm = (pos) => {
        if (pos === "BOTH") return "BOTH";
        if (pos === "NEITHER") return "NEITHER";
        return (pos === "A") === modelIsA ? "MODEL" : "ENGINE";
      };
      comparisons.push({
        idx,
        modelAbstain: !modelClaim,
        engineAbstain: !engineClaim,
        modelIsA,
        verdicts: verdicts.map((v) => ({
          winner: toArm(v.same_as_target),
          confidence: v.confidence,
          reasoning: v.reasoning,
        })),
      });
    }

    results.push({ clip: c.clip, usage, comparisons });
    console.log(" ok");
    await writeFile(path.join(OUT, "kgb-results.json"), JSON.stringify(results, null, 2));
  }

  // Per comparison, the majority verdict decides. Each arm is then scored on
  // that comparison as correct, wrong, or abstained.
  const tally = {
    MODEL: { correct: 0, wrong: 0, abstain: 0 },
    ENGINE: { correct: 0, wrong: 0, abstain: 0 },
    judged: 0,
    bothAbstain: 0,
  };
  for (const r of results) {
    for (const cmp of r.comparisons) {
      if (cmp.modelAbstain && cmp.engineAbstain) {
        tally.bothAbstain++;
        tally.MODEL.abstain++;
        tally.ENGINE.abstain++;
        continue;
      }
      if (cmp.verdicts.length === 0) continue;
      const votes = { MODEL: 0, ENGINE: 0, BOTH: 0, NEITHER: 0 };
      for (const v of cmp.verdicts) votes[v.winner]++;
      const win = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
      tally.judged++;
      for (const arm of ["MODEL", "ENGINE"]) {
        const abstained = arm === "MODEL" ? cmp.modelAbstain : cmp.engineAbstain;
        if (abstained) {
          tally[arm].abstain++;
        } else if (win === "BOTH" || win === arm) {
          tally[arm].correct++;
        } else {
          tally[arm].wrong++;
        }
      }
    }
  }

  const rate = (a) => {
    const answered = a.correct + a.wrong;
    return answered === 0 ? null : a.correct / answered;
  };
  const summary = {
    clips: results.length,
    judgesPerComparison: JUDGES,
    comparisonsJudged: tally.judged,
    bothAbstained: tally.bothAbstain,
    model: { ...tally.MODEL, accuracyWhenAnswering: rate(tally.MODEL) },
    engine: { ...tally.ENGINE, accuracyWhenAnswering: rate(tally.ENGINE) },
  };
  await writeFile(path.join(OUT, "kgb-summary.json"), JSON.stringify(summary, null, 2));

  console.log("\n=== KILL GATE B: subject tracking ===");
  for (const arm of ["model", "engine"]) {
    const a = summary[arm];
    const acc = a.accuracyWhenAnswering;
    console.log(
      `${arm.padEnd(7)} correct ${String(a.correct).padStart(3)}  wrong ${String(a.wrong).padStart(3)}` +
        `  abstained ${String(a.abstain).padStart(3)}` +
        `  accuracy-when-answering ${acc === null ? "n/a" : `${(acc * 100).toFixed(1)}%`}`,
    );
  }
  console.log(`\n${summary.comparisonsJudged} judged comparisons, ${JUDGES} judges each`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
