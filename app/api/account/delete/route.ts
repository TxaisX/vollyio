import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumeApiQuota } from "@/lib/security/rate-limit";
import { hasTrustedMutationOrigin } from "@/lib/security/request";

// Self-serve account deletion: the Privacy Policy's deletion promise, in-app.
// Stored footage goes first (own-folder storage policies, while the session
// still exists), then delete_own_account() removes the auth user and every
// database row cascades away (profiles from auth.users, the rest from
// profiles). Storage listing failures never block the account deletion
// itself: rows and access die with the user even if a blob lingers.
export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  // Deleting the account here does not cancel anything at the payment
  // provider: the subscription lives on their side, keyed on a customer record
  // this delete is about to orphan. A player who deletes while subscribed would
  // keep being charged every month for a product they can no longer sign into,
  // and with the profile gone there is no longer a row tying the customer id to
  // a person, so even reconciling it by hand gets hard.
  //
  // So this refuses rather than silently doing the damage. It is the one thing
  // standing between "I deleted my account" and a recurring charge with no way
  // to stop it from inside the app. Cancelling for them was the alternative,
  // and it is worse: a cancellation is a billing decision, and making one on
  // someone's behalf inside a delete request they may have half-meant is not a
  // decision to take for them.
  // The read itself has to fail closed, and it did not. Discarding `error` here
  // meant an unreadable profile produced `billing = null`, which made the `pro`
  // check below false, which waved the request straight past the guard the
  // comment above calls the one thing standing between a deletion and an
  // unstoppable charge. A transient RLS or network failure was enough to do the
  // exact damage this block exists to prevent, and it would look like a normal
  // successful deletion in the logs. `maybeSingle` reports a genuinely absent
  // row as null data with a null error, so a missing profile still proceeds:
  // there is no subscription to orphan in that case.
  const { data: billing, error: billingError } = await supabase
    .from("profiles")
    .select("plan, stripe_subscription_id")
    .eq("id", user.id)
    .maybeSingle();
  if (billingError) {
    return NextResponse.json(
      {
        error:
          "We couldn't check your plan just now, so we didn't delete anything. Try again in a moment.",
      },
      { status: 503 },
    );
  }
  if (billing?.plan === "pro" && billing?.stripe_subscription_id) {
    return NextResponse.json(
      {
        error:
          "Cancel your plan first, in Settings. Deleting your account now would leave the subscription running and still charging you.",
      },
      { status: 409 },
    );
  }

  const quota = await consumeApiQuota(supabase, "account_delete");
  if (!quota.ok) {
    return NextResponse.json(
      { error: "Account deletion is unavailable. Try again." },
      { status: 503 },
    );
  }
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  for (const bucket of ["frames", "clips"] as const) {
    try {
      const { data: entries } = await supabase.storage
        .from(bucket)
        .list(user.id, { limit: 1000 });
      for (const entry of entries ?? []) {
        const prefix = `${user.id}/${entry.name}`;
        if (entry.id) {
          // A file directly under the user folder.
          await supabase.storage.from(bucket).remove([prefix]);
          continue;
        }
        // An analysis folder: remove its files.
        const { data: files } = await supabase.storage
          .from(bucket)
          .list(prefix, { limit: 1000 });
        const names = (files ?? []).map((f) => `${prefix}/${f.name}`);
        if (names.length > 0) {
          await supabase.storage.from(bucket).remove(names);
        }
      }
    } catch {
      // Continue: deleting the account is the promise that must not fail.
    }
  }

  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    return NextResponse.json(
      { error: "The account couldn't be deleted. Try again, or email support." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
