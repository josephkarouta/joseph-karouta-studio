import type { NextConfig } from "next";

const isPublicBeta = process.env.NEXT_PUBLIC_HEYY_PUBLIC_BETA === "true";

const nextConfig: NextConfig = {
  async headers() {
    if (!isPublicBeta) return [];

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
