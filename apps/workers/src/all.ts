import "./env";

import { createCurrenciesService } from "@bedrock/currencies";
import { db } from "@bedrock/db/client";
import { createFeesService } from "@bedrock/fees";
import { createFxRatesWorker, createFxService } from "@bedrock/fx";
import { createConsoleLogger } from "@bedrock/kernel";
import { createLedgerWorker, createTbClient } from "@bedrock/ledger";
import { createTransfersWorker } from "@bedrock/transfers";
import {
  createTreasuryReconciliationWorker,
  createTreasuryWorker,
} from "@bedrock/treasury";

import { env } from "./env";
import { installShutdownHandlers, runLoop } from "./run-loop";

const logger = createConsoleLogger({ app: "bedrock-workers" });

// -- Ledger (outbox -> TigerBeetle) --
const tb = createTbClient(env.TB_CLUSTER_ID, env.TB_ADDRESS);
const ledgerWorker = createLedgerWorker({ db, tb });

// -- Transfers finalization --
const transfersWorker = createTransfersWorker({ db, logger });

// -- Treasury finalization --
const treasuryWorker = createTreasuryWorker({ db });

// -- Treasury reconciliation --
const reconciliationWorker = createTreasuryReconciliationWorker({ db, logger });

// -- FX rates sync --
const currenciesService = createCurrenciesService({ db, logger });
const feesService = createFeesService({ db, logger, currenciesService });
const fxService = createFxService({
  db,
  logger,
  feesService,
  currenciesService,
});
const fxRatesWorker = createFxRatesWorker({ fxService, logger });

// -- Start all loops --
const loops = [
  runLoop("ledger", () => ledgerWorker.processOnce(), {
    intervalMs: env.LEDGER_WORKER_INTERVAL_MS,
  }),
  runLoop("transfers", () => transfersWorker.processOnce(), {
    intervalMs: env.TRANSFERS_WORKER_INTERVAL_MS,
  }),
  runLoop("treasury", () => treasuryWorker.processOnce(), {
    intervalMs: env.TREASURY_WORKER_INTERVAL_MS,
  }),
  runLoop("reconciliation", () => reconciliationWorker.processOnce(), {
    intervalMs: env.RECONCILIATION_WORKER_INTERVAL_MS,
  }),
  runLoop("fx-rates", () => fxRatesWorker.processOnce(), {
    intervalMs: env.FX_RATES_WORKER_INTERVAL_MS,
  }),
];

installShutdownHandlers(() => {
  for (const l of loops) l.stop();
});

logger.info("All workers started");
await Promise.all(loops.map((l) => l.promise));
logger.info("All workers stopped");
process.exit(0);
