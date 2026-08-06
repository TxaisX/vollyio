// One-window labeler for the unlabeled eval cases: frames and the decision on
// the same screen, keyboard-driven, saving per case.
//
// `label-case.mjs` asks the right questions but shows nothing, so labeling meant
// running `review-evals.mjs` in one window to watch the rep and typing metric
// keys blind in another. That is why 0 of 18 got labeled. This serves the frames
// the case already carries (base64 in the JSON) next to the metric keys for its
// skill, and writes exactly the fields `label-case.mjs` writes, so coverage,
// provenance, and the CLI stay interchangeable.
//
//   node scripts/label-evals.mjs              # tracked set, unlabeled only
//   node scripts/label-evals.mjs --all        # include already-labeled, to revise
//   node scripts/label-evals.mjs --scratch    # local ingest scratch instead
//   node scripts/label-evals.mjs --port 4751
//
// Keys: space play/pause, arrows step frames, 1-9 weakest metric,
// shift+1-9 acceptable alternative, u unknown, s skip, enter save and next.

import { createServer } from "node:http";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { METRICS } from "../lib/ai/metrics.ts";
import { resolveCasesDir } from "./eval-cases-dir.mjs";

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const PORT = Number(flag("port", 4751));
const CASES_DIR = resolveCasesDir(argv);
const INCLUDE_LABELED = argv.includes("--all");

if (!existsSync(CASES_DIR)) {
  console.error(`no case directory at ${CASES_DIR}`);
  process.exit(1);
}

// Same predicate as label-case.mjs: an excluded case is not a gap, and either a
// key or a reviewer-confirmed abstention counts as decided.
function needsLabel(c) {
  const e = c.expected ?? {};
  const hasWeakest =
    Boolean(e.weakest_metric) || (e.acceptable_weakest_metrics ?? []).length > 0;
  return c.excluded !== true && !hasWeakest && e.weakest_metric_unknown !== true;
}

function readCase(id) {
  return JSON.parse(readFileSync(path.join(CASES_DIR, `${id}.json`), "utf8"));
}

function safeId(raw) {
  const id = decodeURIComponent(raw).replace(/[^a-z0-9-]/gi, "");
  return existsSync(path.join(CASES_DIR, `${id}.json`)) ? id : null;
}

function queue() {
  const rows = [];
  let labeled = 0;
  let excluded = 0;
  for (const file of readdirSync(CASES_DIR).sort()) {
    if (!file.endsWith(".json")) continue;
    let c;
    try {
      c = readCase(file.replace(/\.json$/, ""));
    } catch {
      continue;
    }
    if (c.excluded === true) {
      excluded++;
      continue;
    }
    const open = needsLabel(c);
    if (!open) labeled++;
    if (!open && !INCLUDE_LABELED) continue;
    const e = c.expected ?? {};
    rows.push({
      id: c.id,
      skill: c.skill,
      discipline: c.discipline,
      level: c.level,
      done: !open,
      weakest: e.weakest_metric || null,
      unknown: e.weakest_metric_unknown === true,
    });
  }
  // Round-robin across skills so a partial session still spans the suite,
  // matching how eval-label-plan.mjs orders its proposal.
  const bySkill = new Map();
  for (const r of rows) {
    if (!bySkill.has(r.skill)) bySkill.set(r.skill, []);
    bySkill.get(r.skill).push(r);
  }
  const skills = [...bySkill.keys()].sort();
  const ordered = [];
  for (let round = 0; ordered.length < rows.length; round++) {
    let added = false;
    for (const s of skills) {
      const pool = bySkill.get(s);
      if (round < pool.length) {
        ordered.push(pool[round]);
        added = true;
      }
    }
    if (!added) break;
  }
  return { dir: CASES_DIR, cases: ordered, labeled, excluded, metrics: METRICS };
}

