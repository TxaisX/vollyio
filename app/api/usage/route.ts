import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { estimateCostUsd, type UsageTokens } from "@/lib/ai/pricing";

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

  const capRaw = process.env.ANALYZE_MONTHLY_BUDGET_USD;
  const capUsd = capRaw && Number.isFinite(Number(capRaw)) ? Number(capRaw) : null;

  return NextResponse.json({
    note: "All dollar figures are estimates from checked-in rates in lib/ai/pricing.ts; verify against the billing console before treating them as truth.",
    month_to_date: {
      analyses,
      est_usd: monthEstUsd,
      est_usd_per_analysis:
        analyses > 0 && monthEstUsd !== null
          ? Math.round((monthEstUsd / analyses) * 10000) / 10000
          : null,
      by_model: monthRows,
    },
    budget: {
      cap_usd: capUsd,
      est_remaining_usd:
        capUsd !== null && monthEstUsd !== null
          ? Math.round((capUsd - monthEstUsd) * 100) / 100
          : null,
    },
    daily: daily.data.map(priced),
  });
}
