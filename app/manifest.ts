import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sideout — Volleyball Form Coach",
    short_name: "Sideout",
    description:
      "Record a rep, get frame-by-frame form analysis for every volleyball skill.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0f212c",
    theme_color: "#0f212c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
