import type { ModuleManifest } from "@bedrock/core/module-runtime";

export const ACCOUNTING_REPORTING_MODULE_MANIFEST = {
  id: "accounting-reporting",
  version: 1,
  kind: "domain",
  mutability: "mutable",
  description: "Accounting reporting service",
  enabledByDefault: true,
  scopeSupport: { global: true, book: true },
  capabilities: {
    api: {
      version: "v1",
      routePath: "/accounting",
    },
  },
  dependencies: [
    {
      moduleId: "accounting",
      reason: "Reporting depends on accounting data model",
    },
  ],
} as const satisfies ModuleManifest;
