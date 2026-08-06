import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// D-004 (CS-5): cheapest capable model per call.
// Coach chat is the high-frequency path -> Sonnet 5 (capable, ~5x cheaper than Opus).
// Analyze is low-frequency + quality-critical (vision + structured scoring) -> Opus 5,
// which prices identically to the 4.8 it replaces (D-070).
export const COACH_MODEL = "claude-sonnet-5";
export const ANALYZE_MODEL = "claude-opus-5";

// Coach CHAT only, through the gateway (lib/ai/chat.ts). Split from COACH_MODEL
// on 2026-08-05 because the two jobs stopped being the same job: the weekly
// plan asks for one schema-bound object and stays on the coaching service,
// while the chat streams prose to a player many times a session and is the
// app's highest-frequency paid path.
//
// Measured before switching (docs/model-findings-2026-08-05.md): coaching
// substance was comparable across four real player questions, both models
// refused to fabricate a rating, cited real scores, leaked no vendor and
// resisted an injection smuggled into a player-typed goal title. What decided
// it was fit and price. Against an 800-token ceiling Sonnet was cut off on
// four answers of four and this model on one of four -- it finishes a coaching
// answer inside a budget a phone-sized chat has to impose -- at roughly $0.09
// /$0.18 per MTok against $2/$10, which on this path is not a rounding error.
//
// Like VISION_MODEL, the id carries a slash the coaching SDK would 404 on.
// That is the intended tripwire: nothing may pass this to coach().
export const CHAT_MODEL = "deepseek/deepseek-v4-flash";

// D-093: reading pixels and writing coaching are two jobs, and as of the
// 2026-08-04 bakeoff they have different winners. The FRAME READ goes to Gemini
// 3.6 Flash through the gateway in lib/ai/vision.ts: it led the vision
// leaderboards Claude was not even entered on, and prices at $1.50/$7.50 per
// MTok against Opus 5's $5/$25. Everything that writes PROSE a player reads --
// coach chat, the weekly plan, the analysis report text -- stays on the models
// above and on ANTHROPIC_API_KEY, which is the half of the split the bakeoff
// gave no reason to move.
//
// The id carries a slash and the coaching SDK would 404 on it: that is the
// intended tripwire. Nothing may pass VISION_MODEL to coach().
export const VISION_MODEL = "google/gemini-3.6-flash";

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
