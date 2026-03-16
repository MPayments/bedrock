import type { Logger } from "@bedrock/platform/observability/logger";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import type {
  BedrockWorker,
  WorkerRunContext,
  WorkerRunResult,
} from "@bedrock/platform/worker-runtime";

import { createRunProjectorPassHandler } from "../../application/projection/commands/run-projector-pass";
import { createBalancesWorkerContext } from "../../application/shared/context";
import type { BalancesProjectionTransactionsPort } from "../../application/shared/external-ports";
import type {
  BalancesWorkerOperationContext,
  BalancesWorkerOperationGuard,
} from "../../domain/projection";
import { createDrizzleBalancesProjectionRepository } from "../drizzle/repos/projector-repository";

interface BalancesProjectorWorkerDefinitionDeps {
  id?: string;
  intervalMs?: number;
  db: Database;
  logger?: Logger;
  beforeOperation?: BalancesWorkerOperationGuard;
  batchSize?: number;
}

function createBalancesProjectionTransactions(input: {
  db: Database;
}): BalancesProjectionTransactionsPort {
  return {
    async withTransaction(run) {
      return input.db.transaction(async (tx: Transaction) =>
        run({
          projectionRepository: createDrizzleBalancesProjectionRepository(tx),
        }),
      );
    },
  };
}

export function createBalancesProjectorWorkerDefinition(
  deps: BalancesProjectorWorkerDefinitionDeps,
): BedrockWorker {
  const context = createBalancesWorkerContext({
    logger: deps.logger,
    transactions: createBalancesProjectionTransactions({ db: deps.db }),
  });
  const runPass = createRunProjectorPassHandler({
    context,
    batchSize: deps.batchSize,
    beforeOperation: deps.beforeOperation,
  });

  async function runOnce(_ctx: WorkerRunContext): Promise<WorkerRunResult> {
    const processed = await runPass();
    return { processed };
  }

  return {
    id: deps.id ?? "balances",
    intervalMs: deps.intervalMs ?? 5_000,
    runOnce,
  };
}

export type { BalancesWorkerOperationContext };
