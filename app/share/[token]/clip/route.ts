import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analysisByShareToken } from "@/lib/share-read";

export const runtime = "nodejs";

// Streams a shared analysis clip to anyone holding a live share link. The
// signed storage URL stays server-side and the bytes are proxied, because the
// storage path embeds the owner's user id and must never reach the viewer
// (D-049). Range is forwarded so video scrubbing works.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const supabase = await createClient();
  const shared = await analysisByShareToken(supabase, token);
  if (!shared?.clip_path) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("clips")
    .createSignedUrl(shared.clip_path, 3600);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const range = req.headers.get("range");
  const upstream = await fetch(data.signedUrl, {
    headers: range ? { range } : undefined,
  });
  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  });
  for (const name of ["content-length", "content-range"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}
