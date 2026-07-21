// The priority-fix loop (retention). When a player analyzes a skill they have
// analyzed before, the breakdown opens with what they were told to work on last
// time and whether the checkpoint behind it moved. All of this is derived from
// data already stored on the two analyses (D-044): the previous priority fix
// (priority_fix.title), the checkpoint it targeted (changes[0].target_metric),
// and that checkpoint's score on each rep. Pure and structural so it unit-tests
// without a full AnalysisResult and never fabricates a delta.

export type FixMovement = "up" | "down" | "same" | "unseen" | "baseline";

export type LastTimeFix = {
  fixTitle: string;
  metricKey: string;
  then: number | null;
  now: number | null;
  movement: FixMovement;
};

type FixSource = {
  priority_fix?: { title?: string | null } | null;
  changes?: { target_metric?: string | null }[] | null;
  metrics?: { key: string; score?: number; observed?: boolean }[] | null;
};

// The checkpoint's score, or null when it was not observed this rep (so an
// invisible checkpoint can never read as movement).
function observedScore(source: FixSource, key: string): number | null {
  const m = (source.metrics ?? []).find((x) => x.key === key);
  if (!m || m.observed === false || typeof m.score !== "number") return null;
  return m.score;
}

export function lastTimeFix(
  prev: FixSource | null | undefined,
  current: FixSource,
): LastTimeFix | null {
  if (!prev) return null;
  const fixTitle = prev.priority_fix?.title;
  const metricKey = prev.changes?.[0]?.target_metric;
  if (!fixTitle || !metricKey) return null;

  const then = observedScore(prev, metricKey);
  const now = observedScore(current, metricKey);

  let movement: FixMovement;
  if (now == null) movement = "unseen";
  else if (then == null) movement = "baseline";
  else if (now > then) movement = "up";
  else if (now < then) movement = "down";
  else movement = "same";

  return { fixTitle, metricKey, then, now, movement };
}
