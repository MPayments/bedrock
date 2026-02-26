import "./env";

import { db } from "@bedrock/db/client";
import { createLedgerWorker, createTbClient } from "@bedrock/ledger";

import { env } from "./env";
import { installShutdownHandlers, runLoop } from "./run-loop";

const tb = createTbClient(env.TB_CLUSTER_ID, env.TB_ADDRESS);
const worker = createLedgerWorker({ db, tb });

const { promise, stop } = runLoop("ledger", () => worker.processOnce(), {
  intervalMs: env.LEDGER_WORKER_INTERVAL_MS,
});

installShutdownHandlers(stop);
await promise;
process.exit(0);
