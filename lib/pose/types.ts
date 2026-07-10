// Shared, DOM-free types for the on-device motion-tracking pipeline.
// Everything here must stay importable from client, server, and node tests.

export const MEASUREMENTS_VERSION = 1;
export const POSE_LANDMARK_COUNT = 33;

// Landmark indices for the 33-point body model.
export const LM = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

export type Landmark = {
  x: number; // normalized 0..1, image space
  y: number; // normalized 0..1, image space (y grows downward)
  z: number; // depth, roughly normalized to hip width
  v: number; // visibility 0..1
};

export type LandmarkFrame = {
  t: number; // clip time in seconds
  pts: Landmark[]; // length POSE_LANDMARK_COUNT
};

export type DetectorFamily = "swing" | "jump" | "platform";

export type RepWindow = {
  startS: number;
  contactS: number | null;
  endS: number;
  detector: DetectorFamily;
  // Detector fit 0..1: how cleanly the motion matched the family template.
  fit: number;
};

export type MeasurementValue = number | number[] | string | boolean;

export type Measurement = {
  value: MeasurementValue;
  unit: string;
  confidence: number; // 0..1
};

export type RepMeasurements = {
  start_s: number;
  contact_s: number | null;
  end_s: number;
  detector: DetectorFamily;
  metrics: Record<string, Measurement>;
};

export type MeasurementsBlock = {
  version: number;
  capture: {
    dense_fps: number | null;
    coverage: "windows" | "probes";
    engine: string;
  };
  units: string;
  reps: RepMeasurements[];
  session: Record<string, number>;
  omitted_below_confidence: string[];
};

export const UNITS_NOTE =
  "body-relative: heights in standing-body-heights, widths in shoulder-widths, angles in degrees, time in seconds";

// Per-frame keypoints persisted alongside the sent frames so the results page
// can draw skeletons without refetching the dense file.
export type FrameKeypoints = {
  frame_index: number;
  time_s: number | null;
  pts: Landmark[] | null;
};

// Shape of the keypoints.json object uploaded to storage.
export type KeypointsFile = {
  version: number;
  clip_duration_s: number | null;
  frames: LandmarkFrame[];
};