function save(body) {
  const id = safeId(String(body.id ?? ""));
  if (!id) return { ok: false, error: "unknown case id" };
  const file = path.join(CASES_DIR, `${id}.json`);
  const c = readCase(id);
  const keys = (METRICS[c.skill] ?? []).map((m) => m.key);
  const e = (c.expected ??= {});
  const note = String(body.note ?? "").trim();

  if (body.unknown === true) {
    const why = String(body.why ?? "").trim();
    e.weakest_metric_unknown = true;
    delete e.weakest_metric;
    delete e.acceptable_weakest_metrics;
    if (why) e.notes = e.notes ? `${e.notes} | abstain: ${why}` : `abstain: ${why}`;
  } else {
    const weakest = String(body.weakest ?? "").trim();
    // Refuse rather than coerce: a key that is not on this skill's metric list
    // would be a label the scorer can never match.
    if (!keys.includes(weakest)) {
      return { ok: false, error: `"${weakest}" is not a ${c.skill} metric key` };
    }
    e.weakest_metric = weakest;
    delete e.weakest_metric_unknown;
    const alts = (Array.isArray(body.alternates) ? body.alternates : [])
      .map((s) => String(s).trim())
      .filter((s) => keys.includes(s) && s !== weakest)
      .slice(0, 2);
    if (alts.length) e.acceptable_weakest_metrics = alts;
    else delete e.acceptable_weakest_metrics;
  }

  // The expected score band. Optional, because a reviewer who is sure about
  // the weakest mechanic but not about a number should be able to say so, and
  // half a label beats a guessed one. Both ends or neither: a one-sided band
  // is the placeholder shape isVacuousBand() exists to reject.
  const lo = Number(body.overall_min);
  const hi = Number(body.overall_max);
  if (Number.isFinite(lo) && Number.isFinite(hi)) {
    if (lo < 0 || hi > 100 || lo >= hi) {
      return { ok: false, error: `band ${lo}-${hi} must be 0..100 with min < max` };
    }
    if (lo <= 0 && hi >= 100) {
      return { ok: false, error: "a 0-100 band admits every score; that is not a label" };
    }
    e.overall_min = lo;
    e.overall_max = hi;
  }

  if (note) e.notes = e.notes ? `${e.notes} | ${note}` : note;

  const reviewer = String(body.reviewer ?? "").trim();
  if (reviewer) {
    e.labeled_by = reviewer;
    e.labeled_at = new Date().toISOString().slice(0, 10);
  }
  writeFileSync(file, `${JSON.stringify(c, null, 2)}\n`);
  return { ok: true, id };
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(PAGE);
    } else if (url.pathname === "/queue") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(queue()));
    } else if (url.pathname.startsWith("/case/")) {
      const id = safeId(url.pathname.slice(6));
      if (!id) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(readFileSync(path.join(CASES_DIR, `${id}.json`), "utf8"));
    } else if (url.pathname === "/save" && req.method === "POST") {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => {
        let out;
        try {
          out = save(JSON.parse(raw));
        } catch (e) {
          out = { ok: false, error: String(e?.message ?? e) };
        }
        res.writeHead(out.ok ? 200 : 400, { "content-type": "application/json" });
        res.end(JSON.stringify(out));
        if (out.ok) console.log(`saved ${out.id}`);
      });
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
<title>Eval labeler</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { --navy:#0f212c; --navy2:#16303f; --chalk:#f2efe6; --dim:#b9c4c9; --gold:#e8b93b; --teal:#6fbfae; --coral:#e2604f; }
  * { box-sizing: border-box; margin: 0; }
  body { background: var(--navy); color: var(--chalk); font: 15px/1.5 system-ui, sans-serif; padding: 16px 20px 24px; }
  .top { display:flex; justify-content:space-between; align-items:baseline; gap:12px; flex-wrap:wrap; }
  h1 { font-size: 17px; }
  .hint, .muted { color: var(--dim); font-size: 12px; }
  input { background: var(--navy); color: var(--chalk); border:1px solid rgba(242,239,230,.25); border-radius:8px; padding:6px 10px; font:inherit; font-size:13px; }
  input:focus { outline:none; border-color: var(--gold); }
  .cols { margin-top: 12px; display:grid; gap:16px; grid-template-columns:1fr; align-items:start; }
  @media (min-width: 1000px) { .cols { grid-template-columns: 1.25fr .75fr; } }
  .card { background: var(--navy2); border-radius:12px; padding:14px 16px; }
  .card h2 { font-size:11px; letter-spacing:.1em; text-transform:uppercase; color: var(--gold); margin-bottom:10px; }
  #stage { background:#000; border-radius:10px; display:flex; align-items:center; justify-content:center; min-height:320px; overflow:hidden; }
  #stage img { max-width:100%; max-height:62vh; display:block; }
  .strip { display:flex; gap:6px; overflow-x:auto; margin-top:10px; padding-bottom:4px; }
  .strip img { height:56px; border-radius:6px; opacity:.45; cursor:pointer; border:2px solid transparent; }
  .strip img.on { opacity:1; border-color: var(--gold); }
  .controls { display:flex; gap:10px; align-items:center; margin-top:10px; flex-wrap:wrap; font-size:13px; }
  .meta { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:10px; }
  .chip { border:1px solid rgba(242,239,230,.25); border-radius:999px; padding:2px 12px; font-size:12px; }
  .chip.gold { border-color: var(--gold); color: var(--gold); }
  button { background: var(--navy2); color: var(--chalk); border:1px solid rgba(242,239,230,.25); border-radius:10px; padding:8px 14px; font:inherit; font-size:13px; cursor:pointer; }
  button:hover { border-color: var(--gold); }
  button.primary { background: var(--gold); color: var(--navy); border-color: var(--gold); font-weight:700; }
  .opt { display:flex; align-items:center; gap:10px; width:100%; text-align:left; margin:6px 0; padding:9px 12px; }
  .opt .num { width:18px; color: var(--dim); font-variant-numeric: tabular-nums; }
  .opt .w { margin-left:auto; color: var(--dim); font-size:12px; }
  .opt.sel { border-color: var(--gold); background: rgba(232,185,59,.14); }
  .opt.alt { border-color: var(--teal); }
  .opt.alt .w::after { content:" · alt"; color: var(--teal); }
  .opt.unk.sel { border-color: var(--coral); background: rgba(226,96,79,.16); }
  .notes { color: var(--dim); font-size:13px; margin-top:8px; }
  .row { display:flex; gap:8px; margin-top:12px; align-items:center; flex-wrap:wrap; }
  .row input { flex:1; min-width:180px; }
  #status { font-size:12px; color: var(--teal); min-height:18px; margin-top:6px; }
  #status.err { color: var(--coral); }
  ol.queue { list-style:none; padding:0; font-size:12px; max-height:220px; overflow:auto; }
  ol.queue li { padding:3px 0; color: var(--dim); cursor:pointer; }
  ol.queue li.on { color: var(--chalk); }
  ol.queue li.done { color: var(--teal); }
</style>
<div class="top">
  <h1 id="title">Loading…</h1>
  <div class="row" style="margin:0">
    <label class="hint" for="rev">reviewer</label>
    <input id="rev" size="6" placeholder="TX">
    <span class="hint" id="progress"></span>
  </div>
</div>
<div class="hint">space play · &larr; &rarr; frame · 1-9 weakest · shift+1-9 alternative · u unknown · s skip · enter save &amp; next</div>
<div class="cols">
  <div>
    <div class="meta" id="meta"></div>
    <div id="stage"><span class="muted">no frames</span></div>
    <div class="strip" id="strip"></div>
    <div class="controls">
      <button id="play">Play</button>
      <span class="muted" id="frameLabel"></span>
      <label class="muted">speed <input id="speed" type="range" min="120" max="900" value="420" step="20" style="vertical-align:middle"></label>
    </div>
    <div class="card" style="margin-top:12px"><h2>Case notes</h2><div class="notes" id="caseNotes"></div></div>
  </div>
  <div>
    <div class="card">
      <h2>Weakest metric</h2>
      <div id="opts"></div>
      <div class="row"><input id="why" placeholder="why unresolvable (unknown only)"></div>
      <div class="row">
        <label class="hint" for="lo">expected score</label>
        <input id="lo" size="3" placeholder="min" inputmode="numeric">
        <span class="muted">to</span>
        <input id="hi" size="3" placeholder="max" inputmode="numeric">
        <span class="muted" id="bandHint">0-100, optional</span>
      </div>
      <div class="row"><input id="note" placeholder="optional note appended to the case"></div>
      <div class="row">
        <button class="primary" id="save">Save &amp; next</button>
        <button id="skip">Skip</button>
      </div>
      <div id="status"></div>
    </div>
    <div class="card" style="margin-top:12px">
      <h2>Queue</h2>
      <ol class="queue" id="queue"></ol>
    </div>
  </div>
</div>
<script>
var Q = null, idx = 0, cur = null, frames = [], fi = 0, timer = null;
var weakest = null, alts = [], unknown = false;

var el = function (id) { return document.getElementById(id); };
el("rev").value = localStorage.getItem("evalReviewer") || "";
el("rev").addEventListener("change", function () {
  localStorage.setItem("evalReviewer", el("rev").value.trim());
});

function loadQueue(keepId) {
  return fetch("/queue").then(function (r) { return r.json(); }).then(function (q) {
    Q = q;
    if (!q.cases.length) {
      el("title").textContent = "Nothing left to label in " + q.dir;
      el("progress").textContent = q.labeled + " labeled";
      return;
    }
    if (keepId) {
      var at = q.cases.findIndex(function (c) { return c.id === keepId; });
      idx = at === -1 ? Math.min(idx, q.cases.length - 1) : at;
    }
    renderQueue();
    return loadCase();
  });
}

function renderQueue() {
  el("queue").innerHTML = "";
  Q.cases.forEach(function (c, i) {
    var li = document.createElement("li");
    li.textContent = (c.done ? "\\u2713 " : "\\u00b7 ") + c.skill + "  " + c.id;
    li.className = (i === idx ? "on " : "") + (c.done ? "done" : "");
    li.onclick = function () { idx = i; loadCase(); };
    el("queue").appendChild(li);
  });
  var open = Q.cases.filter(function (c) { return !c.done; }).length;
  el("progress").textContent = Q.labeled + " labeled \\u00b7 " + open + " left";
}

function loadCase() {
  stop();
  weakest = null; alts = []; unknown = false;
  el("why").value = ""; el("note").value = ""; el("status").textContent = "";
  el("lo").value = ""; el("hi").value = "";
  var row = Q.cases[idx];
  el("title").textContent = row.id;
  return fetch("/case/" + row.id).then(function (r) { return r.json(); }).then(function (c) {
    cur = c;
    frames = c.frames || [];
    fi = 0;
    el("meta").innerHTML = "";
    [c.skill, c.discipline, c.level, "play " + c.play_index + "/" + c.play_count,
     frames.length + " frames"].forEach(function (t, i) {
      var s = document.createElement("span");
      s.className = "chip" + (i === 0 ? " gold" : "");
      s.textContent = t;
      el("meta").appendChild(s);
    });
    var e = c.expected || {};
    var bits = [];
    if (c.classification && c.classification.action_summary) bits.push(c.classification.action_summary);
    if (e.notes) bits.push(e.notes);
    if (e.strongest_metric) bits.push("strongest (recorded): " + e.strongest_metric);
    if (e.overall_min != null) bits.push("band " + e.overall_min + "-" + e.overall_max);
    el("caseNotes").textContent = bits.join("  |  ") || "none";
    renderFrames();
    showFrame(0);
    renderOpts();
    renderQueue();
  });
}

// Both the strip and the stage get their images built once per case and then
// only toggled, so playback swaps visibility instead of re-decoding a ~100 KB
// data URI every tick, which flickers.
function renderFrames() {
  el("strip").innerHTML = "";
  el("stage").innerHTML = "";
  if (!frames.length) {
    el("stage").innerHTML = '<span class="muted">no frames</span>';
    el("frameLabel").textContent = "";
    return;
  }
  frames.forEach(function (f, i) {
    var src = "data:image/jpeg;base64," + f.data;
    var thumb = new Image();
    thumb.src = src;
    thumb.onclick = function () { stop(); showFrame(i); };
    el("strip").appendChild(thumb);
    var big = new Image();
    big.src = src;
    big.style.display = "none";
    el("stage").appendChild(big);
  });
}

function showFrame(i) {
  if (!frames.length) return;
  fi = (i + frames.length) % frames.length;
  var big = el("stage").children;
  for (var j = 0; j < big.length; j++) big[j].style.display = j === fi ? "block" : "none";
  el("frameLabel").textContent = "frame " + (fi + 1) + "/" + frames.length + " \\u00b7 t=" + frames[fi].time_s + "s";
  var thumbs = el("strip").children;
  for (var k = 0; k < thumbs.length; k++) thumbs[k].className = k === fi ? "on" : "";
}

function play() {
  stop();
  timer = setInterval(function () { showFrame(fi + 1); }, Number(el("speed").value));
  el("play").textContent = "Pause";
}
function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  el("play").textContent = "Play";
}
el("play").onclick = function () { timer ? stop() : play(); };
el("speed").oninput = function () { if (timer) play(); };

