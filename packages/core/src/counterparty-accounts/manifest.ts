import type { ModuleManifest } from "../module-runtime/types";

export const COUNTERPARTY_ACCOUNTS_MODULE_MANIFESTS = [
  {
    id: "counterparty-accounts",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Модуль счетов контрагентов",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },
    capabilities: {
      api: {
        version: "v1",
        routePath: "/counterparty-accounts",
      },
    },
    dependencies: [],
  },
  {
    id: "counterparty-account-providers",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Модуль провайдеров счетов контрагентов",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },
    capabilities: {
      api: {
        version: "v1",
        routePath: "/counterparty-account-providers",
      },
    },
    dependencies: [
      {
        moduleId: "counterparty-accounts",
        reason: "Провайдеры привязаны к счетам контрагентов",
      },
    ],
  },
] as const satisfies ModuleManifest[];
