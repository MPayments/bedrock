import type { Database } from "@bedrock/db/types";
import type { Logger } from "@bedrock/foundation/kernel";
import { BEDROCK_COMPONENT_MANIFESTS } from "@bedrock/modules/component-runtime";
import { createFeesService } from "@bedrock/modules/fees";
import {
  createFxRatesWorkerDefinition,
  createFxService,
} from "@bedrock/modules/fx";
import {
  createBalancesProjectorWorkerDefinition,
} from "@bedrock/platform/balances";
import type { ComponentRuntimeService } from "@bedrock/platform/component-runtime";
import {
  createAttemptDispatchWorkerDefinition,
  createConnectorsService,
  createStatementIngestWorkerDefinition,
  createStatusPollerWorkerDefinition,
  getMockProviders,
} from "@bedrock/platform/connectors";
import { createCurrenciesService } from "@bedrock/platform/currencies";
import { createDocumentsWorkerDefinition } from "@bedrock/platform/documents";
import {
  createLedgerWorkerDefinition,
  type TbClient,
} from "@bedrock/platform/ledger";
import {
  createOrchestrationRetryWorkerDefinition,
  createOrchestrationService,
} from "@bedrock/platform/orchestration";
import { createReconciliationWorkerDefinition } from "@bedrock/platform/reconciliation";
import {
  listWorkerCatalogEntries,
  type BedrockWorker,
  type WorkerCatalogEntry,
} from "@bedrock/platform/worker-runtime";

import type { WorkerEnv } from "../env";
import { isComponentEnabledForBooks } from "./runtime-guard";

interface WorkerModuleDeps {
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

function createConnectorsForWorker(deps: WorkerModuleDeps) {
  return createConnectorsService({
    db: deps.db,
    logger: deps.logger,
    providers: getMockProviders(),
  });
}

export function createWorkerImplementations(
  deps: WorkerModuleDeps,
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

  const dispatchConnectors = createConnectorsForWorker(deps);
  const connectorsDispatch = createAttemptDispatchWorkerDefinition({
    ...createWorkerMetadata("connectors-dispatch", deps.env),
    connectors: dispatchConnectors,
    logger: deps.logger,
    beforeAttempt: ({ bookId }) =>
      isComponentEnabledForBooks({
        componentRuntime: deps.componentRuntime,
        componentId: "connectors",
        bookIds: bookId ? [bookId] : undefined,
      }),
  });

  const pollerConnectors = createConnectorsForWorker(deps);
  const connectorsPoller = createStatusPollerWorkerDefinition({
    ...createWorkerMetadata("connectors-poller", deps.env),
    connectors: pollerConnectors,
    logger: deps.logger,
    beforeAttempt: ({ bookId }) =>
      isComponentEnabledForBooks({
        componentRuntime: deps.componentRuntime,
        componentId: "connectors",
        bookIds: bookId ? [bookId] : undefined,
      }),
  });

  const statementsConnectors = createConnectorsForWorker(deps);
  const connectorsStatements = createStatementIngestWorkerDefinition({
    ...createWorkerMetadata("connectors-statements", deps.env),
    connectors: statementsConnectors,
    logger: deps.logger,
    beforeCursor: () =>
      deps.componentRuntime.isComponentEnabled({
        componentId: "connectors",
      }),
  });

  const orchestrationConnectors = createConnectorsForWorker(deps);
  const orchestrationService = createOrchestrationService({
    db: deps.db,
    logger: deps.logger,
  });
  const orchestrationRetry = createOrchestrationRetryWorkerDefinition({
    ...createWorkerMetadata("orchestration-retry", deps.env),
    connectors: orchestrationConnectors,
    orchestration: orchestrationService,
    logger: deps.logger,
    beforeAttempt: ({ bookId }) =>
      isComponentEnabledForBooks({
        componentRuntime: deps.componentRuntime,
        componentId: "orchestration",
        bookIds: bookId ? [bookId] : undefined,
      }),
  });

  return {
    [ledger.id]: ledger,
    [documents.id]: documents,
    [balances.id]: balances,
    [fxRates.id]: fxRates,
    [reconciliation.id]: reconciliation,
    [connectorsDispatch.id]: connectorsDispatch,
    [connectorsPoller.id]: connectorsPoller,
    [connectorsStatements.id]: connectorsStatements,
    [orchestrationRetry.id]: orchestrationRetry,
  };
}
