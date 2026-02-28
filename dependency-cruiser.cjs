const FOUNDATION_MODULES = [
  "counterparties",
  "currencies",
  "customers",
  "fees",
  "operational-accounts",
];

module.exports = {
  layers: {
    platform: "^packages/platform/",
    modules: "^packages/modules/",
    packs: "^packages/packs/",
    sdk: "^packages/sdk/",
    tooling: "^packages/tooling/",
    adapter: "^apps/",
  },
  forbidden: [
    {
      name: "platform-to-modules",
      from: { path: "^packages/platform/" },
      to: { path: "^packages/modules/" },
    },
    {
      name: "platform-to-sdk",
      from: { path: "^packages/platform/" },
      to: { path: "^packages/sdk/" },
    },
    {
      name: "platform-to-adapter",
      from: { path: "^packages/platform/" },
      to: { path: "^apps/" },
    },
    {
      name: "modules-to-adapter",
      from: { path: "^packages/modules/" },
      to: { path: "^apps/" },
    },
    {
      name: "foundation-to-modules",
      from: {
        path: `^packages/modules/(?:${FOUNDATION_MODULES.join("|")})/`,
      },
      to: { path: "^packages/modules/" },
    },
    {
      name: "packs-to-runtime",
      from: { path: "^packages/packs/" },
      to: { path: "^packages/platform/(?!accounting-contracts/)" },
    },
    {
      name: "packs-to-modules",
      from: { path: "^packages/packs/" },
      to: { path: "^packages/modules/" },
    },
    {
      name: "packs-to-sdk",
      from: { path: "^packages/packs/" },
      to: { path: "^packages/sdk/" },
    },
    {
      name: "packs-to-adapter",
      from: { path: "^packages/packs/" },
      to: { path: "^apps/" },
    },
    {
      name: "ledger-to-accounting-reporting",
      from: { path: "^packages/platform/ledger/" },
      to: { path: "^packages/modules/accounting-reporting/" },
    },
    {
      name: "ledger-to-dimensions",
      from: { path: "^packages/platform/ledger/" },
      to: { path: "^packages/platform/dimensions/" },
    },
    {
      name: "documents-to-modules",
      from: { path: "^packages/platform/documents/" },
      to: { path: "^packages/modules/" },
    },
    {
      name: "accounting-to-documents",
      from: { path: "^packages/platform/accounting/" },
      to: { path: "^packages/platform/documents/" },
    },
    {
      name: "accounting-to-modules",
      from: { path: "^packages/platform/accounting/" },
      to: { path: "^packages/modules/" },
    },
  ],
};
