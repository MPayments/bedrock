import { createCurrenciesService } from "@bedrock/currencies";
import type { Database } from "@bedrock/db";
import { createFeesService } from "@bedrock/fees";
import { createFxRatesWorker, createFxService } from "@bedrock/fx";
import type { Logger } from "@bedrock/kernel";
import { createTransfersWorker } from "@bedrock/transfers";
import {
  createTreasuryReconciliationWorker,
  createTreasuryWorker,
} from "@bedrock/treasury";

import type { env } from "../env";

export interface RegisteredWorker {
  id: string;
  intervalMs: number;
  processOnce: () => Promise<unknown>;
}

export interface WorkerRegistry {
  register: (worker: RegisteredWorker) => void;
}

export interface WorkerModuleDeps {
  db: Database;
  logger: Logger;
  env: typeof env;
}

export interface ApplicationModule {
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
    id: "transfers",
    registerWorkers: (registry, deps) => {
      const worker = createTransfersWorker({ db: deps.db, logger: deps.logger });
      registry.register({
        id: "transfers",
        intervalMs: deps.env.TRANSFERS_WORKER_INTERVAL_MS,
        processOnce: () => worker.processOnce(),
      });
    },
  },
  {
    id: "treasury",
    registerWorkers: (registry, deps) => {
      const worker = createTreasuryWorker({ db: deps.db });
      const reconciliationWorker = createTreasuryReconciliationWorker({
        db: deps.db,
        logger: deps.logger,
      });
      registry.register({
        id: "treasury",
        intervalMs: deps.env.TREASURY_WORKER_INTERVAL_MS,
        processOnce: () => worker.processOnce(),
      });
      registry.register({
        id: "reconciliation",
        intervalMs: deps.env.RECONCILIATION_WORKER_INTERVAL_MS,
        processOnce: () => reconciliationWorker.processOnce(),
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
];

export function registerApplicationWorkers(deps: WorkerModuleDeps) {
  const { registry, workers } = createWorkerRegistry();
  for (const module of APPLICATION_MODULES) {
    module.registerWorkers?.(registry, deps);
  }
  return workers;
}

export function listApplicationModules(): ApplicationModule[] {
  return APPLICATION_MODULES;
}
