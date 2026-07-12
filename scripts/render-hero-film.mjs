// Renders the /film loop (components/film-scene.tsx) to a seamless MP4 plus
// a WebP poster, using deterministic Web Animations stepping: every animation
// on the page is paused and its currentTime is set explicitly before each
// screenshot, so frame i is exactly the loop at t = i/fps regardless of when
// elements mounted or how wall-clock time passes. Every scene animation is
// FILM_SECONDS-periodic, so the 300-frame window loops without a seam.
//
// Usage (Linux cloud session):
//   CHROME_PATH=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell \
//   FFMPEG_PATH=... SITE_URL=http://localhost:3001 VARIANT=film \
//   OUTPUT_PATH=public/sideout-court-vision.mp4 \
//   POSTER_PATH=public/sideout-court-vision-poster.webp POSTER_FRAME=186 \
//   node scripts/render-hero-film.mjs

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const chromePath = process.env.CHROME_PATH;
const ffmpegPath = process.env.FFMPEG_PATH;
const siteUrl = process.env.SITE_URL ?? "http://localhost:3001";
const variant = process.env.VARIANT ?? "film";
const outputPath = path.resolve(process.env.OUTPUT_PATH ?? `public/sideout-${variant}.mp4`);
const posterPath = process.env.POSTER_PATH ? path.resolve(process.env.POSTER_PATH) : null;
const posterFrame = Number(process.env.POSTER_FRAME ?? 0);
const fps = 30;
const seconds = Number(process.env.FILM_SECONDS ?? 10);
const frameTotal = fps * seconds;
const frameDirectory = path.join(tmpdir(), `sideout-film-frames-${variant}`);

if (!chromePath) throw new Error("CHROME_PATH is required.");
if (!ffmpegPath) throw new Error("FFMPEG_PATH is required.");

rmSync(frameDirectory, { recursive: true, force: true });
mkdirSync(frameDirectory, { recursive: true });

const port = 9222 + Math.floor(Math.random() * 500);
const chrome = spawn(
  chromePath,
  [
    `--remote-debugging-port=${port}`,
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--disable-threaded-animation",
    "--disable-threaded-scrolling",
    "--run-all-compositor-stages-before-draw",
    "--window-size=1280,720",
    "about:blank",
  ],
  { stdio: "ignore" },
);
process.on("exit", () => chrome.kill());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let target = null;
for (let attempt = 0; attempt < 40 && !target; attempt += 1) {
  await sleep(250);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json`);
    const list = await res.json();
    target = list.find((t) => t.type === "page");
  } catch {
    // Chrome not listening yet.
  }
}
if (!target) throw new Error("Could not reach Chrome DevTools.");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let callId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
});

function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++callId;
    pending.set(id, (message) => {
      if (message.error) reject(new Error(`${method}: ${message.error.message}`));
      else resolve(message.result);
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression, awaitPromise = false) {
  const { result } = await call("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  return result?.value;
}

await call("Page.enable");
await call("Runtime.enable");
await call("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 720,
  deviceScaleFactor: 1,
  mobile: false,
  screenWidth: 1280,
  screenHeight: 720,
});
await call("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
});
await call("Page.navigate", { url: `${siteUrl}/film?variant=${variant}` });
await sleep(1500);
await evaluate("document.fonts.ready.then(() => true)", true);
await evaluate(
  "Promise.all([...document.images].map((i) => i.decode().catch(() => null))).then(() => true)",
  true,
);
await sleep(500);

// Pause every animation and drive the timeline by hand: frame i is the loop
// at exactly t = cycle + i/fps (one full cycle in, so fill states are past).
const animationCount = await evaluate("document.getAnimations().length");
if (!animationCount) throw new Error("No animations found on /film.");

const cycleMs = seconds * 1000;
async function seek(timeMs) {
  await evaluate(
    `(() => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = ${timeMs};
      }
      return new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))),
      );
    })()`,
    true,
  );
}

const frameStep = 1000 / fps;
for (let index = 0; index <= frameTotal; index += 1) {
  await seek(cycleMs + index * frameStep);
  const shot = await call("Page.captureScreenshot", { format: "png" });
  const name = index === frameTotal ? "frame-seam.png" : `frame-${String(index).padStart(5, "0")}.png`;
  writeFileSync(path.join(frameDirectory, name), Buffer.from(shot.data, "base64"));
}

socket.close();
chrome.kill();

const encode = spawnSync(
  ffmpegPath,
  [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    path.join(frameDirectory, "frame-%05d.png"),
    "-frames:v",
    String(frameTotal),
    "-vf",
    "format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "20",
    "-movflags",
    "+faststart",
    outputPath,
  ],
  { encoding: "utf8" },
);
if (encode.status !== 0) throw new Error(encode.stderr || "Video encoding failed.");

if (posterPath) {
  const poster = spawnSync(
    ffmpegPath,
    [
      "-y",
      "-i",
      path.join(frameDirectory, `frame-${String(posterFrame).padStart(5, "0")}.png`),
      "-c:v",
      "libwebp",
      "-quality",
      "82",
      posterPath,
    ],
    { encoding: "utf8" },
  );
  if (poster.status !== 0) throw new Error(poster.stderr || "Poster encoding failed.");
}

console.log(JSON.stringify({ outputPath, posterPath, frameTotal, frameDirectory }));
