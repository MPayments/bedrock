import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { WORKER_CATALOG } from "./catalog";

const dir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(dir, "../../../.env") });

const workerIntervals = Object.fromEntries(
  WORKER_CATALOG.map((entry) => [
    entry.id,
    Number(process.env[entry.envKey] ?? entry.defaultIntervalMs),
  ]),
) satisfies Record<string, number>;

export const env = {
  TB_ADDRESS: process.env.TB_ADDRESS ?? "127.0.0.1:3000",
  TB_CLUSTER_ID: BigInt(process.env.TB_CLUSTER_ID ?? "0"),
  WORKERS_MONITORING_HOST: process.env.WORKERS_MONITORING_HOST ?? "0.0.0.0",
  WORKERS_MONITORING_PORT: Number(
    process.env.WORKERS_MONITORING_PORT ?? 8081,
  ),
  WORKER_INTERVALS: workerIntervals,
  MPAYMENTS_INTEGRATION_ENABLED:
    process.env.MPAYMENTS_INTEGRATION_ENABLED === "true",
  REDIS_HOST: process.env.REDIS_HOST ?? "127.0.0.1",
  REDIS_PORT: Number(process.env.REDIS_PORT ?? 6379),
  REDIS_USER: process.env.REDIS_USER,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
} as const;

export type WorkerEnv = typeof env;
