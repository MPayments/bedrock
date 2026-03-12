import type { ModuleManifest } from "../module-runtime/types";

export const ACCOUNTING_MODULE_MANIFEST = {
  id: "accounting",
  version: 1,
  kind: "kernel",
  mutability: "immutable",
  description: "Рантайм бухгалтерии",
  enabledByDefault: true,
  scopeSupport: { global: true, book: true },
  capabilities: {
    api: {
      version: "v1",
      routePath: "/accounting",
    },
  },
  dependencies: [
    {
      moduleId: "ledger",
      reason: "Проведение бухгалтерии сохраняется через операции ledger",
    },
    {
      moduleId: "idempotency",
      reason: "Записи бухгалтерии опираются на идемпотентную семантику операций",
    },
  ],
} as const satisfies ModuleManifest;
