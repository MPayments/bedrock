import "./env";

import { db } from "@bedrock/db/client";
import { createConsoleLogger } from "@bedrock/kernel";
import { createLedgerWorker, createTbClient } from "@bedrock/ledger";
import {
  BEDROCK_MODULE_MANIFESTS,
  createModuleRuntimeService,
} from "@bedrock/module-runtime";

import { env } from "./env";
import { registerApplicationWorkers } from "./modules/registry";
import { isModuleEnabledForBooks } from "./modules/runtime-guard";
import {
  createWorkerMonitoringRegistry,
  startWorkerMonitoringServer,
} from "./monitoring";
import { installShutdownHandlers, runLoop } from "./run-loop";

const logger = createConsoleLogger({ app: "bedrock-workers" });
const moduleRuntime = createModuleRuntimeService({
  db,
  logger,
  manifests: BEDROCK_MODULE_MANIFESTS,
});
await moduleRuntime.startBackgroundSync();

// -- Ledger (outbox -> TigerBeetle) --
const tb = createTbClient(env.TB_CLUSTER_ID, env.TB_ADDRESS);
const ledgerWorker = createLedgerWorker({
  db,
  tb,
  beforeJob: ({ bookIds }) =>
    isModuleEnabledForBooks({
      moduleRuntime,
      moduleId: "ledger",
      bookIds,
    }),
});

const applicationWorkers = registerApplicationWorkers({
  db,
  logger,
  env,
  moduleRuntime,
});
const monitoring = createWorkerMonitoringRegistry();
const monitoringServer =
  env.WORKERS_MONITORING_PORT > 0
    ? await startWorkerMonitoringServer({
        host: env.WORKERS_MONITORING_HOST,
        port: env.WORKERS_MONITORING_PORT,
        registry: monitoring,
        logger,
      })
    : null;

// -- Start all loops --
const loops = [
  runLoop(
    "ledger",
    async () => {
      const enabled = await moduleRuntime.isModuleEnabled({
        moduleId: "ledger",
      });
      if (!enabled) {
        return 0;
      }
      return ledgerWorker.processOnce();
    },
    {
      intervalMs: env.LEDGER_WORKER_INTERVAL_MS,
    },
    monitoring.registerWorker({
      name: "ledger",
      intervalMs: env.LEDGER_WORKER_INTERVAL_MS,
    }),
  ),
  ...applicationWorkers.map((worker) =>
    runLoop(
      worker.id,
      () => worker.processOnce(),
      {
        intervalMs: worker.intervalMs,
      },
      monitoring.registerWorker({
        name: worker.id,
        intervalMs: worker.intervalMs,
      }),
    ),
  ),
];

installShutdownHandlers(() => {
  for (const loop of loops) {
    loop.stop();
  }
  if (monitoringServer) {
    void monitoringServer.stop();
  }
  void moduleRuntime.stopBackgroundSync();
});

logger.info("All workers started");
await Promise.all(loops.map((loop) => loop.promise));
logger.info("All workers stopped");
await moduleRuntime.stopBackgroundSync();
process.exit(0);
