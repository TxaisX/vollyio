// Whether a scoring run is good enough to ship, as thresholds rather than taste.
//
// The old harness graded case by case: does this clip's score fall inside its
// labeled band. Every case could pass that and the product still be broken,
// because the failure measured on 2026-08-13 is not per-clip error, it is that
// the whole scale collapsed into 21 points. So the gates here are mostly
// SUITE-level: they ask what the run did as a distribution, not what it did to
// one clip.
//
// Pure and import-free, like lib/scale.ts, so `node --test` loads it directly.

export type GateStatus = "pass" | "fail" | "skipped";

export type Gate = {
  name: string;
  status: GateStatus;
  detail: string;
  /** Why the gate could not run. Only set when status is "skipped". */
  reason?: string;
};

export type RunSummary = {
  /** Final scores, one per scored clip. */
  scores: number[];
  /** Clips the model refused to rate, split by what the reviewer said. */
  refusedRatable: number; // refused a clip a coach says IS ratable: a false refusal
  refusedUnratable: number; // refused a clip a coach says is NOT ratable: correct
  scoredUnratable: number; // scored a clip a coach says is NOT ratable: the bad one
  scoredRatable: number;
  /** Reads that claimed every declared checkpoint was visible. */
  fullVisibility: number;
  visibilityReads: number;
  /** Per-clip max-minus-min across repeated runs. Empty when runs = 1. */
  spreads: number[];
  /**
   * The model's scores before calibration. Needed because `spreads` are also
   * measured before calibration, and comparing a calibrated spread against a
   * raw noise figure would flatter the result: a monotone map stretches the
   * signal and the noise by the same factor.
   */
  rawScores?: number[];
  /**
   * Read noise, measured directly as the pooled within-clip sd across repeated
   * runs of the same clip. Preferred over estimating it from `spreads`.
   */
  noiseSd?: number;
};

export type GateTargets = {
  /** Where the middle of the population should sit. */
  medianMin: number;
  medianMax: number;
  /** How much of the scale a healthy run must actually use. */
  minRange: number;
  /** A distribution flatter than this is not a scale, it is a constant. */
  minSd: number;
  /** Refusing clips a coach called ratable costs a player a rep they filmed fine. */
  maxFalseRefusalRate: number;
  /** Scoring a clip a coach called unratable is the invented-number failure. */
  maxMissedRefusalRate: number;
  /** "Everything was visible" on every clip means the abstain lane is dead. */
  maxFullVisibilityRate: number;
  /** Run-to-run swing on one clip, in points. */
  maxMeanSpread: number;
  /**
   * How much of the variance between clips must be real difference rather than
   * the same clip read twice.
   *
   * The gate that matters most and the one nothing measured before. A scale
   * where a large share of the movement is read noise cannot tell two reps
   * apart however wide the axis is drawn. Measured 2026-08-13 over 13 clips
   * read three times each: read noise sd 3.53 against a between-clip sd of
   * 5.44, which is a reliability of 0.58. Two fifths of what a player sees
   * moving is the dice.
   */
  minReliability: number;
};

// Chosen from the 2026-08-13 measurement, not from taste, and every one of them
// is a number the current build fails:
//   median 78 (target 50-70), range 21 (target 45), sd 5.0 (target 12),
//   full-visibility 96% (target 75%).
// A gate the current build passes would not have caught the thing that is
// wrong, which is the only test of a gate worth having.
export const DEFAULT_TARGETS: GateTargets = {
  medianMin: 50,
  medianMax: 70,
  minRange: 45,
  minSd: 12,
  maxFalseRefusalRate: 0.05,
  maxMissedRefusalRate: 0.2,
  maxFullVisibilityRate: 0.75,
  maxMeanSpread: 8,
  // 0.75: three quarters of the movement has to be the rep. Reachable from the
  // measured 0.58 by taking the median of three reads, which cuts noise
  // variance threefold and lands near 0.79 on these numbers.
  minReliability: 0.75,
};

function pct(n: number, d: number): number {
  return d === 0 ? 0 : n / d;
}

function gate(name: string, ok: boolean, detail: string): Gate {
  return { name, status: ok ? "pass" : "fail", detail };
}

function skip(name: string, reason: string): Gate {
  return { name, status: "skipped", detail: `skipped: ${reason}`, reason };
}

/**
 * Run every gate. A gate with no evidence is SKIPPED and never counted as a
 * pass, which is the one rule carried over intact from the old harness: a check
 * that never ran must not look like agreement.
 */
