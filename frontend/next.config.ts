import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // In production, the frontend serves the SPA behind NPM. NPM routes the whole
  // domain here, so API calls to /api/v1 must be proxied to the backend service.
  // The backend container is reachable by its service name on the shared network.
  async rewrites() {
    const backend =
      process.env.BACKEND_INTERNAL_URL || "http://arxivtd-backend:8000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backend}/api/v1/:path*`,
      },
    ];
  },
  // Prevent browser/CDN from caching auth + account pages for a year. The register
  // page embeds the cloudflare Turnstile widget, which needs the freshest JS; a
  // stale cached copy serves an empty/broken widget.
  async headers() {
    return [
      {
        source: "/(register|login|dashboard|pricing|analyze)/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/register",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
