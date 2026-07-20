// Kill gate A: does the measured-biomechanics path beat a plain visual read?
//
// Run with:
//   node --import ./scripts/ab-register.mjs scripts/ab-run.mjs
//
// Both arms get IDENTICAL frames, the identical rubric, the identical output
// spec, and the identical model and effort. The only difference is whether the
// measurement block is present. Anything else varying between arms would make
// the comparison meaningless, which is why this imports the product's own
// prompt modules rather than approximating them.
//
// Judging is blind and order-randomised per clip, because a judge shown "A" and
// "B" in a fixed order will drift toward one position.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

import { getRubric } from "../lib/ai/rubrics/index.ts";
import { outputSpec } from "../lib/ai/output-spec.ts";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "ab");
const MODEL = "claude-opus-4-8";
const EFFORT = "low";
const JUDGE_MODEL = "claude-opus-4-8";
const JUDGE_EFFORT = "high";
const JUDGES = 3;
const LEVEL = "intermediate";
const DISCIPLINE = "grass";

function keyFromEnv(env) {
  const m = env.match(/ANTHROPIC_API_KEY=(.+)/);
  return m ? m[1].trim() : null;
}

// Deterministic per-clip coin flip, so a rerun judges the same orientation and
// results stay comparable across runs.
function flip(seed) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 2 === 0;
}

async function analyse(client, testCase, withMeasurements) {
  const content = [];
  testCase.frames.forEach((f, i) => {
    content.push({ type: "text", text: `Frame ${i}, t=${f.time_s}s` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: f.data },
    });
  });
  if (withMeasurements && testCase.measurements) {
    content.push({
      type: "text",
      text:
        "On-device motion tracking measured the following for this clip. " +
        "Values carry a confidence; anything listed in omitted_below_confidence " +
        "was NOT measured and must be assessed visually as usual.\n" +
        JSON.stringify(testCase.measurements),
    });
  }
  content.push({
    type: "text",
    text: `Discipline: ${DISCIPLINE}. Player level: ${LEVEL}. Analyze this attack rep sequence across the whole clip.`,
  });

  const res = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: { effort: EFFORT },
      system: [
        { type: "text", text: getRubric("attack", DISCIPLINE), cache_control: { type: "ephemeral" } },
        { type: "text", text: outputSpec("attack", LEVEL), cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content }],
    },
    { maxRetries: 3 },
  );
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return { text, usage: res.usage };
}

const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    winner: { type: "string", enum: ["FIRST", "SECOND", "TIE"] },
    evidence_grounding: { type: "string", enum: ["FIRST", "SECOND", "TIE"] },
    unsupported_claims: {
      type: "string",
      enum: ["FIRST", "SECOND", "TIE"],
      description: "which analysis makes FEWER claims the footage cannot support",
    },
    actionability: { type: "string", enum: ["FIRST", "SECOND", "TIE"] },
    reasoning: { type: "string" },
  },
  required: ["winner", "evidence_grounding", "unsupported_claims", "actionability", "reasoning"],
  additionalProperties: false,
};

