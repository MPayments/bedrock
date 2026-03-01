import "./env";

import { createCurrenciesService } from "@bedrock/currencies";
import { db } from "@bedrock/db/client";
import { createFeesService } from "@bedrock/fees";
import { createFxRatesWorker, createFxService } from "@bedrock/fx";
import { createConsoleLogger } from "@bedrock/kernel";
import {
  BEDROCK_COMPONENT_MANIFESTS,
  createComponentRuntimeService,
} from "@bedrock/component-runtime";

import { env } from "./env";
import { installShutdownHandlers, runLoop } from "./run-loop";

const logger = createConsoleLogger({ app: "bedrock-workers", worker: "fx-rates" });
const componentRuntime = createComponentRuntimeService({
  db,
  logger,
  manifests: BEDROCK_COMPONENT_MANIFESTS,
});
await componentRuntime.startBackgroundSync();
const currenciesService = createCurrenciesService({ db, logger });
const feesService = createFeesService({ db, logger, currenciesService });
const fxService = createFxService({ db, logger, feesService, currenciesService });
const guardedWorker = createFxRatesWorker({
  fxService,
  logger,
  beforeSourceSync: () =>
    componentRuntime.isComponentEnabled({
      componentId: "fx-rates",
    }),
});

const { promise, stop } = runLoop(
  "fx-rates",
  async () => {
    const enabled = await componentRuntime.isComponentEnabled({ componentId: "fx-rates" });
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
  void componentRuntime.stopBackgroundSync();
});
await promise;
await componentRuntime.stopBackgroundSync();
process.exit(0);
