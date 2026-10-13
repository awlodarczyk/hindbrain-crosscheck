import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@node-rs/argon2"],
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
