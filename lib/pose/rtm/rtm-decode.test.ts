import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";
import { DET_SCORE_MIN, decodeDetections, letterboxRatio } from "./yolox-decode.ts";
import { BOX_PADDING, boxToCrop, cropPlacement, cropToFrame } from "./topdown.ts";
import { SIMCC_SPLIT_RATIO, decodeSimcc, decodeSimccArgmax } from "./simcc-decode.ts";

type Fixture = {
  image: { file: string; width: number; height: number };
  det: {
    input_size: number[];
    ratio: number;
    raw_shape: number[];
    raw: number[][];
    boxes: number[][];
  };
  pose: {
    input_size: number[];
    padding: number;
    simcc_split_ratio: number;
  };
  persons: {
    bbox: number[];
    center: number[];
    scale: number[];
    simcc_x: number[][];
    simcc_y: number[][];
    keypoints: number[][];
    scores: number[];
  }[];
};

function loadFixture(name: string): Fixture {
  const raw = readFileSync(new URL(`./fixtures/${name}.json.gz`, import.meta.url));
  return JSON.parse(gunzipSync(raw).toString("utf-8")) as Fixture;
}

const FIXTURES = ["frame_0292", "frame_0264"].map(loadFixture);

for (const fx of FIXTURES) {
  const { width, height } = fx.image;

  test(`${fx.image.file}: letterbox ratio matches reference`, () => {
    assert.ok(Math.abs(letterboxRatio(width, height) - fx.det.ratio) < 1e-9);
  });

  test(`${fx.image.file}: detector decode matches reference boxes`, () => {
    const raw = Float32Array.from(fx.det.raw.flat());
    const boxes = decodeDetections(raw, fx.det.ratio);
    assert.equal(boxes.length, fx.det.boxes.length);
    for (let i = 0; i < boxes.length; i++) {
      const [x1, y1, x2, y2, score] = fx.det.boxes[i];
      assert.ok(Math.abs(boxes[i].x1 - x1) < 0.5, `box ${i} x1`);
      assert.ok(Math.abs(boxes[i].y1 - y1) < 0.5, `box ${i} y1`);
      assert.ok(Math.abs(boxes[i].x2 - x2) < 0.5, `box ${i} x2`);
      assert.ok(Math.abs(boxes[i].y2 - y2) < 0.5, `box ${i} y2`);
      assert.ok(Math.abs(boxes[i].score - score) < 0.005, `box ${i} score`);
      assert.ok(boxes[i].score > DET_SCORE_MIN);
    }
  });

  test(`${fx.image.file}: crop rect matches reference center and scale`, () => {
    assert.equal(fx.pose.padding, BOX_PADDING);
    for (const person of fx.persons) {
      const [x1, y1, x2, y2] = person.bbox;
      const crop = boxToCrop({ x1, y1, x2, y2 });
      assert.ok(Math.abs(crop.cx - person.center[0]) < 0.5, "cx");
      assert.ok(Math.abs(crop.cy - person.center[1]) < 0.5, "cy");
      assert.ok(Math.abs(crop.w - person.scale[0]) < 0.5, "w");
      assert.ok(Math.abs(crop.h - person.scale[1]) < 0.5, "h");
    }
  });

  test(`${fx.image.file}: simcc decode matches reference keypoints`, () => {
    for (const person of fx.persons) {
      const [x1, y1, x2, y2] = person.bbox;
      const crop = boxToCrop({ x1, y1, x2, y2 });
      const points = decodeSimccArgmax(
        Float32Array.from(person.simcc_x.flat()),
        Float32Array.from(person.simcc_y.flat()),
        crop,
      );
      assert.equal(points.length, person.keypoints.length);
      for (let k = 0; k < points.length; k++) {
        assert.ok(
          Math.abs(points[k].x - person.keypoints[k][0]) < 0.75,
          `kpt ${k} x: ${points[k].x} vs ${person.keypoints[k][0]}`,
        );
        assert.ok(
          Math.abs(points[k].y - person.keypoints[k][1]) < 0.75,
          `kpt ${k} y: ${points[k].y} vs ${person.keypoints[k][1]}`,
        );
        assert.ok(
          Math.abs(points[k].score - person.scores[k]) < 0.005,
          `kpt ${k} score`,
        );
      }
    }
  });
}

