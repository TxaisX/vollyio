export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

// Contact address shown on the legal pages. Set NEXT_PUBLIC_SUPPORT_EMAIL to
// a real monitored mailbox in production; the fallback derives from SITE_URL
// so a placeholder never points at a domain we don't control.
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ??
  `support@${new URL(SITE_URL).hostname.replace(/^www\./, "")}`;
