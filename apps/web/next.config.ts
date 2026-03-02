import path from "node:path";
import { fileURLToPath } from "node:url";
// import dotenv from "dotenv";
import type { NextConfig } from "next";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// dotenv.config({ path: path.resolve(dirname, "../../.env") });

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

const nextConfig: NextConfig = {
  transpilePackages: ["@bedrock/ui"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  turbopack: {
    root: path.resolve(dirname, "../.."),
  },
  rewrites: async () => [
    {
      source: "/api/:path*",
      destination: `${API_URL}/api/:path*`,
    },
    {
      source: "/v1/:path*",
      destination: `${API_URL}/v1/:path*`,
    },
  ],
};

export default nextConfig;
