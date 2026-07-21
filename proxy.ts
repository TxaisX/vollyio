import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = [
  "/dashboard",
  "/analyze",
  "/analysis",
  "/history",
  "/drills",
  "/coach",
  "/scoreboard",
  "/goals",
  "/settings",
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Local JWT verification first (no network): the token is checked against
  // the project's public signing keys, cached per instance. Only an expired
  // or missing token falls back to getUser(), whose network call refreshes
  // the session and rewrites cookies. This keeps the per-navigation cost of
  // auth at microseconds instead of an auth-server round trip.
  let userId: string | null = null;
  try {
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const sub = claimsData?.claims?.sub;
    if (!claimsError && typeof sub === "string" && sub.length > 0) userId = sub;
  } catch {
    // Fall through to the refresh path.
  }
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  const path = request.nextUrl.pathname;

  if (!userId && PROTECTED.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (userId && (path === "/" || path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|icon-|apple-icon|manifest|offline|robots.txt|sitemap.xml|opengraph-image|api/).*)",
  ],
};
