// ESTIMATE ONLY. Rates are hand-copied from the provider's public pricing,
// checked 2026-07-29: claude-opus-5 and claude-opus-4-8 both $5 in / $25 out per
// MTok (Opus 5 is a drop-in at 4.8's rate), claude-sonnet-5
// $3 / $15 sticker (an intro discount runs through 2026-08-31; the sticker rate
// is used here so estimates stay conservative). Cache reads bill at 0.1x the
// input rate, 5-minute cache writes at 1.25x. Verify in the billing console
// before treating any number derived here as billing truth.
export type UsageTokens = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
};

// claude-opus-4-8 stays priced after the D-070 switch: telemetry rows written
// before it carry that model string, and estimateCostUsd throws on a model with
// no row, so dropping it would make the month-to-date spend read throw on
// history rather than price it.
const PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
};

const CACHE_READ_MULTIPLIER = 0.1;
const CACHE_WRITE_MULTIPLIER = 1.25;

// Throws on a model with no rate row: a silent $0 would make the budget guard
// and the usage report understate spend, which is the one direction an
// estimate must never err in.
export function estimateCostUsd(tokens: UsageTokens, model: string): number {
  const rates = PER_MTOK[model];
  if (!rates) {
    throw new Error(`No pricing rates for model "${model}".`);
  }
  const perTok = 1 / 1_000_000;
  return (
    tokens.input_tokens * rates.input * perTok +
    tokens.cache_read_input_tokens * rates.input * CACHE_READ_MULTIPLIER * perTok +
    tokens.cache_creation_input_tokens * rates.input * CACHE_WRITE_MULTIPLIER * perTok +
    tokens.output_tokens * rates.output * perTok
  );
}
