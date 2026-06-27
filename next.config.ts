import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  async rewrites() {
    return [];
  },
};

export default nextConfig;
