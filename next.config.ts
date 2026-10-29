import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@iea/circuit-sim", "@iea/voxel-engine"],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
