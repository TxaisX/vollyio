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
