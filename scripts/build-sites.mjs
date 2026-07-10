import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const distRoot = path.resolve(projectRoot, "dist");
const clientRoot = path.join(distRoot, "client");
const nextAppRoot = path.resolve(projectRoot, ".next/server/app");
const nextStaticRoot = path.resolve(projectRoot, ".next/static");
const publicRoot = path.resolve(projectRoot, "public");

if (!distRoot.startsWith(projectRoot + path.sep)) {
  throw new Error("Refusing to prepare a Sites build outside the project.");
}
if (!existsSync(path.join(nextAppRoot, "index.html"))) {
  throw new Error("Run the production build before preparing the Sites output.");
}

rmSync(distRoot, { recursive: true, force: true });
mkdirSync(clientRoot, { recursive: true });

cpSync(path.join(nextAppRoot, "index.html"), path.join(clientRoot, "index.html"));
if (existsSync(path.join(nextAppRoot, "_not-found.html"))) {
  cpSync(path.join(nextAppRoot, "_not-found.html"), path.join(clientRoot, "404.html"));
}
cpSync(nextStaticRoot, path.join(clientRoot, "_next/static"), { recursive: true });

for (const entry of readdirSync(publicRoot)) {
  cpSync(path.join(publicRoot, entry), path.join(clientRoot, entry), {
    recursive: true,
  });
}

mkdirSync(path.join(distRoot, ".openai"), { recursive: true });
cpSync(
  path.join(projectRoot, ".openai/hosting.json"),
  path.join(distRoot, ".openai/hosting.json"),
);

const launchPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <title>Launch film · Sideout</title>
    <meta name="robots" content="noindex,nofollow" />
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; background: #0f212c; color: #f2efe6; font-family: system-ui, sans-serif; }
      body { display: grid; min-height: 100svh; place-items: center; }
      main { width: 100%; }
      video { display: block; width: 100%; max-height: 100svh; background: #0f212c; }
      a { position: fixed; top: 1rem; left: 1rem; z-index: 2; border: 1px solid rgb(242 239 230 / .18); border-radius: .625rem; background: rgb(15 33 44 / .82); color: #f2efe6; padding: .75rem 1rem; font-weight: 700; text-decoration: none; backdrop-filter: blur(12px); }
      a:focus-visible { outline: 2px solid #e8b93b; outline-offset: 2px; }
    </style>
  </head>
  <body>
    <main aria-label="Sideout launch film">
      <a href="/">Back to site</a>
      <video src="/sideout-launch.mp4" poster="/volleyball-hero.webp" autoplay muted playsinline controls aria-label="Sideout launch film"></video>
    </main>
  </body>
</html>`;

mkdirSync(path.join(clientRoot, "launch"), { recursive: true });
writeFileSync(path.join(clientRoot, "launch/index.html"), launchPage);

const rootHtml = readFileSync(path.join(clientRoot, "index.html"), "utf8");
if (!rootHtml.includes("Turn every rep into a reason")) {
  throw new Error("The generated landing page is missing the analytics showcase.");
}

const worker = `function assetRequest(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (!env.ASSETS) {
      return new Response("Site assets are unavailable.", { status: 503 });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const hasExtension = /\\.[a-z0-9]+$/i.test(pathname);
    const candidates = pathname === "/"
      ? ["/index.html"]
      : pathname.endsWith("/")
        ? [pathname + "index.html"]
        : hasExtension
          ? [pathname]
          : [pathname, pathname + "/index.html"];

    for (const candidate of candidates) {
      const response = await env.ASSETS.fetch(assetRequest(request, candidate));
      if (response.status !== 404) return response;
    }

    const notFound = await env.ASSETS.fetch(assetRequest(request, "/404.html"));
    return new Response(notFound.body, {
      status: 404,
      headers: notFound.headers,
    });
  },
};
`;

mkdirSync(path.join(distRoot, "server"), { recursive: true });
writeFileSync(path.join(distRoot, "server/index.js"), worker);

console.log(`Prepared static Sites output in ${distRoot}.`);
