import type { ModuleManifest } from "../module-runtime/types";

export const CUSTOMERS_MODULE_MANIFEST = {
  id: "customers",
  version: 1,
  kind: "domain",
  mutability: "mutable",
  description: "Модуль клиентов",
  enabledByDefault: true,
  scopeSupport: { global: true, book: true },
  capabilities: {
    api: {
      version: "v1",
      routePath: "/customers",
    },
  },
  dependencies: [],
} as const satisfies ModuleManifest;
