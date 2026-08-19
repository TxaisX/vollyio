import { NextResponse } from "next/server";
import { authenticateMutation } from "@/lib/security/api-auth";
import { appContentPayload } from "@/lib/app-content";

export const runtime = "nodejs";

// The native client's copy of the content corpus (drills, technique, rehab).
//
// A GET, but gated by the mutation credential check on purpose: the corpus is
// what an account buys (D-122), and `authenticateMutation` is the one proven
// way this server accepts the app's bearer token (D-120). A plain browser GET
// carries no Origin header and is rejected by that gate - fine, because the
// web has its own rendered pages and this route exists only for the app. An
// anonymous or bad credential is denied, never downgraded.
//
// The payload is identical for every caller, so the only per-request work is
// proving the credential.
export async function GET(request: Request) {
  const auth = await authenticateMutation(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json(appContentPayload(), {
    // Private: the body is the same for everyone, but the response was earned
    // by a credential and must never come out of a shared cache without one.
    headers: { "cache-control": "private, max-age=3600" },
  });
}
