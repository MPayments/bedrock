import "./env";

import { db } from "@bedrock/db/client";
import { createLedgerWorker, createTbClient } from "@bedrock/platform/ledger";
import {
  BEDROCK_COMPONENT_MANIFESTS,
  createComponentRuntimeService,
} from "@bedrock/platform/component-runtime";

import { env } from "./env";
import { isComponentEnabledForBooks } from "./modules/runtime-guard";
import { installShutdownHandlers, runLoop } from "./run-loop";

const componentRuntime = createComponentRuntimeService({
  db,
  manifests: BEDROCK_COMPONENT_MANIFESTS,
});
await componentRuntime.startBackgroundSync();
const tb = createTbClient(env.TB_CLUSTER_ID, env.TB_ADDRESS);
const worker = createLedgerWorker({
  db,
  tb,
  beforeJob: ({ bookIds }) =>
    isComponentEnabledForBooks({
      componentRuntime,
      componentId: "ledger",
      bookIds,
    }),
});

const { promise, stop } = runLoop(
  "ledger",
  async () => {
    const enabled = await componentRuntime.isComponentEnabled({ componentId: "ledger" });
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
  void componentRuntime.stopBackgroundSync();
});
await promise;
await componentRuntime.stopBackgroundSync();
process.exit(0);
