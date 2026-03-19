import "./env";

import { createCurrenciesService } from "@bedrock/currencies";
import { createTbClient } from "@bedrock/ledger/worker";
import { createPartiesService } from "@bedrock/parties";
import { createConsoleLogger } from "@bedrock/platform/observability/logger";
import { createPersistenceContext } from "@bedrock/platform/persistence";
import { createRequisitesService } from "@bedrock/requisites";
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
import { createWorkerMonitoringRegistry, startWorkerMonitoringServer } from "./monitoring";
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
  const persistence = createPersistenceContext(db);

  const partiesService = createPartiesService({
    persistence,
    documents: { hasDocumentsForCustomer: async () => false },
    logger,
  });

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
  const requisiteOwners = {
    async assertOrganizationExists(_organizationId: string) {
      // Workers don't have organizations service — not needed for counterparty requisites
      throw new Error("Organization validation not available in workers context");
    },
    async assertCounterpartyExists(counterpartyId: string) {
      await partiesService.counterparties.findById(counterpartyId);
    },
  };
  const requisitesService = createRequisitesService({
    persistence,
    logger,
    currencies: currenciesPort,
    owners: requisiteOwners,
  });

  const integrationHandler = createIntegrationEventHandler({
    createCustomer: partiesService.customers.create,
    listCustomers: partiesService.customers.list,
    createCounterparty: partiesService.counterparties.create,
    listCounterparties: partiesService.counterparties.list,
    createRequisite: requisitesService.create,
    listProviders: requisitesService.providers.list,
    createProvider: requisitesService.providers.create,
    findCurrencyByCode: currenciesService.findByCode,
    logger,
  });

  integrationConsumer = createIntegrationConsumer({
    handler: integrationHandler,
    logger,
    redisHost: env.REDIS_HOST,
    redisPort: env.REDIS_PORT,
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
