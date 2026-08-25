import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * THE BUG THIS PINS, found by probing the live site on 2026-08-25.
 *
 * `app/(app)/layout.tsx` sets `robots: { index: false, follow: false }` for the
 * whole (app) group, which is correct: the dashboard, history, progress and
 * settings must never be indexed. But three PUBLIC library pages live in the
 * same group and inherited it, so `app/sitemap.ts` was advertising 41 URLs that
 * each served a noindex tag: /learn, /learn/rehab, and all 39 rehab entries.
 *
 * Google obeys the page over the sitemap, so the entire injury library was
 * deindexed while being submitted for crawl. The sitemap's own comment calls
 * those "the highest-intent pages on the site", and reach is the product's
 * stated commercial blocker, so this was silently losing the exact traffic the
 * content was written to earn.
 *
 * The tell was already on every one of those pages: each set a `canonical`,
 * which only means "here is the URL to rank this content under". A page that
 * declares a canonical and also says noindex is asking for two contradictory
 * things, and that contradiction is what this asserts against.
 *
 * Nothing else could catch it. The pages render, the metadata is valid, and
 * every gate stays green whichever way the robots flag points.
 */

const APP_GROUP = new URL("../app/(app)/", import.meta.url);

async function pageFiles(dir: URL): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      found.push(...(await pageFiles(new URL(`${entry.name}/`, dir))));
    } else if (entry.name === "page.tsx") {
      found.push(fileURLToPath(new URL(entry.name, dir)));
    }
  }
  return found;
}

const PAGES = await Promise.all(
  (await pageFiles(APP_GROUP)).map(async (path) => ({
    path: path.replaceAll("\\", "/").slice(path.replaceAll("\\", "/").indexOf("/app/") + 1),
    source: await readFile(path, "utf8"),
  })),
);

test("the (app) group is still noindex by default, which is what makes the rest of this matter", async () => {
  const layout = await readFile(new URL("layout.tsx", APP_GROUP), "utf8");
  assert.match(
    layout,
    /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/,
    "the (app) layout must keep denying indexing by default; the signed-in " +
      "surfaces depend on it and every override below is written against it",
  );
});

test("a page that declares a canonical must also override the group's noindex", () => {
  const wantsToRank = PAGES.filter((p) => /alternates:\s*\{\s*canonical/.test(p.source));

  assert.ok(
    wantsToRank.length >= 6,
    `expected at least 6 public library pages in the (app) group, found ${wantsToRank.length}`,
  );

  for (const page of wantsToRank) {
    assert.match(
      page.source,
      /robots:\s*\{\s*index:\s*true/,
      `${page.path} sets a canonical but inherits the group's noindex, so it is ` +
        "asking Google to rank a page it also tells Google to skip",
    );
  }
});

test("every route family the sitemap advertises is served by an indexable page", async () => {
  const sitemap = await readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8");

  // The sitemap builds URLs from template literals, so the families are read
  // off the source rather than by executing it: this test must keep working
  // when a new family is added, and fail when that family's page forgets the
  // robots override.
  const families: { url: RegExp; page: string }[] = [
    { url: /\$\{SITE_URL\}\/learn`/, page: "app/(app)/learn/page.tsx" },
    { url: /\$\{SITE_URL\}\/learn\/rehab`/, page: "app/(app)/learn/rehab/page.tsx" },
    {
      url: /\$\{SITE_URL\}\/learn\/rehab\/\$\{entry\.slug\}`/,
      page: "app/(app)/learn/rehab/[slug]/page.tsx",
    },
    { url: /\$\{SITE_URL\}\/learn\/\$\{skill\}`/, page: "app/(app)/learn/[skill]/page.tsx" },
    { url: /\$\{SITE_URL\}\/drills`/, page: "app/(app)/drills/page.tsx" },
    {
      url: /\$\{SITE_URL\}\/drills\/\$\{drill\.slug\}`/,
      page: "app/(app)/drills/[slug]/page.tsx",
    },
  ];

  for (const family of families) {
    assert.match(
      sitemap,
      family.url,
      `the sitemap no longer lists the family served by ${family.page}; if that ` +
        "was deliberate, remove it from this list too",
    );
    const page = PAGES.find((p) => p.path === family.page);
    assert.ok(page, `${family.page} is listed in the sitemap but does not exist`);
    assert.match(
      page.source,
      /robots:\s*\{\s*index:\s*true/,
      `${family.page} is advertised in the sitemap but does not override the ` +
        "group's noindex, so every URL in that family is submitted and refused",
    );
  }
});
