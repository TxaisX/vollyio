import { createHmac, timingSafeEqual } from "node:crypto";

// The payment provider's webhook signature scheme and request encoding, kept
// pure and dependency-free so it can be unit tested headlessly and so the
// repo's dependency budget does not have to absorb a payment SDK for two
// endpoints and one HMAC (AGENTS.md, D-001 section 10.5).
//
// No secrets are read here. lib/stripe.ts owns the keys and the network.

const TOLERANCE_SECONDS = 300;

export type ParsedSignature = { timestamp: number; signatures: string[] };

// Header shape: `t=<unix seconds>,v1=<hex>[,v1=<hex>...]`. Several v1 entries
// appear while an endpoint secret is being rotated, so both must be considered.
export function parseSignatureHeader(header: string | null): ParsedSignature | null {
  if (!header) return null;
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!value) continue;
    if (key === "t") {
      if (!/^\d+$/.test(value)) return null;
      timestamp = Number(value);
    } else if (key === "v1") {
      if (/^[0-9a-f]+$/i.test(value)) signatures.push(value.toLowerCase());
    }
  }
  if (timestamp === null || !Number.isFinite(timestamp) || signatures.length === 0) {
    return null;
  }
  return { timestamp, signatures };
}

function equalHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * True only when the body was signed by this secret and the timestamp is
 * inside the replay window. Every failure path returns false: an unverified
 * webhook must be indistinguishable from a forged one.
 */
export function verifyWebhookSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowMs: number = Date.now(),
  toleranceSeconds: number = TOLERANCE_SECONDS,
): boolean {
  if (!secret) return false;
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;

  const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - parsed.timestamp);
  if (ageSeconds > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret)
    .update(`${parsed.timestamp}.${payload}`)
    .digest("hex");
  return parsed.signatures.some((candidate) => equalHex(candidate, expected));
}

type FormValue = string | number | boolean | null | undefined | FormValue[] | { [key: string]: FormValue };

/**
 * The provider's API takes form-encoded bodies with bracketed paths for nested
 * values (`line_items[0][price]`). Null and undefined are DROPPED rather than
 * stringified: sending `customer=undefined` would create a second customer for
 * a player who already has one and split their billing history in two.
 */
export function formEncode(input: Record<string, FormValue>): string {
  const pairs: string[] = [];

  const walk = (prefix: string, value: FormValue): void => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(`${prefix}[${index}]`, item));
      return;
    }
    if (typeof value === "object") {
      for (const [key, nested] of Object.entries(value)) {
        walk(`${prefix}[${key}]`, nested);
      }
      return;
    }
    pairs.push(`${encode(prefix)}=${encode(String(value))}`);
  };

  for (const [key, value] of Object.entries(input)) walk(key, value);
  return pairs.join("&");
}

// encodeURIComponent leaves these unescaped, and the API reads a raw `+` in a
// form body as a space.
function encode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, "%20")
    .replace(/\+/g, "%2B")
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}
