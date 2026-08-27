// Captures the live app at 3x device scale, driving the installed Chrome over
// the DevTools protocol. 3x is deliberate: the captures get composited into
// 1080x1920 store panels at roughly 0.7 scale, so shooting at 1x would leave
// the phone screen visibly soft.
//
// Lived in .cache/ until 2026-08-11, which is gitignored, so the whole store
// capture pipeline would have died with the next clone. Runs in two stages:
// this captures the raw screens, then scripts/store-panels.mjs frames them.
//
//   node scripts/shoot-store-panels.mjs                 capture every shot
//   node scripts/shoot-store-panels.mjs breakdown coach capture only those
//   node scripts/store-panels.mjs                       frame what was captured
//
// SHOOT_EMAIL/SHOOT_PASSWORD pick the account. Point them at the demo account
// to re-shoot against it instead of the owner's own.
import { readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;
const ORIGIN = "https://vollyio.com";
const OUT = path.resolve("G:/OneDrive/Documents/Projects/vollyio-android/play-assets/raw");
const WIDTH = 412;
const HEIGHT = 892;
const SCALE = 3;
const ACCOUNT = process.env.SHOOT_EMAIL;
if (!ACCOUNT) {
  console.error("shoot-store-panels: SHOOT_EMAIL is required.");
  process.exit(1);
}
const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";

const HERO = "cd3fe7d8-488e-46c0-8b5f-933640569914";

const SHOTS = [
  { name: "home", url: "/dashboard", settle: 3000 },
  {
    name: "analyze",
    url: "/analyze",
    settle: 2000,
    actions: [{ click: "Indoor" }, { click: "Attacking", after: 1600 }],
  },
  // A real coach turn, not a mocked bubble. This spends one paid call and one
  // hourly slot on the owner's own account.
  {
    name: "coach",
    url: "/coach",
    settle: 2500,
    actions: [
      { click: "New chat", after: 2500 },
      { click: "What should I work on first?", after: 35000 },
    ],
  },
  {
    name: "coach-probe",
    url: "/coach",
    settle: 2500,
    actions: [
      {
        eval: `[...document.querySelectorAll('button, a, [role="button"]')]
                 .map((n) => n.tagName + '<' + (n.innerText || '').trim() + '>')
                 .join(' | ')`,
      },
    ],
  },
  { name: "drills", url: "/drills", settle: 2500 },
  { name: "progress", url: "/progress", settle: 3500 },
  // The indoor Aug 9 attack carries the hero: it is the owner's own footage and
  // no bystander's face is legible, unlike the outdoor pass rep.
  {
    name: "breakdown-score",
    url: `/analysis/${HERO}`,
    settle: 5000,
    actions: [{ video: { time: 7.0 } }],
  },
  {
    name: "breakdown-fixes",
    url: `/analysis/${HERO}`,
    settle: 5000,
    actions: [{ video: { time: 7.0 } }, { scrollToText: "WHAT WORKED", offset: 620 }],
  },
];

function readEnv() {
  const env = {};
  for (const line of readFileSync("G:/OneDrive/Documents/Projects/vollyio/.env.local", "utf8").split(/\r?\n/)) {
    const match = /^\uFEFF?([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

async function mintCookies(env, email) {
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const verified = await anon.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "magiclink",
  });
  if (verified.error) throw verified.error;

  const jar = new Map();
  const written = [];
  const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => {
        for (const cookie of list) {
          jar.set(cookie.name, cookie.value);
          written.push({ name: cookie.name, value: cookie.value });
        }
      },
    },
  });
  const applied = await ssr.auth.setSession({
    access_token: verified.data.session.access_token,
    refresh_token: verified.data.session.refresh_token,
  });
  if (applied.error) throw applied.error;
  return written;
}

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
  const listeners = [];
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
      return;
    }
    for (const listener of listeners) listener(message);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const once = (method, timeout = 40000) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), timeout);
      const listener = (message) => {
        if (message.method === method) {
          clearTimeout(timer);
          listeners.splice(listeners.indexOf(listener), 1);
          resolve(message.params);
        }
      };
      listeners.push(listener);
    });
  return { ready, send, once, close: () => socket.close() };
}

const CLICK_BY_TEXT = (label) => `
  (() => {
    const wanted = ${JSON.stringify(label)}.trim().toLowerCase();
    const nodes = [...document.querySelectorAll('button, a, [role="button"], label')];
    const text = (node) => (node.innerText || '').trim().toLowerCase();
    // Several controls carry a description on a second line, so an exact match
    // is tried first and the leading label is the fallback.
    const hit =
      nodes.find((node) => text(node) === wanted) ??
      nodes.find((node) => text(node).split('\\n')[0].trim() === wanted);
    if (!hit) return 'MISS: ' + wanted;
    hit.scrollIntoView({ block: 'center' });
    hit.click();
    return 'OK: ' + wanted;
  })()
`;

