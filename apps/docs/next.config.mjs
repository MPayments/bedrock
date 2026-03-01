import path from "node:path";
import { fileURLToPath } from "node:url";
import nextra from "nextra";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const withNextra = nextra({
  contentDirBasePath: "/docs",
  defaultShowCopyCode: true,
  staticImage: true,
});

/** @type {import("next").NextConfig} */
const nextConfig = {
  turbopack: {
    root: path.resolve(dirname, "../.."),
    resolveAlias: {
      "next-mdx-import-source-file": "./mdx-components.tsx",
    },
  },
};

export default withNextra(nextConfig);
