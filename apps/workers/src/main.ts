import "./env";

import { db } from "@bedrock/db/client";
import {
  createConsoleLogger,
  installShutdownHandlers,
} from "@bedrock/foundation/kernel";
import { BEDROCK_COMPONENT_MANIFESTS } from "@bedrock/modules/component-runtime";
import {
  createComponentRuntimeService,
} from "@bedrock/platform/component-runtime";
import { createTbClient } from "@bedrock/platform/ledger";
import {
  createWorkerFleet,
  startWorkerFleet,
} from "@bedrock/platform/worker-runtime";

import { env } from "./env";
import { createWorkerImplementations } from "./modules/registry";
import { createWorkerMonitoringRegistry, startWorkerMonitoringServer } from "./monitoring";
import { parseSelectedWorkerIds } from "./selection";

const logger = createConsoleLogger({ app: "bedrock-workers" });
const componentRuntime = createComponentRuntimeService({
  db,
  logger,
  manifests: BEDROCK_COMPONENT_MANIFESTS,
});
await componentRuntime.startBackgroundSync();

const tb = createTbClient(env.TB_CLUSTER_ID, env.TB_ADDRESS);
const workerImplementations = createWorkerImplementations({
  db,
  logger,
  env,
  tb,
  componentRuntime,
});
const selectedWorkerIds = parseSelectedWorkerIds(process.argv.slice(2));
const workers = createWorkerFleet({
  manifests: BEDROCK_COMPONENT_MANIFESTS,
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
  componentRuntime,
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
  void componentRuntime.stopBackgroundSync();
});

logger.info("Workers started", {
  workers: workers.map((worker) => worker.id),
});
await fleet.promise;
logger.info("Workers stopped");
await componentRuntime.stopBackgroundSync();
process.exit(0);
