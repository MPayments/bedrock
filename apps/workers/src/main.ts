import "./env";

import { LoggerToken, createApp } from "@bedrock/core";
import { createTbClient } from "@multihansa/ledger";

import {
  MULTIHANSA_WORKER_DESCRIPTORS,
  createMultihansaWorkerDescriptor,
  loadMultihansaWorkerConfig,
} from "@multihansa/app";
import { db } from "@multihansa/db/client";

import { createWorkerMonitoringRegistry, startWorkerMonitoringServer } from "./monitoring";
import { parseSelectedWorkerIds } from "./selection";

const config = await loadMultihansaWorkerConfig();
const selectedWorkerIds = parseSelectedWorkerIds(process.argv.slice(2));
const tb = createTbClient(config.tb.clusterId, config.tb.address);
const monitoring = createWorkerMonitoringRegistry();
const activeDescriptors = MULTIHANSA_WORKER_DESCRIPTORS.filter(
  (descriptor) =>
    selectedWorkerIds === undefined || selectedWorkerIds.includes(descriptor.id),
);
const workerObservers = Object.fromEntries(
  activeDescriptors.map((descriptor) => [
    descriptor.id,
    monitoring.registerWorker({
      name: descriptor.id,
      intervalMs:
        config.workerIntervals[descriptor.id] ?? descriptor.defaultIntervalMs,
    }),
  ]),
);

const app = createApp(
  createMultihansaWorkerDescriptor({
    appName: config.appName,
    db,
    tb,
    workerIntervals: config.workerIntervals,
    workerObservers,
    logLevel: config.logLevel,
    selectedWorkerIds,
  }),
);
await app.start();

const logger = app.get(LoggerToken);
const monitoringServer =
  config.monitoring.port > 0
    ? await startWorkerMonitoringServer({
        host: config.monitoring.host,
        port: config.monitoring.port,
        registry: monitoring,
        logger,
      })
    : null;

logger.info("multihansa.workers.started", {
  workers: activeDescriptors.map((descriptor) => descriptor.id),
});

let stopping = false;

async function stop(signal: string) {
  if (stopping) {
    return;
  }

  stopping = true;

  try {
    logger.info("multihansa.workers.stopping", { signal });
    await app.stop();
    if (monitoringServer) {
      await monitoringServer.stop();
    }
    logger.info("multihansa.workers.stopped", { signal });
    process.exitCode = 0;
  } catch (error) {
    logger.error("multihansa.workers.stop_failed", { signal, error });
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

process.on("SIGINT", () => {
  void stop("SIGINT");
});

process.on("SIGTERM", () => {
  void stop("SIGTERM");
});
