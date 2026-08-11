// Composites the raw captures into Play store panels and the feature graphic.
// Everything is authored as HTML on the app's own tokens and rendered by the
// installed Chrome at the exact output size, so the type is vector-crisp and
// only the phone screen is raster.
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9334;
const RAW = "G:/OneDrive/Documents/Projects/vollyio-android/play-assets/raw";
const OUT = "G:/OneDrive/Documents/Projects/vollyio-android/play-assets";
const WORK = "G:/Temp/claude/G--OneDrive-Documents-Projects-vollyio/bc05b4de-9a99-4179-bdb9-64a2d989b0e7/scratchpad/panels";
const COURT = "G:/OneDrive/Documents/Projects/vollyio/public/volleyball-hero.webp";
const MARK = "G:/OneDrive/Documents/Projects/vollyio/public/icon-mark.png";

const NAVY = "#0b1a23";
const CHALK = "#f2efe6";
const GOLD = "#e8b93b";
const MUTED = "#b9c4c9";

const FONTS = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">`;

const PANELS = [
  {
    name: "01-score",
    shot: "breakdown-score",
    kicker: "ONE CLIP, ONE SCORE",
    headline: "Scored like a coach.",
    sub: "A number out of 100, and the checkpoints behind it.",
  },
  {
    name: "02-fix",
    shot: "breakdown-fixes",
    kicker: "WHAT WORKED, WHAT TO CHANGE",
    headline: "The one fix that matters.",
    sub: "Named specifically, with the reason it costs you points.",
  },
  {
    name: "03-film",
    shot: "analyze",
    kicker: "SIX SKILLS",
    headline: "Film one rep.",
    sub: "Pick the skill, upload the clip. That is the whole flow.",
  },
  {
    name: "04-coach",
    shot: "coach",
    kicker: "ASK ANYTHING",
    headline: "Ask your coach.",
    sub: "Every answer is grounded in the reps you have filmed.",
  },
  {
    name: "05-progress",
    shot: "progress",
    kicker: "REP BY REP",
    headline: "Watch the line move.",
    sub: "A trend per skill, once there are enough reps to mean one.",
  },
  {
    name: "06-train",
    shot: "drills",
    kicker: "BEGINNER TO ELITE",
    headline: "Know what to practice.",
    sub: "Step-by-step drills matched to the fix you were given.",
  },
];

const shell = (width, height, body, css) => `<!doctype html>
<html><head><meta charset="utf-8">${FONTS}<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${width}px; height:${height}px; overflow:hidden; }
  body {
    background:${NAVY};
    color:${CHALK};
    font-family:'Instrument Sans', system-ui, sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  .court {
    position:absolute; inset:0;
    background:url('file:///${COURT}') center 30% / cover no-repeat;
    opacity:0.42;
  }
  .veil { position:absolute; inset:0; }
  .glow { position:absolute; border-radius:50%; filter:blur(90px); }
  ${css}
</style></head><body>${body}</body></html>`;

const panelHtml = (panel) =>
  shell(
    1080,
    1920,
    `
    <div class="court"></div>
    <div class="veil"></div>
    <div class="glow g1"></div>
    <div class="glow g2"></div>
    <div class="top">
      <div class="kicker">${panel.kicker}</div>
      <h1>${panel.headline}</h1>
      <p>${panel.sub}</p>
    </div>
    <div class="stage">
      <div class="halo"></div>
      <div class="phone"><img src="file:///${RAW}/${panel.shot}.png"></div>
    </div>`,
    `
    /* The photo only earns its place where there is room for it: the headline
       band above the device. Below that the device is the subject and any
       image behind it just reads as dirt. */
    /* Overscanned upward so the ball is cropped out rather than clipped by the
       top edge; the photo is 2:1 so background-position-y cannot do this. */
    .court {
      left:0; right:0; top:-180px; height:1140px;
      background:url('file:///${COURT}') 74% 0 / cover no-repeat;
      opacity:0.62;
      -webkit-mask-image:linear-gradient(180deg, #000 0%, #000 46%, rgba(0,0,0,0.42) 74%, transparent 100%);
    }
    .veil {
      background:
        linear-gradient(180deg, rgba(11,26,35,0.78) 0%, rgba(11,26,35,0.86) 16%, rgba(11,26,35,0.80) 34%, rgba(11,26,35,0.90) 48%, ${NAVY} 64%, ${NAVY} 100%);
    }
    .g1 { width:860px; height:600px; left:110px; top:300px; background:rgba(232,185,59,0.20); }
    .g2 { width:700px; height:520px; left:-140px; top:1380px; background:rgba(111,191,174,0.13); }
    .top { position:absolute; left:76px; right:76px; top:104px; text-align:center; }
    .kicker {
      font-family:'IBM Plex Mono', monospace; font-size:22px; letter-spacing:0.22em;
      color:${GOLD}; margin-bottom:26px;
    }
    h1 {
      font-family:'Space Grotesk', sans-serif; font-weight:700;
      font-size:76px; line-height:1.02; letter-spacing:-0.028em; margin-bottom:20px;
    }
    p { font-size:31px; line-height:1.36; color:${MUTED}; max-width:830px; margin:0 auto; }
    .stage { position:absolute; left:0; right:0; top:400px; display:flex; justify-content:center; }
    .halo {
      position:absolute; width:940px; height:940px; top:60px; border-radius:50%;
      background:radial-gradient(closest-side, rgba(232,185,59,0.24), transparent 70%);
      filter:blur(40px);
    }
    .phone {
      position:relative; width:700px; padding:11px; border-radius:52px;
      background:linear-gradient(158deg, #334754 0%, #1b2c37 42%, #0e1c25 100%);
      box-shadow:
        0 46px 110px rgba(0,0,0,0.62),
        0 0 0 1px rgba(242,239,230,0.10),
        inset 0 1px 0 rgba(242,239,230,0.16);
    }
    .phone img { display:block; width:100%; border-radius:42px; }`,
  );

