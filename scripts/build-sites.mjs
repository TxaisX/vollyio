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

// The hosting manifest is a local, untracked config for the static host.
// Exporting without it is allowed; the check below keeps CI honest.
if (existsSync(path.join(projectRoot, ".openai/hosting.json"))) {
  mkdirSync(path.join(distRoot, ".openai"), { recursive: true });
  cpSync(
    path.join(projectRoot, ".openai/hosting.json"),
    path.join(distRoot, ".openai/hosting.json"),
  );
}

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
