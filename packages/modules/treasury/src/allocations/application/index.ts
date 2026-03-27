import type { TreasuryCoreServiceDeps } from "../../shared/application/core-context";
import { createTreasuryCoreServiceContext } from "../../shared/application/core-context";
import { AllocateExecutionCommand } from "./commands/allocate-execution";

export function createTreasuryAllocationsService(
  deps: TreasuryCoreServiceDeps,
) {
  const context = createTreasuryCoreServiceContext(deps);
  const allocateExecution = new AllocateExecutionCommand(context);

  return {
    commands: {
      allocateExecution: allocateExecution.execute.bind(allocateExecution),
    },
  };
}

export type TreasuryAllocationsService = ReturnType<
  typeof createTreasuryAllocationsService
>;
