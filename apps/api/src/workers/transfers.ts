import { db } from "@bedrock/db/client";
import { createConsoleLogger } from "@bedrock/kernel";
import { createTransfersWorker } from "@bedrock/transfers";

import "../load-env";

const logger = createConsoleLogger({ app: "bedrock-api", worker: "transfers" });
const worker = createTransfersWorker({
  db,
  logger,
});

const intervalMs = Number(process.env.TRANSFERS_WORKER_INTERVAL_MS ?? 30_000);
let stopped = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});

async function main() {
  logger.info("Transfers worker started", { intervalMs });

  while (!stopped) {
    try {
      const processed = await worker.processOnce();
      logger.debug("Transfers worker tick", { processed });
    } catch (error) {
      logger.error("Transfers worker tick failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await sleep(intervalMs);
  }

  logger.info("Transfers worker stopped");
}

void main();
