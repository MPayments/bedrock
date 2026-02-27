import "./env";

import { db } from "@bedrock/db/client";
import { createConsoleLogger } from "@bedrock/kernel";
import { createLedgerWorker, createTbClient } from "@bedrock/ledger";

import { env } from "./env";
import { registerApplicationWorkers } from "./modules/registry";
import { installShutdownHandlers, runLoop } from "./run-loop";

const logger = createConsoleLogger({ app: "bedrock-workers" });

// -- Ledger (outbox -> TigerBeetle) --
const tb = createTbClient(env.TB_CLUSTER_ID, env.TB_ADDRESS);
const ledgerWorker = createLedgerWorker({ db, tb });

const applicationWorkers = registerApplicationWorkers({ db, logger, env });

// -- Start all loops --
const loops = [
  runLoop("ledger", () => ledgerWorker.processOnce(), {
    intervalMs: env.LEDGER_WORKER_INTERVAL_MS,
  }),
  ...applicationWorkers.map((worker) =>
    runLoop(worker.id, () => worker.processOnce(), {
      intervalMs: worker.intervalMs,
    }),
  ),
];

installShutdownHandlers(() => {
  for (const loop of loops) loop.stop();
});

logger.info("All workers started");
await Promise.all(loops.map((loop) => loop.promise));
logger.info("All workers stopped");
process.exit(0);
