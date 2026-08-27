/**
 * The pure half of retrieval: what text stands in for a rep.
 *
 * Split from retrieval.ts and deliberately import-free -- no `server-only`, no
 * Supabase client -- for the same reason lib/eval-gate.ts is: `node --test` and
 * scripts/backfill-embeddings.mjs both load it directly, and a `server-only`
 * import throws outside a Next runtime.
 */
/** gte-small's dimension. Pinned in migration 067's column type as well. */
export const EMBEDDING_DIMENSIONS = 384;

/** What the edge function will refuse. Kept here so callers can trim first. */
const MAX_INPUT_CHARS = 4000;

export type RatingLike = {
  overall_score?: number | null;
  summary?: string | null;
  strengths?: Array<{ title?: string; detail?: string }> | null;
  improvements?: Array<{ title?: string; detail?: string }> | null;
};

/**
 * The text that stands in for a rep.
 *
 * Titles before details, and details truncated, because gte-small truncates at
 * 512 TOKENS and does it silently. A source text that runs long does not error;
 * it just stops representing its own tail, and the retrieval that follows is
 * wrong in a way no test would catch. Ordering the signal first means the part
 * that survives truncation is the part worth matching on.
 */
export function analysisSourceText(skill: string, rating: RatingLike): string {
  // THE SCORE IS DELIBERATELY NOT IN HERE, and leaving it in was the first
  // version's bug. An embedding that encodes the score retrieves reps that
  // scored alike, which hands the model its own previous number back as an
  // "example" and anchors the next read onto the prior it was supposed to break.
  // That is a feedback loop that TIGHTENS the compression this index exists to
  // fix, and it would have looked like it was working. The score still reaches
  // the caller: match_analyses joins to analyses and returns the real one.
  const parts: string[] = [`skill: ${skill}`];
  if (rating.summary) parts.push(`summary: ${rating.summary}`);

  const titles = (rows: RatingLike["strengths"]) =>
    (rows ?? []).map((r) => r.title).filter(Boolean).join("; ");

  const strengths = titles(rating.strengths);
  if (strengths) parts.push(`strengths: ${strengths}`);
  const improvements = titles(rating.improvements);
  if (improvements) parts.push(`improvements: ${improvements}`);

  return parts.join("\n").slice(0, MAX_INPUT_CHARS);
}