function metricsFor() { return (Q.metrics[cur.skill] || []); }

function renderOpts() {
  var box = el("opts");
  box.innerHTML = "";
  metricsFor().forEach(function (m, i) {
    var b = document.createElement("button");
    b.className = "opt" + (weakest === m.key ? " sel" : "") + (alts.indexOf(m.key) !== -1 ? " alt" : "");
    b.innerHTML = '<span class="num">' + (i + 1) + '</span><span>' + m.label +
      ' <span class="muted">' + m.key + '</span></span><span class="w">w' + m.weight + '</span>';
    b.onclick = function (ev) { ev.shiftKey ? toggleAlt(m.key) : pick(m.key); };
    box.appendChild(b);
  });
  var u = document.createElement("button");
  u.className = "opt unk" + (unknown ? " sel" : "");
  u.innerHTML = '<span class="num">u</span><span>unknown \\u2014 footage does not isolate one fault</span>';
  u.onclick = function () { pickUnknown(); };
  box.appendChild(u);
}

function pick(key) { weakest = key; unknown = false; alts = alts.filter(function (a) { return a !== key; }); renderOpts(); }
function pickUnknown() { unknown = true; weakest = null; alts = []; renderOpts(); el("why").focus(); }
function toggleAlt(key) {
  if (key === weakest) return;
  var at = alts.indexOf(key);
  if (at !== -1) alts.splice(at, 1);
  else if (alts.length < 2) { alts.push(key); unknown = false; }
  renderOpts();
}

