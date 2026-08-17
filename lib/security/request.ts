import { timingSafeEqual } from "node:crypto";

const JSON_CONTENT_TYPE = "application/json";

export type JsonRequestResult =
  | { ok: true; value: unknown }
  | {
      ok: false;
      error: "unsupported_media_type" | "payload_too_large" | "invalid_json";
    };

export async function readJsonRequest(
  request: Request,
  maxBytes: number,
): Promise<JsonRequestResult> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== JSON_CONTENT_TYPE) {
    return { ok: false, error: "unsupported_media_type" };
  }

  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    return { ok: false, error: "payload_too_large" };
  }

  if (!request.body) return { ok: false, error: "invalid_json" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false, error: "payload_too_large" };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}

export function hasTrustedMutationOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export type MutationGate =
  | { mode: "bearer"; token: string }
  | { mode: "cookie" }
  | { mode: "reject" };

/**
 * Which credential a mutation request is allowed to be authenticated by.
 *
 * Every mutation route used to open with `hasTrustedMutationOrigin`, which is
 * correct for a browser and denies every native client by construction: an
 * Android app sends no `Origin` header, so the check that exists to stop
 * another SITE from riding a player's cookies also stopped our own app from
 * calling anything at all (D-120).
 *
 * The origin check is not a general proof of the sender. It compensates for one
 * specific property of cookies: the user agent attaches them automatically, so
 * a request carrying a valid session is not by itself evidence that the player
 * meant to send it. A Bearer token has the opposite property. Nothing attaches
 * it for you, so possession IS the intent, and a cross-site page cannot read
 * one: the web session's token is not reachable from another origin, and a
 * cross-origin request that sets `Authorization` is preflighted, which this app
 * answers with no CORS headers at all. That is this route family's answer to
 * rule 12's "then what authenticates the sender".
 *
 * THE ONE RULE THAT MAKES THIS SAFE, and the reason this is a gate rather than
 * two independent checks: an `Authorization` header COMMITS the request to the
 * bearer path, whether or not the token turns out to be any good. There is
 * deliberately no fallback to cookies, because a fallback is exactly the hole
 * this shape would otherwise open - evil.com cannot obtain a real token, but it
 * could send a junk one, and a gate that shrugged and reached for the cookie
 * jar instead would hand it the victim's session with the origin check already
 * behind it. Reject beats retry here every time.
 */
export function mutationGate(request: Request): MutationGate {
  const authorization = request.headers.get("authorization");
  if (authorization !== null) {
    // Case-insensitive scheme: RFC 7235 says auth schemes are, and rejecting a
    // spec-legal `bearer` would be a trap for any client but the one we wrote.
    const match = /^Bearer[ \t]+([^\s]+)$/i.exec(authorization.trim());
    return match ? { mode: "bearer", token: match[1] } : { mode: "reject" };
  }
  return hasTrustedMutationOrigin(request) ? { mode: "cookie" } : { mode: "reject" };
}

export function isLocalRequest(request: Request): boolean {
  try {
    const hostname = new URL(request.url).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

export function hasLocalEvalAccess(
  request: Request,
  expectedToken: string | undefined,
): boolean {
  if (!isLocalRequest(request) || !expectedToken) return false;
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const supplied = Buffer.from(authorization.slice(7), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function isJpegPayload(data: string, maxDecodedBytes: number): boolean {
  if (
    data.length < 4 ||
    data.length > Math.ceil(maxDecodedBytes / 3) * 4 + 4 ||
    data.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(data)
  ) {
    return false;
  }
  const bytes = Buffer.from(data, "base64");
  return (
    bytes.length >= 4 &&
    bytes.length <= maxDecodedBytes &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

// safeClipExtension lived here until D-097. It normalised whatever a request
// sent and fell back to "webm" on anything unrecognised, which was the right
// shape while the extension only decorated a path the analysis row already
// owned. It is not the right shape now that the extension picks which object
// the route DOWNLOADS and analyses, because a silent default there turns a
// malformed request into a read of some other file. `analyzeRequestSchema`
// carries a closed enum instead, so an unrecognised container is a 400 rather
// than a guess.
