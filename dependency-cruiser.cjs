module.exports = {
  layers: {
    kernel: "^packages/kernel/",
    db: "^packages/db/",
    core: "^packages/core/",
    application: "^packages/application/",
    sdk: "^packages/sdk/",
    tooling: "^packages/tooling/",
    adapter: "^apps/",
  },
  forbidden: [
    {
      name: "no-internal-kernel-imports",
      from: {
        path: "^(packages/(application|core|sdk|tooling)/|apps/)",
      },
      to: {
        path: "^packages/kernel/(?!src(?:/|$))",
      },
    },
    {
      name: "application-to-adapter",
      from: { path: "^packages/application/" },
      to: { path: "^apps/" },
    },
    {
      name: "core-to-adapter",
      from: { path: "^packages/core/" },
      to: { path: "^apps/" },
    },
    {
      name: "core-to-application",
      from: { path: "^packages/core/" },
      to: { path: "^packages/application/" },
    },
  ],
};
