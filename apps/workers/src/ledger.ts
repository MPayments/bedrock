import "./env";

import { db } from "@bedrock/db/client";
import { createLedgerWorker, createTbClient } from "@bedrock/ledger";
import {
  BEDROCK_MODULE_MANIFESTS,
  createModuleRuntimeService,
} from "@bedrock/module-runtime";

import { env } from "./env";
import { isModuleEnabledForBooks } from "./modules/runtime-guard";
import { installShutdownHandlers, runLoop } from "./run-loop";

const moduleRuntime = createModuleRuntimeService({
  db,
  manifests: BEDROCK_MODULE_MANIFESTS,
});
await moduleRuntime.startBackgroundSync();
const tb = createTbClient(env.TB_CLUSTER_ID, env.TB_ADDRESS);
const worker = createLedgerWorker({
  db,
  tb,
  beforeJob: ({ bookIds }) =>
    isModuleEnabledForBooks({
      moduleRuntime,
      moduleId: "ledger",
      bookIds,
    }),
});

const { promise, stop } = runLoop(
  "ledger",
  async () => {
    const enabled = await moduleRuntime.isModuleEnabled({ moduleId: "ledger" });
    if (!enabled) {
      return 0;
    }
    return worker.processOnce();
  },
  {
    intervalMs: env.LEDGER_WORKER_INTERVAL_MS,
  },
);

installShutdownHandlers(() => {
  stop();
  void moduleRuntime.stopBackgroundSync();
});
await promise;
await moduleRuntime.stopBackgroundSync();
process.exit(0);
