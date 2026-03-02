module.exports = {
  layers: {
    foundation: "^packages/(foundation|db)(/|$)",
    platform: "^packages/platform/",
    modules: "^packages/modules/",
    sdk: "^packages/sdk/",
    tooling: "^packages/tooling/",
    adapter: "^apps/",
  },
  forbidden: [
    {
      name: "no-internal-foundation-imports",
      from: {
        path: "^(packages/(modules|platform|sdk|tooling)/|apps/)",
      },
      to: {
        path: "^packages/foundation/(?!src/)",
      },
    },
    {
      name: "modules-to-adapter",
      from: { path: "^packages/modules/" },
      to: { path: "^apps/" },
    },
    {
      name: "platform-to-adapter",
      from: { path: "^packages/platform/" },
      to: { path: "^apps/" },
    },
  ],
};
