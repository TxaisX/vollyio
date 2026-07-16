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
