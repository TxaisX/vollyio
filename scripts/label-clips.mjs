// Blind coach labeling for the calibration corpus.
//
// The model's own number is deliberately NOT shown while labeling. Anchoring is
// the failure mode this whole exercise exists to fix, and a reviewer who can
// see 78 on the screen writes down 78.
//
// One clip at a time, keyboard driven, one keystroke per label. The bands are
// the rubric's own bands (lib/ai/simple-rubric.ts SCALE) so a label lands
// directly on the scale being calibrated rather than needing a translation
// nobody can audit later.
//
//   node scripts/label-clips.mjs [--corpus evals/corpus] [--out evals/labels.json] [--port 4751]
//
// Labels are written after every keystroke, so closing the tab loses nothing.

import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, statSync, createReadStream } from "node:fs";
import path from "node:path";

const args = {};
{
  const rest = process.argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i]?.startsWith("--")) args[rest[i].slice(2)] = rest[++i];
  }
}
const CORPUS = args.corpus ?? "evals/corpus";
const OUT = args.out ?? "evals/labels.json";
const PORT = Number(args.port ?? 4751);

const manifest = JSON.parse(readFileSync(path.join(CORPUS, "manifest.json"), "utf8"));
const labels = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { by_id: {} };
labels.by_id ??= {};

// The rubric's bands, with the midpoint each one implies. The midpoint is what
// the calibration fit consumes; the band is what a coach can actually judge in
// ten seconds without pretending to a precision nobody has.
const BANDS = [
  { key: "1", label: "No technique", hint: "no recognisable technique for this skill", mid: 5 },
  { key: "2", label: "Beginner", hint: "beginner mechanics", mid: 17 },
  { key: "3", label: "Improvising", hint: "gets the ball up, not repeatably", mid: 30 },
  { key: "4", label: "Rough", hint: "recognisable, a fault changed the outcome", mid: 40 },
  { key: "5", label: "Developing", hint: "shape is right, details break under speed", mid: 50 },
  { key: "6", label: "Competent", hint: "executes it, with a habit that costs consistency", mid: 60 },
  { key: "7", label: "Good", hint: "works, fundamentals there, two things to sharpen", mid: 70 },
  { key: "8", label: "Strong", hint: "sound throughout, one clear refinement", mid: 80 },
  { key: "9", label: "Excellent", hint: "complete and repeatable, rest is stylistic", mid: 89 },
  { key: "0", label: "Flawless", hint: "you would teach the skill with this clip", mid: 97 },
];

function save() {
  labels.updated_at = new Date().toISOString();
  writeFileSync(OUT, JSON.stringify(labels, null, 2));
}

function ordered(skill) {
  // Unlabeled first, in manifest order, so a session always opens on work.
  const pool = skill ? manifest.filter((m) => m.skill === skill) : manifest;
  const todo = pool.filter((m) => !labels.by_id[m.id]);
  const done = pool.filter((m) => labels.by_id[m.id]);
  return [...todo, ...done];
}

/**
 * Per-skill progress. At 415 clips nobody labels the corpus in one sitting, and
 * a single global counter cannot tell you that serves are done and digs are
 * untouched, which is the thing that decides what to open next.
 */
function progress() {
  const out = {};
  for (const m of manifest) {
    const row = (out[m.skill] ??= { total: 0, done: 0 });
    row.total++;
    if (labels.by_id[m.id]) row.done++;
  }
  return out;
}

