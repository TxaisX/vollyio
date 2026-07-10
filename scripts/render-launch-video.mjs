import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const cdpUrl = process.env.CDP_URL;
const ffmpegPath = process.env.FFMPEG_PATH;
const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
const outputPath = path.resolve(
  process.env.OUTPUT_PATH ?? "public/sideout-launch.mp4",
);
const frameDirectory = path.resolve(
  process.env.FRAME_DIRECTORY ?? "C:/tmp/sideout-launch-frames",
);

if (!cdpUrl) throw new Error("CDP_URL is required.");
if (!ffmpegPath) throw new Error("FFMPEG_PATH is required.");
if (!frameDirectory.startsWith(path.resolve("C:/tmp") + path.sep)) {
  throw new Error("FRAME_DIRECTORY must stay inside C:/tmp.");
}

rmSync(frameDirectory, { recursive: true, force: true });
mkdirSync(frameDirectory, { recursive: true });

const socket = new WebSocket(cdpUrl);
let callId = 0;
let frameCount = 0;
let captureStart = 0;
const pending = new Map();
const timestamps = [];

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
    return;
  }
  if (message.method !== "Page.screencastFrame") return;

  const index = frameCount++;
  const name = `frame-${String(index).padStart(5, "0")}.jpg`;
  writeFileSync(
    path.join(frameDirectory, name),
    Buffer.from(message.params.data, "base64"),
  );
  timestamps.push(message.params.metadata.timestamp);
  void call("Page.screencastFrameAck", {
    sessionId: message.params.sessionId,
  });
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function call(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++callId;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
}

await call("Page.enable");
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
await call("Page.navigate", {
  url: `${siteUrl}/launch?capture=1&take=${Date.now()}`,
});
await new Promise((resolve) => setTimeout(resolve, 450));

await call("Page.startScreencast", {
  format: "jpeg",
  quality: 92,
  maxWidth: 1280,
  maxHeight: 720,
  everyNthFrame: 1,
});
captureStart = Date.now();
await new Promise((resolve) => setTimeout(resolve, 19_250));
await call("Page.stopScreencast");
socket.close();

if (frameCount < 90) {
  throw new Error(`Only ${frameCount} frames were captured.`);
}

const concat = ["ffconcat version 1.0"];
for (let index = 0; index < frameCount; index += 1) {
  const name = path.join(
    frameDirectory,
    `frame-${String(index).padStart(5, "0")}.jpg`,
  );
  const nextTimestamp = timestamps[index + 1];
  const duration = nextTimestamp
    ? Math.min(0.2, Math.max(0.02, nextTimestamp - timestamps[index]))
    : 0.08;
  concat.push(`file '${name.replaceAll("'", "'\\''")}'`);
  concat.push(`duration ${duration.toFixed(4)}`);
}
concat.push(
  `file '${path
    .join(frameDirectory, `frame-${String(frameCount - 1).padStart(5, "0")}.jpg`)
    .replaceAll("'", "'\\''")}'`,
);

const concatPath = path.join(frameDirectory, "frames.ffconcat");
writeFileSync(concatPath, concat.join("\n"));

const result = spawnSync(
  ffmpegPath,
  [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatPath,
    "-vf",
    "fps=30,format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "19",
    "-movflags",
    "+faststart",
    outputPath,
  ],
  { encoding: "utf8" },
);

if (result.status !== 0) {
  throw new Error(result.stderr || "Video encoding failed.");
}

console.log(
  JSON.stringify({
    outputPath,
    frameCount,
    captureSeconds: (Date.now() - captureStart) / 1000,
  }),
);
