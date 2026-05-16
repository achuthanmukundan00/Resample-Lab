import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // Cloudflare Pages does not support Next.js ISR/SSR — static export only.
  // The API backend must run separately (see docs/deployment.md).
};

export default nextConfig;
