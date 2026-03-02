import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { BEDROCK_COMPONENT_MANIFESTS } from "@bedrock/modules/component-runtime";
import { listWorkerCatalogEntries } from "@bedrock/platform/worker-runtime";

const dir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(dir, "../../../.env") });

const workerCatalog = listWorkerCatalogEntries(BEDROCK_COMPONENT_MANIFESTS);

const workerIntervals = Object.fromEntries(
  workerCatalog.map((entry) => [
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
} as const;

export type WorkerEnv = typeof env;
