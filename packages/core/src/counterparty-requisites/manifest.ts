import type { ModuleManifest } from "../module-runtime/types";

export const COUNTERPARTY_REQUISITES_MODULE_MANIFEST = {
  id: "counterparty-requisites",
  version: 1,
  kind: "domain",
  mutability: "mutable",
  description: "Модуль реквизитов контрагентов",
  enabledByDefault: true,
  scopeSupport: { global: true, book: true },
  capabilities: {
    api: {
      version: "v1",
      routePath: "/counterparty-requisites",
    },
  },
  dependencies: [
    {
      moduleId: "counterparties",
      reason: "Реквизиты привязаны к контрагентам",
    },
  ],
} as const satisfies ModuleManifest;
