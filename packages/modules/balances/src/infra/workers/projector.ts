import type {
  BedrockWorker,
  WorkerRunContext,
  WorkerRunResult,
} from "@bedrock/platform/worker-runtime";

import { createRunProjectorPassHandler } from "../../application/projection/commands/run-projector-pass";
import { createBalancesWorkerContext } from "../../application/shared/context";
import type {
  BalancesWorkerOperationContext,
  BalancesWorkerOperationGuard,
} from "../../domain/projection";
import { createDrizzleBalancesProjectionRepository } from "../drizzle/repos/projector-repository";

interface BalancesProjectorWorkerDefinitionDeps {
  id?: string;
  intervalMs?: number;
  db: import("@bedrock/platform/persistence").Database;
  logger?: import("@bedrock/platform/observability/logger").Logger;
  beforeOperation?: BalancesWorkerOperationGuard;
  batchSize?: number;
}

export function createBalancesProjectorWorkerDefinition(
  deps: BalancesProjectorWorkerDefinitionDeps,
): BedrockWorker {
  const context = createBalancesWorkerContext({
    db: deps.db,
    logger: deps.logger,
    createProjectionRepository: createDrizzleBalancesProjectionRepository,
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
