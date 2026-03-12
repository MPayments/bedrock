import type { ModuleManifest } from "../module-runtime/types";

export const REQUISITES_MODULE_MANIFEST = {
  id: "requisites",
  version: 1,
  kind: "domain",
  mutability: "mutable",
  description: "Модуль реквизитов",
  enabledByDefault: true,
  scopeSupport: { global: true, book: true },
  capabilities: {
    api: {
      version: "v1",
      routePath: "/requisites",
    },
  },
  dependencies: [],
} as const satisfies ModuleManifest;
