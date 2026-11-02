import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  // The console reaches the API on its own origin, so its session cookie is
  // first-party and no API key or token is ever handled by page scripts.
  async rewrites() {
    const api = process.env.QWENCH_API_URL || "http://localhost:4000";
    return [{ source: "/v1/console/:path*", destination: `${api}/v1/console/:path*` }];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
