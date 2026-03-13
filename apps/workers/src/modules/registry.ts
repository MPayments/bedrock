import {
  createBalancesProjectorWorkerDefinition,
} from "@bedrock/balances/worker";
import {
  createLedgerWorkerDefinition,
  type TbClient,
} from "@bedrock/adapter-ledger-tigerbeetle";
import { createCurrenciesService } from "@bedrock/currencies";
import { createDocumentsWorkerDefinition } from "@bedrock/documents/worker";
import { createFeesService } from "@bedrock/fees";
import {
  createFxService,
} from "@bedrock/fx";
import { createFxRatesWorkerDefinition } from "@bedrock/fx/worker";
import { createDefaultFxRateSourceProviders } from "@bedrock/integration-fx-providers";
import {
  type BedrockWorker,
  type WorkerCatalogEntry,
} from "@bedrock/adapter-worker-runtime";
import type { Logger } from "@bedrock/observability/logger";
import { createPeriodCloseWorkerDefinition } from "@bedrock/workflow-period-close";
import type { Database } from "@bedrock/adapter-db-drizzle/db/types";

import { WORKER_CATALOG } from "../catalog";
import type { WorkerEnv } from "../env";

interface WorkerModuleDeps {
  db: Database;
  logger: Logger;
  env: WorkerEnv;
  tb: TbClient;
}

const workerCatalogById = new Map<string, WorkerCatalogEntry>(
  WORKER_CATALOG.map((entry) => [entry.id, entry]),
);

function requireWorkerCatalogEntry(workerId: string): WorkerCatalogEntry {
  const entry = workerCatalogById.get(workerId);
  if (!entry) {
    throw new Error(`Missing worker catalog entry for ${workerId}`);
  }
  return entry;
}

function createWorkerMetadata(
  workerId: string,
  env: WorkerEnv,
): Pick<BedrockWorker, "id" | "intervalMs"> {
  const entry = requireWorkerCatalogEntry(workerId);
  const intervalMs = env.WORKER_INTERVALS[workerId] ?? entry.defaultIntervalMs;

  if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
    throw new Error(`Invalid interval for worker ${workerId}: ${intervalMs}`);
  }

  return {
    id: workerId,
    intervalMs,
  };
}

export function createWorkerImplementations(
  deps: WorkerModuleDeps,
): Record<string, BedrockWorker> {
  const ledger = createLedgerWorkerDefinition({
    ...createWorkerMetadata("ledger", deps.env),
    db: deps.db,
    tb: deps.tb,
  });

  const documents = createDocumentsWorkerDefinition({
    ...createWorkerMetadata("documents", deps.env),
    db: deps.db,
  });
  const documentsPeriodClose = createPeriodCloseWorkerDefinition({
    ...createWorkerMetadata("documents-period-close", deps.env),
    db: deps.db,
    logger: deps.logger,
  });

  const balances = createBalancesProjectorWorkerDefinition({
    ...createWorkerMetadata("balances", deps.env),
    db: deps.db,
    logger: deps.logger,
  });

  const currenciesService = createCurrenciesService({
    db: deps.db,
    logger: deps.logger,
  });
  const feesService = createFeesService({
    db: deps.db,
    logger: deps.logger,
    currenciesService,
  });
  const fxService = createFxService({
    db: deps.db,
    logger: deps.logger,
    feesService,
    currenciesService,
    rateSourceProviders: createDefaultFxRateSourceProviders(),
  });
  const fxRates = createFxRatesWorkerDefinition({
    ...createWorkerMetadata("fx-rates", deps.env),
    fxService,
    logger: deps.logger,
  });

  return {
    [ledger.id]: ledger,
    [documents.id]: documents,
    [documentsPeriodClose.id]: documentsPeriodClose,
    [balances.id]: balances,
    [fxRates.id]: fxRates,
  };
}
