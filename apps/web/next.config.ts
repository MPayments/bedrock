import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@bedrock/ui"],
  turbopack: {
    root: path.resolve(dirname, "../.."),
  },
};

export default nextConfig;
