// D-110 eval: does putting the instructions before the clip change the READ?
//
// The reorder exists to open the prompt cache. Cost is already proven; this
// asks the only question that matters afterwards, which is whether the model
// answers differently when it is told what to look for before it is shown the
// footage. D-096 is the standing rule here: one model id is not one behaviour
// and a single passing run proves nothing, so every arm is run N times and
// compared on distribution rather than on one draw.
//
// Run: node scripts/eval-prompt-order.mjs <clipDir> [runs]

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { simpleRubric, simpleRatingSchema } from "../lib/ai/simple-rubric.ts";
import { METRICS } from "../lib/ai/metrics.ts";
import { SKILL_LABEL } from "../lib/skills.ts";

const CLIP_DIR = process.argv[2];
const RUNS = Number(process.argv[3] ?? 5);
const MODEL = "google/gemini-3.6-flash";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const KEY = env.match(/^OPENROUTER_API_KEY=(.+)$/m)[1].trim().replace(/^["']|["']$/g, "");

const DISCIPLINE = "indoor";

function catalogFor(skill) {
  // The route enriches each checkpoint with authored prose; the label is enough
  // here and keeps this script free of the `@/` alias, which Node will not
  // resolve without a loader.
  return METRICS[skill].map((m) => ({ key: m.key, label: m.label, what: m.label }));
}

function body(skill, clipB64, durationS, order) {
  const system = simpleRubric(skill, DISCIPLINE, [], catalogFor(skill));
  const instructions = [
    `Discipline: ${DISCIPLINE}. Rate this ${SKILL_LABEL[skill].toLowerCase()} rep across the whole clip.`,
  ];
  const clip = [
    { type: "video_url", video_url: { url: `data:video/mp4;base64,${clipB64}` } },
    { type: "text", text: `This clip is ${durationS.toFixed(1)} seconds long.` },
  ];
  // OLD = clip first, instructions last, no breakpoint (what shipped before).
  // NEW = instructions first with a cache breakpoint, then the clip.
  const content =
    order === "old"
      ? [...clip, ...instructions.map((text) => ({ type: "text", text }))]
      : [
          ...instructions.map((text, i) =>
            i === instructions.length - 1
              ? { type: "text", text, cache_control: { type: "ephemeral" } }
              : { type: "text", text },
          ),
          ...clip,
        ];
  return JSON.stringify({
    model: MODEL,
    max_tokens: 8000,
    provider: { only: ["google-vertex"] },
    messages: [{ role: "system", content: system }, { role: "user", content }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "analysis",
        strict: false,
        schema: z.toJSONSchema(simpleRatingSchema, { io: "output" }),
      },
    },
  });
}

async function once(skill, clipB64, durationS, order) {
  // The gateway drops connections on large video uploads often enough that an
  // unretried run loses whole arms of the comparison.
  let j = null;
  for (let attempt = 0; attempt < 4 && j === null; attempt++) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", "X-Title": "vollyio-eval" },
        body: body(skill, clipB64, durationS, order),
        signal: AbortSignal.timeout(180000),
      });
      j = await res.json();
    } catch (e) {
      if (attempt === 3) return { valid: false, score: null, visible: 0, checkpoints: 0, strengths: 0, changes: 0, order: "", cached: 0, inTok: 0, cost: 0, provider: "NETWORK_FAIL" };
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  const u = j.usage ?? {};
  const raw = j.choices?.[0]?.message?.content ?? "";
  let parsed = null;
  try {
    parsed = simpleRatingSchema.parse(JSON.parse(raw.replace(/^\s*```(?:json)?\s*\n?|\n?```\s*$/g, "")));
  } catch {}
  const cps = parsed?.checkpoints ?? [];
  return {
    valid: parsed != null,
    score: parsed?.overall_score ?? null,
    visible: cps.filter((c) => c.visible).length,
    checkpoints: cps.length,
    strengths: (parsed?.strengths ?? []).length,
    improvements: (parsed?.improvements ?? []).length,
    // The abstain lane is the property most at risk from a prompt change: D-094
    // measured a 0% abstention rate as the failure this field exists to fix.
    ratable: parsed?.ratable ?? null,
    // Ordering is the thing D-099 says is reliable, so it is what gets compared.
    order: cps.filter((c) => c.visible).map((c) => c.key).join(">"),
    cached: u.prompt_tokens_details?.cached_tokens ?? 0,
    inTok: u.prompt_tokens ?? 0,
    cost: u.cost ?? 0,
    provider: j.provider ?? null,
  };
}

const stats = (xs) => {
  const v = xs.filter((x) => typeof x === "number");
  if (!v.length) return { n: 0 };
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  return { n: v.length, mean: +mean.toFixed(1), min: Math.min(...v), max: Math.max(...v) };
};

const clips = readdirSync(CLIP_DIR).filter((f) => f.endsWith(".mp4"));
const out = {};
for (const file of clips) {
  const skill = file.replace(/\.mp4$/, "");
  if (!METRICS[skill]) { console.error(`skip ${file}: not a skill`); continue; }
  const b64 = readFileSync(join(CLIP_DIR, file)).toString("base64");
  const durationS = Number(process.env[`DUR_${skill.toUpperCase()}`] ?? 10);
  for (const order of ["old", "new"]) {
    const rows = [];
    for (let i = 0; i < RUNS; i++) {
      const r = await once(skill, b64, durationS, order);
      rows.push(r);
      console.error(`${skill}/${order} run${i + 1}: valid=${r.valid} score=${r.score} ratable=${r.ratable} s/i=${r.strengths}+${r.improvements} visible=${r.visible}/${r.checkpoints} cached=${r.cached} ${r.provider ?? ""}`);
    }
    out[`${skill}/${order}`] = {
      validRate: `${rows.filter((r) => r.valid).length}/${rows.length}`,
      score: stats(rows.map((r) => r.score)),
      visible: stats(rows.map((r) => r.visible)),
      strengths: stats(rows.map((r) => r.strengths)),
      improvements: stats(rows.map((r) => r.improvements)),
      ratableTrue: rows.filter((r) => r.ratable === true).length,
      cachedMean: Math.round(rows.reduce((a, r) => a + r.cached, 0) / rows.length),
      inTokMean: Math.round(rows.reduce((a, r) => a + r.inTok, 0) / rows.length),
      costMean: +(rows.reduce((a, r) => a + r.cost, 0) / rows.length).toFixed(5),
      orderings: [...new Set(rows.map((r) => r.order))].length,
    };
  }
}
console.log(JSON.stringify(out, null, 2));
