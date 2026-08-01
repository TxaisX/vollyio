import type { NextConfig } from "next";

// Supabase is the only third-party origin the browser ever talks to directly
// (auth refresh, storage uploads/downloads, realtime); derived from the same
// env var the Supabase clients use so the CSP can't drift from where they
// actually point.
// THROWS rather than degrading. The original version returned empty strings when
// the env var was missing or malformed, which emits a syntactically valid CSP
// that omits the database origin: auth refresh, every storage upload and
// download, and realtime all fail in the browser, on a build that went green.
// That is a total outage whose only symptom is console errors in someone else's
// browser. A missing origin here has to stop the build.
function supabaseOrigins(): { http: string; ws: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is unset, so the CSP cannot name the database origin. " +
        "Shipping without it would block auth, storage and realtime in every browser.",
    );
  }
  let http: string;
  try {
    http = new URL(url).origin;
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL is not a valid URL (${JSON.stringify(url)}), so the CSP cannot name the database origin.`,
    );
  }
  return { http, ws: http.replace(/^http/, "ws") };
}

const { http: supabaseOrigin, ws: supabaseWsOrigin } = supabaseOrigins();

// script-src keeps 'unsafe-inline' because Next's own streaming-hydration
// script tags are inline and content-varying per request; a nonce would
// require every route to opt into dynamic rendering (including the landing
// page, which has its own Lighthouse budget). Every other directive is
// locked down, so this is a deliberate, narrow exception, not a blanket one.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // Both origins are guaranteed non-empty by the throw above, so no conditional
  // interpolation: an empty segment here would be an unnoticed hole.
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  `media-src 'self' blob: ${supabaseOrigin}`,
  // next/font/google self-hosts into /_next/static/media at build time, so no
  // font CDN is ever contacted. Verified against the live bundle.
  "font-src 'self'",
  // Vercel Analytics is same-origin in production (/_vercel/insights/script.js
  // and /_vercel/insights/event); only its debug build talks to
  // va.vercel-scripts.com, which is never shipped.
  `connect-src 'self' ${supabaseOrigin} ${supabaseWsOrigin}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  experimental: {
    viewTransition: true,
    // Reuse prefetched route payloads on click instead of refetching: tab
    // switches resolve from the router cache (instant) and refresh in the
    // background of normal use. Server actions still revalidate their paths,
    // so mutations render fresh immediately; the only staleness window is
    // read-only tab flipping within 30s.
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