test("decodeSimcc lands a symmetric two-bin peak at the fractional midpoint", () => {
  const wx = 384;
  const wy = 512;
  const simccX = new Float32Array(wx);
  const simccY = new Float32Array(wy);
  // Symmetric peak straddling bins 10 and 11 on x, 20 and 21 on y: the true
  // sub-pixel location is the midpoint (10.5 / 20.5), which plain argmax cannot
  // reach but the windowed centroid must.
  simccX[9] = 0.2;
  simccX[10] = 0.8;
  simccX[11] = 0.8;
  simccX[12] = 0.2;
  simccY[19] = 0.2;
  simccY[20] = 0.8;
  simccY[21] = 0.8;
  simccY[22] = 0.2;
  const crop = boxToCrop({ x1: 0, y1: 0, x2: 192, y2: 256 });
  const [pt] = decodeSimcc(simccX, simccY, crop, 1);
  const expected = cropToFrame(10.5 / SIMCC_SPLIT_RATIO, 20.5 / SIMCC_SPLIT_RATIO, crop);
  assert.ok(Math.abs(pt.x - expected.x) < 1e-6, `x ${pt.x} vs ${expected.x}`);
  assert.ok(Math.abs(pt.y - expected.y) < 1e-6, `y ${pt.y} vs ${expected.y}`);
  const [argmaxPt] = decodeSimccArgmax(simccX, simccY, crop, 1);
  assert.ok(Math.abs(argmaxPt.x - expected.x) > 1e-3, "argmax cannot reach the midpoint");
});

for (const fx of FIXTURES) {
  test(`${fx.image.file}: decodeSimcc score is byte-identical to argmax`, () => {
    for (const person of fx.persons) {
      const [x1, y1, x2, y2] = person.bbox;
      const crop = boxToCrop({ x1, y1, x2, y2 });
      const simccX = Float32Array.from(person.simcc_x.flat());
      const simccY = Float32Array.from(person.simcc_y.flat());
      const soft = decodeSimcc(simccX, simccY, crop);
      const argmax = decodeSimccArgmax(simccX, simccY, crop);
      for (let k = 0; k < soft.length; k++) {
        assert.equal(soft[k].score, argmax[k].score, `kpt ${k} score`);
      }
    }
  });

  test(`${fx.image.file}: decodeSimcc stays within 1.5px of argmax`, () => {
    for (const person of fx.persons) {
      const [x1, y1, x2, y2] = person.bbox;
      const crop = boxToCrop({ x1, y1, x2, y2 });
      const simccX = Float32Array.from(person.simcc_x.flat());
      const simccY = Float32Array.from(person.simcc_y.flat());
      const soft = decodeSimcc(simccX, simccY, crop);
      const argmax = decodeSimccArgmax(simccX, simccY, crop);
      for (let k = 0; k < soft.length; k++) {
        assert.ok(Math.abs(soft[k].x - argmax[k].x) < 1.5, `kpt ${k} x drift`);
        assert.ok(Math.abs(soft[k].y - argmax[k].y) < 1.5, `kpt ${k} y drift`);
      }
    }
  });
}

test("decodeSimcc preserves the score<=0 sentinel exactly", () => {
  const wx = 384;
  const wy = 512;
  // All-zero classification rows: xMax=yMax=0 → score 0 → sentinel path.
  const simccX = new Float32Array(wx);
  const simccY = new Float32Array(wy);
  const crop = boxToCrop({ x1: 40, y1: 60, x2: 160, y2: 400 });
  const [soft] = decodeSimcc(simccX, simccY, crop, 1);
  const [argmax] = decodeSimccArgmax(simccX, simccY, crop, 1);
  assert.equal(soft.score, argmax.score);
  assert.ok(soft.score <= 0);
  assert.equal(soft.x, argmax.x);
  assert.equal(soft.y, argmax.y);
});

test("cropToFrame inverts the crop mapping", () => {
  const crop = boxToCrop({ x1: 100, y1: 50, x2: 220, y2: 400 });
  const corner = cropToFrame(0, 0, crop);
  const opposite = cropToFrame(192, 256, crop);
  assert.ok(Math.abs(corner.x - (crop.cx - crop.w / 2)) < 1e-9);
  assert.ok(Math.abs(corner.y - (crop.cy - crop.h / 2)) < 1e-9);
  assert.ok(Math.abs(opposite.x - (crop.cx + crop.w / 2)) < 1e-9);
  assert.ok(Math.abs(opposite.y - (crop.cy + crop.h / 2)) < 1e-9);
});

test("boxToCrop locks aspect to the pose input", () => {
  const wide = boxToCrop({ x1: 0, y1: 0, x2: 300, y2: 100 });
  const tall = boxToCrop({ x1: 0, y1: 0, x2: 100, y2: 300 });
  assert.ok(Math.abs(wide.w / wide.h - 192 / 256) < 1e-9);
  assert.ok(Math.abs(tall.w / tall.h - 192 / 256) < 1e-9);
});

test("cropPlacement clips to the source image and preserves scale", () => {
  const crop = boxToCrop({ x1: -50, y1: -20, x2: 100, y2: 400 });
  const placed = cropPlacement(crop, 1920, 1080);
  assert.ok(placed);
  assert.ok(placed.sx >= 0 && placed.sy >= 0);
  assert.ok(Math.abs(placed.dw / placed.sw - 192 / crop.w) < 1e-9);
  assert.ok(Math.abs(placed.dh / placed.sh - 256 / crop.h) < 1e-9);
  const offFrame = cropPlacement(crop, 10, 10);
  assert.ok(offFrame === null || (placed.sw > 0 && placed.sh > 0));
});
