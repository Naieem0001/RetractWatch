import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
  // Keep local app/api routes local. Rewriting to localhost:3000 from the same
  // app causes self-proxy loops and hung requests in single-app dev setup.
  async rewrites() {
    return [];
  },
};

export default nextConfig;
