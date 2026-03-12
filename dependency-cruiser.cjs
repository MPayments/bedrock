module.exports = {
  layers: {
    common: "^packages/common/",
    db: "^packages/db/",
    module: "^packages/modules/",
    platform: "^packages/platform/",
    runtime: "^packages/runtime/",
    plugin: "^packages/plugins/",
    integration: "^packages/integrations/",
    sdk: "^packages/sdk/",
    tooling: "^packages/tooling/",
    app: "^apps/",
  },
  forbidden: [
    {
      name: "no-internal-common-imports",
      from: {
        path:
          "^(packages/(modules|platform|runtime|plugins|integrations|sdk|tooling)/|apps/)",
      },
      to: {
        path: "^packages/common/(?!src(?:/|$))",
      },
    },
    {
      name: "package-to-app",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "common-to-business",
      from: { path: "^packages/common/" },
      to: {
        path:
          "^packages/(modules|platform|runtime|plugins|integrations)/",
      },
    },
  ],
};
