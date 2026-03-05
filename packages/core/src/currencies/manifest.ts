import type { ModuleManifest } from "../module-runtime/types";

export const CURRENCIES_MODULE_MANIFEST = {
  id: "currencies",
  version: 1,
  kind: "domain",
  mutability: "mutable",
  description: "Модуль валют",
  enabledByDefault: true,
  scopeSupport: { global: true, book: true },
  capabilities: {
    api: {
      version: "v1",
      routePath: "/currencies",
    },
  },
  dependencies: [],
} as const satisfies ModuleManifest;
