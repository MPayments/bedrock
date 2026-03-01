import "./env";

import { createCurrenciesService } from "@bedrock/currencies";
import { db } from "@bedrock/db/client";
import { createFeesService } from "@bedrock/fees";
import { createFxRatesWorker, createFxService } from "@bedrock/fx";
import { createConsoleLogger } from "@bedrock/kernel";
import {
  BEDROCK_MODULE_MANIFESTS,
  createModuleRuntimeService,
} from "@bedrock/module-runtime";

import { env } from "./env";
import { installShutdownHandlers, runLoop } from "./run-loop";

const logger = createConsoleLogger({ app: "bedrock-workers", worker: "fx-rates" });
const moduleRuntime = createModuleRuntimeService({
  db,
  logger,
  manifests: BEDROCK_MODULE_MANIFESTS,
});
await moduleRuntime.startBackgroundSync();
const currenciesService = createCurrenciesService({ db, logger });
const feesService = createFeesService({ db, logger, currenciesService });
const fxService = createFxService({ db, logger, feesService, currenciesService });
const guardedWorker = createFxRatesWorker({
  fxService,
  logger,
  beforeSourceSync: () =>
    moduleRuntime.isModuleEnabled({
      moduleId: "fx-rates",
    }),
});

const { promise, stop } = runLoop(
  "fx-rates",
  async () => {
    const enabled = await moduleRuntime.isModuleEnabled({ moduleId: "fx-rates" });
    if (!enabled) {
      return 0;
    }
    return guardedWorker.processOnce();
  },
  {
    intervalMs: env.FX_RATES_WORKER_INTERVAL_MS,
  },
);

installShutdownHandlers(() => {
  stop();
  void moduleRuntime.stopBackgroundSync();
});
await promise;
await moduleRuntime.stopBackgroundSync();
process.exit(0);
