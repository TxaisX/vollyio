# Metadata (Lisa, Phase 0)

Per-route titles and descriptions, `generateMetadata` copy for the two dynamic routes, the Open Graph reconciliation, the section 10.6 logo name, and voice alt text for volleyball visuals. Same voice law as `docs/copy.md`: second person, plain sentences, no em dashes, no vendor names.

## 0. Separator decision (affects every title)
The shipped brand strings use an em dash: title default `Sideout — Volleyball Form Coach`, template `%s — Sideout`, manifest `name`, OG title, Twitter title, and the OG image `alt`. An em dash in a tab title is user-visible copy and breaches the voice law. Replace the em dash with the middot `·`, which is already the brand's separator glyph everywhere in the UI (the font-mono `·` between meta items). This keeps the wordmark intact and removes the violation.

- New default title: `Sideout · Volleyball Form Coach`
- New template: `%s · Sideout`

Flagged as a change to already-shipped strings. If the owner wants to keep the em-dash wordmark, that is a Ditto call; absent a ruling, ship the middot. All titles below assume the `%s · Sideout` template, so each route sets only the `%s` part.

---

## 1. Reconciliation: shipped vs. missing/changed

### Already shipped (do NOT duplicate)
- Root layout (`app/layout.tsx`): `metadataBase` (SITE_URL), `title.default` + `title.template`, `description`, `openGraph` (type/siteName/title/description), `twitter` (summary_large_image), `applicationName`, `appleWebApp`, `alternates.canonical`, `robots.index`.
- `app/opengraph-image.tsx`: 1200x630 OG image with the `SIDEOUT` wordmark, "6 skills scored", "0–100, frame by frame", "Fix the one thing holding your game back.", and `alt` set.
- Auth per-route: `/login` title `Log in` + description; `/signup` title `Sign up` + description.
- `/offline`: title `Offline` + `robots: noindex`.

### Missing or changed (the work)
1. Em-dash correction on all brand strings (section 0): layout `title.default`, `title.template`, `manifest.ts` `name`, layout `openGraph.title`, layout `twitter.title`, and `opengraph-image.tsx` `alt`.
2. App routes with no title today: `/dashboard`, `/analyze`, `/coach`, `/goals`, `/scoreboard`, `/history`, `/drills` (section 2).
3. `analysis/[id]`: no `generateMetadata` (section 3).
4. `drills/[slug]`: no `generateMetadata`, currently inherits the generic title, an SEO/shareability gap (section 3).
5. OG mark: the OG image carries the wordmark text but not the gold ring-and-sprout mark from `public/icon-512.png`; section 10.6 requires the mark in the OG image (section 4).
6. Drills indexability: `/drills` and `/drills/[slug]` sit inside `(app)/layout.tsx`, which sets `robots: { index:false }`. To realize the "static and indexable" intent, these two routes must override with `robots: { index:true, follow:true }` in their own metadata. Whether the routes are actually reachable without auth is a `proxy.ts` decision for Dave; the metadata override is noted here so it is not missed. All other app routes stay noindex.

The landing route (`/`) needs no page-level `export const metadata`: the root `title.default` is the landing title and `alternates.canonical` is `/`. Covered.

---

## 2. Per-route titles and descriptions

Marketing and auth routes are indexable; descriptions matter for search. App routes are noindex (except drills), so descriptions are for completeness and internal consistency.

| Route | Title (`%s`) | Description |
|---|---|---|
| `/` (landing) | *(root default)* `Sideout · Volleyball Form Coach` | `Record a rep, get frame-by-frame form analysis for every volleyball skill.` (shipped) |
| `/login` | `Log in` | `Log in to your Sideout account.` (shipped) |
| `/signup` | `Sign up` | `Create your Sideout account and get your first breakdown free.` (shipped) |
| `/offline` | `Offline` | *(none; noindex)* |
| `/dashboard` | `Dashboard` | `Your rolling skill rating, daily challenge, goals, and recent breakdowns.` |
| `/analyze` | `Analyze a rep` | `Record or upload a rep and get it scored frame by frame.` |
| `/coach` | `Coach` | `Ask your coach anything. Every answer comes from your own scores and goals.` |
| `/goals` | `Goals` | `Aim each training block at one number instead of vague reps.` |
| `/scoreboard` | `Scoreboard` | `Keep the score for a live match, set by set.` |
| `/history` | `History` | `Every rep you have filmed, with the priority fix for each.` |
| `/drills` | `Drills` | `Step-by-step drills for every volleyball skill, beginner to elite.` (set `robots: index` to make it indexable) |

Implementation note: app routes set `export const metadata = { title: "…", description: "…" }` at the top of each `page.tsx`. `/coach`, `/dashboard`, `/analyze`, `/goals`, `/scoreboard`, `/history` are `dynamic = "force-dynamic"` server components; a static `metadata` export is fine alongside that.

---

## 3. generateMetadata copy (dynamic routes)