function next() {
  if (idx < Q.cases.length - 1) { idx++; loadCase(); }
  else loadQueue();
}
el("skip").onclick = function () { next(); };

el("save").onclick = function () {
  if (!unknown && !weakest) { fail("pick a metric, or unknown"); return; }
  // The CLI asks for initials before it shows the first case. This one has a
  // field sitting in the corner, which is how 18 labels got written with no
  // reviewer on them. A label nobody stands behind is not provenance.
  if (!el("rev").value.trim()) { fail("enter your reviewer initials first"); el("rev").focus(); return; }
  var body = {
    id: cur.id,
    weakest: weakest,
    unknown: unknown,
    alternates: alts,
    why: el("why").value,
    note: el("note").value,
    overall_min: el("lo").value.trim(),
    overall_max: el("hi").value.trim(),
    reviewer: el("rev").value.trim(),
  };
  fetch("/save", { method: "POST", body: JSON.stringify(body) })
    .then(function (r) { return r.json(); })
    .then(function (out) {
      if (!out.ok) { fail(out.error); return; }
      el("status").className = "";
      el("status").textContent = "saved " + out.id;
      var savedId = cur.id;
      var row = Q.cases[idx];
      row.done = true;
      Q.labeled++;
      if (idx < Q.cases.length - 1) { idx++; loadCase(); }
      else loadQueue(savedId);
    });
};

