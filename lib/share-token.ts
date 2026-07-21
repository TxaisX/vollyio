import { createHash, randomBytes } from "node:crypto";

// Share links carry a 32-byte token in the URL; only its sha256 lands in the
// database, so a table read never yields a working link (D-049). The token is
// shown once, at creation.
export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

// Postgres computes the same digest inside analysis_by_share_token:
// encode(sha256(convert_to(p_token, 'UTF8')), 'hex'). Keep the two in sync.
