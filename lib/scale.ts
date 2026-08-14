// The scoring scale: what the model says, turned into what the player sees.
//
// WHY THIS EXISTS. Measured 2026-08-13 over 47 real player clips replayed
// through the shipped prompt (scripts/video-eval.mjs): 45 scored, min 71,
// median 78, max 92, sd 5.0. The product ships a 0-100 scale and uses 21 points
// of it. Every rep a player has ever uploaded came back "Solid" or "Advanced",
// so the number carries almost no information: it cannot say "that was your
// best one yet" and it cannot say "that rep did not work".
//
// The instinct is to write a sterner prompt. D-034 forbids it and D-094
// measured why: severity is not a wording problem. The same model, re-anchored
// by prompt three times in one week, moved its median 55 -> 78 -> 97 while its
// RANK CORRELATION against labels held at 0.708. It knows which rep is better.
// It does not know where to put the number. So the ordering is taken from the
// model and the placement is done here, in code, against anchors a coach set.
//
// This module is pure and import-free so `node --test` and the offline fitting
// script both load it without a build step.

/** Bumped whenever the map changes, and stored on the row (D-094). */
export const SCALE_VERSION = 2;

/**
 * One point on the map: the model said `raw`, a coach's labels say that rep
 * belongs at `final`. Between anchors the map interpolates linearly, outside
 * them it extrapolates from the nearest segment, and it is always monotone, so
 * a rep the model ranked higher NEVER scores lower than one it ranked below.
 * That single property is what makes this safe: it moves the scale without
 * touching the one judgment the model is good at.
 */
export type Anchor = { raw: number; final: number };

/**
 * The provisional map, in force until coach labels replace it.
 *
 * Derived from the measured distribution rather than from taste, and its
 * shape is the whole argument: the model's usable output lives in 71-92, so
 * that window is STRETCHED across the range a score needs, and everything the
 * model puts below 71 (which it does only when a rep is visibly wrong) is
 * pulled down hard rather than compressed into the fifties.
 *
 * The anchors say, in order: a model 60 is a rep that failed, a model 71 (our
 * observed floor) is developing rather than good, a model 78 (our observed
 * median) is competent, a model 85 is genuinely strong, and a model 92 (our
 * observed ceiling) is excellent but not perfect. The top of the range stays
 * reachable and unreached, which is the point of a top.
 *
 * REPLACE THIS with fitAnchors() output as soon as labels exist. It is honest
 * about the compression and it is still a guess about where the middle belongs.
 */
export const PROVISIONAL_ANCHORS: Anchor[] = [
  { raw: 40, final: 5 },
  { raw: 55, final: 20 },
  { raw: 65, final: 34 },
  { raw: 71, final: 45 },
  { raw: 78, final: 60 },
  { raw: 85, final: 76 },
  { raw: 92, final: 90 },
  { raw: 100, final: 100 },
];

/** Lowest and highest a calibrated score may take. */
export const SCALE_MIN = 0;
export const SCALE_MAX = 100;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Map a raw model score onto the player-facing scale.
 *
 * Monotone by construction: anchors are sorted and any non-increasing `final`
 * is lifted to its predecessor, so a malformed anchor set degrades into a flat
 * segment instead of inverting two players' reps.
 */
export function calibrate(raw: number, anchors: Anchor[] = PROVISIONAL_ANCHORS): number {
  if (!Number.isFinite(raw)) return SCALE_MIN;
  const pts = [...anchors].sort((a, b) => a.raw - b.raw);
  if (pts.length === 0) return clamp(Math.round(raw), SCALE_MIN, SCALE_MAX);
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].final < pts[i - 1].final) pts[i] = { ...pts[i], final: pts[i - 1].final };
  }
  if (pts.length === 1) return clamp(Math.round(pts[0].final), SCALE_MIN, SCALE_MAX);

  let lo = pts[0];
  let hi = pts[pts.length - 1];
  if (raw <= lo.raw) {
    hi = pts[1];
  } else if (raw >= hi.raw) {
    lo = pts[pts.length - 2];
  } else {
    for (let i = 1; i < pts.length; i++) {
      if (raw <= pts[i].raw) {
        lo = pts[i - 1];
        hi = pts[i];
        break;
      }
    }
  }
  const span = hi.raw - lo.raw;
  const t = span === 0 ? 0 : (raw - lo.raw) / span;
  return clamp(Math.round(lo.final + t * (hi.final - lo.final)), SCALE_MIN, SCALE_MAX);
}

