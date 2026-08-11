import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");

test("the landing opens with a product-true spike film read", () => {
  const hero = read("components/cinematic-hero.tsx");
  const styles = read("app/globals.css");

  assert.match(hero, /aria-hidden="true" className="hero-analysis-rail/);
  assert.match(hero, /Whole rep/);
  assert.match(hero, /value: "82"/);
  assert.match(hero, /Spike score/);
  assert.match(hero, /Checkpoints read/);
  assert.doesNotMatch(hero, /°/);
  // D-033 again, and the reason the readout no longer says "Frame 12". The
  // video path samples about one frame per second and /api/analyze returns no
  // instant at all (`timeAt = () => null`), so a frame number or a timestamp
  // in the hero advertises a precision that was deliberately removed. The
  // count is five because every skill in METRICS has exactly five checkpoints.
  assert.doesNotMatch(hero, /Frame \d/);
  assert.doesNotMatch(hero, /exact frame/);
  assert.doesNotMatch(hero, /timestamp/i);
  assert.match(hero, /Analyze your first rep/);
  assert.match(hero, /autoPlay=\{false\}/);
  assert.doesNotMatch(hero, /playDelayMs/);
  assert.doesNotMatch(hero, /Serve score/);
  assert.doesNotMatch(hero, /cinematic-hero-camera/);
  assert.doesNotMatch(styles, /@keyframes cinematic-camera/);
});

test("no user-facing surface claims per-frame precision, not just the hero", () => {
  // THE GUARD ABOVE HAD A HOLE AND THE HOLE SHIPPED. 6e351ba pulled the
  // frame-timing claims off the landing page, the hero and the Terms, and the
  // test that pinned that fix read `components/cinematic-hero.tsx` and nothing
  // else. `app/manifest.ts` went on saying "frame-by-frame form analysis" for
  // another day, which is the worst surface of the lot to be wrong on: the
  // manifest description is what an install prompt and a store listing read
  // out, so it is the promise made to somebody who has not opened the app yet.
  //
  // D-033's rule is about the PRODUCT, not about one component, so the check
  // has to cover every surface a stranger reads. Adding a file here costs one
  // line; forgetting to costs a claim nobody is looking for.
  // Ordered roughly by how far the string travels from someone who has never
  // opened the app. The first four are read by MACHINES, which is why they all
  // survived a sweep that rewrote what people read: they reach a search result,
  // an answer engine, a share card and an install prompt first.
  const SURFACES = [
    "app/layout.tsx", // meta description on every page, and the OG card
    "app/opengraph-image.tsx", // the share card image itself
    "app/manifest.ts", // install prompt and store listing
    "app/page.tsx", // JSON-LD for search and answer engines
    "app/film/page.tsx",
    "app/(app)/analyze/page.tsx",
    "app/samples/page.tsx",
    "components/cinematic-hero.tsx",
    "components/analytics-showcase.tsx",
    "app/(legal)/terms/page.tsx",
    "app/(legal)/privacy/page.tsx",
    "lib/site.ts",
  ];

  // NOT swept, and each for a reason worth stating so nobody "finishes the job"
  // by mistake:
  //   components/clip-viewer.tsx and most of analyze-flow.tsx say "frame by
  //   frame" about the frame STRIP, which is a real strip of real frames. That
  //   is a description of a UI element, not a claim about analysis.
  //   lib/ai/rubrics/index.ts instructs the model to work through frames and
  //   cite frame indices. That is the FRAME path's prompt, it is internal, and
  //   the instruction is accurate for the path that uses it.

  // The claim FAMILY, not one string. "frame-by-frame" survived precisely
  // because the earlier sweep hunted the exact phrases it had already found.
  const FORBIDDEN: [RegExp, string][] = [
    [/frame[- ]by[- ]frame/i, "the video path samples about one frame per second"],
    [/frame[- ]level/i, "there is no frame-level output on the video path"],
    [/exact frame/i, "no frame is identified as the one"],
    [/timestamp/i, "/api/analyze sets timeAt = () => null"],
    [/\bFrame \d/, "a frame number implies an index the row does not carry"],
  ];

  for (const surface of SURFACES) {
    const body = read(surface);
    if (body === "") continue;
    for (const [pattern, why] of FORBIDDEN) {
      assert.doesNotMatch(
        body,
        pattern,
        `${surface} promises precision the engine does not have: ${why}`,
      );
    }
  }
});

test("the film room resolves the hero before the explainer", () => {
  const page = read("app/page.tsx");
  const filmIndex = page.indexOf('id="film"');
  const howIndex = page.indexOf('id="how"');

  assert.notEqual(filmIndex, -1);
  assert.notEqual(howIndex, -1);
  assert.ok(filmIndex < howIndex);
});

test("the hero film has no camera-transform hook", () => {
  const film = read("components/court-film.tsx");

  assert.match(film, /autoPlay\?: boolean/);
  assert.doesNotMatch(film, /playDelayMs/);
  assert.doesNotMatch(film, /mediaClassName/);
  assert.match(film, /absolute inset-0 h-full w-full object-cover/);
  assert.match(film, /preload="none"/);
});

test("the manual hero film reports playback truthfully", () => {
  const film = read("components/court-film.tsx");

  assert.match(film, /const \[isPlaying, setIsPlaying\] = useState\(false\)/);
  assert.match(film, /onPlaying=\{\(\) => setIsPlaying\(true\)\}/);
  assert.match(film, /onPause=\{\(\) => setIsPlaying\(false\)\}/);
  assert.match(film, /aria-label=\{isPlaying \? "Pause the film" : "Play the film"\}/);
  assert.match(
    film,
    /function handlePlaybackToggle\(\)[\s\S]*?if \(video\.paused\)[\s\S]*?video\.play\(\)/,
  );
});

test("a user-paused autoplay film stays paused after leaving the viewport", () => {
  const film = read("components/court-film.tsx");

  assert.match(film, /const \[userPaused, setUserPaused\] = useState\(false\)/);
  assert.match(film, /if \(!video \|\| !autoPlay \|\| userPaused\) return/);
  assert.match(film, /setUserPaused\(false\)[\s\S]*?video\.play\(\)/);
  assert.match(film, /setUserPaused\(true\)[\s\S]*?video\.pause\(\)/);
  assert.match(film, /\[autoPlay, reducedMotion, stillOnly, userPaused\]/);
});

test("switching to a still poster resets the playback label", () => {
  const film = read("components/court-film.tsx");

  assert.match(
    film,
    /useEffect\(\(\) => \{[\s\S]*?if \(!reducedMotion && !stillOnly\) return;[\s\S]*?videoRef\.current\?\.pause\(\);[\s\S]*?setIsPlaying\(false\);[\s\S]*?\}, \[reducedMotion, stillOnly\]\)/,
  );
  assert.doesNotMatch(film, /\{showVideo \? \(\s*<video/);
  assert.match(film, /\$\{showVideo \? "" : "hidden"\}/);
  assert.match(film, /\{!showVideo && \(\s*<Image/);
});

test("the landing film and analytics stay attack-specific", () => {
  const filmScene = read("components/film-scene.tsx");
  const analytics = read("components/analytics-showcase.tsx");
  const landing = read("app/page.tsx");

  assert.match(filmScene, /Spike analysis/);
  assert.match(filmScene, /film-ring/, "the mark is a ring, not a skeleton");
  assert.match(filmScene, /Follow-through/);
  assert.doesNotMatch(filmScene, /Serve analysis/);
  // D-033: the film may not depict capabilities the product no longer has.
  assert.doesNotMatch(filmScene, /film-bone/);
  assert.doesNotMatch(filmScene, /body heights/);
  assert.doesNotMatch(filmScene, /°/);

  assert.match(analytics, /example attack session/i);
  assert.match(analytics, /Spike score/);
  assert.match(analytics, /Approach footwork/);
  assert.doesNotMatch(analytics, /Serve score/);

  assert.match(landing, /spike scores 82/i);
  assert.doesNotMatch(landing, /serve scores 82/i);
});

test("the cinematic headline is immediately paintable as the LCP", () => {
  const hero = read("components/cinematic-hero.tsx");
  const headingIndex = hero.indexOf("<h1");
  const nearestRevealOpen = hero.lastIndexOf("<Reveal", headingIndex);
  const nearestRevealClose = hero.lastIndexOf("</Reveal>", headingIndex);

  assert.notEqual(headingIndex, -1);
  assert.ok(nearestRevealClose > nearestRevealOpen);
});
