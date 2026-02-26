import "./env";

import { createCurrenciesService } from "@bedrock/currencies";
import { db } from "@bedrock/db/client";
import { createFeesService } from "@bedrock/fees";
import { createFxRatesWorker, createFxService } from "@bedrock/fx";
import { createConsoleLogger } from "@bedrock/kernel";

import { env } from "./env";
import { installShutdownHandlers, runLoop } from "./run-loop";

const logger = createConsoleLogger({ app: "bedrock-workers", worker: "fx-rates" });
const currenciesService = createCurrenciesService({ db, logger });
const feesService = createFeesService({ db, logger, currenciesService });
const fxService = createFxService({ db, logger, feesService, currenciesService });
const worker = createFxRatesWorker({ fxService, logger });

const { promise, stop } = runLoop("fx-rates", () => worker.processOnce(), {
  intervalMs: env.FX_RATES_WORKER_INTERVAL_MS,
});

installShutdownHandlers(stop);
await promise;
process.exit(0);