/**
 * How much of the skill the clip actually let the model see.
 *
 * The frame path had this and the video path dropped it: `app/api/analyze`
 * passes `result.coverage_pct ?? 100` into updateRating, and the video branch
 * never sets the field, so a read that saw two checkpoints of five moves a
 * player's rating exactly as hard as one that saw all five.
 */
export function coveragePct(visible: number, declared: number): number {
  if (declared <= 0) return 0;
  return Math.round((clamp(visible, 0, declared) / declared) * 100);
}

/**
 * The ceiling a partially-seen rep may claim.
 *
 * A score is a claim about a whole rep. When the footage only showed part of
 * it, the honest ceiling is lower than perfect no matter how good the visible
 * part looked, because the unseen part is unseen and not excellent. This is
 * deliberately a CAP and not a subtraction: a bad rep filmed badly still scores
 * badly, and a good rep filmed badly is held back rather than punished twice.
 *
 * Full coverage caps at the top of the scale, which is to say it does nothing.
 */
export function coverageCap(pct: number): number {
  if (pct >= 100) return SCALE_MAX;
  if (pct >= 80) return 92;
  if (pct >= 60) return 82;
  if (pct >= 40) return 70;
  return 55;
}

export type FinalScore = {
  /** What the player sees. */
  score: number;
  /** Before the coverage cap; kept so a capped score is auditable. */
  calibrated: number;
  /** Straight from the model, stored so the map can be refitted later. */
  raw: number;
  coverage_pct: number;
  /** True when the cap, not the calibration, decided the number. */
  capped: boolean;
  /** Under 60% coverage the read is thin enough that the UI must say so. */
  low_confidence: boolean;
  scale_version: number;
};

/**
 * The whole pipeline, in one call: raw -> calibrated -> coverage-capped.
 *
 * Every intermediate is returned rather than discarded. The map WILL be refitted
 * when more labels arrive, and a stored `raw` is what makes a refit apply to the
 * history a player already has instead of only to their next rep.
 */
export function finalScore(
  raw: number,
  visible: number,
  declared: number,
  anchors: Anchor[] = PROVISIONAL_ANCHORS,
): FinalScore {
  const calibrated = calibrate(raw, anchors);
  const pct = coveragePct(visible, declared);
  const cap = coverageCap(pct);
  const score = Math.min(calibrated, cap);
  return {
    score,
    calibrated,
    raw,
    coverage_pct: pct,
    capped: score < calibrated,
    low_confidence: pct < 60,
    scale_version: SCALE_VERSION,
  };
}

/** One read of a clip, as the combiner needs it. */
export type Read = {
  /** null when the read refused or failed. */
  score: number | null;
  ratable: boolean;
  visible: number;
  declared: number;
};

export type CombinedRead = {
  /** The raw score to calibrate, or null when the reads refused. */
  score: number | null;
  ratable: boolean;
  visible: number;
  declared: number;
  /** max minus min across the ratable reads. Zero for a single read. */
  spread: number;
  reads: number;
};

/**
 * Combine repeated reads of ONE clip into the number that gets calibrated.
 *
 * Measured 2026-08-13: pooled within-clip read noise is sd 3.5 against a
 * between-clip sd of 5.9, which is a reliability of 0.64. About a third of what
 * a player watches move is the same clip read twice. Nothing in the prompt
 * fixes that, because it is sampling variance and not judgement: the only cure
 * is more samples.
 *
 * MEDIAN, not mean. One clip in the stability sample came back 71, 68, 54 on
 * three draws. A mean lets that 54 drag the answer 6 points; the median ignores
 * it, which is the correct treatment for a draw that disagrees with both of its
 * siblings about what it even saw.
 *
 * Refusals vote. A clip that most reads refuse is refused, rather than scored
 * from whichever minority happened to answer: "two of three could not rate
 * this" is a refusal with extra evidence, not a score with a caveat.
 */
