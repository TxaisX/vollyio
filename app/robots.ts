import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Mirrors lib/route-guard.ts PROTECTED: a path is hidden from crawlers
      // because it holds someone's own data, not because it lives in the (app)
      // route group. /learn and /drills are static technique content and are
      // both indexable.
      disallow: [
        "/dashboard",
        "/analyze",
        "/analysis",
        "/history",
        "/progress",
        "/coach",
        "/scoreboard",
        "/goals",
        "/settings",
        "/share",
        "/offline",
        "/film",
        "/zzpreview",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
