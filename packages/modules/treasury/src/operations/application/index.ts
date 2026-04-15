import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateOrGetPlannedTreasuryOperationCommand } from "./commands/create-or-get-planned-operation";
import { RecordTreasuryOperationFactCommand } from "./commands/record-operation-fact";
import type {
  TreasuryOperationFactsRepository,
  TreasuryOperationsRepository,
} from "./ports/operations.repository";
import { GetTreasuryOperationByIdQuery } from "./queries/get-operation-by-id";
import { ListTreasuryOperationFactsQuery } from "./queries/list-operation-facts";
import { ListTreasuryOperationsQuery } from "./queries/list-operations";

export interface TreasuryOperationsServiceDeps {
  factsRepository: TreasuryOperationFactsRepository;
  operationsRepository: TreasuryOperationsRepository;
  runtime: ModuleRuntime;
}

export function createTreasuryOperationsService(
  deps: TreasuryOperationsServiceDeps,
) {
  const createOrGetPlannedOperation =
    new CreateOrGetPlannedTreasuryOperationCommand(deps.operationsRepository);
  const recordOperationFact = new RecordTreasuryOperationFactCommand(
    deps.factsRepository,
    deps.operationsRepository,
    deps.runtime.generateUuid,
    deps.runtime.now,
  );
  const getOperationById = new GetTreasuryOperationByIdQuery(
    deps.operationsRepository,
  );
  const listOperations = new ListTreasuryOperationsQuery(
    deps.operationsRepository,
  );
  const listOperationFacts = new ListTreasuryOperationFactsQuery(
    deps.factsRepository,
  );

  return {
    commands: {
      createOrGetPlanned:
        createOrGetPlannedOperation.execute.bind(createOrGetPlannedOperation),
      recordActualFact:
        recordOperationFact.execute.bind(recordOperationFact),
    },
    queries: {
      findById: getOperationById.execute.bind(getOperationById),
      listFacts: listOperationFacts.execute.bind(listOperationFacts),
      list: listOperations.execute.bind(listOperations),
    },
  };
}

export type TreasuryOperationsService = ReturnType<
  typeof createTreasuryOperationsService
>;
