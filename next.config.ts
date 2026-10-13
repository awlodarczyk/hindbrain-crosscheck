import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["better-sqlite3", "@node-rs/argon2"],
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
