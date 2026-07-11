import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this folder so Next.js doesn't get confused by
  // the repo-root package-lock.json (used only for local dev scripts).
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
