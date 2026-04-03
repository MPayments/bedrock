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
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
  S3_BUCKET: process.env.S3_BUCKET ?? "bedrock-documents",
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_REGION: process.env.S3_REGION ?? "us-east-1",
  S3_SECRET_KEY: process.env.S3_SECRET_KEY,
  TB_ADDRESS: process.env.TB_ADDRESS ?? "127.0.0.1:3555",
  TB_CLUSTER_ID: BigInt(process.env.TB_CLUSTER_ID ?? "0"),
  WORKERS_MONITORING_HOST: process.env.WORKERS_MONITORING_HOST ?? "0.0.0.0",
  WORKERS_MONITORING_PORT: Number(
    process.env.WORKERS_MONITORING_PORT ?? 8081,
  ),
  WORKER_INTERVALS: workerIntervals,
} as const;

export type WorkerEnv = typeof env;
