export const DOCUMENTS_MODULE_MANIFEST = {
  id: "documents",
  version: 1,
  kind: "kernel",
  mutability: "immutable",
  description: "Рантайм документооборота",
  enabledByDefault: true,
  scopeSupport: { global: true, book: true },
  capabilities: {
    workers: [
      {
        id: "documents",
        envKey: "DOCUMENTS_WORKER_INTERVAL_MS",
        defaultIntervalMs: 5_000,
        description: "Завершает статусы проведения документов по результатам ledger.",
      },
    ],
  },
  dependencies: [
    {
      moduleId: "accounting",
      reason: "Проведение документов выполняется через runtime бухгалтерии",
    },
    {
      moduleId: "ledger",
      reason: "Проведение документов записывает операции ledger",
    },
    {
      moduleId: "idempotency",
      reason: "Действия с документами используют идемпотентные квитанции действий",
    },
  ],
} as const;