export function combineReads(reads: readonly Read[]): CombinedRead {
  const usable = reads.filter((r) => r.ratable && typeof r.score === "number");
  const refusals = reads.filter((r) => !r.ratable).length;
  const declared = reads.find((r) => r.declared > 0)?.declared ?? 0;

  if (usable.length === 0 || refusals >= reads.length - refusals) {
    return { score: null, ratable: false, visible: 0, declared, spread: 0, reads: reads.length };
  }

  const scores = usable.map((r) => r.score as number).sort((a, b) => a - b);
  const mid = Math.floor(scores.length / 2);
  const score =
    scores.length % 2 === 1
      ? scores[mid]
      : Math.round((scores[mid - 1] + scores[mid]) / 2);

  // Coverage takes the median too, for the same reason the score does: a single
  // read that missed a checkpoint the other two described should not decide how
  // much of the rep was visible.
  const seen = usable.map((r) => r.visible).sort((a, b) => a - b);
  const vmid = Math.floor(seen.length / 2);
  const visible =
    seen.length % 2 === 1 ? seen[vmid] : Math.round((seen[vmid - 1] + seen[vmid]) / 2);

  return {
    score,
    ratable: true,
    visible,
    declared,
    spread: scores[scores.length - 1] - scores[0],
    reads: reads.length,
  };
}

/**
 * How much of a score's variance is the rep rather than the read.
 *
 * `noiseSd` is the pooled within-clip sd across repeated reads; `scores` is one
 * score per clip. Returns 0 when the noise explains everything. This is the
 * number the eval gate turns into a pass or a fail, and the number multi-draw
 * exists to move.
 */
export function reliability(scores: readonly number[], noiseSd: number): number {
  if (scores.length < 2) return 0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const observed = scores.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (scores.length - 1);
  if (observed <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - (noiseSd * noiseSd) / observed));
}

/**
 * Fit anchors from labeled reps: pairs of (what the model said, where a coach
 * put it).
 *
 * Pool-adjacent-violators isotonic regression. It is the right tool because it
 * assumes ONLY monotonicity, which is exactly the one property we have evidence
 * for and the only one we want to impose. No curve shape is assumed, no
 * distribution is forced, and a set of labels that disagrees with the model's
 * ordering flattens the map there rather than inverting it.
 *
 * Duplicate raw values are averaged first, so ten clips the model all called 78
 * become one anchor at the mean of what the coach called them.
 */
export function fitAnchors(
  pairs: readonly { raw: number; label: number }[],
  minPairs = 8,
): Anchor[] | null {
  const usable = pairs.filter(
    (p) => Number.isFinite(p.raw) && Number.isFinite(p.label),
  );
  if (usable.length < minPairs) return null;

  const byRaw = new Map<number, number[]>();
  for (const p of usable) {
    const bucket = byRaw.get(p.raw) ?? [];
    bucket.push(p.label);
    byRaw.set(p.raw, bucket);
  }
  const points = [...byRaw.entries()]
    .map(([raw, labels]) => ({
      raw,
      final: labels.reduce((a, b) => a + b, 0) / labels.length,
      weight: labels.length,
    }))
    .sort((a, b) => a.raw - b.raw);

  // Pool adjacent violators.
  const stack: { raw: number; final: number; weight: number }[] = [];
  for (const p of points) {
    let cur = { ...p };
    while (stack.length > 0 && stack[stack.length - 1].final > cur.final) {
      const prev = stack.pop()!;
      const weight = prev.weight + cur.weight;
      cur = {
        raw: cur.raw,
        final: (prev.final * prev.weight + cur.final * cur.weight) / weight,
        weight,
      };
    }
    stack.push(cur);
  }

  const fitted = stack.map((p) => ({ raw: p.raw, final: Math.round(p.final) }));
  // Pin the ends so extrapolation past the labeled window stays inside the
  // scale instead of running off it on the first unusual rep.
  const first = fitted[0];
  const last = fitted[fitted.length - 1];
  const out: Anchor[] = [];
  if (first.raw > SCALE_MIN) out.push({ raw: SCALE_MIN, final: SCALE_MIN });
  out.push(...fitted);
  if (last.raw < SCALE_MAX) out.push({ raw: SCALE_MAX, final: SCALE_MAX });
  return out;
}

/** Descriptive stats for a run of scores, for the eval summary and the fit report. */
export function distribution(scores: readonly number[]): {
  n: number;
  min: number | null;
  p10: number | null;
  median: number | null;
  p90: number | null;
  max: number | null;
  mean: number;
  sd: number;
  range: number;
} {
  const s = [...scores].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (s.length === 0) {
    return { n: 0, min: null, p10: null, median: null, p90: null, max: null, mean: 0, sd: 0, range: 0 };
  }
  const at = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((acc, x) => acc + (x - mean) ** 2, 0) / s.length);
  return {
    n: s.length,
    min: s[0],
    p10: at(0.1),
    median: at(0.5),
    p90: at(0.9),
    max: s[s.length - 1],
    mean: Number(mean.toFixed(1)),
    sd: Number(sd.toFixed(1)),
    range: s[s.length - 1] - s[0],
  };
}
