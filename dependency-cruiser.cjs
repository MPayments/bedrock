const PLATFORM_PACKAGES = [
  "kernel",
  "db",
  "idempotency",
  "books",
  "documents",
  "balances",
  "reconciliation",
  "dimensions",
  "ledger",
  "accounting",
  "book-accounts",
];

const APPLICATION_PACKAGES = [
  "doc-types",
  "document-registry",
  "fx",
  "fees",
  "operational-accounts",
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
    {
      name: "ledger-to-dimensions",
      comment: "@bedrock/ledger raw reads must not depend on label infra.",
      from: {
        path: "^packages/ledger/",
      },
      to: {
        path: "^packages/dimensions/",
      },
    },
    {
      name: "documents-to-application",
      comment: "@bedrock/documents must stay domain-agnostic.",
      from: {
        path: "^packages/documents/",
      },
      to: {
        path: `^packages/(?:${APPLICATION_PACKAGES.join("|")})/`,
      },
    },
    {
      name: "accounting-to-documents",
      comment: "@bedrock/accounting runtime must not depend on documents.",
      from: {
        path: "^packages/accounting/",
      },
      to: {
        path: "^packages/documents/",
      },
    },
    {
      name: "accounting-to-application",
      comment: "@bedrock/accounting runtime must not depend on domains.",
      from: {
        path: "^packages/accounting/",
      },
      to: {
        path: `^packages/(?:${APPLICATION_PACKAGES.join("|")})/`,
      },
    },
  ],
};
