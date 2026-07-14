// Local reviewer for folder-ingested eval cases: arrow keys walk the reps.
//
//   node scripts/review-evals.mjs [--port 4750]
//
// Left/Right: previous/next rep (ordered by video then play).
// Up/Down: previous/next video (first rep). No dependencies, no network.

import { createServer } from "node:http";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const args = {};
const rest = process.argv.slice(2);
for (let i = 0; i < rest.length; i += 2) args[rest[i]?.slice(2)] = rest[i + 1];
const PORT = Number(args.port ?? 4750);

const casesDir = "evals/cases";

function listCases() {
  return readdirSync(casesDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

function caseMeta(id) {
  const c = JSON.parse(readFileSync(path.join(casesDir, `${id}.json`), "utf8"));
  return {
    id: c.id,
    skill: c.skill,
    discipline: c.discipline,
    source: c.source,
    video_slug: c.video_slug,
    play_index: c.play_index,
    play_count: c.play_count,
    window: c.window,
    excluded: c.excluded ?? false,
    classification: c.classification ?? null,
    frame_count: Array.isArray(c.frames) ? c.frames.length : 0,
  };
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(PAGE);
    } else if (url.pathname === "/data") {
      const results = existsSync("evals/RESULTS.json")
        ? JSON.parse(readFileSync("evals/RESULTS.json", "utf8"))
        : { results: {} };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ cases: listCases().map(caseMeta), results: results.results }));
    } else if (url.pathname.startsWith("/case/")) {
      const id = decodeURIComponent(url.pathname.slice(6)).replace(/[^a-z0-9-]/gi, "");
      const file = path.join(casesDir, `${id}.json`);
      if (!existsSync(file)) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(readFileSync(file, "utf8"));
    } else {
      res.writeHead(404);
      res.end("not found");
    }
  } catch (e) {
    res.writeHead(500);
    res.end(String(e?.message ?? e));
  }
});