async function judge(client, frames, first, second, n) {
  const content = [];
  frames.forEach((f, i) => {
    content.push({ type: "text", text: `Frame ${i}, t=${f.time_s}s` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: f.data },
    });
  });
  content.push({
    type: "text",
    text:
      `You are judging two coaching analyses of the SAME volleyball attack, shown above.\n\n` +
      `You do not know how either was produced. Judge only what is written.\n\n` +
      `The product they belong to promises never to assert what it cannot support from the footage. ` +
      `Weigh that heavily: a specific claim the frames cannot justify is WORSE than an honest ` +
      `admission of uncertainty. A rear or distant camera angle genuinely cannot establish exact ` +
      `joint angles, heights, speeds, or spin.\n\n` +
      `=== ANALYSIS FIRST ===\n${first}\n\n=== ANALYSIS SECOND ===\n${second}\n\n` +
      `Decide which is better overall, and separately on evidence grounding, on making fewer ` +
      `unsupported claims, and on actionability for the athlete. TIE is allowed and should be used ` +
      `when they are genuinely close.`,
  });

  const res = await client.messages.create(
    {
      model: JUDGE_MODEL,
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      output_config: { effort: JUDGE_EFFORT, format: { type: "json_schema", schema: JUDGE_SCHEMA } },
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

  const bundle = JSON.parse(await readFile(path.join(OUT, "bundle.json"), "utf8"));
  const cases = bundle.cases.filter((c) => c.measurements && c.frames?.length);
  console.log(`${cases.length} clips with measurements\n`);

  await mkdir(OUT, { recursive: true });
  const results = [];

  for (const c of cases) {
    process.stdout.write(`${c.clip}: measured... `);
    const measured = await analyse(client, c, true);
    process.stdout.write(`vision... `);
    const vision = await analyse(client, c, false);

    // Blind, order randomised per clip and stable across reruns.
    const measuredFirst = flip(c.clip);
    const first = measuredFirst ? measured.text : vision.text;
    const second = measuredFirst ? vision.text : measured.text;

    process.stdout.write(`judging`);
    const verdicts = [];
    for (let j = 0; j < JUDGES; j++) {
      const v = await judge(client, c.frames, first, second, j);
      if (v) verdicts.push(v);
      process.stdout.write(".");
    }

    // Translate positional verdicts back to arms.
    const toArm = (pos) =>
      pos === "TIE" ? "TIE" : (pos === "FIRST") === measuredFirst ? "MEASURED" : "VISION";
    const mapped = verdicts.map((v) => ({
      winner: toArm(v.winner),
      evidence_grounding: toArm(v.evidence_grounding),
      unsupported_claims: toArm(v.unsupported_claims),
      actionability: toArm(v.actionability),
      reasoning: v.reasoning,
    }));

    results.push({
      clip: c.clip,
      measuredFirst,
      measuredText: measured.text,
      visionText: vision.text,
      usage: { measured: measured.usage, vision: vision.usage },
      verdicts: mapped,
    });
    const tally = mapped.map((m) => m.winner).join(",");
    console.log(` -> ${tally}`);
    await writeFile(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  }

  // Aggregate by majority of judges per clip.
  const axes = ["winner", "evidence_grounding", "unsupported_claims", "actionability"];
  const summary = {};
  for (const axis of axes) {
    const counts = { MEASURED: 0, VISION: 0, TIE: 0 };
    for (const r of results) {
      const votes = { MEASURED: 0, VISION: 0, TIE: 0 };
      for (const v of r.verdicts) votes[v[axis]]++;
      const win = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
      counts[win]++;
    }
    summary[axis] = counts;
  }

  const tokens = results.reduce(
    (a, r) => ({
      measuredIn: a.measuredIn + (r.usage.measured?.input_tokens ?? 0),
      measuredOut: a.measuredOut + (r.usage.measured?.output_tokens ?? 0),
      visionIn: a.visionIn + (r.usage.vision?.input_tokens ?? 0),
      visionOut: a.visionOut + (r.usage.vision?.output_tokens ?? 0),
    }),
    { measuredIn: 0, measuredOut: 0, visionIn: 0, visionOut: 0 },
  );

  await writeFile(
    path.join(OUT, "summary.json"),
    JSON.stringify({ clips: results.length, judgesPerClip: JUDGES, summary, tokens }, null, 2),
  );

  console.log("\n=== KILL GATE A ===");
  for (const axis of axes) {
    const c = summary[axis];
    console.log(
      `${axis.padEnd(20)} measured ${String(c.MEASURED).padStart(2)}  vision ${String(c.VISION).padStart(2)}  tie ${String(c.TIE).padStart(2)}`,
    );
  }
  console.log(
    `\ntokens  measured in/out ${tokens.measuredIn}/${tokens.measuredOut}` +
      `   vision in/out ${tokens.visionIn}/${tokens.visionOut}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
