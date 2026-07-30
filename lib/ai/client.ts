import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// D-004 (CS-5): cheapest capable model per call.
// Coach chat is the high-frequency path -> Sonnet 5 (capable, ~5x cheaper than Opus).
// Analyze is low-frequency + quality-critical (vision + structured scoring) -> Opus 5,
// which prices identically to the 4.8 it replaces (D-070).
export const COACH_MODEL = "claude-sonnet-5";
export const ANALYZE_MODEL = "claude-opus-5";

// Effort tuning from the 2026-07-20 model/effort benchmark (see decisions.md D-027).
// Opus: correct on the checkable timing fact at every effort level, and its cost
// ladder is flat-to-inverted, so low buys the same accuracy at ~half the wall clock.
// That grid ran on Opus 4.8; low is carried forward on Opus 5 unmeasured (D-070).
// Sonnet: correct at medium, wrong at high/xhigh/max (it fabricated a movement the
// frames refute). Sonnet 5 defaults to high when unset, so this cap is load-bearing.
export const ANALYZE_EFFORT = "low";
export const COACH_EFFORT = "medium";

let cached: Anthropic | null = null;

export function coach(): Anthropic {
  if (!cached) {
    cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cached;
}
