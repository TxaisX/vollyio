// Pure decode for the vendored person detector. This export embeds its own
// NMS: the raw output is (1, N, 5) rows of x1,y1,x2,y2,score in letterbox
// space, so decoding is scale-back plus a score gate. Constants and quirks
// mirror the validated Python reference exactly; fixture tests in
// yolox-decode.test.ts pin the parity.

export const DET_INPUT_SIZE = 640;
// Letterbox fill value used by the reference preprocess.
export const DET_PAD_VALUE = 114;
// Score gate the reference applies to this NMS-embedded export.
export const DET_SCORE_MIN = 0.3;

export type DetBox = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
};

// Scale factor mapping the source image into the letterbox square.
export function letterboxRatio(srcW: number, srcH: number, dst = DET_INPUT_SIZE): number {
  return Math.min(dst / srcH, dst / srcW);
}

// raw: flat (N, 5) tensor data. Returns boxes in source-image pixel space,
// in raw order (callers sort/cap as needed).
export function decodeDetections(raw: Float32Array | number[], ratio: number): DetBox[] {
  const boxes: DetBox[] = [];
  const n = Math.floor(raw.length / 5);
  for (let i = 0; i < n; i++) {
    const o = i * 5;
    const score = raw[o + 4];
    if (!(score > DET_SCORE_MIN)) continue;
    boxes.push({
      x1: raw[o] / ratio,
      y1: raw[o + 1] / ratio,
      x2: raw[o + 2] / ratio,
      y2: raw[o + 3] / ratio,
      score,
    });
  }
  return boxes;
}
