export const ORGANIZATIONS_MODULE_MANIFEST = {
  id: "organizations",
  version: 1,
  kind: "domain",
  mutability: "mutable",
  description: "Модуль организаций",
  enabledByDefault: true,
  scopeSupport: { global: true, book: true },
  capabilities: {
    api: {
      version: "v1",
      routePath: "/organizations",
    },
  },
  dependencies: [],
} as const;
