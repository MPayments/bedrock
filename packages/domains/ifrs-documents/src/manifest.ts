export const IFRS_DOCUMENTS_MODULE_MANIFEST = {
  id: "ifrs-documents",
  version: 1,
  kind: "domain",
  mutability: "mutable",
  description: "IFRS treasury/accounting document modules",
  enabledByDefault: true,
  scopeSupport: { global: true, book: true },
  capabilities: {
    workers: [
      {
        id: "documents-period-close",
        envKey: "DOCUMENTS_PERIOD_CLOSE_WORKER_INTERVAL_MS",
        defaultIntervalMs: 60_000,
        description:
          "Генерирует ежемесячные документы period_close и закрывает периоды контрагентов.",
      },
    ],
    documentModules: [
      "transfer_intra",
      "transfer_intercompany",
      "transfer_resolution",
      "capital_funding",
      "period_close",
      "period_reopen",
    ],
  },
  dependencies: [
    {
      moduleId: "documents",
      reason: "IFRS workflows are executed through the documents runtime",
    },
    {
      moduleId: "counterparties",
      reason: "Автозакрытие периода создает документы для контрагентов.",
    },
    {
      moduleId: "requisites",
      reason: "Transfer and funding modules resolve organization bindings and requisite ownership",
    },
  ],
} as const;
