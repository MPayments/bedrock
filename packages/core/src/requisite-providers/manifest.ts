import type { ModuleManifest } from "../module-runtime/types";

export const REQUISITE_PROVIDERS_MODULE_MANIFEST = {
  id: "requisite-providers",
  version: 1,
  kind: "domain",
  mutability: "mutable",
  description: "Модуль провайдеров реквизитов",
  enabledByDefault: true,
  scopeSupport: { global: true, book: true },
  capabilities: {
    api: {
      version: "v1",
      routePath: "/requisite-providers",
    },
  },
  dependencies: [],
} as const satisfies ModuleManifest;
