import { BEDROCK_MODULE_MANIFESTS } from "@bedrock/application/module-runtime";
import { createFeesService } from "@bedrock/application/fees";
import {
  createFxRatesWorkerDefinition,
  createFxService,
} from "@bedrock/application/fx";
import {
  createBalancesProjectorWorkerDefinition,
} from "@bedrock/core/balances";
import type { ModuleRuntimeService } from "@bedrock/core/module-runtime";
import { createCurrenciesService } from "@bedrock/core/currencies";
import {
  createDocumentsWorkerDefinition,
  createPeriodCloseWorkerDefinition,
} from "@bedrock/core/documents";
import {
  createLedgerWorkerDefinition,
  type TbClient,
} from "@bedrock/core/ledger";
import {
  listWorkerCatalogEntries,
  type BedrockWorker,
  type WorkerCatalogEntry,
} from "@bedrock/core/worker-runtime";
import type { Logger } from "@bedrock/kernel";
import type { Database } from "@bedrock/kernel/db/types";

import type { WorkerEnv } from "../env";
import { isModuleEnabledForBooks } from "./runtime-guard";

interface WorkerModuleDeps {
  db: Database;
  logger: Logger;
  env: WorkerEnv;
  tb: TbClient;
  moduleRuntime: ModuleRuntimeService;
}

const workerCatalogById = new Map<string, WorkerCatalogEntry>(
  listWorkerCatalogEntries(BEDROCK_MODULE_MANIFESTS).map((entry) => [
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
): Pick<BedrockWorker, "id" | "moduleId" | "intervalMs"> {
  const entry = requireWorkerCatalogEntry(workerId);
  const intervalMs = env.WORKER_INTERVALS[workerId] ?? entry.defaultIntervalMs;

  if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
    throw new Error(`Invalid interval for worker ${workerId}: ${intervalMs}`);
  }

  return {
    id: workerId,
    moduleId: entry.moduleId,
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
    beforeJob: ({ bookIds }) =>
      isModuleEnabledForBooks({
        moduleRuntime: deps.moduleRuntime,
        moduleId: "ledger",
        bookIds,
      }),
  });

  const documents = createDocumentsWorkerDefinition({
    ...createWorkerMetadata("documents", deps.env),
    db: deps.db,
    beforeDocument: ({ bookIds }) =>
      isModuleEnabledForBooks({
        moduleRuntime: deps.moduleRuntime,
        moduleId: "documents",
        bookIds,
      }),
  });
  const documentsPeriodClose = createPeriodCloseWorkerDefinition({
    ...createWorkerMetadata("documents-period-close", deps.env),
    db: deps.db,
    logger: deps.logger,
    beforeCounterparty: () =>
      deps.moduleRuntime.isModuleEnabled({
        moduleId: "documents",
      }),
  });

  const balances = createBalancesProjectorWorkerDefinition({
    ...createWorkerMetadata("balances", deps.env),
    db: deps.db,
    logger: deps.logger,
    beforeOperation: ({ bookIds }) =>
      isModuleEnabledForBooks({
        moduleRuntime: deps.moduleRuntime,
        moduleId: "balances",
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
      deps.moduleRuntime.isModuleEnabled({
        moduleId: "fx-rates",
      }),
  });

  return {
    [ledger.id]: ledger,
    [documents.id]: documents,
    [documentsPeriodClose.id]: documentsPeriodClose,
    [balances.id]: balances,
    [fxRates.id]: fxRates,
  };
}
