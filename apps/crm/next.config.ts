import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@bedrock/sdk-clients-ui",
    "@bedrock/sdk-organizations-ui",
    "@bedrock/sdk-parties-ui",
    "@bedrock/sdk-tables-ui",
    "@bedrock/sdk-ui",
    "@bedrock/sdk-users-ui",
  ],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  redirects: async () => [
    {
      source: "/clients",
      destination: "/customers",
      permanent: false,
    },
    {
      source: "/clients/:path*",
      destination: "/customers/:path*",
      permanent: false,
    },
    {
      source: "/reports/clients",
      destination: "/reports/customers",
      permanent: false,
    },
    {
      source: "/reports/clients/:path*",
      destination: "/reports/customers/:path*",
      permanent: false,
    },
  ],
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