const env = readEnv();
const only = process.argv.slice(2);
const shots = only.length ? SHOTS.filter((shot) => only.includes(shot.name)) : SHOTS;
if (!shots.length) throw new Error(`no shots matched: ${only.join(", ")}`);

const cookies = await mintCookies(env, ACCOUNT);
console.log(`signed in as ${ACCOUNT} (${cookies.length} cookie)`);

mkdirSync(OUT, { recursive: true });
const profileDir = path.join(tmpdir(), "vollyio-shoot-profile");
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
  await client.send("Network.enable");
  await client.send("Runtime.enable");

  const host = new URL(ORIGIN).hostname;
  for (const cookie of cookies) {
    await client.send("Network.setCookie", {
      name: cookie.name,
      value: cookie.value,
      domain: host,
      path: "/",
      secure: true,
      httpOnly: false,
      sameSite: "Lax",
    });
  }

  await client.send("Emulation.setUserAgentOverride", { userAgent: MOBILE_UA, platform: "Android" });
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: SCALE,
    mobile: true,
    screenWidth: WIDTH,
    screenHeight: HEIGHT,
  });
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  // Every reveal animation settles at its end state under reduced motion, so a
  // capture never lands mid-fade.
  await client.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });

  for (const shot of shots) {
    await client.send("Page.navigate", { url: `${ORIGIN}${shot.url}` });
    await client.once("Page.loadEventFired").catch(() => {});
    await sleep(shot.settle);

    for (const action of shot.actions ?? []) {
      if (action.click) {
        const result = await client.send("Runtime.evaluate", {
          expression: CLICK_BY_TEXT(action.click),
          returnByValue: true,
        });
        console.log(`    click ${result.result.value}`);
        await sleep(action.after ?? 1200);
      }
      if (action.eval) {
        const result = await client.send("Runtime.evaluate", {
          expression: action.eval,
          returnByValue: true,
        });
        console.log(`    eval ${JSON.stringify(result.result.value)}`);
        await sleep(action.after ?? 300);
      }
      if (action.video) {
        // The control bar only shows because the clip is paused and idle; a
        // player mid-rep never sees it. Seeking also gets a frame of the actual
        // attack instead of the pre-roll the poster lands on.
        const result = await client.send("Runtime.evaluate", {
          expression: `
            (() => {
              const video = document.querySelector('video');
              if (!video) return 'MISS';
              video.removeAttribute('controls');
              video.controls = false;
              video.currentTime = ${action.video.time ?? 0};
              return 'OK dur=' + (video.duration || 0).toFixed(1);
            })()
          `,
          returnByValue: true,
        });
        console.log(`    video ${result.result.value}`);
        await sleep(action.after ?? 1800);
      }
      if (action.scrollToText) {
        // The clip is sticky on this page, so an anchored scroll is the only
        // way to land the columns under it instead of behind the header.
        const result = await client.send("Runtime.evaluate", {
          expression: `
            (() => {
              const wanted = ${JSON.stringify(action.scrollToText)}.trim().toLowerCase();
              const node = [...document.querySelectorAll('h1,h2,h3,h4,p,div,span')]
                .find((el) => (el.textContent || '').trim().toLowerCase() === wanted);
              if (!node) return 'MISS';
              const top = node.getBoundingClientRect().top + window.scrollY - ${action.offset ?? 900};
              window.scrollTo({ top, behavior: 'instant' });
              return 'OK @' + Math.round(top);
            })()
          `,
          returnByValue: true,
        });
        console.log(`    anchor ${result.result.value}`);
        await sleep(action.after ?? 900);
      }
      if (action.scroll !== undefined) {
        await client.send("Runtime.evaluate", {
          expression: `window.scrollTo({ top: ${action.scroll}, behavior: 'instant' })`,
        });
        await sleep(700);
      }
    }

    const probe = await client.send("Runtime.evaluate", {
      expression: "JSON.stringify({ path: location.pathname, height: document.documentElement.scrollHeight })",
      returnByValue: true,
    });
    const { path: landed, height } = JSON.parse(probe.result.value);

    if (shot.full) {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: WIDTH,
        height: Math.min(height, 6000),
        deviceScaleFactor: SCALE,
        mobile: true,
        screenWidth: WIDTH,
        screenHeight: HEIGHT,
      });
      await sleep(1200);
    }

    const screenshot = await client.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      optimizeForSpeed: false,
    });
    const file = path.join(OUT, `${shot.name}.png`);
    writeFileSync(file, Buffer.from(screenshot.data, "base64"));
    console.log(`${shot.name.padEnd(13)} ${landed.padEnd(46)} h=${height}`);

    if (shot.full) {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: WIDTH,
        height: HEIGHT,
        deviceScaleFactor: SCALE,
        mobile: true,
        screenWidth: WIDTH,
        screenHeight: HEIGHT,
      });
    }
  }
  client.close();
} finally {
  chrome.kill();
}
