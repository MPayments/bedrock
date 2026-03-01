import { createBalancesProjectorWorker } from "@bedrock/balances";
import {
  createAttemptDispatchWorker,
  createConnectorsService,
  createStatementIngestWorker,
  createStatusPollerWorker,
  type ConnectorAdapter,
} from "@bedrock/connectors";
import { createCurrenciesService } from "@bedrock/currencies";
import type { Database } from "@bedrock/db";
import { createDocumentsWorker } from "@bedrock/documents";
import { createFeesService } from "@bedrock/fees";
import { createFxRatesWorker, createFxService } from "@bedrock/fx";
import type { Logger } from "@bedrock/kernel";
import type {
  BedrockModuleId,
  ModuleRuntimeService,
} from "@bedrock/module-runtime";
import {
  createOrchestrationRetryWorker,
  createOrchestrationService,
} from "@bedrock/orchestration";
import { createReconciliationWorker } from "@bedrock/reconciliation";

import type { env as workerEnv } from "../env";
import { isModuleEnabledForBooks } from "./runtime-guard";

interface RegisteredWorker {
  id: string;
  intervalMs: number;
  processOnce: () => Promise<unknown>;
}

interface WorkerModuleDeps {
  db: Database;
  logger: Logger;
  env: typeof workerEnv;
  moduleRuntime: ModuleRuntimeService;
}

interface WorkerComponentManifest {
  id: string;
  moduleId: BedrockModuleId;
  intervalMs: (runtimeEnv: typeof workerEnv) => number;
  createProcessOnce: (deps: WorkerModuleDeps) => () => Promise<unknown>;
}

const mockWebhookAdapter: ConnectorAdapter = {
  async initiate(input) {
    return {
      status: "submitted",
      externalAttemptRef: `wh:${input.attempt.id}`,
      responsePayload: { accepted: true },
    };
  },
  async getStatus() {
    return {
      status: "pending",
      responsePayload: { pending: true },
    };
  },
  async verifyAndParseWebhook(input) {
    return {
      signatureValid: true,
      eventType: "provider_event",
      webhookIdempotencyKey: String(
        input.rawPayload.eventId ?? input.rawPayload.id ?? "unknown",
      ),
      parsedPayload: input.rawPayload,
    };
  },
  async fetchStatements() {
    return {
      records: [],
      nextCursor: null,
    };
  },
};

const mockPollingAdapter: ConnectorAdapter = {
  async initiate(input) {
    return {
      status: "pending",
      externalAttemptRef: `poll:${input.attempt.id}`,
      responsePayload: { accepted: true },
    };
  },
  async getStatus(input) {
    return {
      status: input.externalAttemptRef.includes("fail")
        ? "failed_retryable"
        : "succeeded",
      responsePayload: { externalAttemptRef: input.externalAttemptRef },
    };
  },
  async verifyAndParseWebhook(input) {
    return {
      signatureValid: false,
      eventType: "unsupported",
      webhookIdempotencyKey: String(
        input.rawPayload.eventId ?? input.rawPayload.id ?? "unknown",
      ),
      parsedPayload: input.rawPayload,
    };
  },
  async fetchStatements() {
    return {
      records: [],
      nextCursor: null,
    };
  },
};

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
    providers: {
      mock_webhook: mockWebhookAdapter,
      mock_polling: mockPollingAdapter,
    },
  });
}

const WORKER_COMPONENT_MANIFESTS: WorkerComponentManifest[] = [
  {
    id: "documents",
    moduleId: "documents",
    intervalMs: (runtimeEnv) => runtimeEnv.LEDGER_WORKER_INTERVAL_MS,
    createProcessOnce: (deps) => {
      const worker = createDocumentsWorker({
        db: deps.db,
        beforeDocument: ({ bookIds }) =>
          isModuleEnabledForBooks({
            moduleRuntime: deps.moduleRuntime,
            moduleId: "documents",
            bookIds,
          }),
      });
      return () => worker.processOnce();
    },
  },
  {
    id: "balances",
    moduleId: "balances",
    intervalMs: (runtimeEnv) => runtimeEnv.BALANCES_WORKER_INTERVAL_MS,
    createProcessOnce: (deps) => {
      const worker = createBalancesProjectorWorker({
        db: deps.db,
        logger: deps.logger,
        beforeOperation: ({ bookIds }) =>
          isModuleEnabledForBooks({
            moduleRuntime: deps.moduleRuntime,
            moduleId: "balances",
            bookIds,
          }),
      });
      return () => worker.processOnce();
    },
  },
  {
    id: "fx-rates",
    moduleId: "fx-rates",
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
          deps.moduleRuntime.isModuleEnabled({
            moduleId: "fx-rates",
          }),
      });
      return () => worker.processOnce();
    },
  },
  {
    id: "reconciliation",
    moduleId: "reconciliation",
    intervalMs: (runtimeEnv) => runtimeEnv.RECONCILIATION_WORKER_INTERVAL_MS,
    createProcessOnce: (deps) => {
      const worker = createReconciliationWorker({
        db: deps.db,
        logger: deps.logger,
        beforeSource: () =>
          deps.moduleRuntime.isModuleEnabled({
            moduleId: "reconciliation",
          }),
      });
      return () => worker.processOnce();
    },
  },
  {
    id: "connectors-dispatch",
    moduleId: "connectors",
    intervalMs: (runtimeEnv) =>
      runtimeEnv.CONNECTORS_DISPATCH_WORKER_INTERVAL_MS,
    createProcessOnce: (deps) => {
      const connectors = createConnectorsForWorker(deps);
      const worker = createAttemptDispatchWorker({
        connectors,
        logger: deps.logger,
        beforeAttempt: ({ bookId }) =>
          isModuleEnabledForBooks({
            moduleRuntime: deps.moduleRuntime,
            moduleId: "connectors",
            bookIds: bookId ? [bookId] : undefined,
          }),
      });
      return () => worker.processOnce();
    },
  },
  {
    id: "connectors-poller",
    moduleId: "connectors",
    intervalMs: (runtimeEnv) => runtimeEnv.CONNECTORS_STATUS_POLLER_INTERVAL_MS,
    createProcessOnce: (deps) => {
      const connectors = createConnectorsForWorker(deps);
      const worker = createStatusPollerWorker({
        connectors,
        logger: deps.logger,
        beforeAttempt: ({ bookId }) =>
          isModuleEnabledForBooks({
            moduleRuntime: deps.moduleRuntime,
            moduleId: "connectors",
            bookIds: bookId ? [bookId] : undefined,
          }),
      });
      return () => worker.processOnce();
    },
  },
  {
    id: "connectors-statements",
    moduleId: "connectors",
    intervalMs: (runtimeEnv) =>
      runtimeEnv.CONNECTORS_STATEMENT_INGEST_INTERVAL_MS,
    createProcessOnce: (deps) => {
      const connectors = createConnectorsForWorker(deps);
      const worker = createStatementIngestWorker({
        connectors,
        logger: deps.logger,
        beforeCursor: () =>
          deps.moduleRuntime.isModuleEnabled({
            moduleId: "connectors",
          }),
      });
      return () => worker.processOnce();
    },
  },
  {
    id: "orchestration-retry",
    moduleId: "orchestration",
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
          isModuleEnabledForBooks({
            moduleRuntime: deps.moduleRuntime,
            moduleId: "orchestration",
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
        const isEnabled = await deps.moduleRuntime.isModuleEnabled({
          moduleId: component.moduleId,
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