const featureHtml = () =>
  shell(
    1024,
    500,
    `
    <div class="court"></div>
    <div class="veil"></div>
    <div class="glow g1"></div>
    <div class="glow g2"></div>
    <div class="wrap">
      <div class="left">
        <div class="brand"><img src="file:///${MARK}"><span>Vollyio</span></div>
        <h1>Film one rep.<br>Get the <em>one fix</em><br>that matters.</h1>
        <div class="skills">
          <span>Serve</span><span>Pass</span><span>Set</span><span>Attack</span><span>Block</span><span>Dig</span>
        </div>
      </div>
      <div class="right">
        <div class="halo"></div>
        <div class="phone"><img src="file:///${RAW}/breakdown-score.png"></div>
      </div>
    </div>`,
    `
    .court { background:url('file:///${COURT}') 70% 38% / 132% auto no-repeat; opacity:0.85; }
    .veil {
      background:
        linear-gradient(94deg, ${NAVY} 24%, rgba(11,26,35,0.86) 46%, rgba(11,26,35,0.46) 72%, rgba(11,26,35,0.62) 100%);
    }
    .g1 { width:560px; height:420px; left:560px; top:-40px; background:rgba(232,185,59,0.20); }
    .g2 { width:460px; height:340px; left:-120px; top:280px; background:rgba(111,191,174,0.14); }
    .wrap { position:absolute; inset:0; display:flex; align-items:center; padding:0 0 0 64px; }
    .left { width:590px; }
    .brand { display:flex; align-items:center; gap:14px; margin-bottom:26px; }
    .brand img { width:44px; height:44px; }
    .brand span {
      font-family:'Space Grotesk', sans-serif; font-weight:700; font-size:34px;
      letter-spacing:-0.015em; color:${CHALK};
    }
    h1 {
      font-family:'Space Grotesk', sans-serif; font-weight:700;
      font-size:58px; line-height:1.04; letter-spacing:-0.026em;
    }
    h1 em { font-style:normal; color:${GOLD}; }
    .skills {
      margin-top:30px; display:flex; gap:9px;
      font-family:'IBM Plex Mono', monospace; font-size:13px; letter-spacing:0.12em;
      color:${MUTED}; text-transform:uppercase;
    }
    .skills span { border:1px solid rgba(242,239,230,0.22); border-radius:999px; padding:8px 14px; }
    /* The device is pinned to the top edge and bleeds off the bottom. Centring
       it in a 500px band clips the app header, which reads as a mistake. */
    .right { position:relative; align-self:stretch; flex:1; }
    .halo {
      position:absolute; width:560px; height:560px; top:-40px; left:50%; margin-left:-280px;
      border-radius:50%;
      background:radial-gradient(closest-side, rgba(232,185,59,0.26), transparent 70%);
      filter:blur(30px);
    }
    .phone {
      position:absolute; top:34px; left:50%; margin-left:-166px;
      width:320px; padding:6px; border-radius:36px;
      background:linear-gradient(158deg, #334754 0%, #1b2c37 42%, #0e1c25 100%);
      box-shadow:
        0 30px 70px rgba(0,0,0,0.62),
        0 0 0 1px rgba(242,239,230,0.10),
        inset 0 1px 0 rgba(242,239,230,0.16);
    }
    .phone img { display:block; width:100%; border-radius:28px; }`,
  );

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pageSocket() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome has not opened the debugging port yet.
    }
    await sleep(250);
  }
  throw new Error("Chrome debugging port never came up");
}

function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 1;
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  return { ready, send, close: () => socket.close() };
}

mkdirSync(WORK, { recursive: true });
mkdirSync(OUT, { recursive: true });

const jobs = [
  ...PANELS.map((panel) => ({
    file: path.join(WORK, `${panel.name}.html`),
    html: panelHtml(panel),
    width: 1080,
    height: 1920,
    out: path.join(OUT, `screenshot-${panel.name}.png`),
  })),
  {
    file: path.join(WORK, "feature.html"),
    html: featureHtml(),
    width: 1024,
    height: 500,
    out: path.join(OUT, "feature-graphic-1024x500.png"),
  },
];
for (const job of jobs) writeFileSync(job.file, job.html);

const profileDir = path.join(tmpdir(), "vollyio-panels-profile");
rmSync(profileDir, { recursive: true, force: true });
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--disable-gpu",
    "--allow-file-access-from-files",
    "--force-color-profile=srgb",
    "--font-render-hinting=none",
    "about:blank",
  ],
  { stdio: "ignore" },
);

try {
  const client = connect(await pageSocket());
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");

  for (const job of jobs) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: job.width,
      height: job.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await client.send("Page.navigate", { url: `file:///${job.file.replace(/\\/g, "/")}` });
    await sleep(2200);
    // Webfonts decide the whole layout, so the capture waits on them rather
    // than on a fixed timer alone.
    await client.send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true });
    await sleep(600);

    const screenshot = await client.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: false });
    writeFileSync(job.out, Buffer.from(screenshot.data, "base64"));
    console.log(`${String(job.width).padStart(4)}x${job.height}  ${job.out}`);
  }
  client.close();
} finally {
  chrome.kill();
}