function fail(msg) { el("status").className = "err"; el("status").textContent = msg; }

document.addEventListener("keydown", function (ev) {
  if (ev.target.tagName === "INPUT") {
    if (ev.key === "Enter") el("save").click();
    return;
  }
  var m = metricsFor();
  if (ev.key === " ") { ev.preventDefault(); timer ? stop() : play(); }
  else if (ev.key === "ArrowRight") { stop(); showFrame(fi + 1); }
  else if (ev.key === "ArrowLeft") { stop(); showFrame(fi - 1); }
  else if (ev.key === "ArrowDown") { ev.preventDefault(); next(); }
  else if (ev.key === "u" || ev.key === "U") pickUnknown();
  else if (ev.key === "s" || ev.key === "S") next();
  else if (ev.key === "Enter") el("save").click();
  else if (/^Digit[1-9]$/.test(ev.code)) {
    // Off ev.code, not ev.key: shift+3 is "#" on a US layout and something else
    // everywhere else, and the alternate picker has to work on both.
    var n = Number(ev.code.slice(5)) - 1;
    if (m[n]) ev.shiftKey ? toggleAlt(m[n].key) : pick(m[n].key);
  }
});

loadQueue();
</script>
`;

server.listen(PORT, () => {
  const q = queue();
  console.log(
    `labeling ${q.cases.length} case(s) from ${CASES_DIR} (${q.labeled} already labeled, ${q.excluded} excluded)`,
  );
  console.log(`open http://localhost:${PORT}`);
  console.log("each save writes its case file; stopping part-way keeps the saves.");
});
