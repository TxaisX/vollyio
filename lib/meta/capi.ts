import "server-only";
import {
  buildCapiEvent,
  type MetaCapiEvent,
  type MetaEventInput,
} from "./events.ts";

// The server half of conversion reporting. The browser pixel is blocked for a
// large minority of visitors (content blockers, iOS Private Relay, plain
// tracker-blocking defaults), so a browser-only setup under-reports conversions
// and the reported cost-per-result is wrong in the expensive direction: the
// delivery algorithm optimizes against results it never saw.
//
// Every event sent here carries the same `event_id` the pixel sends, so the two
// halves collapse into one conversion rather than double-counting.
//
// This module can never fail a request. Ad measurement is not worth a 500 on a
// signup, so every path returns a result object and nothing throws outward.

const GRAPH_VERSION = "v21.0";

export type CapiOutcome =
  | { sent: false; reason: "not_configured" | "no_identifier" | "failed" }
  | { sent: true };

/**
 * Null unless BOTH halves of the credential are present. Absent config is the
 * normal state in local dev and preview, and it must be silent there: a warning
 * on every signup in development trains people to ignore the log.
 */
function capiConfig(): { pixelId: string; token: string } | null {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixelId || !token) return null;
  return { pixelId, token };
}

/**
 * Report one conversion. Fire-and-forget from the caller's perspective, but
 * AWAITED rather than left dangling: a serverless instance can be frozen the
 * instant the response is written, which drops an un-awaited fetch (the same
 * reason lib/analysis-telemetry.ts is awaited). One regional round trip against
 * a request that has already done its real work.
 */
export async function reportMetaConversion(
  input: MetaEventInput,
): Promise<CapiOutcome> {
  const config = capiConfig();
  if (!config) return { sent: false, reason: "not_configured" };

  const event = buildCapiEvent(input);
  // No cookie, no IP, no user agent: the platform rejects the batch outright,
  // so there is nothing to send and nothing to log about.
  if (!event) return { sent: false, reason: "no_identifier" };

  return postEvents(config, [event]);
}

async function postEvents(
  config: { pixelId: string; token: string },
  events: MetaCapiEvent[],
): Promise<CapiOutcome> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${config.pixelId}/events`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: events,
        access_token: config.token,
      }),
      // Bounded so a slow ad endpoint cannot hold a player's request open. The
      // platform's own guidance is that this call is best-effort.
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) {
      // Body, not just status: the Graph API returns 400 with a specific
      // message for a malformed field, and the status alone cannot tell a bad
      // token from a misspelled key. Never logs the token or the event body.
      const detail = await res.text().catch(() => "");
      console.error("[meta] conversion rejected", {
        status: res.status,
        detail: detail.slice(0, 300),
      });
      return { sent: false, reason: "failed" };
    }
    return { sent: true };
  } catch (err) {
    console.error("[meta] conversion send failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return { sent: false, reason: "failed" };
  }
}
