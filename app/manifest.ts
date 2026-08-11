import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vollyio · Volleyball Form Coach",
    short_name: "Vollyio",
    // This line used to promise per-frame analysis. It survived the D-033 sweep
    // in 6e351ba that pulled the same claim off the landing page, the hero and
    // the Terms, because nothing was looking inside the manifest. The video
    // path samples roughly one frame a second and `/api/analyze` sets
    // `timeAt = () => null`, so that precision is a capability the product does
    // not have, and this is the worst surface of the lot to claim it on: the
    // description is the text an install prompt and a store listing read out,
    // so it is the promise made to somebody who has not opened the app yet.
    // `lib/landing-cinematic.test.ts` now reads this file, and it reads the
    // whole file including comments, so do not restate the old claim here.
    description:
      "Score one volleyball rep from a short clip, and get the single fix that moves your game fastest.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0f212c",
    theme_color: "#0f212c",
    icons: [
      // "any": full-bleed mark, shown as-is (never cropped).
      { src: "/icon-any-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-any-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // "maskable": ~21% safe padding so Android/PWA masks never crop the ring.
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
