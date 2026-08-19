import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourceRoots = ["app", "components", "content", "lib"];
const sourceExtensions = new Set([".ts", ".tsx"]);
const copyRoots = ["app", "components", "content"];
const copyFiles = new Set(["lib/frames.ts", "lib/ai/mock.ts", "lib/auth-errors.ts"]);
const copyExclusions = ["lib/ai/rubrics/"];
const failures = [];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function report(file, source, position, message) {
  const { line, character } = source.getLineAndCharacterOfPosition(position);
  failures.push(`${file}:${line + 1}:${character + 1} ${message}`);
}

function literalText(node) {
  if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) return node.text;
  if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
    return node.text;
  }
  return null;
}

function isModuleSpecifier(node) {
  const parent = node.parent;
  if (!parent) return false;
  return (
    ((ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) &&
      parent.moduleSpecifier === node) ||
    (ts.isExternalModuleReference(parent) && parent.expression === node)
  );
}

for (const absolute of sourceRoots.flatMap((dir) => walk(join(root, dir)))) {
  if (!sourceExtensions.has(extname(absolute))) continue;
  const file = relative(root, absolute).replaceAll("\\", "/");
  const text = readFileSync(absolute, "utf8");
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const checksTokens =
    file.startsWith("components/") ||
    (file.startsWith("app/") &&
      !file.endsWith("/layout.tsx") &&
      !file.endsWith("/manifest.ts") &&
      !file.endsWith("/opengraph-image.tsx"));
  if (checksTokens) {
    const colorPattern = /#[0-9a-f]{3,8}\b|\brgba?\(\s*\d|\bhsla?\(\s*\d|font-family\s*:/gi;
    for (const match of text.matchAll(colorPattern)) {
      report(file, source, match.index, "hardcoded color or font; use a design token");
    }
  }

  const checksCopy =
    (copyRoots.some((dir) => file.startsWith(`${dir}/`)) || copyFiles.has(file)) &&
    !copyExclusions.some((dir) => file.startsWith(dir));

  function visit(node) {
    if (checksCopy) {
      const value = literalText(node);
      if (
        !isModuleSpecifier(node) &&
        /\b(?:Anthropic|Claude|OpenAI|Supabase|Vercel)\b/i.test(value ?? "")
      ) {
        report(file, source, node.getStart(source), "user-facing copy contains a vendor name");
      }

      // PRECISION THE SCORING PATH CANNOT PRODUCE.
      // The live read samples roughly one low-resolution image per second, so
      // no frame index and no sub-second timestamp sits behind anything the
      // UI says. Copy citing one is a false statement about the product, and
      // it had shipped twice: the landing page advertised "cited: frame 6,
      // t=1.2s" and the film scene "Priority fix, frame 12". Both are gone;
      // this stops them being retyped.
      if (
        !isModuleSpecifier(node) &&
        /\bframes?\s*[#:]?\s*\d|\bt\s*=\s*\d+(?:\.\d+)?\s*s\b/i.test(value ?? "")
      ) {
        report(
          file,
          source,
          node.getStart(source),
          "copy cites a frame or timestamp; the scoring path samples ~1 low-res image per second and cannot support one",
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  for (const match of text.matchAll(/\bdebugger\b|console\.log\s*\(/g)) {
    report(file, source, match.index, "debug code is not allowed in production source");
  }
  // Vollyio house rule: no em dashes anywhere in source (copy OR comments) --
  // they read as machine-written. Use a comma or a hyphen instead.
  for (const match of text.matchAll(/—/g)) {
    report(file, source, match.index, "em dash is not allowed (vollyio rule); use a comma or hyphen");
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Policy lint passed.");
}
