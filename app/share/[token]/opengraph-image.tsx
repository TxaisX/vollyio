import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { analysisByShareToken } from "@/lib/share-read";
import { SKILL_LABEL } from "@/lib/skills";
import { scoreBand } from "@/lib/ratings";
import { displayScore } from "@/lib/score-precision";

export const runtime = "nodejs";
export const alt = "Vollyio breakdown";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Link-preview card for a shared breakdown: score, skill, priority fix.
// Rendered server-side from the same bounded RPC projection as the page; a
// dead link renders the generic card instead of leaking anything.
export default async function OgImage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const shared = await analysisByShareToken(supabase, token);

  const navy = "#0f212c";
  const chalk = "#f2efe6";
  const chalkDim = "#b9c4c9";
  const gold = "#e8b93b";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: navy,
          color: chalk,
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: 2, color: gold }}>
            VOLLYIO
          </div>
          <div style={{ fontSize: 24, color: chalkDim, textTransform: "uppercase", letterSpacing: 3 }}>
            Breakdown
          </div>
        </div>

        {shared ? (
          <div style={{ display: "flex", alignItems: "center", gap: 64 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 220,
                height: 220,
                borderRadius: 110,
                border: `10px solid ${gold}`,
                fontSize: 88,
                fontWeight: 700,
              }}
            >
              {displayScore(shared.overall_score)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 720 }}>
              <div
                style={{
                  fontSize: 30,
                  color: gold,
                  textTransform: "uppercase",
                  letterSpacing: 4,
                }}
              >
                {SKILL_LABEL[shared.skill]}
              </div>
              <div style={{ marginTop: 16, fontSize: 46, fontWeight: 700, lineHeight: 1.2 }}>
                {shared.result.priority_fix.title}
              </div>
              {/* THE NUMBER TRAVELS WITH ITS CONTEXT, or it does not travel.
                  This card is the most-distributed artifact the product makes
                  (share links were 74 of the first 219 visitors) and it is the
                  only score surface whose audience cannot open the app and see
                  the band, the scale or the caveat. It shipped as a bare 88 in
                  a gold ring to people with none of that, who read it as a
                  percentile. */}
              <div style={{ marginTop: 18, fontSize: 26, color: chalkDim }}>
                {scoreBand(shared.overall_score)} · one 10-second clip, read to
                the nearest 5
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 46, fontWeight: 700 }}>
            This breakdown is no longer shared.
          </div>
        )}

        <div style={{ fontSize: 24, color: chalkDim, letterSpacing: 3 }}>
          FILM. FIX. REPEAT.
        </div>
      </div>
    ),
    size,
  );
}
