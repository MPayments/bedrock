import "./env";

import { db } from "@bedrock/db/client";
import { createConsoleLogger } from "@bedrock/kernel";
import { createTransfersWorker } from "@bedrock/transfers";

import { env } from "./env";
import { installShutdownHandlers, runLoop } from "./run-loop";

const logger = createConsoleLogger({ app: "bedrock-workers", worker: "transfers" });
const worker = createTransfersWorker({ db, logger });

const { promise, stop } = runLoop("transfers", () => worker.processOnce(), {
  intervalMs: env.TRANSFERS_WORKER_INTERVAL_MS,
});

installShutdownHandlers(stop);
await promise;
process.exit(0);
