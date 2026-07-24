import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vollyio · Volleyball Form Coach",
    short_name: "Vollyio",
    description:
      "Record a rep, get frame-by-frame form analysis for every volleyball skill.",
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