const page = () => `<!doctype html>
<meta charset="utf-8"><title>Vollyio clip labeling</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; font:15px/1.5 ui-sans-serif,system-ui,sans-serif; background:#0b1020; color:#e8ecf8; }
  header { display:flex; gap:16px; align-items:baseline; padding:10px 16px; border-bottom:1px solid #223; }
  header b { font-size:17px; }
  .muted { color:#8b96b4; }
  main { display:grid; grid-template-columns: minmax(0,1fr) 340px; gap:16px; padding:16px; }
  video { width:100%; max-height:70vh; background:#000; border-radius:8px; }
  ol { list-style:none; margin:0; padding:0; }
  li { display:flex; gap:10px; align-items:baseline; padding:7px 9px; border-radius:6px; }
  li kbd { background:#1b2340; border:1px solid #33406b; border-radius:5px; padding:1px 7px; font:13px ui-monospace,monospace; }
  li.on { background:#1c3a2a; outline:1px solid #2f7d55; }
  .hint { color:#8b96b4; font-size:13px; }
  .bar { height:6px; background:#1b2340; border-radius:3px; overflow:hidden; margin-top:8px; }
  .bar i { display:block; height:100%; background:#4ea87a; }
  footer { padding:10px 16px; border-top:1px solid #223; color:#8b96b4; font-size:13px; }
  .skill { text-transform:capitalize; color:#ffd479; }
  #filters button { background:#141a30; color:#8b96b4; border:1px solid #263155; border-radius:999px;
    padding:3px 10px; margin-right:5px; font:12px inherit; cursor:pointer; text-transform:capitalize; }
  #filters button.on { background:#1c3a2a; color:#e8ecf8; border-color:#2f7d55; }
</style>
<header>
  <b id="pos"></b><span class="skill" id="skill"></span><span class="muted" id="meta"></span>
  <span id="filters"></span>
  <span class="muted" style="margin-left:auto" id="count"></span>
</header>
<main>
  <div>
    <video id="v" controls autoplay loop muted playsinline></video>
    <div class="bar"><i id="prog"></i></div>
  </div>
  <div>
    <p class="hint">How well was THIS REP executed? Grade the rep, not the player's level.</p>
    <ol id="bands"></ol>
    <p class="hint"><kbd>X</kbd> can't rate this clip (wrong skill, too far, cut off, too dark)<br>
    <kbd>&larr;</kbd> <kbd>&rarr;</kbd> move &middot; <kbd>N</kbd> add a note &middot; labels save instantly</p>
  </div>
</main>
<footer id="status">loading</footer>
<script>
const BANDS = ${JSON.stringify(BANDS)};
let items = [], i = 0, labels = {}, prog = {}, skill = null;
const el = (id) => document.getElementById(id);

async function boot() {
  const r = await fetch('/api/state' + (skill ? '?skill=' + skill : '')).then((r) => r.json());
  items = r.items; labels = r.labels; prog = r.progress; i = 0;
  drawFilters();
  draw();
}
function drawFilters() {
  const skills = Object.keys(prog).sort();
  document.getElementById('filters').innerHTML =
    ['<button data-s="">all</button>']
      .concat(skills.map((s) =>
        '<button data-s="' + s + '" class="' + (skill === s ? 'on' : '') + '">' +
        s + ' ' + prog[s].done + '/' + prog[s].total + '</button>')).join('');
  document.querySelectorAll('#filters button').forEach((b) =>
    b.addEventListener('click', () => { skill = b.dataset.s || null; boot(); }));
}
function draw() {
  const it = items[i];
  if (!it) return;
  el('pos').textContent = (i + 1) + '/' + items.length;
  el('skill').textContent = it.skill;
  el('meta').textContent = it.discipline + ' · ' + (it.duration_s ? it.duration_s.toFixed(1) + 's' : '');
  const done = items.filter((x) => labels[x.id]).length;
  el('count').textContent = done + ' labeled · ' + (items.length - done) + ' left' + (skill ? ' in ' + skill : '');
  el('prog').style.width = (100 * done / Math.max(1, items.length)) + '%';
  const v = el('v');
  if (v.dataset.id !== it.id) { v.src = '/clip/' + encodeURIComponent(it.file); v.dataset.id = it.id; }
  const cur = labels[it.id];
  el('bands').innerHTML = BANDS.map((b) =>
    '<li class="' + (cur && cur.band === b.key ? 'on' : '') + '"><kbd>' + b.key + '</kbd>' +
    '<span><b>' + b.label + '</b><br><span class="hint">' + b.hint + '</span></span></li>').join('');
  el('status').textContent = cur
    ? (cur.unratable ? 'marked: cannot rate' : 'marked: ' + cur.label + (cur.note ? ' — ' + cur.note : ''))
    : 'unlabeled';
}
async function put(body) {
  const it = items[i];
  const before = labels[it.id];
  labels[it.id] = (await fetch('/api/label', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: it.id, ...body }),
  }).then((r) => r.json())).label;
  if (!before && prog[it.skill]) { prog[it.skill].done++; drawFilters(); }
  draw();
  setTimeout(() => { if (i < items.length - 1) { i++; draw(); } }, 120);
}
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey) return;
  const band = BANDS.find((b) => b.key === e.key);
  if (band) { put({ band: band.key, label: band.label, mid: band.mid }); return; }
  if (e.key.toLowerCase() === 'x') { put({ unratable: true, label: 'cannot rate' }); return; }
  if (e.key === 'ArrowRight') { i = Math.min(items.length - 1, i + 1); draw(); }
  if (e.key === 'ArrowLeft') { i = Math.max(0, i - 1); draw(); }
  if (e.key.toLowerCase() === 'n') {
    const note = prompt('Note for this clip:');
    if (note) fetch('/api/label', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: items[i].id, note, merge: true }) }).then((r) => r.json())
      .then((r) => { labels[items[i].id] = r.label; draw(); });
  }
});
boot();
</script>`;

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(page());
    return;
  }
  if (url.pathname === "/api/state") {
    res.writeHead(200, { "content-type": "application/json" });
    // shipped_score is stripped, not merely unrendered. Blind means blind, and
    // a number sitting in a devtools network tab is not blind.
    const skill = url.searchParams.get("skill") || null;
    const items = ordered(skill).map(({ shipped_score, shipped_version, source, ...rest }) => rest);
    res.end(JSON.stringify({ items, labels: labels.by_id, progress: progress() }));
    return;
  }
  if (url.pathname === "/api/label" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const b = JSON.parse(body);
      const prev = labels.by_id[b.id] ?? {};
      const next = b.merge
        ? { ...prev, note: b.note ?? prev.note }
        : {
            band: b.band ?? null,
            label: b.label,
            // The band midpoint on the 0-100 scale. The fit consumes this; the
            // band is what the coach actually chose.
            mid: b.mid ?? null,
            unratable: b.unratable === true,
            note: prev.note ?? null,
            at: new Date().toISOString(),
          };
      labels.by_id[b.id] = next;
      save();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ label: next }));
    });
    return;
  }
  if (url.pathname.startsWith("/clip/")) {
    const file = path.join(CORPUS, decodeURIComponent(url.pathname.slice("/clip/".length)));
    if (!existsSync(file) || !path.resolve(file).startsWith(path.resolve(CORPUS))) {
      res.writeHead(404).end("no clip");
      return;
    }
    const size = statSync(file).size;
    const type = file.endsWith(".webm") ? "video/webm" : file.endsWith(".mov") ? "video/quicktime" : "video/mp4";
    // Range support, because a 40 MB clip that cannot seek is a clip nobody
    // will label thirty of.
    const range = req.headers.range;
    if (range) {
      const [s, e] = range.replace(/bytes=/, "").split("-");
      const start = Number(s);
      const end = e ? Number(e) : size - 1;
      res.writeHead(206, {
        "content-range": `bytes ${start}-${end}/${size}`,
        "accept-ranges": "bytes",
        "content-length": end - start + 1,
        "content-type": type,
      });
      createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { "content-length": size, "content-type": type, "accept-ranges": "bytes" });
    createReadStream(file).pipe(res);
    return;
  }
  res.writeHead(404).end("nope");
}).listen(PORT, () => {
  const todo = manifest.filter((m) => !labels.by_id[m.id]).length;
  console.log(`label-clips: http://localhost:${PORT}  (${manifest.length} clips, ${todo} unlabeled)`);
});
