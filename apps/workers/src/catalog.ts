import type { WorkerCatalogEntry } from "@bedrock/platform/worker-runtime";

export const WORKER_CATALOG = [
  {
    id: "ledger",
    envKey: "LEDGER_WORKER_INTERVAL_MS",
    defaultIntervalMs: 5_000,
    description: "Проводит отложенные операции ledger в TigerBeetle.",
  },
  {
    id: "documents",
    envKey: "DOCUMENTS_WORKER_INTERVAL_MS",
    defaultIntervalMs: 250,
    description: "Завершает статусы проведения документов по результатам ledger.",
  },
  {
    id: "documents-period-close",
    envKey: "DOCUMENTS_PERIOD_CLOSE_WORKER_INTERVAL_MS",
    defaultIntervalMs: 60_000,
    description:
      "Генерирует и отправляет на согласование ежемесячные документы period_close.",
  },
  {
    id: "balances",
    envKey: "BALANCES_WORKER_INTERVAL_MS",
    defaultIntervalMs: 5_000,
    description: "Проецирует проведенные записи ledger в балансовые позиции.",
  },
  {
    id: "treasury-rates",
    envKey: "TREASURY_RATES_WORKER_INTERVAL_MS",
    defaultIntervalMs: 60_000,
    description: "Refreshes stale treasury rate sources.",
  },
  {
    id: "reconciliation",
    envKey: "RECONCILIATION_WORKER_INTERVAL_MS",
    defaultIntervalMs: 60_000,
    description: "Обрабатывает внешние записи сверки и связывает их с операциями.",
  },
  {
    id: "deal-attachment-ingestion",
    envKey: "DEAL_ATTACHMENT_INGESTION_WORKER_INTERVAL_MS",
    defaultIntervalMs: 15_000,
    description: "Распознает загруженные инвойсы и договоры по сделкам.",
  },
  // TODO: Phase 3 — add ops-s3-cleanup and ops-activity-log-cleanup once adapters are wired
] as const satisfies readonly WorkerCatalogEntry[];

export type WorkerId = (typeof WORKER_CATALOG)[number]["id"];
