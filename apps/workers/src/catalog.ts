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
    id: "ops-s3-cleanup",
    envKey: "OPS_S3_CLEANUP_WORKER_INTERVAL_MS",
    defaultIntervalMs: 86_400_000,
    description:
      "Удаляет файлы из S3 по записям в ops_s3_cleanup_queue.",
  },
  {
    id: "ops-activity-log-cleanup",
    envKey: "OPS_ACTIVITY_LOG_CLEANUP_WORKER_INTERVAL_MS",
    defaultIntervalMs: 86_400_000,
    description:
      "Очищает записи activity log старше 180 дней.",
  },
] as const satisfies readonly WorkerCatalogEntry[];

export type WorkerId = (typeof WORKER_CATALOG)[number]["id"];
