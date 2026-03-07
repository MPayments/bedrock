import type { ModuleManifest } from "../module-runtime/types";

export const ORGANIZATION_REQUISITES_MODULE_MANIFEST = {
  id: "organization-requisites",
  version: 1,
  kind: "domain",
  mutability: "mutable",
  description: "Модуль реквизитов организаций",
  enabledByDefault: true,
  scopeSupport: { global: true, book: true },
  capabilities: {
    api: {
      version: "v1",
      routePath: "/organization-requisites",
    },
  },
  dependencies: [
    {
      moduleId: "counterparties",
      reason: "Реквизиты организаций привязаны к внутренним контрагентам",
    },
    {
      moduleId: "ledger",
      reason: "Реквизиты организаций хранят бухгалтерские привязки к книгам",
    },
  ],
} as const satisfies ModuleManifest;
