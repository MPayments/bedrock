module.exports = {
  layers: {
    common: "^packages/common/",
    db: "^packages/db/",
    app: "^packages/app/",
    sdk: "^packages/sdk/",
    tooling: "^packages/tooling/",
    adapter: "^apps/",
  },
  forbidden: [
    {
      name: "no-internal-common-imports",
      from: {
        path: "^(packages/(app|sdk|tooling)/|apps/)",
      },
      to: {
        path: "^packages/common/(?!src(?:/|$))",
      },
    },
    {
      name: "app-to-adapter",
      from: { path: "^packages/app/" },
      to: { path: "^apps/" },
    },
    {
      name: "common-to-app",
      from: { path: "^packages/common/" },
      to: { path: "^packages/app/" },
    },
  ],
};
