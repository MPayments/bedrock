import type { ModuleManifest } from "@bedrock/core/module-runtime";

export const PAYMENTS_MODULE_MANIFEST = {
  id: "payments",
  version: 1,
  kind: "domain",
  mutability: "mutable",
  description: "Payments workflow module",
  enabledByDefault: true,
  scopeSupport: { global: true, book: true },
  capabilities: {
    api: {
      version: "v1",
      routePath: "/payments",
    },
    documentModules: ["payment_intent", "payment_resolution"],
  },
  dependencies: [
    {
      moduleId: "documents",
      reason: "Payments are implemented as document workflows",
    },
  ],
} as const satisfies ModuleManifest;
