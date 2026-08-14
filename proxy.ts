import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { guardDecision } from "@/lib/route-guard";

// Read once, and do not assert non-null. This middleware matches nearly every
// path, so anything that throws in here 500s the entire site, the landing page
// and /login included. Production did exactly that: `process.env.X!` handed
// undefined to createServerClient, which threw "Your project's URL and Key are
// required to create a Supabase client!" on every request the deployment saw.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// D-118. Who is asking, and whether they ever gave us an email address.
//
// `isAnonymous` defaults to FALSE whenever the claim is absent, and that
// direction is deliberate. The two failure modes are not symmetric: reading a
// real account as anonymous locks every existing player out of their own
// settings, history and billing, while reading an anonymous session as a real
// account costs them nothing but the run of a few pages that will be empty.
// The boundary that must not fail is the one that spends money, and that one is
// not here: `reserve_analysis_entitlement` reads `is_anonymous` off the same JWT
// inside Postgres (migration 061), where no client can route around it.
type Session = { userId: string | null; isAnonymous: boolean };

const NOBODY: Session = { userId: null, isAnonymous: false };

async function verifiedSession(
  request: NextRequest,
  onResponse: (next: NextResponse) => void,
): Promise<Session> {
  // No configuration means no way to verify anyone. Report "nobody", which
  // guardDecision treats as fail-closed on protected paths.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return NOBODY;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        const next = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          next.cookies.set(name, value, options),
        );
        onResponse(next);
      },
    },
  });

  // Local JWT verification first (no network): the token is checked against
  // the project's public signing keys, cached per instance. Only an expired
  // or missing token falls back to getUser(), whose network call refreshes
  // the session and rewrites cookies. This keeps the per-navigation cost of
  // auth at microseconds instead of an auth-server round trip.
  try {
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const claims = claimsData?.claims as
      | { sub?: unknown; is_anonymous?: unknown }
      | undefined;
    const sub = claims?.sub;
    if (!claimsError && typeof sub === "string" && sub.length > 0) {
      return { userId: sub, isAnonymous: claims?.is_anonymous === true };
    }
  } catch {
    // Fall through to the refresh path.
  }

  // Also guarded: an auth-service blip or a clock-skew rejection here used to
  // propagate out of the middleware and take every page down with it.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NOBODY;
    return { userId: user.id, isAnonymous: user.is_anonymous === true };
  } catch {
    return NOBODY;
  }
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { userId, isAnonymous } = await verifiedSession(request, (next) => {
    response = next;
  });

  switch (guardDecision(request.nextUrl.pathname, userId, isAnonymous)) {
    case "to-login": {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    case "to-dashboard": {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    case "to-signup": {
      const url = request.nextUrl.clone();
      url.pathname = "/signup";
      return NextResponse.redirect(url);
    }
    default:
      return response;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|icon-|apple-icon|manifest|offline|robots.txt|sitemap.xml|opengraph-image|api/).*)",
  ],
};
