import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Anchors for the read, drawn from the player's own history.
 *
 * WHAT THIS IS FOR. The score compresses because every clip is read in a vacuum:
 * nothing in the prompt says what a 60 looks like, so the model returns the
 * population mean with a little noise on top (evals/CALIBRATION.md, measured sd
 * 3.1 on the shipping id). Retrieval is the cheap half of the fix -- put the
 * player's nearest previous reps of the same skill in front of the model as
 * comparison points, so it is ranking rather than guessing at an absolute.
 *
 * WHAT THIS IS NOT. It is not training data and must not become it. The 59 rows
 * in `analyses` are this product's OWN OUTPUTS, not ground truth; learning from
 * them would reproduce the compression rather than fix it. `analysis_feedback`
 * (`was_right`) is the only ground-truth channel in the app, and until it has
 * volume, nothing here justifies a fine-tune.
 *
 * NOTHING IN THIS MODULE IS WIRED INTO A PAID PATH YET, deliberately. Changing
 * what `/api/analyze` sends is a change to the read, and this repo's standard for
 * that is a measured arm, not an argument (D-034). Build the index, backfill it,
 * measure an anchored arm against `evals/arm-37-flash.json`, and only then decide.
 */

export { EMBEDDING_DIMENSIONS, analysisSourceText } from "./retrieval-text.ts";
import { analysisSourceText, EMBEDDING_DIMENSIONS, type RatingLike } from "./retrieval-text.ts";

/** What the edge function will refuse. Kept here so callers can trim first. */
const MAX_INPUT_CHARS = 4000;

export class EmbeddingError extends Error {}

/**
 * Text to vector, on the runtime the project already pays for.
 *
 * The model gateway has no embedding model at all, so this is a Supabase Edge
 * Function running gte-small in-process. It returns a NORMALIZED vector, which
 * migration 067's `vector_ip_ops` index requires: inner product over
 * unnormalized vectors ranks by magnitude and returns confident nonsense.
 */
export async function embedText(
  supabase: SupabaseClient,
  input: string,
): Promise<number[]> {
  const trimmed = input.trim();
  if (!trimmed) throw new EmbeddingError("Nothing to embed.");

  const { data, error } = await supabase.functions.invoke("embed", {
    body: { input: trimmed.slice(0, MAX_INPUT_CHARS) },
  });
  if (error) throw new EmbeddingError(error.message);

  const embedding = (data as { embedding?: unknown } | null)?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new EmbeddingError(
      `Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${
        Array.isArray(embedding) ? embedding.length : typeof embedding
      }.`,
    );
  }
  return embedding as number[];
}

/**
 * Record one rep in the index.
 *
 * Upsert on `analysis_id`, because a re-read of the same analysis should replace
 * its vector rather than fail or duplicate it. Writes go through the CALLER's
 * client so the row lands under the owner policy in migration 067; a service
 * client here would write past RLS and make the table's guarantee a comment.
 */
export async function indexAnalysis(
  supabase: SupabaseClient,
  args: { analysisId: string; userId: string; skill: string; rating: RatingLike },
): Promise<void> {
  const sourceText = analysisSourceText(args.skill, args.rating);
  const embedding = await embedText(supabase, sourceText);

  const { error } = await supabase.from("analysis_embeddings").upsert(
    {
      analysis_id: args.analysisId,
      user_id: args.userId,
      source_text: sourceText,
      embedding: embedding as unknown as string,
      embed_model: "gte-small",
    },
    { onConflict: "analysis_id" },
  );
  if (error) throw new EmbeddingError(error.message);
}

export type AnchorRep = {
  analysis_id: string;
  skill: string;
  overall_score: number;
  created_at: string;
  source_text: string;
  similarity: number;
};

/**
 * The k nearest previous reps of the same skill.
 *
 * `match_analyses` is SECURITY INVOKER, so this returns only rows the caller
 * already owns; there is no cross-player retrieval and adding one would be a
 * consent decision about private footage, not a tuning knob.
 *
 * Returns [] rather than throwing when the index is empty or the call fails. A
 * read that would have been fine without anchors must not become a failed read
 * because the anchor lookup was unavailable.
 */
export async function findAnchorReps(
  supabase: SupabaseClient,
  args: { skill: string; queryEmbedding: number[]; limit?: number },
): Promise<AnchorRep[]> {
  const { data, error } = await supabase.rpc("match_analyses", {
    query_embedding: args.queryEmbedding as unknown as string,
    match_skill: args.skill,
    match_count: args.limit ?? 5,
  });
  if (error || !Array.isArray(data)) return [];
  return data as AnchorRep[];
}
