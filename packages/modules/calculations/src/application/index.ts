import type { ModuleRuntime } from "@bedrock/shared/core";

import { ArchiveCalculationCommand } from "./commands/archive-calculation";
import { CreateCalculationCommand } from "./commands/create-calculation";
import type { CalculationReads } from "./ports/calculation.reads";
import type { CalculationsCommandUnitOfWork } from "./ports/calculations.uow";
import type { CalculationReferencesPort } from "./ports/references.port";
import { FindCalculationByIdQuery } from "./queries/find-calculation-by-id";
import { ListCalculationsQuery } from "./queries/list-calculations";

export interface CalculationsServiceDeps {
  commandUow: CalculationsCommandUnitOfWork;
  reads: CalculationReads;
  references: CalculationReferencesPort;
  runtime: ModuleRuntime;
}

export function createCalculationsService(deps: CalculationsServiceDeps) {
  const createCalculation = new CreateCalculationCommand(
    deps.runtime,
    deps.commandUow,
    deps.references,
  );
  const archiveCalculation = new ArchiveCalculationCommand(
    deps.runtime,
    deps.commandUow,
  );
  const findCalculationById = new FindCalculationByIdQuery(deps.reads);
  const listCalculations = new ListCalculationsQuery(deps.reads);

  return {
    commands: {
      archive: archiveCalculation.execute.bind(archiveCalculation),
      create: createCalculation.execute.bind(createCalculation),
    },
    queries: {
      findById: findCalculationById.execute.bind(findCalculationById),
      list: listCalculations.execute.bind(listCalculations),
    },
  };
}

export type CalculationsService = ReturnType<typeof createCalculationsService>;
