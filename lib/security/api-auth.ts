import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createBearerClient } from "@/lib/supabase/bearer";
import { mutationGate } from "@/lib/security/request";

export type MutationClient =
  | { ok: true; supabase: SupabaseClient; user: User | null; mode: "cookie" | "bearer" }
  | { ok: false; response: NextResponse };

export type MutationAuth =
  | { ok: true; supabase: SupabaseClient; user: User; mode: "cookie" | "bearer" }
  | { ok: false; response: NextResponse };

function deny(status: number, error: string): { ok: false; response: NextResponse } {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/**
 * Prove the caller's credential and hand back the client that matches it,
 * WITHOUT requiring the credential to belong to anybody (D-120).
 *
 * This is the shape `/api/report` needs and the reason the two functions are
 * split. That route must keep working with no account at all, because the
 * person best placed to report a public share page is the stranger who opened
 * the link, and the SECURITY DEFINER function is the only thing allowed to
 * decide which surfaces an anonymous caller may reach.
 *
 * A bearer token still has to be real even here. Presenting a bad token is an
 * error, never an invitation to be served as anonymous instead: silently
 * downgrading would mean an expired app session quietly files reports the
 * database attributes to nobody, and the reporter would never learn their
 * session had lapsed.
 *
 * The CLIENT is what comes back, not just a verdict. A route that proved a
 * bearer token and then reached for `createClient()` out of habit would
 * authorize the app's request and perform it as whoever the cookie jar held,
 * which on a shared device is a different player. Returning the one client that
 * matches the credential just verified is what makes that mistake impossible to
 * make quietly.
 */
export async function mutationClient(
  request: Request,
  options: { forbiddenMessage?: string } = {},
): Promise<MutationClient> {
  const gate = mutationGate(request);

  if (gate.mode === "reject") {
    return deny(403, options.forbiddenMessage ?? "Forbidden.");
  }

  if (gate.mode === "bearer") {
    const supabase = createBearerClient(gate.token);
    if (!supabase) return deny(503, "Sign-in is unavailable right now.");

    // Verified against the auth server rather than decoded here. A JWT this
    // process parsed itself is a claim; only the issuer can say the signature
    // holds, the token has not expired, and the account still exists.
    const { data, error } = await supabase.auth.getUser(gate.token);
    if (error || !data.user) return deny(401, "Please log in.");
    return { ok: true, supabase, user: data.user, mode: "bearer" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { ok: true, supabase, user, mode: "cookie" };
}

/**
 * The opening line of every mutation route that requires an account.
 *
 * Replaces the `hasTrustedMutationOrigin` guard plus the `createClient` /
 * `getUser` pair that used to be copied into six of them. `mode` is returned
 * for callers that legitimately need to branch on surface, and never for
 * authorization: nothing may become more permissive because a request called
 * itself native, and the mode is derived from which credential was proven
 * rather than from anything the caller asserted about itself.
 */
export async function authenticateMutation(
  request: Request,
  options: { forbiddenMessage?: string } = {},
): Promise<MutationAuth> {
  const result = await mutationClient(request, options);
  if (!result.ok) return result;
  if (!result.user) return deny(401, "Please log in.");
  return { ok: true, supabase: result.supabase, user: result.user, mode: result.mode };
}
