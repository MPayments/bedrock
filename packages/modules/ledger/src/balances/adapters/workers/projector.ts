import type { Logger } from "@bedrock/platform/observability/logger";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import type {
  BedrockWorker,
  WorkerRunContext,
  WorkerRunResult,
} from "@bedrock/platform/worker-runtime";

import { RunProjectorPassCommand } from "../../application/projection/commands";
import { createBalancesWorkerContext } from "../../application/shared/context";
import type { BalancesProjectionTransactionsPort } from "../../application/shared/external-ports";
import type {
  BalancesWorkerOperationContext,
  BalancesWorkerOperationGuard,
} from "../../domain/projection";
import { DrizzleBalancesProjectionRepository } from "../drizzle/projection.repository";

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
          projectionRepository: new DrizzleBalancesProjectionRepository(tx),
        }),
      );
    },
  };
}

export function createBalancesProjectorWorkerDefinition(
  deps: BalancesProjectorWorkerDefinitionDeps,
): BedrockWorker {
  const context = createBalancesWorkerContext({
    transactions: createBalancesProjectionTransactions({ db: deps.db }),
    ...(deps.logger ? { logger: deps.logger } : {}),
  });
  const runPass = new RunProjectorPassCommand(context, {
    ...(deps.batchSize === undefined ? {} : { batchSize: deps.batchSize }),
    ...(deps.beforeOperation
      ? { beforeOperation: deps.beforeOperation }
      : {}),
  });

  async function runOnce(_ctx: WorkerRunContext): Promise<WorkerRunResult> {
    const processed = await runPass.execute();
    return { processed };
  }

  return {
    id: deps.id ?? "balances",
    intervalMs: deps.intervalMs ?? 5_000,
    runOnce,
  };
}

export type { BalancesWorkerOperationContext };
