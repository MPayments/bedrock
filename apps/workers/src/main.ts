import "./env";

import {
  createConsoleLogger,
  installShutdownHandlers,
} from "@bedrock/kernel";
import { createTbClient } from "@bedrock/ledger";
import { createBedrockApp } from "@bedrock/modules";

import {
  createMultihansaDomainBundle,
  createMultihansaWorkerImplementations,
} from "@multihansa/app";
import { db } from "@multihansa/db/client";

import { env } from "./env";
import { createWorkerMonitoringRegistry, startWorkerMonitoringServer } from "./monitoring";
import { parseSelectedWorkerIds } from "./selection";

const logger = createConsoleLogger({ app: "multihansa-workers" });
const bundle = createMultihansaDomainBundle({ db, logger });
const app = createBedrockApp({
  db,
  logger,
  modules: bundle.modules,
  createServices: () => bundle.services,
});
await app.moduleRuntime.startBackgroundSync();

const tb = createTbClient(env.TB_CLUSTER_ID, env.TB_ADDRESS);
const workerImplementations = createMultihansaWorkerImplementations({
  db,
  logger,
  tb,
  moduleRuntime: app.moduleRuntime,
  workerIntervals: env.WORKER_INTERVALS,
  services: bundle.services,
});
const selectedWorkerIds = parseSelectedWorkerIds(process.argv.slice(2));
const workers = app.createWorkerFleet({
  workerImplementations,
  selectedWorkerIds,
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
const fleet = app.startWorkerFleet({
  appName: "multihansa-workers",
  workers,
  createObserver: (worker) =>
    monitoring.registerWorker({
      name: worker.id,
      intervalMs: worker.intervalMs,
    }),
});

installShutdownHandlers(() => {
  fleet.stop();
  if (monitoringServer) {
    void monitoringServer.stop();
  }
  void app.moduleRuntime.stopBackgroundSync();
});

logger.info("Workers started", {
  workers: workers.map((worker) => worker.id),
});
await fleet.promise;
logger.info("Workers stopped");
await app.moduleRuntime.stopBackgroundSync();
process.exit(0);