export function runGates(summary: RunSummary, targets: GateTargets = DEFAULT_TARGETS): Gate[] {
  const gates: Gate[] = [];
  const s = [...summary.scores].sort((a, b) => a - b);

  if (s.length < 10) {
    gates.push(skip("distribution", `${s.length} scored clips is too few to describe a distribution`));
  } else {
    const median = s[Math.floor(s.length / 2)];
    const range = s[s.length - 1] - s[0];
    const mean = s.reduce((a, b) => a + b, 0) / s.length;
    const sd = Math.sqrt(s.reduce((acc, x) => acc + (x - mean) ** 2, 0) / s.length);
    gates.push(
      gate(
        "median_in_target",
        median >= targets.medianMin && median <= targets.medianMax,
        `median ${median} vs [${targets.medianMin}, ${targets.medianMax}]`,
      ),
      gate("range_used", range >= targets.minRange, `used ${range} points, need ${targets.minRange}`),
      gate("spread_not_collapsed", sd >= targets.minSd, `sd ${sd.toFixed(1)}, need ${targets.minSd}`),
    );
  }

  const ratable = summary.refusedRatable + summary.scoredRatable;
  if (ratable === 0) {
    gates.push(skip("false_refusals", "no clips a reviewer confirmed are ratable"));
  } else {
    const rate = pct(summary.refusedRatable, ratable);
    gates.push(
      gate(
        "false_refusals",
        rate <= targets.maxFalseRefusalRate,
        `${summary.refusedRatable}/${ratable} good clips refused (${(rate * 100).toFixed(1)}%)`,
      ),
    );
  }

  const unratable = summary.refusedUnratable + summary.scoredUnratable;
  if (unratable === 0) {
    gates.push(
      skip("missed_refusals", "no clips a reviewer confirmed are unratable; the refusal lane is untested"),
    );
  } else {
    const rate = pct(summary.scoredUnratable, unratable);
    gates.push(
      gate(
        "missed_refusals",
        rate <= targets.maxMissedRefusalRate,
        `${summary.scoredUnratable}/${unratable} unratable clips got a score anyway (${(rate * 100).toFixed(1)}%)`,
      ),
    );
  }

  if (summary.visibilityReads === 0) {
    gates.push(skip("abstain_lane_alive", "no reads reported checkpoint visibility"));
  } else {
    const rate = pct(summary.fullVisibility, summary.visibilityReads);
    gates.push(
      gate(
        "abstain_lane_alive",
        rate <= targets.maxFullVisibilityRate,
        `${(rate * 100).toFixed(1)}% of reads claimed every checkpoint visible`,
      ),
    );
  }

  if (summary.spreads.length === 0) {
    gates.push(
      skip("stability", "single-run suite; re-run with --runs 2 to measure"),
      skip("noise_below_signal", "no repeated runs, so read noise is unmeasured"),
    );
  } else {
    const meanSpread = summary.spreads.reduce((a, b) => a + b, 0) / summary.spreads.length;
    gates.push(
      gate(
        "stability",
        meanSpread <= targets.maxMeanSpread,
        `mean run-to-run spread ${meanSpread.toFixed(1)} points, max ${targets.maxMeanSpread}`,
      ),
    );

    // Compared on the RAW scale, where the spreads were measured.
    const raw = summary.rawScores ?? [];
    if (raw.length < 10) {
      gates.push(skip("noise_below_signal", "too few raw scores to measure between-clip spread"));
    } else {
      const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
      const observedVar = raw.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (raw.length - 1);
      // Reliability: the share of the variance between clips that is real
      // difference rather than the same clip read twice. `noiseSd` is measured
      // directly from repeated runs when the caller has it, and estimated from
      // the mean 3-run spread otherwise (spread ~ 1.7 sd at n=3).
      const noiseSd = summary.noiseSd ?? meanSpread / 1.7;
      const reliability = observedVar <= 0 ? 0 : Math.max(0, 1 - (noiseSd * noiseSd) / observedVar);
      gates.push(
        gate(
          "noise_below_signal",
          reliability >= targets.minReliability,
          `reliability ${reliability.toFixed(2)} (read noise sd ${noiseSd.toFixed(1)} against between-clip sd ${Math.sqrt(observedVar).toFixed(1)}), need ${targets.minReliability}`,
        ),
      );
    }
  }

  return gates;
}

export type GateVerdict = "pass" | "fail" | "unverified";

/**
 * A run passes only when nothing failed AND the two gates that need human
 * labels actually ran. Without them the suite has measured shape and said
 * nothing about correctness, which is "unverified" and never a pass.
 */
export function gateVerdict(gates: Gate[]): GateVerdict {
  if (gates.some((g) => g.status === "fail")) return "fail";
  const labelGates = ["false_refusals", "missed_refusals"];
  const ranALabelGate = gates.some((g) => labelGates.includes(g.name) && g.status !== "skipped");
  return ranALabelGate ? "pass" : "unverified";
}
