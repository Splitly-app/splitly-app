import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    if (!target) return [];
    const origin = new URL(target).origin;
    return [{ source: "/api/:path*", destination: `${origin}/:path*` }];
  },
};
export default config;
