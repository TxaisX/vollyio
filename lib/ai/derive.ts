import type { Skill } from "@/lib/skills";
import { METRICS, metricWeight } from "./metrics.ts";
import { deriveMetric } from "./pointers.ts";

export type ScoredMetric = { score: number; observed: boolean; weight: number };

export type OverallDerivation = {
  overall: number | null;
  coveragePct: number;
  lowConfidence: boolean;
};

// The weighted mean over OBSERVED metrics, plus how much of the rubric this rep
// let the coach see. Weights sum to 100 per skill, so the observed weight is the
// coverage percentage; below 60 the read is flagged low-confidence. Nothing
// observed yields a null overall so the caller can fall back to the model's
// whole-clip read. Still uncurved and code-derived (D-039/D-040); the only change
// from a plain mean is that a heavier checkpoint moves the number more, and a
// missing one is dropped weight-and-all rather than counted.
export function weightedOverall(metrics: ScoredMetric[]): OverallDerivation {
  const totalWeight = metrics.reduce((s, m) => s + m.weight, 0);
  const observed = metrics.filter((m) => m.observed);
  const observedWeight = observed.reduce((s, m) => s + m.weight, 0);
  if (observedWeight <= 0 || totalWeight <= 0) {
    return { overall: null, coveragePct: 0, lowConfidence: true };
  }
  const overall = Math.round(
    observed.reduce((s, m) => s + m.score * m.weight, 0) / observedWeight,
  );
  const coveragePct = Math.round((observedWeight / totalWeight) * 100);
  return { overall, coveragePct, lowConfidence: coveragePct < 60 };
}

export type DerivedMetric = {
  key: string;
  weight: number;
  score: number;
  observed: boolean;
  statuses: { key: string; status: string }[];
};

// One scoring path for the analyze route and the eval route both: derive each
// metric from its pointer verdicts (D-039), then combine into the weighted
// overall + coverage above. The model's job is unchanged; all of this is code.
export function deriveResult(
  skill: Skill,
  metricsMap: Record<
    string,
    { pointers?: { key: string; status: string }[] } | undefined
  >,
): { metrics: DerivedMetric[] } & OverallDerivation {
  const metrics: DerivedMetric[] = METRICS[skill].map((m) => {
    const d = deriveMetric(skill, m.key, metricsMap[m.key]?.pointers);
    return {
      key: m.key,
      weight: metricWeight(skill, m.key),
      score: d.raw,
      observed: d.observed,
      statuses: d.statuses,
    };
  });
  return { metrics, ...weightedOverall(metrics) };
}
