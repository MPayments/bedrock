import { createBalancesProjectorWorker } from "@bedrock/balances";
import { createCurrenciesService } from "@bedrock/currencies";
import type { Database } from "@bedrock/db";
import { createDocumentsWorker } from "@bedrock/documents";
import { createFeesService } from "@bedrock/fees";
import { createFxRatesWorker, createFxService } from "@bedrock/fx";
import type { Logger } from "@bedrock/kernel";
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
];

export function registerApplicationWorkers(deps: WorkerModuleDeps) {
  const { registry, workers } = createWorkerRegistry();
  for (const module of APPLICATION_MODULES) {
    module.registerWorkers?.(registry, deps);
  }
  return workers;
}
