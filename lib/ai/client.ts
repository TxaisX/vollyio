import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// D-004 (CS-5): cheapest capable model per call.
// Coach chat is the high-frequency path -> Sonnet 5 (capable, ~5x cheaper than Opus).
// Analyze is low-frequency + quality-critical (vision + structured scoring) -> keep Opus 4.8.
export const COACH_MODEL = "claude-sonnet-5";
export const ANALYZE_MODEL = "claude-opus-4-8";

let cached: Anthropic | null = null;

export function coach(): Anthropic {
  if (!cached) {
    cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cached;
}
