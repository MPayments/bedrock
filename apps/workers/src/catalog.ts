import type { WorkerCatalogEntry } from "@bedrock/platform-worker-runtime";

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
    defaultIntervalMs: 5_000,
    description: "Завершает статусы проведения документов по результатам ledger.",
  },
  {
    id: "documents-period-close",
    envKey: "DOCUMENTS_PERIOD_CLOSE_WORKER_INTERVAL_MS",
    defaultIntervalMs: 60_000,
    description:
      "Генерирует ежемесячные документы period_close и закрывает периоды контрагентов.",
  },
  {
    id: "balances",
    envKey: "BALANCES_WORKER_INTERVAL_MS",
    defaultIntervalMs: 5_000,
    description: "Проецирует проведенные записи ledger в балансовые позиции.",
  },
  {
    id: "fx-rates",
    envKey: "FX_RATES_WORKER_INTERVAL_MS",
    defaultIntervalMs: 60_000,
    description: "Refreshes stale FX rate sources.",
  },
] as const satisfies readonly WorkerCatalogEntry[];

export type WorkerId = (typeof WORKER_CATALOG)[number]["id"];
