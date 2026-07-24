import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const rawDir = path.join(root, "raw");
const framesDir = path.join(root, "frames");
const reportPath = path.join(root, "vollyio-attacker-model-effort-report.html");

async function readJson(name) {
  return JSON.parse(await readFile(path.join(root, name), "utf8"));
}

async function readOptionalJson(name) {
  try {
    return await readJson(name);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function cleanText(value) {
  return String(value ?? "")
    .replaceAll("\u2014", " - ")
    .replaceAll("\u2013", "-")
    .replaceAll("â€”", " - ")
    .replaceAll("â€“", "-")
    .replaceAll("â†’", "to")
    .replaceAll("Ã—", "x")
    .replaceAll("ðŸ”¥", "")
    .replace(/\s+-\s+-\s+/g, " - ");
}

function esc(value) {
  return cleanText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeJson(value) {
  return esc(JSON.stringify(value, null, 2));
}

function number(value, digits = 0) {
  if (!Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function median(values) {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
}

function duration(ms) {
  if (!Number.isFinite(ms)) return "n/a";
  const seconds = ms / 1000;
  if (seconds < 120) return `${number(seconds, 1)}s`;
  return `${Math.floor(seconds / 60)}m ${number(seconds % 60, 0)}s`;
}

function percent(value) {
  return Number.isFinite(value) ? `${number(value * 100, 0)}%` : "n/a";
}

function title(value) {
  return cleanText(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function modelLabel(run) {
  return run.slug || run.key || run.id;
}

const modelPricing = {
  "gpt-5.6-sol": { api: [5, 0.5, 30], credits: [125, 12.5, 750] },
  "gpt-5.6-terra": { api: [2.5, 0.25, 15], credits: [62.5, 6.25, 375] },
  "gpt-5.6-luna": { api: [1, 0.1, 6], credits: [25, 2.5, 150] },
  "gpt-5.5": { api: [5, 0.5, 30], credits: [125, 12.5, 750] },
  "gpt-5.4": { api: [2.5, 0.25, 15], credits: [62.5, 6.25, 375] },
  "gpt-5.4-mini": { api: [0.75, 0.075, 4.5], credits: [18.75, 1.875, 113] },
};

function usageCost(usage, rates) {
  if (!usage || !rates) return null;
  const input = Number(usage.input_tokens) || 0;
  const cached = Math.min(input, Number(usage.cached_input_tokens) || 0);
  const output = Number(usage.output_tokens) || 0;
  return ((input - cached) * rates[0] + cached * rates[1] + output * rates[2]) / 1_000_000;
}

function runCost(run) {
  const pricing = modelPricing[modelLabel(run)];
  if (!pricing) return null;
  return {
    api: usageCost(run.usage, pricing.api),
    credits: usageCost(run.usage, pricing.credits),
  };
}

function money(value, digits = 4) {
  return Number.isFinite(value) ? `$${number(value, digits)}` : "n/a";
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function aggregateRows(rows, keyFn, order = []) {
  return [...groupBy(rows, keyFn)].map(([key, items]) => ({
    key,
    count: items.length,
    quality: average(items.map((item) => item.quality_score)),
    attack: average(items.map((item) => item.raw.attack_score)),
    latency: average(items.map((item) => item.duration_ms)),
    input: average(items.map((item) => item.usage?.input_tokens)),
    output: average(items.map((item) => item.usage?.output_tokens)),
    reasoning: average(items.map((item) => item.usage?.reasoning_output_tokens)),
    apiCost: average(items.map((item) => runCost(item)?.api)),
    credits: average(items.map((item) => runCost(item)?.credits)),
  })).sort((a, b) => {
    const ai = order.indexOf(a.key);
    const bi = order.indexOf(b.key);
    if (ai >= 0 || bi >= 0) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    return (b.quality ?? -1) - (a.quality ?? -1);
  });
}

function collectStability(node, ids, output = new Map()) {
  if (Array.isArray(node)) {
    for (const value of node) collectStability(value, ids, output);
    return output;
  }
  if (!node || typeof node !== "object") return output;
  const id = node.id || node.run_id || node.model_effort_id || node.candidate_id;
  if (typeof id === "string" && ids.has(id)) output.set(id, node);
  for (const [key, value] of Object.entries(node)) {
    if (ids.has(key) && value && typeof value === "object") {
      output.set(key, { id: key, ...value });
    }
    collectStability(value, ids, output);
  }
  return output;
}

function stabilityLabel(record) {
  if (!record) return "not tested";
  const direct = [
    ["quality_range", "quality range"],
    ["score_range", "score range"],
    ["attack_score_range", "attack range"],
    ["spread", "spread"],
    ["stddev", "SD"],
    ["standard_deviation", "SD"],
  ];
  for (const [key, label] of direct) {
    if (Number.isFinite(record[key])) return `${label} ${number(record[key], 1)}`;
  }
  if (typeof record.stable === "boolean") return record.stable ? "stable" : "variable";
  if (typeof record.status === "string") return cleanText(record.status);
  if (Array.isArray(record.scores) && record.scores.every(Number.isFinite)) {
    return `range ${number(Math.max(...record.scores) - Math.min(...record.scores), 1)}`;
  }
  return "tested";
}

function markdownSection(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return [];
  const output = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) break;
    output.push(lines[index]);
  }
  return output;
}

function parseTimeline(markdown) {
  const rows = markdownSection(markdown, "Phase timeline")
    .filter((line) => /^\|.*\|$/.test(line.trim()))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cleanText(cell.trim())))
    .filter((cells) => cells.length >= 4 && cells[0] !== "Phase" && !/^[-: ]+$/.test(cells[0]));
  return rows.map(([phase, time, evidence, confidence]) => ({ phase, time, evidence, confidence }));
}

function parseNumbered(markdown, heading) {
  return markdownSection(markdown, heading)
    .map((line) => line.match(/^\d+\.\s+(.*)$/)?.[1])
    .filter(Boolean);
}

function themeFor(text) {
  const value = cleanText(text).toLowerCase();
  if (/space|spacing|under the ball|crowd|separation|in front/.test(value)) return "Ball-body spacing and contact window";
  if (/penultimate|last two|final two|plant|close step/.test(value)) return "Penultimate and plant organization";
  if (/elbow|arm load|non-hitting|off arm|whip|aerial/.test(value)) return "Aerial arm sequence";
  if (/timing|apex|set arrives|jump-ball/.test(value)) return "Jump-ball timing";
  if (/landing|descent|absorb/.test(value)) return "Landing control";
  if (/approach|route|curve|footwork/.test(value)) return "Approach shape and rhythm";
  if (/contact|reach|extension/.test(value)) return "Contact height and extension";
  return "Other specific correction";
}

function consensus(rows) {
  const themes = new Map();
  for (const row of rows) {
    const first = row.raw.priority_changes?.slice().sort((a, b) => a.rank - b.rank)[0];
    if (!first) continue;
    const theme = themeFor(`${first.change} ${first.why}`);
    if (!themes.has(theme)) themes.set(theme, []);
    themes.get(theme).push({ id: row.id, text: first.change });
  }
  const priorityThemes = [...themes].map(([theme, findings]) => ({ theme, findings, count: findings.length }))
    .sort((a, b) => b.count - a.count);
  const phaseGroups = new Map();
  for (const row of rows) {
    for (const phase of row.raw.phases ?? []) {
      if (!phaseGroups.has(phase.phase)) phaseGroups.set(phase.phase, []);
      phaseGroups.get(phase.phase).push(phase.score);
    }
  }
  const phases = [...phaseGroups].map(([phase, scores]) => ({
    phase,
    average: average(scores),
    min: Math.min(...scores),
    max: Math.max(...scores),
  })).sort((a, b) => a.average - b.average);
  return { priorityThemes, phases };
}

function frameNameFor(index, phase) {
  const lower = phase.toLowerCase();
  if (lower.includes("transition")) return "overview_2fps.jpg";
  if (lower.includes("approach")) return "approach_sequence_5.0_6.8_15fps.jpg";
  if (lower.includes("penultimate") || lower.includes("plant")) return "key_6.40_penultimate.png";
  if (lower.includes("takeoff")) return "key_6.80_takeoff.png";
  if (lower.includes("aerial")) return "key_7.20_loading.png";
  if (lower.includes("contact") || lower.includes("acceleration")) return "key_7.55_contact.png";
  if (lower.includes("follow")) return "key_7.63_post_contact.png";
  if (lower.includes("landing")) return "key_8.33_landing.png";
  const fallback = [
    "overview_2fps.jpg",
    "approach_sequence_5.0_6.8_15fps.jpg",
    "key_6.40_penultimate.png",
    "key_6.80_takeoff.png",
    "key_7.20_loading.png",
    "key_7.55_contact.png",
    "key_7.63_post_contact.png",
    "key_8.33_landing.png",
  ];
  return fallback[index % fallback.length];
}

function scoreClass(score) {
  if (!Number.isFinite(score)) return "neutral";
  if (score >= 85) return "excellent";
  if (score >= 75) return "good";
  if (score >= 65) return "mixed";
  return "weak";
}

function metricBar(label, value, detail = "") {
  const width = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return `<div class="metric-row"><span>${esc(label)}</span><span class="metric-track"><i style="width:${width}%"></i></span><b>${esc(Number.isFinite(value) ? number(value, 1) : "n/a")}</b>${detail ? `<small>${esc(detail)}</small>` : ""}</div>`;
}

function renderAggregateTable(rows, headingLabel) {
  return `<div class="table-wrap" role="region" aria-label="Scrollable ${esc(headingLabel)} averages" tabindex="0"><table><thead><tr><th>${esc(headingLabel)}</th><th>Runs</th><th>Judge quality</th><th>Attack score</th><th>Avg latency</th><th>Avg API cost</th><th>Avg credits</th><th>Avg output</th><th>Avg reasoning</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${esc(title(row.key))}</strong></td><td>${row.count}</td><td>${number(row.quality, 1)}</td><td>${number(row.attack, 1)}</td><td>${duration(row.latency)}</td><td>${money(row.apiCost)}</td><td>${number(row.credits, 2)}</td><td>${number(row.output, 0)}</td><td>${number(row.reasoning, 0)}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderRankingTable(rows, ranked = true) {
  return `<div class="table-wrap" role="region" aria-label="Scrollable model ranking" tabindex="0"><table class="ranking-table"><thead><tr>${ranked ? "<th>Rank</th>" : ""}<th>Combination</th><th>Effort</th><th>Judge quality</th><th>Attack score</th><th>Confidence</th><th>Latency</th><th>Tokens in / out</th><th>API-equivalent cost</th><th>Codex credits</th><th>Judge gap</th><th>Stability</th></tr></thead><tbody>${rows.map((row, index) => {
    const cost = runCost(row);
    const costAttributes = cost ? ` data-run-cost-id="${esc(row.id)}" data-api-cost="${cost.api.toFixed(4)}" data-codex-credits="${cost.credits.toFixed(2)}"` : "";
    return `<tr${costAttributes} class="${index === 0 && ranked ? "winner" : ""}">${ranked ? `<td class="rank">${index + 1}</td>` : ""}<td><a href="#response-${esc(row.id)}"><strong>${esc(modelLabel(row))}</strong></a><small>${esc(row.id)}</small></td><td><span class="chip effort">${esc(title(row.effort))}</span></td><td><span class="score ${scoreClass(row.quality_score)}">${number(row.quality_score, 1)}</span></td><td>${number(row.raw.attack_score, 0)}</td><td>${percent(row.raw.confidence)}</td><td>${duration(row.duration_ms)}</td><td>${number(row.usage?.input_tokens, 0)} / ${number(row.usage?.output_tokens, 0)}</td><td>${money(cost?.api)}</td><td>${number(cost?.credits, 2)}</td><td>${number(row.judge_disagreement, 1)}</td><td>${esc(stabilityLabel(row.stability))}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderPricingTable() {
  return `<div class="table-wrap" role="region" aria-label="Scrollable pricing rate table" tabindex="0"><table class="pricing-table"><thead><tr><th>Model</th><th>API input</th><th>API cached input</th><th>API output</th><th>Codex input credits</th><th>Codex cached credits</th><th>Codex output credits</th></tr></thead><tbody>${Object.entries(modelPricing).map(([model, pricing]) => `<tr><td><strong>${esc(model)}</strong></td><td>${money(pricing.api[0], pricing.api[0] < 0.1 ? 3 : 2)}</td><td>${money(pricing.api[1], pricing.api[1] < 0.1 ? 3 : 2)}</td><td>${money(pricing.api[2], 2)}</td><td>${number(pricing.credits[0], 3)}</td><td>${number(pricing.credits[1], 3)}</td><td>${number(pricing.credits[2], 3)}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderBarChart(rows, valueFn, valueLabel, className = "gold") {
  const values = rows.map(valueFn).filter(Number.isFinite);
  const max = Math.max(...values, 1);
  return `<div class="bar-chart">${rows.map((row) => {
    const value = valueFn(row);
    const width = Number.isFinite(value) ? Math.max(1, value / max * 100) : 0;
    return `<div class="chart-row"><span><b>${esc(row.key)}</b><small>${esc(title(row.effort))}</small></span><i class="${className}"><em style="width:${width}%"></em></i><strong>${esc(valueLabel(row))}</strong></div>`;
  }).join("")}</div>`;
}

function renderEvaluations(evaluations = []) {
  if (!evaluations.length) return `<p class="muted">No completed judge evaluation was attached.</p>`;
  const dimensions = ["evidence_grounding", "biomechanical_accuracy", "prioritization", "actionability", "realism", "uncertainty_discipline", "clarity"];
  return `<div class="judge-grid">${evaluations.map((evaluation) => `<article class="judge-card"><div class="eyebrow">${esc(title(evaluation.judge || "Judge"))}</div><p>${esc(evaluation.verdict)}</p><div class="mini-metrics">${dimensions.map((dimension) => metricBar(title(dimension), evaluation[dimension])).join("")}</div>${evaluation.factual_issues?.length ? `<h5>Factual issues</h5><ul>${evaluation.factual_issues.map((issue) => `<li>${esc(issue)}</li>`).join("")}</ul>` : ""}${evaluation.best_qualities?.length ? `<h5>Best qualities</h5><ul>${evaluation.best_qualities.map((quality) => `<li>${esc(quality)}</li>`).join("")}</ul>` : ""}</article>`).join("")}</div>`;
}

const fallbackDimensions = {
  evidence_grounding: 0.25,
  biomechanical_accuracy: 0.20,
  prioritization: 0.15,
  actionability: 0.15,
  realism: 0.10,
  uncertainty_discipline: 0.10,
  clarity: 0.05,
};

async function benchmarkFromJudgeBatches(matrix) {
  const judgeDir = path.join(root, "judging");
  const blindMap = JSON.parse(await readFile(path.join(judgeDir, "blind-map.json"), "utf8"));
  const names = (await readdir(judgeDir))
    .filter((name) => /^judge-[a-z]+--batch-\d+\.json$/i.test(name))
    .sort();
  if (!names.length) throw new Error("No benchmark-ranking.json or completed judge batches were found.");
  const evaluationsById = new Map();
  for (const name of names) {
    const judge = name.match(/^(judge-[a-z]+)/i)?.[1] ?? path.basename(name, ".json");
    const output = JSON.parse(await readFile(path.join(judgeDir, name), "utf8"));
    for (const evaluation of output.evaluations ?? []) {
      const mapped = blindMap[evaluation.candidate_id];
      if (!mapped?.id) continue;
      if (!evaluationsById.has(mapped.id)) evaluationsById.set(mapped.id, []);
      evaluationsById.get(mapped.id).push({ judge, ...evaluation });
    }
  }
  const ranking = matrix.results.filter((result) => result.status === "complete").map((run) => {
    const evaluations = evaluationsById.get(run.id) ?? [];
    const scores = evaluations.map((evaluation) => Object.entries(fallbackDimensions)
      .reduce((sum, [key, weight]) => sum + (Number(evaluation[key]) || 0) * weight, 0));
    return {
      id: run.id,
      evaluations,
      quality_score: scores.length ? Math.round(average(scores) * 10) / 10 : null,
      judge_disagreement: scores.length > 1 ? Math.round((Math.max(...scores) - Math.min(...scores)) * 10) / 10 : null,
    };
  }).sort((a, b) => (b.quality_score ?? -1) - (a.quality_score ?? -1));
  return {
    generated_at: new Date().toISOString(),
    dimensions: fallbackDimensions,
    ranking,
    source: "completed_judge_batches",
    judge_batches: names,
  };
}

function renderResponse(row) {
  const response = row.raw;
  const cost = runCost(row);
  const costMeta = cost
    ? `<span>API equivalent <b>${money(cost.api)}</b></span><span>Codex credits <b>${number(cost.credits, 2)}</b></span>`
    : `<span>Cost <b>unpriced internal router</b></span>`;
  return `<details class="response" id="response-${esc(row.id)}"><summary><span><strong>${esc(modelLabel(row))}</strong><small>${esc(title(row.effort))} effort</small></span><span class="summary-stats"><b class="score ${scoreClass(row.quality_score)}">${number(row.quality_score, 1)}</b><small>quality</small><b>${number(response.attack_score, 0)}</b><small>attack</small></span></summary><div class="response-body"><div class="response-lead"><div><div class="eyebrow">Coach verdict</div><p>${esc(response.verdict)}</p></div><aside><span>Confidence <b>${percent(response.confidence)}</b></span><span>Latency <b>${duration(row.duration_ms)}</b></span><span>Reasoning tokens <b>${number(row.usage?.reasoning_output_tokens, 0)}</b></span>${costMeta}</aside></div><div class="phase-grid">${(response.phases ?? []).map((phase) => `<article><div><span>${esc(title(phase.phase))}</span><b>${number(phase.score, 0)}</b></div><p>${esc(phase.observation)}</p><small>${esc((phase.evidence_timestamps ?? []).map((time) => `${time}s`).join(", "))}</small><p class="impact">${esc(phase.performance_impact)}</p></article>`).join("")}</div><div class="response-columns"><section><div class="eyebrow">Priority changes</div>${(response.priority_changes ?? []).slice().sort((a, b) => a.rank - b.rank).map((change) => `<article class="change-card"><span class="change-rank">${change.rank}</span><div><h4>${esc(change.change)}</h4><p>${esc(change.why)}</p><dl><div><dt>Cue</dt><dd>${esc(change.cue)}</dd></div><div><dt>Drill</dt><dd>${esc(change.drill)}</dd></div><div><dt>Dosage</dt><dd>${esc(change.dosage)}</dd></div><div><dt>Success test</dt><dd>${esc(change.success_test)}</dd></div></dl></div></article>`).join("")}</section><section><div class="eyebrow">Strengths to preserve</div><ul class="clean-list">${(response.strengths ?? []).map((strength) => `<li><b>${esc(strength.finding)}</b><span>${esc(strength.why_it_matters)}</span></li>`).join("")}${(response.preserve ?? []).map((item) => `<li><b>${esc(item)}</b></li>`).join("")}</ul><div class="eyebrow caveat-label">Limitations stated</div><ul class="caveat-list">${(response.limitations ?? []).map((limitation) => `<li>${esc(limitation)}</li>`).join("")}</ul></section></div><div class="bottom-line"><span>Coach bottom line</span><p>${esc(response.coach_bottom_line)}</p></div><section class="judge-section"><div class="eyebrow">Blind judge review</div>${renderEvaluations(row.evaluations)}</section><details class="raw-json"><summary>View raw structured response</summary><pre>${safeJson(response)}</pre></details></div></details>`;
}

const matrix = await readJson("matrix-results.json");
const benchmarkFile = await readOptionalJson("benchmark-ranking.json");
const benchmark = benchmarkFile ?? await benchmarkFromJudgeBatches(matrix);
const stability = await readOptionalJson("stability-results.json");
const evidenceNotes = await readFile(path.join(root, "video-evidence-notes.md"), "utf8");

const rawNames = (await readdir(rawDir)).filter((name) => name.endsWith(".json")).sort();
const rawEntries = await Promise.all(rawNames.map(async (name) => ({
  id: path.basename(name, ".json"),
  raw: JSON.parse(await readFile(path.join(rawDir, name), "utf8")),
})));
const rawById = new Map(rawEntries.map((entry) => [entry.id, entry.raw]));
const rankingRows = Array.isArray(benchmark.ranking) ? benchmark.ranking : [];
const rankingById = new Map(rankingRows.map((row) => [row.id, row]));
const completeRuns = matrix.results.filter((result) => result.status === "complete");
const runIds = new Set(completeRuns.map((run) => run.id));
const stabilityById = stability ? collectStability(stability, runIds) : new Map();

for (const run of completeRuns) {
  if (!rawById.has(run.id)) throw new Error(`Missing raw response for ${run.id}`);
}

const rows = completeRuns.map((run) => ({
  ...run,
  ...rankingById.get(run.id),
  raw: rawById.get(run.id),
  stability: stabilityById.get(run.id) ?? null,
}));
const visible = rows.filter((row) => row.tier === "visible")
  .sort((a, b) => (b.quality_score ?? -1) - (a.quality_score ?? -1));
const legacy = rows.filter((row) => row.tier === "legacy")
  .sort((a, b) => (b.quality_score ?? -1) - (a.quality_score ?? -1));
const autoReview = rows.filter((row) => row.tier === "internal");
const pricedRuns = rows.map((row) => ({ row, cost: runCost(row) })).filter((entry) => entry.cost);
const pricedApiTotal = pricedRuns.reduce((sum, entry) => sum + entry.cost.api, 0);
const pricedCreditTotal = pricedRuns.reduce((sum, entry) => sum + entry.cost.credits, 0);
const lowestCostRun = pricedRuns.slice().sort((a, b) => a.cost.api - b.cost.api)[0];
const highestCostRun = pricedRuns.slice().sort((a, b) => b.cost.api - a.cost.api)[0];

if (visible.length !== 21) throw new Error(`Expected 21 visible combinations, found ${visible.length}`);
if (visible.some((row) => !Number.isFinite(row.quality_score))) {
  throw new Error("Visible ranking is incomplete. Wait for benchmark-ranking.json to finish.");
}

const frameNames = (await readdir(framesDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.(png|jpe?g)$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort();
const frameAssets = new Map();
for (const name of frameNames) {
  const extension = path.extname(name).toLowerCase();
  const mime = extension === ".png" ? "image/png" : "image/jpeg";
  const data = await readFile(path.join(framesDir, name));
  frameAssets.set(name, `data:${mime};base64,${data.toString("base64")}`);
}

function frameAsset(name) {
  const asset = frameAssets.get(name);
  if (!asset) throw new Error(`Missing frame asset ${name}`);
  return asset;
}

const timeline = parseTimeline(evidenceNotes);
const evidenceCorrections = parseNumbered(evidenceNotes, "Highest-value corrections");
const familyStats = aggregateRows(visible, (row) => modelLabel(row));
const effortOrder = ["low", "medium", "high", "xhigh", "max", "ultra"];
const effortStats = aggregateRows(visible, (row) => row.effort, effortOrder);
const coachConsensus = consensus(visible);
const winner = visible[0];
const fastest = visible.slice().sort((a, b) => a.duration_ms - b.duration_ms)[0];
const nearWinner = visible
  .filter((row) => row.effort !== "ultra")
  .sort((a, b) => b.quality_score - a.quality_score || a.duration_ms - b.duration_ms)[0] ?? fastest;
const winnerCost = runCost(winner);
const nearWinnerCost = runCost(nearWinner);
const visibleAttackScores = visible.map((row) => row.raw.attack_score).filter(Number.isFinite);
const generatedAt = new Date();
const judgeCounts = visible.map((row) => row.evaluations?.length ?? 0);
const judgeCoverage = `${Math.min(...judgeCounts)}-${Math.max(...judgeCounts)} judges per response`;
const stabilitySummary = stability
  ? cleanText(stability.summary || stability.recommendation || `${stabilityById.size} combinations have attached stability records.`)
  : "No separate stability file was present. The report keeps single-run quality distinct from repeatability.";
const weightEntries = Object.entries(benchmark.dimensions ?? {});

const timelineHtml = timeline.map((item, index) => {
  const imageName = frameNameFor(index, item.phase);
  return `<article class="timeline-card"><img src="${frameAsset(imageName)}" alt="${esc(`${item.phase}, ${item.time}`)}"><div><span class="timeline-time">${esc(item.time)}</span><h3>${esc(item.phase)}</h3><p>${esc(item.evidence)}</p><small>Evidence confidence: ${esc(item.confidence)}</small></div></article>`;
}).join("");

const stripNames = [
  "overview_2fps.jpg",
  "approach_sequence_5.0_6.8_15fps.jpg",
  "contact_sequence_6.70_7.70_30fps.jpg",
  "landing_sequence_7.70_8.70_30fps.jpg",
];

const qualityRange = visible.length ? `${number(visible.at(-1).quality_score, 1)} to ${number(winner.quality_score, 1)}` : "n/a";
const reportHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vollyio attacker coaching benchmark</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Space+Grotesk:wght@500;600;700&display=swap');
:root{--navy:#0f212c;--navy-light:#16303f;--navy-lighter:#1e3d4e;--chalk:#f2efe6;--chalk-dim:#b9c4c9;--gold:#e8b93b;--gold-dim:#c79c2e;--teal:#6fbfae;--coral:#e2604f;--line:rgb(242 239 230 / .12);--display:'Space Grotesk',sans-serif;--sans:'Instrument Sans',system-ui,sans-serif;--mono:'IBM Plex Mono',monospace;--radius:1rem;--shadow:0 12px 32px -16px rgb(0 0 0 / .55);--glow:0 0 28px -6px rgb(232 185 59 / .4)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--navy);color:var(--chalk);font-family:var(--sans);font-size:16px;line-height:1.6;background-image:radial-gradient(circle at 82% 5%,rgb(232 185 59 / .09),transparent 27rem)}a{color:inherit}img{max-width:100%}button,summary{font:inherit}.shell{width:min(1180px,calc(100% - 32px));margin:auto}.topbar{position:sticky;top:0;z-index:30;border-bottom:1px solid var(--line);background:rgb(15 33 44 / .93);backdrop-filter:blur(14px)}.topbar .shell{min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-family:var(--display);font-weight:700;letter-spacing:-.02em}.brand span{color:var(--gold)}nav{display:flex;gap:18px;overflow:auto}nav a{font:500 11px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;text-decoration:none;color:var(--chalk-dim);white-space:nowrap}nav a:hover{color:var(--gold)}header{padding:84px 0 50px;border-bottom:1px solid var(--line)}.eyebrow{font:600 11px/1.3 var(--mono);text-transform:uppercase;letter-spacing:.14em;color:var(--gold)}h1,h2,h3,h4,h5{font-family:var(--display);line-height:1.12;margin:0}h1{font-size:clamp(38px,7vw,72px);letter-spacing:-.045em;max-width:14ch;margin-top:18px}h1 em{font-style:normal;color:var(--gold)}.lede{font-size:clamp(17px,2.3vw,21px);color:var(--chalk-dim);max-width:68ch;margin:22px 0 0}.hero-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:28px}.chip{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:99px;padding:6px 11px;font:500 11px/1 var(--mono);letter-spacing:.04em;color:var(--chalk-dim)}.chip.gold{border-color:rgb(232 185 59 / .45);color:var(--gold)}.chip.teal{border-color:rgb(111 191 174 / .45);color:var(--teal)}.chip.effort{padding:4px 8px}main section.report-section{padding:64px 0;border-bottom:1px solid var(--line)}.section-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,.65fr);gap:28px;align-items:end;margin-bottom:28px}.section-head h2{font-size:clamp(28px,4vw,42px);letter-spacing:-.03em;margin-top:10px}.section-head p{margin:0;color:var(--chalk-dim)}.decision-grid{display:grid;grid-template-columns:1.35fr .65fr;gap:18px}.decision{border:1px solid rgb(232 185 59 / .28);background:var(--navy-light);border-radius:var(--radius);padding:30px;box-shadow:var(--shadow)}.decision.primary{box-shadow:var(--glow)}.decision h3{font-size:clamp(25px,3vw,36px);margin:8px 0 12px}.decision p{color:var(--chalk-dim)}.decision .why{color:var(--chalk);font-size:18px}.decision-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-top:24px}.decision-stats div{background:var(--navy);padding:14px}.decision-stats span{display:block;font:500 10px var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--chalk-dim)}.decision-stats b{display:block;font:700 24px var(--display);margin-top:4px}.callout{border-left:3px solid var(--teal);background:rgb(111 191 174 / .08);padding:16px 18px;border-radius:0 12px 12px 0}.callout.caution{border-left-color:var(--coral);background:rgb(226 96 79 / .08)}.callout p{margin:0}.method-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.method-card{border:1px solid var(--line);border-radius:var(--radius);padding:20px;background:var(--navy-light)}.method-card b{display:block;font:700 30px var(--display);color:var(--gold);overflow-wrap:anywhere}.method-card span{display:block;color:var(--chalk-dim);margin-top:5px}.weights{margin-top:18px;display:flex;flex-wrap:wrap;gap:8px}.weights span{border:1px solid var(--line);border-radius:9px;padding:7px 10px;font:500 11px var(--mono);color:var(--chalk-dim)}.filmstrips{display:grid;gap:14px;margin-bottom:24px}.filmstrips figure{margin:0;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--navy-light)}.filmstrips img{display:block;width:100%;max-height:520px;object-fit:contain;background:#08151c}.filmstrips figcaption{padding:10px 14px;font:500 11px var(--mono);color:var(--chalk-dim)}.timeline{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.timeline-card{display:grid;grid-template-columns:190px 1fr;gap:0;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--navy-light)}.timeline-card img{width:100%;height:100%;min-height:180px;object-fit:cover}.timeline-card div{padding:18px}.timeline-card h3{font-size:19px;margin:6px 0}.timeline-card p{font-size:14px;color:var(--chalk-dim);margin:0}.timeline-card small{display:block;margin-top:10px;color:var(--teal);font:500 10px var(--mono)}.timeline-time{font:600 11px var(--mono);color:var(--gold)}.corrections{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:20px}.corrections article{border:1px solid var(--line);border-radius:12px;padding:18px;background:var(--navy-light);display:flex;gap:13px}.corrections b{font:700 18px var(--display);color:var(--gold)}.corrections p{margin:0;color:var(--chalk-dim)}.table-wrap{overflow:auto;max-width:100%;border:1px solid var(--line);border-radius:var(--radius);background:var(--navy-light);scrollbar-color:var(--gold-dim) var(--navy)}.table-wrap:focus{outline:2px solid var(--gold);outline-offset:3px}table{width:100%;border-collapse:collapse;min-width:880px}.ranking-table{min-width:1180px}.pricing-table{min-width:1040px}th,td{padding:12px 14px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}th{position:sticky;top:57px;background:var(--navy-lighter);z-index:2;font:600 10px var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--chalk-dim)}td{font-size:13px}td small{display:block;color:var(--chalk-dim);font:10px var(--mono);margin-top:3px}.ranking-table tr:last-child td,table tr:last-child td{border-bottom:0}.ranking-table tr.winner td{background:rgb(232 185 59 / .07)}.rank{font:700 20px var(--display);color:var(--gold)}.score{display:inline-flex;min-width:46px;justify-content:center;border-radius:8px;padding:4px 7px;font:700 13px var(--mono)}.score.excellent{background:var(--gold);color:var(--navy)}.score.good{background:var(--teal);color:var(--navy)}.score.mixed{border:1px solid var(--gold-dim);color:var(--gold)}.score.weak{border:1px solid var(--coral);color:var(--coral)}.score.neutral{border:1px solid var(--line);color:var(--chalk-dim)}.analysis-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}.analysis-card{min-width:0;border:1px solid var(--line);border-radius:var(--radius);padding:22px;background:var(--navy-light)}.analysis-card h3{font-size:22px;margin-bottom:8px}.analysis-card>p{color:var(--chalk-dim)}.charts{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;margin-top:20px}.chart-card{min-width:0;border:1px solid var(--line);border-radius:var(--radius);padding:20px;background:var(--navy-light)}.chart-card h3{font-size:20px}.chart-card>p{font-size:13px;color:var(--chalk-dim)}.bar-chart{display:grid;gap:9px;margin-top:16px}.chart-row{display:grid;grid-template-columns:150px minmax(0,1fr) 90px;gap:10px;align-items:center}.chart-row>span{display:flex;justify-content:space-between;gap:5px;min-width:0}.chart-row span b{font:600 11px var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.chart-row span small{font:10px var(--mono);color:var(--chalk-dim)}.chart-row>i{height:8px;background:rgb(242 239 230 / .08);border-radius:99px;overflow:hidden}.chart-row>i em{display:block;height:100%;background:var(--gold);border-radius:inherit}.chart-row>i.teal em{background:var(--teal)}.chart-row>strong{text-align:right;font:600 10px var(--mono);color:var(--chalk-dim)}.consensus-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}.theme-list{display:grid;gap:10px}.theme{border:1px solid var(--line);border-radius:12px;padding:15px;background:var(--navy-light)}.theme>div{display:flex;justify-content:space-between;gap:15px}.theme h3{font-size:17px}.theme b{color:var(--gold);font:700 17px var(--mono)}.theme p{margin:7px 0 0;font-size:13px;color:var(--chalk-dim)}.metric-row{display:grid;grid-template-columns:160px minmax(0,1fr) 42px;gap:9px;align-items:center;margin:9px 0}.metric-row>span:first-child{font-size:12px;color:var(--chalk-dim)}.metric-track{height:7px;background:rgb(242 239 230 / .08);border-radius:99px;overflow:hidden}.metric-track i{display:block;height:100%;background:var(--gold)}.metric-row b{text-align:right;font:600 11px var(--mono)}.metric-row small{grid-column:2/4;color:var(--chalk-dim)}.response-tools{display:flex;flex-wrap:wrap;gap:9px;margin:-8px 0 18px}.report-action{cursor:pointer;border:1px solid var(--line);border-radius:9px;background:var(--navy-light);color:var(--chalk);padding:8px 12px;font:600 11px var(--mono)}.report-action:hover,.report-action:focus-visible{border-color:var(--gold);color:var(--gold)}.response-stack{display:grid;gap:12px}.response{border:1px solid var(--line);border-radius:var(--radius);background:var(--navy-light);overflow:hidden;scroll-margin-top:80px}.response>summary{cursor:pointer;padding:16px 19px;display:flex;align-items:center;justify-content:space-between;gap:16px;list-style:none}.response>summary::-webkit-details-marker{display:none}.response>summary:hover{background:rgb(232 185 59 / .05)}.response>summary span:first-child{display:flex;align-items:baseline;gap:10px}.response>summary small{font:500 10px var(--mono);color:var(--chalk-dim)}.summary-stats{display:grid;grid-template-columns:auto auto auto auto;align-items:center;gap:8px}.summary-stats small{text-transform:uppercase;letter-spacing:.06em}.response-body{padding:24px;border-top:1px solid var(--line)}.response-lead{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:25px}.response-lead p{font-size:18px}.response-lead aside{display:grid;gap:7px;align-content:start;border-left:1px solid var(--line);padding-left:18px}.response-lead aside span{font-size:12px;color:var(--chalk-dim)}.response-lead aside b{color:var(--chalk)}.phase-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:20px}.phase-grid article{border:1px solid var(--line);border-radius:10px;padding:14px;background:var(--navy)}.phase-grid article>div{display:flex;justify-content:space-between;gap:10px}.phase-grid article>div span{font:600 10px var(--mono);text-transform:uppercase;color:var(--gold)}.phase-grid article>div b{font:700 18px var(--display)}.phase-grid p{font-size:13px;color:var(--chalk-dim);margin:8px 0}.phase-grid small{font:10px var(--mono);color:var(--teal)}.phase-grid p.impact{color:var(--chalk);font-style:italic}.response-columns{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:20px;margin-top:24px}.change-card{display:grid;grid-template-columns:30px minmax(0,1fr);gap:12px;padding:16px 0;border-bottom:1px solid var(--line)}.change-card:last-child{border:0}.change-rank{height:28px;width:28px;border:1px solid var(--gold);color:var(--gold);display:grid;place-items:center;border-radius:8px;font:600 12px var(--mono)}.change-card h4{font-size:18px}.change-card p{font-size:13px;color:var(--chalk-dim)}dl{display:grid;gap:7px;margin:10px 0 0}dl div{display:grid;grid-template-columns:80px minmax(0,1fr);gap:8px}dt{font:600 10px var(--mono);text-transform:uppercase;color:var(--teal)}dd{margin:0;font-size:12px;color:var(--chalk-dim);overflow-wrap:anywhere}.clean-list,.caveat-list{padding:0;list-style:none}.clean-list li{padding:10px 0;border-bottom:1px solid var(--line)}.clean-list b,.clean-list span{display:block}.clean-list span{font-size:12px;color:var(--chalk-dim)}.caveat-label{margin-top:22px}.caveat-list li{font-size:12px;color:var(--chalk-dim);margin:7px 0;padding-left:14px;position:relative}.caveat-list li:before{content:'!';position:absolute;left:0;color:var(--coral);font:600 10px var(--mono)}.bottom-line{margin-top:22px;border-left:3px solid var(--gold);padding:14px 18px;background:rgb(232 185 59 / .07)}.bottom-line span{font:600 10px var(--mono);text-transform:uppercase;color:var(--gold)}.bottom-line p{margin:4px 0 0}.judge-section{margin-top:24px}.judge-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:10px}.judge-card{border:1px solid var(--line);border-radius:12px;padding:16px;background:var(--navy)}.judge-card p,.judge-card li{font-size:12px;color:var(--chalk-dim)}.judge-card h5{font-size:13px;margin-top:14px}.mini-metrics .metric-row{grid-template-columns:150px minmax(0,1fr) 34px}.raw-json{margin-top:20px;border:1px solid var(--line);border-radius:10px;padding:12px}.raw-json>summary{cursor:pointer;font:600 11px var(--mono);color:var(--teal)}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.55 var(--mono);color:var(--chalk-dim);max-height:620px;overflow:auto}.appendix-note{color:var(--chalk-dim);max-width:72ch}.caveat-band{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.caveat-band article{border-top:2px solid var(--coral);background:var(--navy-light);padding:18px;border-radius:0 0 12px 12px}.caveat-band h3{font-size:17px}.caveat-band p{font-size:13px;color:var(--chalk-dim)}.data-details{margin-top:18px}.data-details summary{cursor:pointer;color:var(--teal);font:600 11px var(--mono)}.source-links{margin:16px 0 0;color:var(--chalk-dim);font-size:13px}.source-links a{color:var(--teal)}
th{top:0}
@media(max-width:900px){.decision-grid,.analysis-grid,.charts,.consensus-grid,.section-head,.response-columns{grid-template-columns:1fr}.method-grid{grid-template-columns:repeat(2,1fr)}.timeline{grid-template-columns:1fr}.response-lead{grid-template-columns:1fr}.response-lead aside{border-left:0;border-top:1px solid var(--line);padding:14px 0 0}.judge-grid{grid-template-columns:1fr}.caveat-band{grid-template-columns:1fr}.section-head{align-items:start}.topbar nav{display:none}}
@media(max-width:620px){.shell{width:min(100% - 22px,1180px)}header{padding-top:58px}.decision,.analysis-card,.chart-card,.response-body{padding:17px}.decision-stats{grid-template-columns:1fr}.method-grid,.phase-grid,.corrections{grid-template-columns:1fr}.timeline-card{grid-template-columns:1fr}.timeline-card img{max-height:270px}.chart-row{grid-template-columns:110px 1fr 70px}.response>summary{align-items:flex-start}.response>summary span:first-child{display:grid}.summary-stats{grid-template-columns:auto auto}.topbar .shell{min-height:52px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
@media print{.topbar{display:none}body{background:#fff;color:#111}.shell{width:100%}.report-section{break-inside:avoid}.response:not([open]) .response-body{display:block}.response,.decision,.method-card,.analysis-card,.chart-card,.timeline-card,.table-wrap{background:#fff;color:#111;box-shadow:none}.muted,.section-head p,.decision p,td small{color:#444}}
</style>
</head>
<body>
<div class="topbar"><div class="shell"><div class="brand"><span>vollyio</span> / coaching benchmark</div><nav><a href="#recommendation">Recommendation</a><a href="#cost">Cost</a><a href="#evidence">Evidence</a><a href="#ranking">Ranking</a><a href="#analysis">Analysis</a><a href="#responses">Responses</a></nav></div></div>
<header><div class="shell"><div class="eyebrow">Attacker film analysis benchmark</div><h1>Which model gives the most <em>coach-realistic</em> advice?</h1><p class="lede">Thirty-three model and effort combinations reviewed the same eight frames of one right-handed grass attack. This report ranks the 21 current visible combinations on blinded coaching quality, then separates legacy and Auto Review results.</p><div class="hero-meta"><span class="chip gold">21 visible combinations ranked</span><span class="chip">33 total responses</span><span class="chip teal">${esc(judgeCoverage)}</span><span class="chip">${pricedRuns.length} priced combinations</span><span class="chip">Single slowed rep</span><span class="chip">Generated ${esc(generatedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }))}</span></div></div></header>
<main>
<section class="report-section" id="recommendation"><div class="shell"><div class="section-head"><div><div class="eyebrow">Executive recommendation</div><h2>Use ${esc(modelLabel(winner))} at ${esc(title(winner.effort))} effort for the quality-first benchmark.</h2></div><p>The recommendation follows the blinded judge composite. Ultra includes automatic delegation, so ${esc(modelLabel(nearWinner))} at ${esc(title(nearWinner.effort))} is the best pure-effort alternative. Price is now reported from observed token usage, but production reliability and performance on other athletes and skills remain untested.</p></div><div class="decision-grid"><article class="decision primary"><div class="eyebrow">Quality winner</div><h3>${esc(modelLabel(winner))} / ${esc(title(winner.effort))}</h3><p class="why">${esc(winner.raw.coach_bottom_line)}</p><div class="decision-stats"><div><span>Judge quality</span><b>${number(winner.quality_score, 1)}</b></div><div><span>Attack score</span><b>${number(winner.raw.attack_score, 0)}</b></div><div><span>Wall time</span><b>${duration(winner.duration_ms)}</b></div><div><span>API equivalent</span><b>${money(winnerCost?.api)}</b></div></div><div class="callout" style="margin-top:18px"><p><strong>First correction:</strong> ${esc(winner.raw.priority_changes?.[0]?.change || "See the full response below.")}</p></div></article><article class="decision"><div class="eyebrow">Best pure-effort alternative</div><h3>${esc(modelLabel(nearWinner))} / ${esc(title(nearWinner.effort))}</h3><p>This option is ${duration(nearWinner.duration_ms)}, ${money(nearWinnerCost?.api)} API-equivalent, ${number(nearWinnerCost?.credits, 2)} Codex credits, and a blinded quality score of ${number(nearWinner.quality_score, 1)}. It excludes delegated Ultra workflow behavior.</p><div class="callout caution"><p><strong>Evidence boundary:</strong> ${esc(stabilitySummary)}</p></div></article></div><div class="caveat-band" style="margin-top:18px"><article><h3>Slow-motion clip</h3><p>Playback timestamps locate frames only. Actual approach speed, tempo, and phase duration are not scoreable without the original-speed footage.</p></article><article><h3>One repetition</h3><p>The benchmark can compare advice on this rep. It cannot establish athlete consistency or general model quality across volleyball skills.</p></article><article><h3>Rear-oblique view</h3><p>Foot placement, contact depth, exact joint angles, jump height, ball speed, spin, and medical risk remain unsupported.</p></article></div></div></section>
<section class="report-section" id="method"><div class="shell"><div class="section-head"><div><div class="eyebrow">Methodology</div><h2>Same evidence, same prompt, blinded evaluation.</h2></div><p>Every response analyzed the shirtless right-handed attacker only. The benchmark isolates model family and effort while holding the evidence and structured coaching contract constant.</p></div><div class="method-grid"><article class="method-card"><b>8</b><span>chronological key frames</span></article><article class="method-card"><b>${completeRuns.length}</b><span>structured coaching responses</span></article><article class="method-card"><b>${esc(judgeCoverage)}</b><span>completed judge coverage</span></article><article class="method-card"><b>${qualityRange}</b><span>visible quality-score range</span></article></div><div class="weights">${weightEntries.map(([key, weight]) => `<span>${esc(title(key))}: ${number(weight * 100, 0)}%</span>`).join("")}</div><div class="callout" style="margin-top:18px"><p>Judge quality combines evidence grounding, biomechanical accuracy, prioritization, actionability, realism, uncertainty discipline, and clarity. All 21 visible combinations received two blinded judges. One legacy candidate also received two; the remaining legacy and internal candidates received one. Scores with different coverage are displayed together but should not be treated as equally stable. Latency, token telemetry, API-equivalent dollars, and Codex credits are reported separately.</p></div></div></section>
<section class="report-section" id="cost"><div class="shell"><div class="section-head"><div><div class="eyebrow">Observed run cost</div><h2>Every model-effort cost comes from this benchmark's saved token telemetry.</h2></div><p>Effort has no fixed surcharge. A higher effort costs more only when it uses more input, cached input, output, or delegated work. The ranking tables show the exact observed cost for every priced combination.</p></div><div class="method-grid"><article class="method-card"><b>${money(lowestCostRun?.cost.api)}</b><span>lowest: ${esc(modelLabel(lowestCostRun?.row))} / ${esc(title(lowestCostRun?.row.effort))}</span></article><article class="method-card"><b>${money(highestCostRun?.cost.api)}</b><span>highest: ${esc(modelLabel(highestCostRun?.row))} / ${esc(title(highestCostRun?.row.effort))}</span></article><article class="method-card"><b>${money(pricedApiTotal, 2)}</b><span>API-equivalent total for ${pricedRuns.length} priced candidate runs</span></article><article class="method-card"><b>${number(pricedCreditTotal, 2)}</b><span>Codex-credit total for the same candidate runs</span></article></div><div class="callout" style="margin:18px 0"><p><strong>How to read this:</strong> The dollar column is an API-equivalent estimate at standard short-context rates, not an invoice. The benchmark ran through plan access, so included allowance can make the marginal cash charge $0. Credits show the direct Codex usage equivalent. Auto Review remains unpriced because it is an internal router rather than a stable selectable model. Judge-call overhead is excluded from per-candidate costs.</p></div><h3 style="margin-bottom:12px">Current rates per 1 million tokens</h3>${renderPricingTable()}<p class="source-links">Rates checked July 20, 2026. Sources: <a href="https://developers.openai.com/api/docs/pricing">API pricing</a>, <a href="https://help.openai.com/en/articles/20001106">Codex rate card</a>, and <a href="https://openai.com/index/gpt-5-6/">GPT-5.6 pricing and effort behavior</a>. Formula: uncached input x input rate + cached input x cached rate + total output x output rate. Reasoning tokens are already part of total output and are not added twice.</p></div></section>
<section class="report-section" id="evidence"><div class="shell"><div class="section-head"><div><div class="eyebrow">Evidence timeline</div><h2>What the clip actually supports.</h2></div><p>The timeline below comes from a frame-by-frame evidence note prepared before model comparison. Images are embedded in this HTML so the report remains self-contained.</p></div><div class="filmstrips">${stripNames.map((name) => `<figure><img src="${frameAsset(name)}" alt="${esc(title(path.basename(name, path.extname(name))))}"><figcaption>${esc(name)}</figcaption></figure>`).join("")}</div><div class="timeline">${timelineHtml}</div><div class="corrections">${evidenceCorrections.map((correction, index) => `<article><b>${index + 1}</b><p>${esc(correction)}</p></article>`).join("")}</div><details class="data-details"><summary>Read the full expert evidence note</summary><pre>${esc(evidenceNotes)}</pre></details></div></section>
<section class="report-section" id="ranking"><div class="shell"><div class="section-head"><div><div class="eyebrow">Visible model ranking</div><h2>All 21 current combinations.</h2></div><p>Rank is determined by blinded coaching quality only. Attack score shows each model's own form grade and is not itself the benchmark score.</p></div>${renderRankingTable(visible, true)}</div></section>
<section class="report-section" id="analysis"><div class="shell"><div class="section-head"><div><div class="eyebrow">Model and effort analysis</div><h2>Capability gains are not linear with effort.</h2></div><p>Family and effort averages reveal where additional reasoning improved coaching quality and where it mainly increased latency or output volume.</p></div><div class="analysis-grid"><article class="analysis-card"><h3>Model-family averages</h3><p>Visible combinations only, averaged across each family's supported effort levels.</p>${renderAggregateTable(familyStats, "Family")}</article><article class="analysis-card"><h3>Effort-level averages</h3><p>Visible combinations only, averaged across families that expose the effort.</p>${renderAggregateTable(effortStats, "Effort")}</article></div><div class="charts"><article class="chart-card"><h3>Latency by combination</h3><p>Observed end-to-end wall time for this benchmark run.</p>${renderBarChart(visible, (row) => row.duration_ms, (row) => duration(row.duration_ms), "gold")}</article><article class="chart-card"><h3>Output and reasoning volume</h3><p>Bar length is output tokens. The label also reports reasoning tokens from run telemetry.</p>${renderBarChart(visible, (row) => row.usage?.output_tokens, (row) => `${number(row.usage?.output_tokens, 0)} out / ${number(row.usage?.reasoning_output_tokens, 0)} reason`, "teal")}</article></div></div></section>
<section class="report-section" id="consensus"><div class="shell"><div class="section-head"><div><div class="eyebrow">Coach consensus</div><h2>The advice converges on spacing and sequencing.</h2></div><p>Consensus is counted from each visible response's first-ranked correction, then checked against average phase scores. It describes agreement, not truth by majority vote.</p></div><div class="consensus-grid"><div class="theme-list">${coachConsensus.priorityThemes.slice(0, 6).map((theme) => `<article class="theme"><div><h3>${esc(theme.theme)}</h3><b>${theme.count}/${visible.length}</b></div><p>${esc(theme.findings.slice(0, 3).map((finding) => finding.text).join(" | "))}</p></article>`).join("")}</div><article class="analysis-card"><h3>Phase-score consensus</h3><p>Average model-assigned scores across the 21 visible combinations. Range shows interpretive spread.</p>${coachConsensus.phases.map((phase) => metricBar(title(phase.phase), phase.average, `range ${phase.min}-${phase.max}`)).join("")}<div class="callout" style="margin-top:18px"><p>Median attack score: <strong>${number(median(visibleAttackScores), 1)}</strong>. Mean: <strong>${number(average(visibleAttackScores), 1)}</strong>. Range: <strong>${Math.min(...visibleAttackScores)}-${Math.max(...visibleAttackScores)}</strong>.</p></div></article></div></div></section>
<section class="report-section" id="legacy"><div class="shell"><div class="section-head"><div><div class="eyebrow">Legacy appendix</div><h2>Eight legacy combinations, kept separate.</h2></div><p class="appendix-note">Legacy results are useful as historical controls. They do not compete for the visible-model recommendation.</p></div>${renderRankingTable(legacy, true)}</div></section>
<section class="report-section" id="auto-review"><div class="shell"><div class="section-head"><div><div class="eyebrow">Auto Review appendix</div><h2>Unranked internal routing results.</h2></div><p class="appendix-note">Auto Review is intentionally unranked because its routing behavior is not a stable, user-selectable model family. Quality and telemetry remain visible for context.</p></div>${renderRankingTable(autoReview, false)}</div></section>
<section class="report-section" id="responses"><div class="shell"><div class="section-head"><div><div class="eyebrow">Individual responses</div><h2>Every raw coaching analysis.</h2></div><p>Open any combination to inspect its full phase scores, corrections, drills, blind-judge feedback, limitations, original structured JSON, and observed cost. Ranking links now open the linked response automatically.</p></div><div class="response-tools" aria-label="Response visibility controls"><button class="report-action" type="button" data-response-action="expand">Expand all responses</button><button class="report-action" type="button" data-response-action="collapse">Collapse all responses</button></div><div class="response-stack">${rows.map(renderResponse).join("")}</div>${stability ? `<details class="data-details"><summary>View raw stability results</summary><pre>${safeJson(stability)}</pre></details>` : ""}</div></section>
</main>
<script>
const responseDetails = [...document.querySelectorAll("details.response")];
function openLinkedResponse() {
  const id = decodeURIComponent(location.hash.slice(1));
  const target = document.getElementById(id);
  if (target?.matches("details.response")) target.open = true;
}
for (const button of document.querySelectorAll("[data-response-action]")) {
  button.addEventListener("click", () => {
    const shouldOpen = button.dataset.responseAction === "expand";
    for (const detail of responseDetails) detail.open = shouldOpen;
  });
}
window.addEventListener("hashchange", openLinkedResponse);
openLinkedResponse();
</script>
</body>
</html>`;

const normalizedReportHtml = reportHtml.replaceAll("\u2014", " - ").replaceAll("\u2013", "-");
await writeFile(reportPath, normalizedReportHtml, "utf8");
console.log(JSON.stringify({ reportPath, bytes: Buffer.byteLength(normalizedReportHtml), visible: visible.length, legacy: legacy.length, autoReview: autoReview.length, rawResponses: rawEntries.length, stability: Boolean(stability) }));
