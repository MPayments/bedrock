import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveWorkerIntervals } from "@multihansa/common/workers";

import { MULTIHANSA_WORKER_DESCRIPTORS } from "@multihansa/app";

const dir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(dir, "../../../.env") });

const workerIntervals = resolveWorkerIntervals({
  descriptors: MULTIHANSA_WORKER_DESCRIPTORS,
  env: process.env,
});

export const env = {
  TB_ADDRESS: process.env.TB_ADDRESS ?? "127.0.0.1:3000",
  TB_CLUSTER_ID: BigInt(process.env.TB_CLUSTER_ID ?? "0"),
  WORKERS_MONITORING_HOST: process.env.WORKERS_MONITORING_HOST ?? "0.0.0.0",
  WORKERS_MONITORING_PORT: Number(
    process.env.WORKERS_MONITORING_PORT ?? 8081,
  ),
  WORKER_INTERVALS: workerIntervals,
} as const;

export type WorkerEnv = typeof env;
