import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateCalculationCommand } from "./commands/create-calculation";
import { DeleteCalculationCommand } from "./commands/delete-calculation";
import type { CalculationReads } from "./ports/calculation.reads";
import type { CalculationsCommandUnitOfWork } from "./ports/calculations.uow";
import { FindCalculationByIdQuery } from "./queries/find-calculation-by-id";
import { ListCalculationsQuery } from "./queries/list-calculations";

export interface CalculationsServiceDeps {
  runtime: ModuleRuntime;
  commandUow: CalculationsCommandUnitOfWork;
  reads: CalculationReads;
}

export function createCalculationsService(deps: CalculationsServiceDeps) {
  const createCalculation = new CreateCalculationCommand(
    deps.runtime,
    deps.commandUow,
  );
  const deleteCalculation = new DeleteCalculationCommand(
    deps.runtime,
    deps.commandUow,
  );
  const findById = new FindCalculationByIdQuery(deps.reads);
  const listCalculations = new ListCalculationsQuery(deps.reads);

  return {
    commands: {
      create: createCalculation.execute.bind(createCalculation),
      delete: deleteCalculation.execute.bind(deleteCalculation),
    },
    queries: {
      findById: findById.execute.bind(findById),
      list: listCalculations.execute.bind(listCalculations),
      findByApplicationId: deps.reads.findByApplicationId.bind(deps.reads),
      findLatestByApplicationId:
        deps.reads.findLatestByApplicationId.bind(deps.reads),
    },
  };
}

export type CalculationsService = ReturnType<
  typeof createCalculationsService
>;
