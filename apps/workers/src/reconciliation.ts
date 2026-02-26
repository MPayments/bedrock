import "./env";

import { db } from "@bedrock/db/client";
import { createConsoleLogger } from "@bedrock/kernel";
import { createTreasuryReconciliationWorker } from "@bedrock/treasury";

import { env } from "./env";
import { installShutdownHandlers, runLoop } from "./run-loop";

const logger = createConsoleLogger({ app: "bedrock-workers", worker: "reconciliation" });
const worker = createTreasuryReconciliationWorker({ db, logger });

const { promise, stop } = runLoop(
  "reconciliation",
  () => worker.processOnce(),
  { intervalMs: env.RECONCILIATION_WORKER_INTERVAL_MS },
);

installShutdownHandlers(stop);
await promise;
process.exit(0);
