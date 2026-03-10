module.exports = {
  layers: {
    bedrock: "^packages/bedrock/",
    domains: "^packages/domains/",
    db: "^packages/db/",
    sdk: "^packages/sdk/",
    apps: "^apps/",
  },
  forbidden: [
    {
      name: "bedrock-to-domains",
      from: {
        path: "^packages/bedrock/",
      },
      to: {
        path: "^packages/domains/",
      },
    },
    {
      name: "domains-to-apps",
      from: { path: "^packages/domains/" },
      to: { path: "^apps/" },
    },
    {
      name: "bedrock-to-apps",
      from: { path: "^packages/bedrock/" },
      to: { path: "^apps/" },
    },
    {
      name: "ui-to-bedrock",
      from: { path: "^packages/sdk/ui/" },
      to: { path: "^packages/bedrock/" },
    },
    {
      name: "ui-to-domains",
      from: { path: "^packages/sdk/ui/" },
      to: { path: "^packages/domains/" },
    },
    {
      name: "ui-to-db",
      from: { path: "^packages/sdk/ui/" },
      to: { path: "^packages/db/" },
    },
    {
      name: "ui-to-apps",
      from: { path: "^packages/sdk/ui/" },
      to: { path: "^apps/" },
    },
  ],
};
