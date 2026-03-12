module.exports = {
  layers: {
    framework: "^packages/bedrock/",
    domains: "^packages/domains/",
    db: "^packages/db/",
    sdk: "^packages/sdk/",
    tooling: "^packages/tooling/",
    adapter: "^apps/",
  },
  forbidden: [
    {
      name: "framework-to-domains",
      from: {
        path: "^packages/bedrock/",
      },
      to: {
        path: "^packages/domains/",
      },
    },
    {
      name: "domains-to-adapter",
      from: { path: "^packages/domains/" },
      to: { path: "^apps/" },
    },
    {
      name: "framework-to-adapter",
      from: { path: "^packages/bedrock/" },
      to: { path: "^apps/" },
    },
  ],
};
