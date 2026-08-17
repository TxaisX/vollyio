// D-124. Who gets the tester comp, who loses it, and every uncertainty's
// direction. Pure and tested, because entitlement moves here: the script
// (scripts/tester-comps.mjs) is only IO around these two lists.
//
// The deal, as the invite card states it: join the vollyio-testers group and
// stay through the closed test, and Pro is comped for 30 days. Leave the group
// early and the comp ends with the membership, because the comp buys TESTING,
// not a month of allowance for a drive-by join.
//
// A comp is distinguishable from a purchase by construction: a comped account
// has plan 'pro' with NO stripe_subscription_id, and carries the server-only
// `tester_comp_until` marker in auth app_metadata, which nothing a player can
// reach may write. An account with a real subscription is NEVER touched in
// either direction: money always outranks the comp.
//
// One comp per account, ever. An expired or revoked comp leaves its marker in
// place, and the marker's presence blocks a re-grant, so leave-and-rejoin
// farms nothing.

export const TESTER_COMP_DAYS = 30;

export type TesterCompRow = {
  id: string;
  email: string | null;
  isAnonymous: boolean;
  plan: string | null;
  hasSubscription: boolean;
  testerCompUntil: string | null;
};

export type TesterCompActions = {
  grant: TesterCompRow[];
  revoke: { row: TesterCompRow; reason: "left_group" | "expired" }[];
};

function parseInstant(value: string | null): number | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

export function testerCompActions(
  rows: TesterCompRow[],
  memberEmails: string[],
  nowIso: string,
): TesterCompActions {
  const now = Date.parse(nowIso);
  const members = new Set(
    memberEmails.map((e) => e.trim().toLowerCase()).filter((e) => e.length > 0),
  );

  const grant: TesterCompRow[] = [];
  const revoke: TesterCompActions["revoke"] = [];

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase() ?? null;
    // No email or an anonymous session: not a tester in any sense we can
    // verify. Resolve to "do nothing", the direction that moves no plan.
    if (!email || row.isAnonymous) continue;
    // A real subscription outranks the comp in both directions.
    if (row.hasSubscription) continue;

    const isMember = members.has(email);
    const compUntil = parseInstant(row.testerCompUntil);
    const marked = row.testerCompUntil !== null;

    if (isMember && !marked && row.plan === "free") {
      grant.push(row);
      continue;
    }

    // Only rows this programme marked are this programme's to take back: a
    // comp granted by hand for some other reason has no marker and is left
    // exactly as the owner set it.
    if (marked && row.plan === "pro") {
      if (!isMember) {
        revoke.push({ row, reason: "left_group" });
      } else if (compUntil !== null && compUntil < now) {
        revoke.push({ row, reason: "expired" });
      }
      // An unparseable marker date on a member resolves to "keep": wrongly
      // extending a comp costs allowance, wrongly revoking one breaks the
      // promise the card made.
    }
  }

  return { grant, revoke };
}
