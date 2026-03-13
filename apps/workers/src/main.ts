import "./env";

import { createConsoleLogger } from "@bedrock/observability/logger";
import { installShutdownHandlers } from "@bedrock/adapter-worker-runtime/worker-loop";
import { db } from "@bedrock/adapter-db-drizzle/client";
import { createTbClient } from "@bedrock/adapter-ledger-tigerbeetle";
import {
  createWorkerFleet,
  startWorkerFleet,
} from "@bedrock/adapter-worker-runtime";

import { WORKER_CATALOG } from "./catalog";
import { env } from "./env";
import { createWorkerImplementations } from "./modules/registry";
import { createWorkerMonitoringRegistry, startWorkerMonitoringServer } from "./monitoring";
import { parseSelectedWorkerIds } from "./selection";

const logger = createConsoleLogger({ app: "bedrock-workers" });
const tb = createTbClient(env.TB_CLUSTER_ID, env.TB_ADDRESS);
const workerImplementations = createWorkerImplementations({
  db,
  logger,
  env,
  tb,
});
const selectedWorkerIds = parseSelectedWorkerIds(process.argv.slice(2));
const workers = createWorkerFleet({
  catalog: WORKER_CATALOG,
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
const fleet = startWorkerFleet({
  appName: "bedrock-workers",
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
