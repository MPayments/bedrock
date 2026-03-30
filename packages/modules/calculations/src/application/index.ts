import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { ModuleRuntime } from "@bedrock/shared/core";

import { ArchiveCalculationCommand } from "./commands/archive-calculation";
import { CreateCalculationCommand } from "./commands/create-calculation";
import { CreateCalculationForApplicationCommand } from "./commands/create-calculation-for-application";
import type { CalculationReads } from "./ports/calculation.reads";
import type { CalculationsCommandUnitOfWork } from "./ports/calculations.uow";
import type { CalculationReferencesPort } from "./ports/references.port";
import { FindCalculationApplicationIdQuery } from "./queries/find-calculation-application-id";
import { FindCalculationByIdQuery } from "./queries/find-calculation-by-id";
import { FindLatestCalculationByApplicationIdQuery } from "./queries/find-latest-calculation-by-application-id";
import { ListCalculationsQuery } from "./queries/list-calculations";
import { ListCalculationsByApplicationIdQuery } from "./queries/list-calculations-by-application-id";

export interface CalculationsServiceDeps {
  commandUow: CalculationsCommandUnitOfWork;
  idempotency: IdempotencyPort;
  reads: CalculationReads;
  references: CalculationReferencesPort;
  runtime: ModuleRuntime;
}

export function createCalculationsService(deps: CalculationsServiceDeps) {
  const createCalculation = new CreateCalculationCommand(
    deps.runtime,
    deps.commandUow,
    deps.idempotency,
    deps.references,
  );
  const createCalculationForApplication = new CreateCalculationForApplicationCommand(
    deps.runtime,
    deps.commandUow,
    deps.idempotency,
    deps.references,
  );
  const archiveCalculation = new ArchiveCalculationCommand(
    deps.runtime,
    deps.commandUow,
  );
  const findCalculationApplicationId = new FindCalculationApplicationIdQuery(
    deps.reads,
  );
  const findCalculationById = new FindCalculationByIdQuery(deps.reads);
  const findLatestByApplicationId = new FindLatestCalculationByApplicationIdQuery(
    deps.reads,
  );
  const listCalculations = new ListCalculationsQuery(deps.reads);
  const listByApplicationId = new ListCalculationsByApplicationIdQuery(
    deps.reads,
  );

  return {
    commands: {
      archive: archiveCalculation.execute.bind(archiveCalculation),
      create: createCalculation.execute.bind(createCalculation),
      createForApplication:
        createCalculationForApplication.execute.bind(
          createCalculationForApplication,
        ),
    },
    queries: {
      findApplicationId:
        findCalculationApplicationId.execute.bind(findCalculationApplicationId),
      findById: findCalculationById.execute.bind(findCalculationById),
      findLatestByApplicationId:
        findLatestByApplicationId.execute.bind(findLatestByApplicationId),
      list: listCalculations.execute.bind(listCalculations),
      listByApplicationId: listByApplicationId.execute.bind(listByApplicationId),
    },
  };
}

export type CalculationsService = ReturnType<typeof createCalculationsService>;
