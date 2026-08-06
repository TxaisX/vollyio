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
