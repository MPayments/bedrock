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
import {
  createOrchestrationRetryWorker,
  createOrchestrationService,
} from "@bedrock/orchestration";
import { createReconciliationWorker } from "@bedrock/reconciliation";

import type { env } from "../env";

interface RegisteredWorker {
  id: string;
  intervalMs: number;
  processOnce: () => Promise<unknown>;
}

interface WorkerRegistry {
  register: (worker: RegisteredWorker) => void;
}

interface WorkerModuleDeps {
  db: Database;
  logger: Logger;
  env: typeof env;
}

interface ApplicationModule {
  id: string;
  registerWorkers?: (registry: WorkerRegistry, deps: WorkerModuleDeps) => void;
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
      webhookIdempotencyKey:
        String(input.rawPayload.eventId ?? input.rawPayload.id ?? "unknown"),
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
      webhookIdempotencyKey:
        String(input.rawPayload.eventId ?? input.rawPayload.id ?? "unknown"),
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

const APPLICATION_MODULES: ApplicationModule[] = [
  {
    id: "documents",
    registerWorkers: (registry, deps) => {
      const worker = createDocumentsWorker({ db: deps.db });
      registry.register({
        id: "documents",
        intervalMs: deps.env.LEDGER_WORKER_INTERVAL_MS,
        processOnce: () => worker.processOnce(),
      });
    },
  },
  {
    id: "balances",
    registerWorkers: (registry, deps) => {
      const worker = createBalancesProjectorWorker({
        db: deps.db,
        logger: deps.logger,
      });

      registry.register({
        id: "balances",
        intervalMs: deps.env.BALANCES_WORKER_INTERVAL_MS,
        processOnce: () => worker.processOnce(),
      });
    },
  },
  {
    id: "fx-rates",
    registerWorkers: (registry, deps) => {
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
      const worker = createFxRatesWorker({ fxService, logger: deps.logger });

      registry.register({
        id: "fx-rates",
        intervalMs: deps.env.FX_RATES_WORKER_INTERVAL_MS,
        processOnce: () => worker.processOnce(),
      });
    },
  },
  {
    id: "reconciliation",
    registerWorkers: (registry, deps) => {
      const worker = createReconciliationWorker({
        db: deps.db,
        logger: deps.logger,
      });

      registry.register({
        id: "reconciliation",
        intervalMs: deps.env.RECONCILIATION_WORKER_INTERVAL_MS,
        processOnce: () => worker.processOnce(),
      });
    },
  },
  {
    id: "connectors-dispatch",
    registerWorkers: (registry, deps) => {
      const connectors = createConnectorsService({
        db: deps.db,
        logger: deps.logger,
        providers: {
          mock_webhook: mockWebhookAdapter,
          mock_polling: mockPollingAdapter,
        },
      });
      const worker = createAttemptDispatchWorker({
        connectors,
        logger: deps.logger,
      });

      registry.register({
        id: "connectors-dispatch",
        intervalMs: deps.env.CONNECTORS_DISPATCH_WORKER_INTERVAL_MS,
        processOnce: () => worker.processOnce(),
      });
    },
  },
  {
    id: "connectors-poller",
    registerWorkers: (registry, deps) => {
      const connectors = createConnectorsService({
        db: deps.db,
        logger: deps.logger,
        providers: {
          mock_webhook: mockWebhookAdapter,
          mock_polling: mockPollingAdapter,
        },
      });
      const worker = createStatusPollerWorker({
        connectors,
        logger: deps.logger,
      });

      registry.register({
        id: "connectors-poller",
        intervalMs: deps.env.CONNECTORS_STATUS_POLLER_INTERVAL_MS,
        processOnce: () => worker.processOnce(),
      });
    },
  },
  {
    id: "connectors-statements",
    registerWorkers: (registry, deps) => {
      const connectors = createConnectorsService({
        db: deps.db,
        logger: deps.logger,
        providers: {
          mock_webhook: mockWebhookAdapter,
          mock_polling: mockPollingAdapter,
        },
      });
      const worker = createStatementIngestWorker({
        connectors,
        logger: deps.logger,
      });

      registry.register({
        id: "connectors-statements",
        intervalMs: deps.env.CONNECTORS_STATEMENT_INGEST_INTERVAL_MS,
        processOnce: () => worker.processOnce(),
      });
    },
  },
  {
    id: "orchestration-retry",
    registerWorkers: (registry, deps) => {
      const connectors = createConnectorsService({
        db: deps.db,
        logger: deps.logger,
        providers: {
          mock_webhook: mockWebhookAdapter,
          mock_polling: mockPollingAdapter,
        },
      });
      const orchestration = createOrchestrationService({
        db: deps.db,
        logger: deps.logger,
      });
      const worker = createOrchestrationRetryWorker({
        connectors,
        orchestration,
        logger: deps.logger,
      });

      registry.register({
        id: "orchestration-retry",
        intervalMs: deps.env.ORCHESTRATION_WORKER_INTERVAL_MS,
        processOnce: () => worker.processOnce(),
      });
    },
  },
];

export function registerApplicationWorkers(deps: WorkerModuleDeps) {
  const { registry, workers } = createWorkerRegistry();
  for (const module of APPLICATION_MODULES) {
    module.registerWorkers?.(registry, deps);
  }
  return workers;
}
