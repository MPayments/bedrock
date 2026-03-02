import { createBalancesProjectorWorker } from "@bedrock/balances";
import type {
  BedrockComponentId,
  ComponentRuntimeService,
} from "@bedrock/component-runtime";
import {
  createAttemptDispatchWorker,
  createConnectorsService,
  createStatementIngestWorker,
  createStatusPollerWorker,
  getMockProviders,
} from "@bedrock/connectors";
import { createCurrenciesService } from "@bedrock/currencies";
import { createDocumentsWorker } from "@bedrock/documents";
import { createFeesService } from "@bedrock/fees";
import type { Database } from "@bedrock/foundation/db/types";
import type { Logger } from "@bedrock/foundation/kernel";
import { createFxRatesWorker, createFxService } from "@bedrock/fx";
import {
  createOrchestrationRetryWorker,
  createOrchestrationService,
} from "@bedrock/orchestration";
import { createReconciliationWorker } from "@bedrock/reconciliation";

import type { env as workerEnv } from "../env";
import { isComponentEnabledForBooks } from "./runtime-guard";

interface RegisteredWorker {
  id: string;
  intervalMs: number;
  processOnce: () => Promise<unknown>;
}

interface WorkerModuleDeps {
  db: Database;
  logger: Logger;
  env: typeof workerEnv;
  componentRuntime: ComponentRuntimeService;
}

interface WorkerComponentManifest {
  id: string;
  componentId: BedrockComponentId;
  intervalMs: (runtimeEnv: typeof workerEnv) => number;
  createProcessOnce: (deps: WorkerModuleDeps) => () => Promise<unknown>;
}

function createWorkerRegistry() {
  const workers: RegisteredWorker[] = [];

  return {
    registry: {
      register(worker: RegisteredWorker) {
        workers.push(worker);
      },
    },
    workers,
  };
}

function createConnectorsForWorker(deps: WorkerModuleDeps) {
  return createConnectorsService({
    db: deps.db,
    logger: deps.logger,
    providers: getMockProviders(),
  });
}

const WORKER_COMPONENT_MANIFESTS: WorkerComponentManifest[] = [
  {
    id: "documents",
    componentId: "documents",
    intervalMs: (runtimeEnv) => runtimeEnv.LEDGER_WORKER_INTERVAL_MS,
    createProcessOnce: (deps) => {
      const worker = createDocumentsWorker({
        db: deps.db,
        beforeDocument: ({ bookIds }) =>
          isComponentEnabledForBooks({
            componentRuntime: deps.componentRuntime,
            componentId: "documents",
            bookIds,
          }),
      });
      return () => worker.processOnce();
    },
  },
  {
    id: "balances",
    componentId: "balances",
    intervalMs: (runtimeEnv) => runtimeEnv.BALANCES_WORKER_INTERVAL_MS,
    createProcessOnce: (deps) => {
      const worker = createBalancesProjectorWorker({
        db: deps.db,
        logger: deps.logger,
        beforeOperation: ({ bookIds }) =>
          isComponentEnabledForBooks({
            componentRuntime: deps.componentRuntime,
            componentId: "balances",
            bookIds,
          }),
      });
      return () => worker.processOnce();
    },
  },
  {
    id: "fx-rates",
    componentId: "fx-rates",
    intervalMs: (runtimeEnv) => runtimeEnv.FX_RATES_WORKER_INTERVAL_MS,
    createProcessOnce: (deps) => {
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
      const worker = createFxRatesWorker({
        fxService,
        logger: deps.logger,
        beforeSourceSync: () =>
          deps.componentRuntime.isComponentEnabled({
            componentId: "fx-rates",
          }),
      });
      return () => worker.processOnce();
    },
  },
  {
    id: "reconciliation",
    componentId: "reconciliation",
    intervalMs: (runtimeEnv) => runtimeEnv.RECONCILIATION_WORKER_INTERVAL_MS,
    createProcessOnce: (deps) => {
      const worker = createReconciliationWorker({
        db: deps.db,
        logger: deps.logger,
        beforeSource: () =>
          deps.componentRuntime.isComponentEnabled({
            componentId: "reconciliation",
          }),
      });
      return () => worker.processOnce();
    },
  },
  {
    id: "connectors-dispatch",
    componentId: "connectors",
    intervalMs: (runtimeEnv) =>
      runtimeEnv.CONNECTORS_DISPATCH_WORKER_INTERVAL_MS,
    createProcessOnce: (deps) => {
      const connectors = createConnectorsForWorker(deps);
      const worker = createAttemptDispatchWorker({
        connectors,
        logger: deps.logger,
        beforeAttempt: ({ bookId }) =>
          isComponentEnabledForBooks({
            componentRuntime: deps.componentRuntime,
            componentId: "connectors",
            bookIds: bookId ? [bookId] : undefined,
          }),
      });
      return () => worker.processOnce();
    },
  },
  {
    id: "connectors-poller",
    componentId: "connectors",
    intervalMs: (runtimeEnv) => runtimeEnv.CONNECTORS_STATUS_POLLER_INTERVAL_MS,
    createProcessOnce: (deps) => {
      const connectors = createConnectorsForWorker(deps);
      const worker = createStatusPollerWorker({
        connectors,
        logger: deps.logger,
        beforeAttempt: ({ bookId }) =>
          isComponentEnabledForBooks({
            componentRuntime: deps.componentRuntime,
            componentId: "connectors",
            bookIds: bookId ? [bookId] : undefined,
          }),
      });
      return () => worker.processOnce();
    },
  },
  {
    id: "connectors-statements",
    componentId: "connectors",
    intervalMs: (runtimeEnv) =>
      runtimeEnv.CONNECTORS_STATEMENT_INGEST_INTERVAL_MS,
    createProcessOnce: (deps) => {
      const connectors = createConnectorsForWorker(deps);
      const worker = createStatementIngestWorker({
        connectors,
        logger: deps.logger,
        beforeCursor: () =>
          deps.componentRuntime.isComponentEnabled({
            componentId: "connectors",
          }),
      });
      return () => worker.processOnce();
    },
  },
  {
    id: "orchestration-retry",
    componentId: "orchestration",
    intervalMs: (runtimeEnv) => runtimeEnv.ORCHESTRATION_WORKER_INTERVAL_MS,
    createProcessOnce: (deps) => {
      const connectors = createConnectorsForWorker(deps);
      const orchestration = createOrchestrationService({
        db: deps.db,
        logger: deps.logger,
      });
      const worker = createOrchestrationRetryWorker({
        connectors,
        orchestration,
        logger: deps.logger,
        beforeAttempt: ({ bookId }) =>
          isComponentEnabledForBooks({
            componentRuntime: deps.componentRuntime,
            componentId: "orchestration",
            bookIds: bookId ? [bookId] : undefined,
          }),
      });
      return () => worker.processOnce();
    },
  },
];

export function registerApplicationWorkers(deps: WorkerModuleDeps) {
  const { registry, workers } = createWorkerRegistry();

  for (const component of WORKER_COMPONENT_MANIFESTS) {
    const processOnce = component.createProcessOnce(deps);

    registry.register({
      id: component.id,
      intervalMs: component.intervalMs(deps.env),
      processOnce: async () => {
        const isEnabled = await deps.componentRuntime.isComponentEnabled({
          componentId: component.componentId,
        });

        if (!isEnabled) {
          return 0;
        }

        return processOnce();
      },
    });
  }

  return workers;
}
