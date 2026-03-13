export const clientReachableCommonImportPaths = [
  {
    name: "@bedrock/kernel",
    message:
      "Client-reachable code must import explicit safe subpaths such as @bedrock/kernel/math, @bedrock/kernel/utils, or @bedrock/kernel/canon.",
  },
  {
    name: "@bedrock/kernel/crypto",
    message: "@bedrock/kernel/crypto is server-only.",
  },
  {
    name: "@bedrock/kernel/logger",
    message: "@bedrock/kernel/logger is server-only.",
  },
  {
    name: "@bedrock/kernel/worker-loop",
    message: "@bedrock/kernel/worker-loop is server-only.",
  },
];
