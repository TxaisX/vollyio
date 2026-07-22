// Client-safe share constants (no node:crypto import, unlike share-token.ts).
// The lifetime mirrors the expires_at default in 019_share_links.sql; the
// share contract test pins the two together.
export const SHARE_LINK_TTL_DAYS = 30;
