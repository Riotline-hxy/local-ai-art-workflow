import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  experimental: { proxyClientMaxBodySize: '100mb' },
};

export default nextConfig;
