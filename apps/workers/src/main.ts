import "./env";

import { createCurrenciesService } from "@bedrock/currencies";
import { createTbClient } from "@bedrock/ledger/worker";
import { createConsoleLogger } from "@bedrock/platform/observability/logger";
import {
  createWorkerFleet,
  startWorkerFleet,
} from "@bedrock/platform/worker-runtime";
import { installShutdownHandlers } from "@bedrock/platform/worker-runtime/worker-loop";
import { createIntegrationEventHandler } from "@bedrock/workflow-integration-mpayments";

import { WORKER_CATALOG } from "./catalog";
import { db } from "./db/client";
import { env } from "./env";
import { createIntegrationConsumer } from "./modules/integration-consumer";
import { createWorkerImplementations } from "./modules/registry";
import {
  createWorkerMonitoringRegistry,
  startWorkerMonitoringServer,
} from "./monitoring";
import { createWorkerPartiesModule } from "./parties-module";
import { parseSelectedWorkerIds } from "./selection";

const logger = createConsoleLogger({ app: "bedrock-workers" });
logger.info("Environment variables", { env });
const tb = await createTbClient(env.TB_CLUSTER_ID, env.TB_ADDRESS);
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

let integrationConsumer: { close(): Promise<void> } | null = null;

if (env.MPAYMENTS_INTEGRATION_ENABLED) {
  const currenciesService = createCurrenciesService({ db, logger });
  const currenciesPort = {
    async assertCurrencyExists(id: string) {
      await currenciesService.findById(id);
    },
    async listCodesById(ids: string[]) {
      const rows = await Promise.all(
        ids.map(
          async (id) =>
            [id, (await currenciesService.findById(id)).code] as const,
        ),
      );
      return new Map(rows);
    },
  };
  const partiesModule = createWorkerPartiesModule({
    db,
    documents: { hasDocumentsForCustomer: async () => false },
    currencies: currenciesPort,
    logger,
  });

  const integrationHandler = createIntegrationEventHandler({
    createCustomer: partiesModule.customers.commands.create,
    listCustomers: partiesModule.customers.queries.list,
    createCounterparty: partiesModule.counterparties.commands.create,
    listCounterparties: partiesModule.counterparties.queries.list,
    createRequisite: partiesModule.requisites.commands.create,
    listProviders: partiesModule.requisites.queries.listProviders,
    createProvider: partiesModule.requisites.commands.createProvider,
    findCurrencyByCode: currenciesService.findByCode,
    logger,
  });

  integrationConsumer = createIntegrationConsumer({
    handler: integrationHandler,
    logger,
    redisHost: env.REDIS_HOST,
    redisPort: env.REDIS_PORT,
    redisUser: env.REDIS_USER,
    redisPassword: env.REDIS_PASSWORD,
  });
}

installShutdownHandlers(() => {
  fleet.stop();
  if (monitoringServer) {
    void monitoringServer.stop();
  }
  if (integrationConsumer) {
    void integrationConsumer.close();
  }
});

logger.info("Workers started", {
  workers: workers.map((worker) => worker.id),
  integrationConsumer: env.MPAYMENTS_INTEGRATION_ENABLED,
});
await fleet.promise;
logger.info("Workers stopped");
process.exit(0);
