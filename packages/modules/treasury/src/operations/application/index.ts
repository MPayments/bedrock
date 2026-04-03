import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateOrGetPlannedTreasuryOperationCommand } from "./commands/create-or-get-planned-operation";
import type { TreasuryOperationsRepository } from "./ports/operations.repository";
import { GetTreasuryOperationByIdQuery } from "./queries/get-operation-by-id";
import { ListTreasuryOperationsQuery } from "./queries/list-operations";

export interface TreasuryOperationsServiceDeps {
  operationsRepository: TreasuryOperationsRepository;
  runtime: ModuleRuntime;
}

export function createTreasuryOperationsService(
  deps: TreasuryOperationsServiceDeps,
) {
  const createOrGetPlannedOperation =
    new CreateOrGetPlannedTreasuryOperationCommand(deps.operationsRepository);
  const getOperationById = new GetTreasuryOperationByIdQuery(
    deps.operationsRepository,
  );
  const listOperations = new ListTreasuryOperationsQuery(
    deps.operationsRepository,
  );

  return {
    commands: {
      createOrGetPlanned:
        createOrGetPlannedOperation.execute.bind(createOrGetPlannedOperation),
    },
    queries: {
      findById: getOperationById.execute.bind(getOperationById),
      list: listOperations.execute.bind(listOperations),
    },
  };
}

export type TreasuryOperationsService = ReturnType<
  typeof createTreasuryOperationsService
>;
