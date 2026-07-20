// Identify each staged play's skill + discipline with repeated independent
// model votes, then write final eval cases to evals/cases/.
//
// Confidence protocol: 3 independent votes; unanimous -> accept (1.0).
// Otherwise extend to 5, then 7; accept the mode with votes/total as the
// confidence. Below 0.8 after 7 votes the play is written flagged
// `uncertain: true` so the review UI surfaces it for a human call.
// Votes never see the filename, so agreement measures the footage alone.
//
// Usage: node scripts/classify-plays.mjs [--only <playId>] [--model <id>]

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const SKILLS = ["serve", "pass", "set", "attack", "block", "dig"];
const DISCIPLINES = ["indoor", "beach"];

function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // fall through to the ambient environment
  }
}
loadEnvLocal();
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("classify-plays: ANTHROPIC_API_KEY missing (.env.local or env)");
  process.exit(1);
}

const [, , ...rest] = process.argv;
const args = {};
for (let i = 0; i < rest.length; i += 2) args[rest[i]?.slice(2)] = rest[i + 1];
const MODEL = args.model ?? process.env.COACH_MODEL ?? "claude-sonnet-5";

const client = new Anthropic({ maxRetries: 4 });

const SYSTEM = `You are a volleyball video classifier. You are shown frames sampled
in time order from one play. Identify the single most prominent skill action
performed in this play and the discipline.

Rules:
- skill is exactly one of: serve, pass, set, attack, block, dig.
  Choose the action that the play is ABOUT (the featured touch), not every
  touch that occurs. A rally that ends in a spike is "attack"; a clip built
  around a jump serve is "serve"; a dramatic defensive dig is "dig".
- discipline is "beach" (sand court, 2 players a side) or "indoor" (hard
  court, 6 a side).
- Respond with ONLY a JSON object, no prose:
  {"skill":"...","discipline":"...","confidence":0.0,"action_summary":"one sentence"}
- confidence is YOUR certainty in the skill choice, 0..1.
- If the frames genuinely show no volleyball action, use confidence 0.1 and
  your best guess.`;

async function vote(frames) {
  const content = frames.flatMap((f, i) => [
    { type: "text", text: `Frame ${i}, t=${f.time_s}s` },
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.data } },
  ]);
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM,
    messages: [{ role: "user", content: [...content, { type: "text", text: "Classify this play." }] }],
  });
  const text = res.content.find((b) => b.type === "text")?.text ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]);
    if (!SKILLS.includes(v.skill) || !DISCIPLINES.includes(v.discipline)) return null;
    return {
      skill: v.skill,
      discipline: v.discipline,
      confidence: Math.max(0, Math.min(1, Number(v.confidence) || 0)),
      action_summary: String(v.action_summary ?? "").slice(0, 300),
    };
  } catch {
    return null;
  }
}

function tally(votes) {
  const bySkill = {};
  for (const v of votes) bySkill[v.skill] = (bySkill[v.skill] ?? 0) + 1;
  const [skill, count] = Object.entries(bySkill).sort((a, b) => b[1] - a[1])[0];
  const byDisc = {};
  for (const v of votes) byDisc[v.discipline] = (byDisc[v.discipline] ?? 0) + 1;
  const discipline = Object.entries(byDisc).sort((a, b) => b[1] - a[1])[0][0];
  return { skill, discipline, agreement: count / votes.length };
}

async function classify(play) {
  const votes = [];
  for (const target of [3, 5, 7]) {
    while (votes.length < target) {
      const v = await vote(play.classify_frames);
      if (v) votes.push(v);
    }
    const t = tally(votes);
    if (t.agreement === 1 || (votes.length >= 5 && t.agreement >= 0.8)) {
      return { ...t, votes, uncertain: t.agreement < 0.95 && !(t.agreement === 1) };
    }
  }
  const t = tally(votes);
  return { ...t, votes, uncertain: t.agreement < 0.8 };
}

const playsDir = path.join("evals", "work", "plays");
const casesDir = path.join("evals", "cases");
mkdirSync(casesDir, { recursive: true });

const only = args.only ?? null;
const files = readdirSync(playsDir).filter(
  (f) => f.endsWith(".json") && (!only || f.startsWith(only)),
);

const groups = {};
for (const f of files) {
  const play = JSON.parse(readFileSync(path.join(playsDir, f), "utf8"));
  const c = await classify(play);
  const caseId = `${play.play_id}`;
  const summary = c.votes.map((v) => v.skill).join(",");
  writeFileSync(
    path.join(casesDir, `${caseId}.json`),
    JSON.stringify({
      id: caseId,
      skill: c.skill,
      discipline: c.discipline,
      level: "pro",
      source: play.source_video,
      video_slug: play.video_slug,
      play_index: play.play_index,
      play_count: play.play_count,
      window: play.window,
      frames: play.frames,
      classification: {
        model: MODEL,
        votes: c.votes,
        agreement: Math.round(c.agreement * 100) / 100,
        uncertain: c.uncertain,
      },
      // Left unlabeled on purpose: a placeholder 0-100 band always passes and
      // an empty weakest_metric silently skips, so both read as agreement the
      // harness never earned. Label with scripts/label-case.mjs.
      expected: {
        notes: `Calibration rep from pro footage; unlabeled. Run: node scripts/label-case.mjs ${caseId}`,
      },
      measurements: null,
    }),
  );
  (groups[play.video_slug] ??= []).push(caseId);
  console.log(
    `${caseId}: ${c.skill}/${c.discipline} agreement=${c.agreement.toFixed(2)}${c.uncertain ? " UNCERTAIN" : ""} [${summary}]`,
  );
}

writeFileSync(path.join("evals", "GROUPS.json"), JSON.stringify(groups, null, 2));
console.log(`wrote ${files.length} cases + evals/GROUPS.json`);
