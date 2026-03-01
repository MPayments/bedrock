import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(dir, "../../../.env") });

export const env = {
  TB_ADDRESS: process.env.TB_ADDRESS ?? "127.0.0.1:3000",
  TB_CLUSTER_ID: BigInt(process.env.TB_CLUSTER_ID ?? "0"),
  WORKERS_MONITORING_HOST: process.env.WORKERS_MONITORING_HOST ?? "0.0.0.0",
  WORKERS_MONITORING_PORT: Number(
    process.env.WORKERS_MONITORING_PORT ?? 8081,
  ),

  LEDGER_WORKER_INTERVAL_MS: Number(
    process.env.LEDGER_WORKER_INTERVAL_MS ?? 5_000,
  ),
  BALANCES_WORKER_INTERVAL_MS: Number(
    process.env.BALANCES_WORKER_INTERVAL_MS ?? 5_000,
  ),
  TRANSFERS_WORKER_INTERVAL_MS: Number(
    process.env.TRANSFERS_WORKER_INTERVAL_MS ?? 30_000,
  ),
  TREASURY_WORKER_INTERVAL_MS: Number(
    process.env.TREASURY_WORKER_INTERVAL_MS ?? 30_000,
  ),
  RECONCILIATION_WORKER_INTERVAL_MS: Number(
    process.env.RECONCILIATION_WORKER_INTERVAL_MS ?? 60_000,
  ),
  FX_RATES_WORKER_INTERVAL_MS: Number(
    process.env.FX_RATES_WORKER_INTERVAL_MS ?? 60_000,
  ),
  CONNECTORS_DISPATCH_WORKER_INTERVAL_MS: Number(
    process.env.CONNECTORS_DISPATCH_WORKER_INTERVAL_MS ?? 5_000,
  ),
  CONNECTORS_STATUS_POLLER_INTERVAL_MS: Number(
    process.env.CONNECTORS_STATUS_POLLER_INTERVAL_MS ?? 10_000,
  ),
  CONNECTORS_STATEMENT_INGEST_INTERVAL_MS: Number(
    process.env.CONNECTORS_STATEMENT_INGEST_INTERVAL_MS ?? 60_000,
  ),
  ORCHESTRATION_WORKER_INTERVAL_MS: Number(
    process.env.ORCHESTRATION_WORKER_INTERVAL_MS ?? 5_000,
  ),
} as const;
