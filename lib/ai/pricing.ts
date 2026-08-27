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

const PER_MTOK: Record<string, { input: number; output: number }> = {
  // The two live ids (D-098), read from the gateway's own model listing on
  // 2026-08-06 rather than hand-copied from a pricing page. Gateway spend is
  // PREPAID, so the account balance is the real ceiling and these rates only
  // feed the month-to-date estimate; the app cannot see the balance at all.
  //
  // Adding a model id to lib/ai/client.ts without adding its row here is a
  // production outage waiting for someone to set ANALYZE_MONTHLY_BUDGET_USD:
  // the throw below is deliberate, the budget guard fails CLOSED on a spend it
  // cannot price, and the symptom is a calm 503 for every player at once. That
  // very gap shipped once, between the analyze route moving to the gateway and
  // this row landing. lib/ai/pricing.test.ts now pins the two together.
  //
  // Read from the gateway's model listing again on 2026-08-27, when the vision
  // path moved to 3.7-flash. That listing now prices 3.6-flash at 0.75 / 3.75,
  // half the row below, which was itself read from the same listing on
  // 2026-08-06. Whether the price was cut or the first reading was wrong is not
  // determinable after the fact, so the row STAYS at the higher pair: it prices
  // history only now, an estimate may overstate and must never understate, and
  // a row edited on a guess is worse than one left conservative.
  "google/gemini-3.7-flash": { input: 0.375, output: 1.875 },
  "google/gemini-3.6-flash": { input: 1.5, output: 7.5 },
  // Rounded up from the listed 0.0882 / 0.1764: an estimate must never
  // understate, and the sub-cent precision buys nothing at this scale.
  "deepseek/deepseek-v4-flash": { input: 0.09, output: 0.18 },
  // The wind-down id (D-131). Listed at zero in both directions on the
  // gateway; the row exists so the budget guard and the usage report keep
  // pricing every stored row rather than throwing on the live one.
  "minimax/minimax-m3:free": { input: 0, output: 0 },
  // The retired coaching-service tiers stay priced. Telemetry rows written
  // before D-098 carry these model strings, and estimateCostUsd throws on a
  // model with no row, so dropping them would make the month-to-date spend read
  // throw on history rather than price it.
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
