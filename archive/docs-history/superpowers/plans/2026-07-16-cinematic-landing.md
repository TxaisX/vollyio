# Cinematic Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Sideout's landing hero and film-room handoff into one cinematic, product-true opening sequence.

**Architecture:** Keep `app/page.tsx` as a Server Component and extract the opening composition into a focused `CinematicHero` Server Component. The existing `CourtFilm` client boundary owns opt-in autoplay, truthful play/pause state, reduced motion, and data saver behavior. The hero court plate remains static until the visitor presses Play, while the dedicated film room autoplays in view. Styling stays in the established global component layer and uses only current tokens.

**Tech Stack:** Next.js 16.2, React 19, TypeScript, Tailwind 4 utilities, project CSS motion primitives, Node test runner.

## Global Constraints

- Use only the existing navy, chalk, gold, teal tokens and existing fonts.
- Preserve the current headline, product claims, primary CTA, pause control, and real court-film assets.
- `prefers-reduced-motion` always wins and must settle at a complete static composition.
- Motion uses transform and opacity only and must not shift layout.
- Do not add a dependency, replace native scrolling, commit, push, or deploy before owner review.
- Landing and dashboard Lighthouse performance must remain at least 90.

---

### Task 1: Cinematic hero and film-room handoff

**Files:**
- Create: `components/cinematic-hero.tsx`
- Create: `lib/landing-cinematic.test.ts`
- Modify: `components/court-film.tsx`
- Modify: `components/landing-nav.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `CourtFilm`, `Reveal`, `SeamArcs`, and existing `/sideout-hero-loop.*` assets.
- Produces: `CinematicHero(): React.ReactElement` and optional `CourtFilmProps.autoPlay`.

- [ ] **Step 1: Write the failing landing contract test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("the landing opens with a product-true spike film read", () => {
  const hero = read("components/cinematic-hero.tsx");
  assert.match(hero, /aria-hidden="true" className="hero-analysis-rail/);
  assert.match(hero, /Frame 12/);
  assert.match(hero, /value: "82"/);
  assert.match(hero, /Spike score/);
  assert.match(hero, /Analyze your first rep/);
  assert.doesNotMatch(hero, /cinematic-hero-camera/);
});

test("the film room resolves the hero before the explainer", () => {
  const page = read("app/page.tsx");
  assert.ok(page.indexOf('id="film"') < page.indexOf('id="how"'));
});

test("the hero film has no camera-transform hook", () => {
  const film = read("components/court-film.tsx");
  assert.doesNotMatch(film, /mediaClassName/);
  assert.match(film, /className="absolute inset-0 h-full w-full object-cover"/);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test lib/landing-cinematic.test.ts`

Expected: FAIL because `components/cinematic-hero.tsx` and the spike readout do not exist.

- [ ] **Step 3: Implement the focused cinematic composition**

Create `CinematicHero` with the existing headline, CTA, film assets, play control, and decorative spike-analysis rail. Add `autoPlay?: boolean` to `CourtFilmProps`, set the hero to `autoPlay={false}`, keep manual playback immediate, and expose truthful play/pause state. Retain in-view autoplay for the dedicated film room. Replace the inline hero in `app/page.tsx` with `<CinematicHero />`, move the existing film-room section directly after it, and order `LandingNav` links as Film room, How it works, Analytics, Skills, Progress, FAQ.

Add component-layer CSS for `.cinematic-hero`, `.cinematic-hero-aperture`, `.hero-title-focus`, `.hero-analysis-rail`, `.hero-analysis-cell`, and `.cinematic-film-section`. Keep the court plate free of camera transforms and leave the poster branch static.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `node --test lib/landing-cinematic.test.ts`

Expected: the focused cinematic contract passes.

- [ ] **Step 5: Run project and browser verification**

Run: `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test`, and `npm.cmd run build`.

Expected: every command exits 0. Inspect `/` at desktop and 390x844, verify keyboard focus and the film pause control, verify the reduced-motion static state, and keep the final local dev tab open for owner review. Do not commit or push.
