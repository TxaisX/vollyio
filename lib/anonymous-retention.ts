/**
 * Which anonymous sessions have outlived their purpose (D-118).
 *
 * The free read hands a stranger a real `auth.users` row and then takes their
 * footage, which is usually filmed at a gym full of other people's children.
 * Most of those strangers never come back. Nothing else in the product ever
 * removes them, so without this they accumulate forever: film belonging to
 * somebody who never gave us an email address, kept indefinitely, against a
 * Privacy Policy that promises the film goes when the account goes (D-024).
 *
 * Deleting the `auth.users` row is enough to keep that promise. `profiles`
 * cascades from it, `analyses` cascades from `profiles`, and migration 015's
 * trigger calls the purge-user-media edge function on delete. This module only
 * has to answer WHICH rows, and it has to be wrong in one direction only.
 *
 * EVERY UNCERTAINTY RESOLVES TO "KEEP". A row that is skipped by mistake costs
 * storage; a row deleted by mistake destroys a player's account and their film.
 * So a missing flag, an unparseable date, a malformed id and an unexpected
 * shape are all silently kept, and only a row that is provably an expired
 * anonymous session is ever returned.
 */

// Long enough that somebody who read their breakdown, thought about it, and
// came back a few weeks later still finds it waiting. Short enough that footage
// from a stranger who never returned does not sit on our storage for a year.
export const ANONYMOUS_RETENTION_DAYS = 30;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DAY_MS = 86_400_000;

function isExpiredAnonymous(row: unknown, nowMs: number, days: number): string | null {
  if (typeof row !== "object" || row === null) return null;
  const { id, created_at: createdAt, is_anonymous: isAnonymous, email } = row as Record<
    string,
    unknown
  >;

  // Strictly true. A missing flag is not a false one: an admin listing that
  // stopped returning the field would otherwise read as "everybody is
  // anonymous" and this would propose deleting the entire user table.
  if (isAnonymous !== true) return null;

  // Belt and braces, and it is not redundant. An address means somebody claimed
  // this row, and if the flag and the address ever disagree the address is the
  // one that represents a human being who typed something. Keep, and let the
  // disagreement be somebody's bug rather than somebody's loss.
  if (typeof email === "string" && email.trim() !== "") return null;

  if (typeof id !== "string" || !UUID_PATTERN.test(id)) return null;

  if (typeof createdAt !== "string") return null;
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return null;

  // A row from the future is a clock problem, not an expired session.
  const ageMs = nowMs - created;
  if (ageMs < 0) return null;

  return ageMs > days * DAY_MS ? id : null;
}

/**
 * The ids safe to delete, in the order they arrived.
 *
 * `rows` is whatever the admin listing returned, typed as unknown because it is
 * JSON off the wire and the one thing this must never do is trust its shape.
 */
export function expiredAnonymousIds(
  rows: unknown,
  now: string | number | Date,
  days: number = ANONYMOUS_RETENTION_DAYS,
): string[] {
  if (!Array.isArray(rows)) return [];

  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(nowMs)) return [];

  // A nonsense retention window must not become a purge of everything. Zero or
  // negative would delete every anonymous row including the one created a
  // second ago, which is precisely the mistake a typo produces.
  if (!Number.isFinite(days) || days < 1) return [];

  const ids: string[] = [];
  for (const row of rows) {
    const id = isExpiredAnonymous(row, nowMs, days);
    if (id) ids.push(id);
  }
  return ids;
}
