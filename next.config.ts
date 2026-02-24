import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      // Prevent browser from caching HTML pages and RSC payloads across deploys.
      // Excludes _next/static (JS/CSS bundles with content hashes — must be cached).
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
      ],
    },
  ],
};

export default nextConfig;
