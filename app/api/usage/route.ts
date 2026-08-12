import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { estimateCostUsd, type UsageTokens } from "@/lib/ai/pricing";
import { analysesRemaining, creditsVerdict, readCredits } from "@/lib/ai/credits";

export const runtime = "nodejs";

// Dev-only spend report (D-054): 404 in production (same posture as
// /api/eval), and requires a signed-in session because the aggregate RPCs are
// granted to authenticated only. Local dev points at the production database,
// so this is how the owner reads real month-to-date spend in a browser.
// Every dollar figure is an ESTIMATE from checked-in rates
// (lib/ai/pricing.ts), never billing truth.

type UsageRow = UsageTokens & { model: string; analyses: number; day?: string };

function isUsageRow(row: unknown): row is UsageRow {
  if (row === null || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.model === "string" &&
    typeof r.analyses === "number" &&
    typeof r.input_tokens === "number" &&
    typeof r.output_tokens === "number" &&
    typeof r.cache_read_input_tokens === "number" &&
    typeof r.cache_creation_input_tokens === "number"
  );
}

function priced(row: UsageRow) {
  let estUsd: number | null;
  try {
    estUsd = Math.round(estimateCostUsd(row, row.model) * 10000) / 10000;
  } catch {
    // Unknown model: report the tokens, never fabricate a price for them.
    estUsd = null;
  }
  return { ...row, est_usd: estUsd };
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  const [month, daily] = await Promise.all([
    supabase.rpc("analyze_usage_month"),
    supabase.rpc("analyze_usage_daily", { p_days: 31 }),
  ]);
  if (
    month.error ||
    daily.error ||
    !Array.isArray(month.data) ||
    !Array.isArray(daily.data) ||
    !month.data.every(isUsageRow) ||
    !daily.data.every(isUsageRow)
  ) {
    return NextResponse.json({ error: "Usage is unavailable." }, { status: 502 });
  }

  const monthRows = month.data.map(priced);
  const analyses = monthRows.reduce((n, r) => n + r.analyses, 0);
  const anyUnpriced = monthRows.some((r) => r.est_usd === null);
  const monthEstUsd = anyUnpriced
    ? null
    : Math.round(monthRows.reduce((n, r) => n + (r.est_usd ?? 0), 0) * 100) / 100;

  // The one figure on this page that is NOT an estimate: the gateway's own
  // answer to how much prepaid credit is left. Everything else here is priced
  // from checked-in rates and can drift; this is the money.
  const credits = await readCredits();

  return NextResponse.json({
    note: "All dollar figures are estimates from checked-in rates in lib/ai/pricing.ts EXCEPT prepaid_balance, which is read from the gateway and is authoritative.",
    prepaid_balance:
      credits === null
        ? { readable: false, note: "The gateway did not answer. This is a monitoring failure, not a zero balance." }
        : {
            readable: true,
            remaining_usd: Math.round(credits.remainingUsd * 100) / 100,
            analyses_remaining: analysesRemaining(credits.remainingUsd),
            verdict: creditsVerdict(credits),
            granted_usd: credits.totalCredits,
            used_usd: Math.round(credits.totalUsage * 100) / 100,
          },
    month_to_date: {
      analyses,
      est_usd: monthEstUsd,
      est_usd_per_analysis:
        analyses > 0 && monthEstUsd !== null
          ? Math.round((monthEstUsd / analyses) * 10000) / 10000
          : null,
      by_model: monthRows,
    },
    // `budget` used to report ANALYZE_MONTHLY_BUDGET_USD against a
    // month-to-date estimate. That variable and its guard were deleted in
    // D-104, so the block reported a cap of null forever. `prepaid_balance`
    // above replaces it with the number that actually binds.
    daily: daily.data.map(priced),
  });
}
