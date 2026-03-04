import { BEDROCK_COMPONENT_MANIFESTS } from "@bedrock/application/component-runtime";
import { createFeesService } from "@bedrock/application/fees";
import {
  createFxRatesWorkerDefinition,
  createFxService,
} from "@bedrock/application/fx";
import {
  createBalancesProjectorWorkerDefinition,
} from "@bedrock/core/balances";
import type { ComponentRuntimeService } from "@bedrock/core/component-runtime";
import { createCurrenciesService } from "@bedrock/core/currencies";
import {
  createDocumentsWorkerDefinition,
  createPeriodCloseWorkerDefinition,
} from "@bedrock/core/documents";
import {
  createLedgerWorkerDefinition,
  type TbClient,
} from "@bedrock/core/ledger";
import { createReconciliationWorkerDefinition } from "@bedrock/core/reconciliation";
import {
  listWorkerCatalogEntries,
  type BedrockWorker,
  type WorkerCatalogEntry,
} from "@bedrock/core/worker-runtime";
import type { Logger } from "@bedrock/kernel";
import type { Database } from "@bedrock/kernel/db/types";

import type { WorkerEnv } from "../env";
import { isComponentEnabledForBooks } from "./runtime-guard";

interface WorkerComponentDeps {
  db: Database;
  logger: Logger;
  env: WorkerEnv;
  tb: TbClient;
  componentRuntime: ComponentRuntimeService;
}

const workerCatalogById = new Map<string, WorkerCatalogEntry>(
  listWorkerCatalogEntries(BEDROCK_COMPONENT_MANIFESTS).map((entry) => [
    entry.id,
    entry,
  ]),
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
): Pick<BedrockWorker, "id" | "componentId" | "intervalMs"> {
  const entry = requireWorkerCatalogEntry(workerId);
  const intervalMs = env.WORKER_INTERVALS[workerId] ?? entry.defaultIntervalMs;

  if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
    throw new Error(`Invalid interval for worker ${workerId}: ${intervalMs}`);
  }

  return {
    id: workerId,
    componentId: entry.componentId,
    intervalMs,
  };
}

export function createWorkerImplementations(
  deps: WorkerComponentDeps,
): Record<string, BedrockWorker> {
  const ledger = createLedgerWorkerDefinition({
    ...createWorkerMetadata("ledger", deps.env),
    db: deps.db,
    tb: deps.tb,
    beforeJob: ({ bookIds }) =>
      isComponentEnabledForBooks({
        componentRuntime: deps.componentRuntime,
        componentId: "ledger",
        bookIds,
      }),
  });

  const documents = createDocumentsWorkerDefinition({
    ...createWorkerMetadata("documents", deps.env),
    db: deps.db,
    beforeDocument: ({ bookIds }) =>
      isComponentEnabledForBooks({
        componentRuntime: deps.componentRuntime,
        componentId: "documents",
        bookIds,
      }),
  });
  const documentsPeriodClose = createPeriodCloseWorkerDefinition({
    ...createWorkerMetadata("documents-period-close", deps.env),
    db: deps.db,
    logger: deps.logger,
    beforeCounterparty: () =>
      deps.componentRuntime.isComponentEnabled({
        componentId: "documents",
      }),
  });

  const balances = createBalancesProjectorWorkerDefinition({
    ...createWorkerMetadata("balances", deps.env),
    db: deps.db,
    logger: deps.logger,
    beforeOperation: ({ bookIds }) =>
      isComponentEnabledForBooks({
        componentRuntime: deps.componentRuntime,
        componentId: "balances",
        bookIds,
      }),
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
  });
  const fxRates = createFxRatesWorkerDefinition({
    ...createWorkerMetadata("fx-rates", deps.env),
    fxService,
    logger: deps.logger,
    beforeSourceSync: () =>
      deps.componentRuntime.isComponentEnabled({
        componentId: "fx-rates",
      }),
  });

  const reconciliation = createReconciliationWorkerDefinition({
    ...createWorkerMetadata("reconciliation", deps.env),
    db: deps.db,
    logger: deps.logger,
    beforeSource: () =>
      deps.componentRuntime.isComponentEnabled({
        componentId: "reconciliation",
      }),
  });

  return {
    [ledger.id]: ledger,
    [documents.id]: documents,
    [documentsPeriodClose.id]: documentsPeriodClose,
    [balances.id]: balances,
    [fxRates.id]: fxRates,
    [reconciliation.id]: reconciliation,
  };
}
