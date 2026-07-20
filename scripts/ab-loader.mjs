// Resolves the "@/..." path alias so Node can import the real prompt modules.
// The A/B must run the prompt stack the product ships, not a copy of it.
import { pathToFileURL } from "node:url";
import path from "node:path";
const root = process.cwd();
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    for (const cand of [rel, `${rel}.ts`, `${rel}.tsx`, `${rel}/index.ts`]) {
      const p = path.join(root, cand);
      try {
        const { statSync } = await import("node:fs");
        if (statSync(p).isFile()) return next(pathToFileURL(p).href, context);
      } catch {}
    }
  }
  return next(specifier, context);
}
