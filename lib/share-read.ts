import type { AnalysisResult } from "./analysis-types.ts";
import type { Discipline, Skill } from "./skills.ts";

export type SharedAnalysis = {
  skill: Skill;
  discipline: Discipline;
  overall_score: number;
  created_at: string;
  result: AnalysisResult;
  clip_path: string | null;
};

type RpcClient = {
  rpc(
    name: string,
    args: { p_token: string },
  ): PromiseLike<{ data: unknown; error: unknown }>;
};

// The one anon read surface (D-049): the DB function hashes the raw URL token
// itself and returns a bounded projection or null. Every share surface (page,
// OG image, clip stream) resolves through here so the shape cannot drift.
export async function analysisByShareToken(
  client: RpcClient,
  token: string,
): Promise<SharedAnalysis | null> {
  if (token.length < 20 || token.length > 128) return null;
  try {
    const { data, error } = await client.rpc("analysis_by_share_token", {
      p_token: token,
    });
    if (error || data == null || typeof data !== "object") return null;
    return data as SharedAnalysis;
  } catch {
    return null;
  }
}
