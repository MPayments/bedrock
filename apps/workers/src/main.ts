import "./env";

import {
  createConsoleLogger,
  installShutdownHandlers,
} from "@multihansa/common";
import { createWorkerFleet, startWorkerFleet } from "@multihansa/common/workers";
import { createTbClient } from "@multihansa/ledger";

import {
  createMultihansaServices,
  createMultihansaWorkers,
} from "@multihansa/app";
import { db } from "@multihansa/db/client";

import { env } from "./env";
import { createWorkerMonitoringRegistry, startWorkerMonitoringServer } from "./monitoring";
import { parseSelectedWorkerIds } from "./selection";

const logger = createConsoleLogger({ app: "multihansa-workers" });
const services = createMultihansaServices({ db, logger });

const tb = createTbClient(env.TB_CLUSTER_ID, env.TB_ADDRESS);
const workerImplementations = createMultihansaWorkers({
  db,
  logger,
  tb,
  workerIntervals: env.WORKER_INTERVALS,
  services,
});
const selectedWorkerIds = parseSelectedWorkerIds(process.argv.slice(2));
const workers = createWorkerFleet({
  workers: workerImplementations,
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
const fleet = startWorkerFleet({
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
});

logger.info("Workers started", {
  workers: workers.map((worker) => worker.id),
});
await fleet.promise;
logger.info("Workers stopped");
process.exit(0);
