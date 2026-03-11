module.exports = {
  layers: {
    common: "^packages/common/",
    domains: "^packages/domains/",
    db: "^packages/db/",
    ui: "^packages/ui/",
    apps: "^apps/",
  },
  forbidden: [
    {
      name: "common-to-domains",
      from: {
        path: "^packages/common/",
      },
      to: {
        path: "^packages/domains/",
      },
    },
    {
      name: "common-to-db",
      from: { path: "^packages/common/" },
      to: { path: "^packages/db/" },
    },
    {
      name: "common-to-apps",
      from: { path: "^packages/common/" },
      to: { path: "^apps/" },
    },
    {
      name: "domains-to-apps",
      from: { path: "^packages/domains/" },
      to: { path: "^apps/" },
    },
    {
      name: "domains-to-db",
      from: { path: "^packages/domains/" },
      to: { path: "^packages/db/" },
    },
    {
      name: "ui-to-common",
      from: { path: "^packages/ui/" },
      to: { path: "^packages/common/" },
    },
    {
      name: "ui-to-domains",
      from: { path: "^packages/ui/" },
      to: { path: "^packages/domains/" },
    },
    {
      name: "ui-to-db",
      from: { path: "^packages/ui/" },
      to: { path: "^packages/db/" },
    },
    {
      name: "ui-to-apps",
      from: { path: "^packages/ui/" },
      to: { path: "^apps/" },
    },
  ],
};
