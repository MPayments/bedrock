export const COUNTERPARTIES_MODULE_MANIFESTS = [
  {
    id: "counterparties",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Модуль контрагентов",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },
    capabilities: {
      api: {
        version: "v1",
        routePath: "/counterparties",
      },
    },
    dependencies: [],
  },
  {
    id: "counterparty-groups",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Модуль групп контрагентов",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },
    capabilities: {
      api: {
        version: "v1",
        routePath: "/counterparty-groups",
      },
    },
    dependencies: [
      {
        moduleId: "counterparties",
        reason: "Группы агрегируют контрагентов",
      },
    ],
  },
] as const;
