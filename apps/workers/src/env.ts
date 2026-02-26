import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(dir, "../../../.env") });

export const env = {
  TB_ADDRESS: process.env.TB_ADDRESS ?? "127.0.0.1:3000",
  TB_CLUSTER_ID: BigInt(process.env.TB_CLUSTER_ID ?? "0"),

  LEDGER_WORKER_INTERVAL_MS: Number(
    process.env.LEDGER_WORKER_INTERVAL_MS ?? 5_000,
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
} as const;
