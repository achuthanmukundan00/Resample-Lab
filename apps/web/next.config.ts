import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // Cloudflare Pages does not support Next.js ISR/SSR — static export only.
  // The API backend must run separately (see docs/deployment.md).
  //
  // Subpath deployment: set NEXT_PUBLIC_BASE_PATH=/rlab to serve under
  // watchyourtemper.com/rlab . When omitted the app serves from root,
  // preserving the standalone Pages URL.
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
