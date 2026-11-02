import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  // The console reaches the API on its own origin, so its session cookie is
  // first-party and no API key or token is ever handled by page scripts.
  //
  // /v1/public goes the same way, for a different reason: proxying keeps the
  // paste box on this origin (no CORS preflight, no API address in the bundle)
  // while still passing the visitor's own address through x-forwarded-for, which
  // is what the API's per-IP fair-use limit counts. The public endpoints take no
  // key, so nothing secret passes through here.
  //
  // IMPORTANT: rewrites() runs at BUILD time and the resolved destination is
  // written into .next/routes-manifest.json. Setting QWENCH_API_URL only at run
  // time does nothing — `next start` serves whatever was baked in. In Docker it
  // has to be a build arg, which is why the Dockerfile and docker-compose.yml
  // pass it both ways. Get this wrong and the webapp container proxies to
  // itself, which is how the console silently stopped reaching the API.
  async rewrites() {
    const api = process.env.QWENCH_API_URL || "http://localhost:4000";
    return [
      { source: "/v1/console/:path*", destination: `${api}/v1/console/:path*` },
      { source: "/v1/public/:path*", destination: `${api}/v1/public/:path*` },
    ];
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
