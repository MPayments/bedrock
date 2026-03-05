import type { ModuleManifest } from "@bedrock/core/module-runtime";

export const FEES_MODULE_MANIFEST = {
  id: "fees",
  version: 1,
  kind: "domain",
  mutability: "mutable",
  description: "Fees runtime",
  enabledByDefault: true,
  scopeSupport: { global: true, book: true },
  capabilities: {},
  dependencies: [
    {
      moduleId: "currencies",
      reason: "Fee rules are currency-bound",
    },
  ],
} as const satisfies ModuleManifest;
