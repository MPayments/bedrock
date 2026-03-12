import "./env";

import { BEDROCK_MODULE_MANIFESTS } from "@bedrock/application/module-runtime";
import {
  createModuleRuntimeService,
} from "@bedrock/core/module-runtime";
import { createTbClient } from "@bedrock/core/ledger";
import {
  createWorkerFleet,
  startWorkerFleet,
} from "@bedrock/core/worker-runtime";
import { db } from "@bedrock/db/client";
import {
  createConsoleLogger,
  installShutdownHandlers,
} from "@bedrock/kernel";

import { createWorkerImplementations } from "./modules/registry";
import { env } from "./env";
import { createWorkerMonitoringRegistry, startWorkerMonitoringServer } from "./monitoring";
import { parseSelectedWorkerIds } from "./selection";

const logger = createConsoleLogger({ app: "bedrock-workers" });
const moduleRuntime = createModuleRuntimeService({
  db,
  logger,
  manifests: BEDROCK_MODULE_MANIFESTS,
});
await moduleRuntime.startBackgroundSync();

const tb = createTbClient(env.TB_CLUSTER_ID, env.TB_ADDRESS);
const workerImplementations = createWorkerImplementations({
  db,
  logger,
  env,
  tb,
  moduleRuntime,
});
const selectedWorkerIds = parseSelectedWorkerIds(process.argv.slice(2));
const workers = createWorkerFleet({
  manifests: BEDROCK_MODULE_MANIFESTS,
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
  moduleRuntime,
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
  void moduleRuntime.stopBackgroundSync();
});

logger.info("Workers started", {
  workers: workers.map((worker) => worker.id),
});
await fleet.promise;
logger.info("Workers stopped");
await moduleRuntime.stopBackgroundSync();
process.exit(0);
