import "./env";

import { db } from "@bedrock/db/client";
import { createTreasuryWorker } from "@bedrock/treasury";

import { env } from "./env";
import { installShutdownHandlers, runLoop } from "./run-loop";

const worker = createTreasuryWorker({ db });

const { promise, stop } = runLoop("treasury", () => worker.processOnce(), {
  intervalMs: env.TREASURY_WORKER_INTERVAL_MS,
});

installShutdownHandlers(stop);
await promise;
process.exit(0);