### app/(app)/analysis/[id]/page.tsx
Private, per-user data (rows filtered by `user_id`), so keep it `noindex`. The title and description make the tab and any pasted-link preview legible. Fetch the minimal columns in `generateMetadata` (skill, overall_score, result.priority_fix.title); return a not-found title when the row is missing.

- Title: `${SKILL_LABEL[skill]} breakdown, ${score}/100`
  - renders as, e.g., `Serving breakdown, 78/100 · Sideout`
- Description (second person): `Your ${SKILL_LABEL[skill].toLowerCase()} rep scored ${score} out of 100. Priority fix: ${priorityFixTitle}`
  - e.g. `Your serving rep scored 78 out of 100. Priority fix: Toss six inches further into the court.`
- Missing row: `{ title: "Breakdown not found" }`
- `robots: { index: false, follow: false }`

### app/(app)/drills/[slug]/page.tsx
Static, public content, meant to be indexable and shareable. `drill.summary` is already a complete sentence in instructional voice; use it as the description.

- Title: `${drill.name}`
  - renders as, e.g., `Toss and Freeze · Sideout`
- Description: `${drill.summary}`
  - e.g. `Isolate a repeatable serving toss by tossing to a fixed height and freezing to check placement before ever striking the ball.`
- OpenGraph: `{ title: \`${drill.name} · Sideout\`, description: drill.summary }`
- `robots: { index: true, follow: true }` (overrides the app-layout noindex)
- Missing slug (bad `[slug]`): `{ title: "Drill not found", robots: { index: false } }`

---

## 4. Landing / Open Graph plan

The landing OG is already wired at the root; the plan below is the delta only.

- Keep the existing `openGraph` block in `app/layout.tsx` and the auto-detected `app/opengraph-image.tsx`. Apply the em-dash-to-middot fix (section 0) to `openGraph.title`, `twitter.title`, and the image `alt`.
- OG image `alt` (corrected, no em dash): `Sideout: record a rep and get a frame-by-frame breakdown of every volleyball skill.`
- Add the mark (10.6): render the gold ring-and-sprout from `public/icon-512.png` inside `app/opengraph-image.tsx` alongside the `SIDEOUT` wordmark (top-left lockup). The mark is decorative within the composed image; the message-level `alt` above already carries meaning, so no separate description of the logo is needed. Keep the image on-token (navy field, gold mark, chalk text); no new colors.
- Per-route OG: only `drills/[slug]` (public) sets its own `openGraph` (section 3). `analysis/[id]` stays private/noindex and does not need a public OG. Other app routes inherit the site OG, which is correct.
- Twitter: `summary_large_image` inherits the OG image via the Next convention; no separate `twitter-image` needed.

---

## 5. Section 10.6 accessible logo name

The mark links home in two headers. When the visible wordmark text `Sideout` is present, keep it as the accessible name and mark the icon graphic `aria-hidden`; set the link's accessible name to `Sideout, home` so the destination is clear.

| WHERE | LINK TARGET | ACCESSIBLE NAME |
|---|---|---|
| `components/landing-nav.tsx` logo `<Link href="/">` | landing home | aria-label: `Sideout, home` (icon `aria-hidden`, wordmark visible) |
| `app/(app)/layout.tsx` sidebar logo `<Link href="/dashboard">` | app home (dashboard) | aria-label: `Sideout, home` (icon `aria-hidden`, wordmark visible) |
| `app/page.tsx` footer wordmark | not a link | no accessible name needed |

The logo link is a tap target: 44px minimum. Adding the mark must not regress the `landing-nav` mobile menu, the skip link, or `app-nav` accessibility items.

---

## 6. Volleyball visual alt text (section 10.3)

No assets are sourced yet (`docs/assets.md` is empty). Alt text rules and ready-to-use strings for the likely candidates so Jerry can drop them in when an asset lands.

### Rules
- Alt text describes what the image shows, plainly, and names the skill and the moment. It does not editorialize or use filler.
- Purely ambient or decorative media (a court texture, a blurred rally behind a hero, motion loops that carry no information) get `aria-hidden` and an empty `alt`, never a description.
- If a visual animates or autoplays, it falls back to a still poster under reduced motion; the poster carries the same alt text.
- No vendor names, no em dashes.

### Ready alt text per skill (for an action still or poster)
| Skill | Alt text |
|---|---|
| serve | `A player at full reach, striking a serve at the top of the toss.` |
| pass | `A player low over a flat platform, passing a driven ball.` |
| set | `A setter under the ball, hands framed above the forehead at release.` |
| attack | `A hitter at the peak of the approach, arm cocked to swing.` |
| block | `A blocker pressing over the net, hands angled into the court.` |
| dig | `A defender sprawled low, platform extended to dig a hard-driven ball.` |

### Decorative / ambient
| Use | Handling |
|---|---|
| court, net, or rally texture behind a hero or section | `aria-hidden`, empty `alt` |
| looping ambient motion (no information conveyed) | `aria-hidden`, empty `alt`, still poster under reduced motion |

Every shipped asset must also be logged in `docs/assets.md` with source, license, dimensions, reduced-motion behavior, and this alt text before it ships.
