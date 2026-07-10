import type { NextConfig } from "next";

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
};

export default nextConfig;
