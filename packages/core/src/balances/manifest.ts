import type { ModuleManifest } from "../module-runtime/types";

export const BALANCES_MODULE_MANIFEST = {
  id: "balances",
  version: 1,
  kind: "domain",
  mutability: "mutable",
  description: "Рантайм и проектор балансов",
  enabledByDefault: true,
  scopeSupport: { global: true, book: true },
  capabilities: {
    api: {
      version: "v1",
      routePath: "/balances",
    },
    workers: [
      {
        id: "balances",
        envKey: "BALANCES_WORKER_INTERVAL_MS",
        defaultIntervalMs: 5_000,
        description: "Проецирует проведенные записи ledger в балансовые позиции.",
      },
    ],
  },
  dependencies: [
    {
      moduleId: "ledger",
      reason: "Баланс формируется из событий ledger",
    },
  ],
} as const satisfies ModuleManifest;