const PAGE = /* html */ `<!doctype html>
<meta charset="utf-8">
<title>Rep review</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { --navy:#0f212c; --navy2:#16303f; --chalk:#f2efe6; --dim:#b9c4c9; --gold:#e8b93b; --teal:#6fbfae; --coral:#e2604f; }
  * { box-sizing: border-box; margin: 0; }
  body { background: var(--navy); color: var(--chalk); font: 15px/1.5 system-ui, sans-serif; padding: 20px; }
  .top { display:flex; justify-content: space-between; align-items:baseline; gap:12px; flex-wrap:wrap; }
  h1 { font-size: 18px; }
  .hint { color: var(--dim); font-size: 12px; }
  .meta { margin-top: 10px; display:flex; gap:8px; flex-wrap: wrap; align-items:center; }
  .chip { border:1px solid rgba(242,239,230,.25); border-radius: 999px; padding: 2px 12px; font-size: 12px; }
  .chip.gold { border-color: var(--gold); color: var(--gold); }
  .chip.warn { border-color: var(--coral); color: var(--coral); }
  .band-Elite { background: var(--gold); color: var(--navy); border:0; font-weight:700; }
  .band-Advanced { background: var(--teal); color: var(--navy); border:0; font-weight:700; }
  .band-Solid { border-color: var(--teal); color: var(--teal); }
  .band-Developing { border-color: var(--coral); color: var(--coral); }
  .films { margin-top: 14px; display:flex; gap:8px; overflow-x:auto; padding-bottom: 6px; }
  .films figure { flex: 0 0 auto; }
  .films img { display:block; max-height: 300px; border-radius: 8px; }
  .films figcaption { font-size: 11px; color: var(--dim); text-align:center; padding-top:2px; }
  .cols { margin-top: 14px; display:grid; gap: 14px; grid-template-columns: 1fr; }
  @media (min-width: 900px) { .cols { grid-template-columns: 1.1fr .9fr; } }
  .card { background: var(--navy2); border-radius: 12px; padding: 14px 16px; }
  .card h2 { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--gold); margin-bottom: 8px; }
  .metric { display:flex; align-items:center; gap:10px; margin: 6px 0; font-size: 13px; }
  .metric .k { width: 170px; color: var(--dim); }
  .bar { flex:1; height: 8px; background: rgba(242,239,230,.12); border-radius: 999px; overflow:hidden; }
  .bar i { display:block; height:100%; background: var(--gold); }
  .nav { position: fixed; inset-inline: 0; bottom: 0; display:flex; justify-content:center; gap: 10px; padding: 12px; background: linear-gradient(transparent, rgba(15,33,44,.95) 40%); }
  button { background: var(--navy2); color: var(--chalk); border: 1px solid rgba(242,239,230,.25); border-radius: 10px; padding: 10px 18px; font-size: 14px; cursor: pointer; }
  button:hover { border-color: var(--gold); }
  .muted { color: var(--dim); font-size: 13px; }
  ul { padding-left: 18px; }
</style>
<div class="top">
  <h1 id="title">Loading…</h1>
  <span class="hint">← → rep &nbsp;·&nbsp; ↑ ↓ video &nbsp;·&nbsp; siblings stay linked by video</span>
</div>
<div class="meta" id="meta"></div>
<div class="films" id="films"></div>
<div class="cols">
  <div class="card"><h2>Coaching read</h2><div id="read" class="muted">No model result yet.</div></div>
  <div class="card"><h2>Metrics</h2><div id="metrics" class="muted">No model result yet.</div></div>
</div>
<div class="nav">
  <button onclick="step(-1)">← Prev rep</button>
  <button onclick="step(1)">Next rep →</button>
</div>
<script>
let CASES = [], RESULTS = {}, i = 0;
const bandChip = b => b ? '<span class="chip band-' + b + '">' + b + '</span>' : '';
async function load() {
  const d = await (await fetch('/data')).json();
  CASES = d.cases; RESULTS = d.results || {};
  i = Math.min(Number(localStorage.getItem('rep-i') || 0), CASES.length - 1);
  render();
}
function step(n) { i = (i + n + CASES.length) % CASES.length; localStorage.setItem('rep-i', i); render(); }
function stepVideo(n) {
  const cur = CASES[i].video_slug;
  let j = i;
  do { j = (j + n + CASES.length) % CASES.length; } while (CASES[j].video_slug === cur && j !== i);
  const slug = CASES[j].video_slug;
  while (CASES[j - 1] && CASES[j - 1].video_slug === slug) j--;
  i = j; localStorage.setItem('rep-i', i); render();
}
addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); stepVideo(-1); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); stepVideo(1); }
});
async function render() {
  const c = CASES[i];
  const r = RESULTS[c.id];
  document.getElementById('title').textContent =
    (i + 1) + ' / ' + CASES.length + ' · ' + c.skill.toUpperCase() + ' · ' + c.discipline +
    ' · play ' + c.play_index + ' of ' + c.play_count;
  const cls = c.classification || {};
  document.getElementById('meta').innerHTML =
    '<span class="chip gold">' + c.video_slug + '</span>' +
    (r ? bandChip(r.band) + '<span class="chip">overall ' + r.coherent_overall +
      (r.overalls && r.overalls.length > 1 ? ' · runs [' + r.overalls.join(', ') + ']' : '') + '</span>' : '<span class="chip">not scored yet</span>') +
    '<span class="chip">window ' + c.window.startS + 's – ' + c.window.endS + 's</span>' +
    '<span class="chip">id confidence ' + Math.round((cls.agreement ?? 0) * 100) + '%</span>' +
    (cls.uncertain ? '<span class="chip warn">uncertain id</span>' : '') +
    (c.excluded ? '<span class="chip warn">excluded (no action)</span>' : '') +
    '<span class="chip" style="border:0;color:var(--dim)">' + (cls.action_summary || '') + '</span>';
  const full = await (await fetch('/case/' + c.id)).json();
  document.getElementById('films').innerHTML = (full.frames || []).map((f, k) =>
    '<figure><img loading="lazy" src="data:image/jpeg;base64,' + f.data + '"><figcaption>#' + k + ' · ' + f.time_s + 's</figcaption></figure>'
  ).join('');
  const read = document.getElementById('read');
  const met = document.getElementById('metrics');
  if (r && r.analysis) {
    const a = r.analysis;
    read.innerHTML =
      (a.scene_read ? '<p>' + a.scene_read + '</p>' : '') +
      '<p style="margin-top:8px">' + (a.summary || '') + '</p>' +
      (a.changes && a.changes.length ? '<p style="margin-top:8px"><b>Fix first:</b> ' + a.changes[0].what + '</p>' : '') +
      (a.insights ? '<ul style="margin-top:8px">' + a.insights.map(x => '<li>[' + x.kind + ' · f' + x.frame_index + '] ' + x.text + '</li>').join('') + '</ul>' : '');
    met.innerHTML = Object.entries(a.metrics || {}).map(([k, v]) =>
      '<div class="metric"><span class="k">' + k + '</span><span class="bar"><i style="width:' + v.score + '%"></i></span><b>' + v.score + '</b></div>'
    ).join('') || '<span class="muted">none</span>';
  } else {
    read.innerHTML = '<span class="muted">' + (r && r.error ? 'Run failed: ' + r.error : 'No model result yet. Run scripts/run-evals.mjs once API credits are available.') + '</span>';
    met.innerHTML = '<span class="muted">–</span>';
  }
}
load();
</script>`;

server.listen(PORT, () => {
  console.log(`rep review: http://localhost:${PORT} (${listCases().length} reps)`);
});
