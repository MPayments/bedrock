import type { ModuleManifest } from "../module-runtime/types";

export const RECONCILIATION_MODULE_MANIFEST = {
  id: "reconciliation",
  version: 1,
  kind: "domain",
  mutability: "mutable",
  description: "Рантайм сверки",
  enabledByDefault: true,
  scopeSupport: { global: true, book: true },
  capabilities: {
    api: {
      version: "v1",
      routePath: "/reconciliation",
    },
    workers: [
      {
        id: "reconciliation",
        envKey: "RECONCILIATION_WORKER_INTERVAL_MS",
        defaultIntervalMs: 60_000,
        description: "Запускает батчи сверки для ожидающих внешних записей.",
      },
    ],
  },
  dependencies: [
    {
      moduleId: "documents",
      reason: "Сверка использует document workflow для корректировок",
    },
    {
      moduleId: "idempotency",
      reason: "Записи сверки идемпотентны",
    },
  ],
} as const satisfies ModuleManifest;
