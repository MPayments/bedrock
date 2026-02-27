const PLATFORM_PACKAGES = [
  "kernel",
  "db",
  "ledger",
  "accounting",
  "book-accounts",
];

const APPLICATION_PACKAGES = [
  "transfers",
  "treasury",
  "fx",
  "fees",
  "accounts",
  "counterparties",
  "customers",
  "currencies",
];

module.exports = {
  layers: {
    platform: `^packages/(?:${PLATFORM_PACKAGES.join("|")})(?:/|$)`,
    application: `^packages/(?:${APPLICATION_PACKAGES.join("|")})(?:/|$)`,
    adapter: "^apps/(?:[^/]+)(?:/|$)",
  },
  forbidden: [
    {
      name: "platform-to-application",
      comment: "Platform core modules must not depend on application modules.",
      from: {
        path: `^packages/(?:${PLATFORM_PACKAGES.join("|")})/`,
      },
      to: {
        path: `^packages/(?:${APPLICATION_PACKAGES.join("|")})/`,
      },
    },
    {
      name: "platform-to-adapter",
      comment: "Platform core modules must not depend on adapters.",
      from: {
        path: `^packages/(?:${PLATFORM_PACKAGES.join("|")})/`,
      },
      to: {
        path: "^apps/",
      },
    },
    {
      name: "application-to-adapter",
      comment: "Application modules must not depend on adapters.",
      from: {
        path: `^packages/(?:${APPLICATION_PACKAGES.join("|")})/`,
      },
      to: {
        path: "^apps/",
      },
    },
    {
      name: "ledger-to-accounting-reporting",
      comment:
        "@bedrock/ledger must not depend on accounting reporting/use-case query layer.",
      from: {
        path: "^packages/ledger/",
      },
      to: {
        path: "^packages/accounting-reporting/",
      },
    },
  ],
};
